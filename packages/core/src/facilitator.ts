import {
  createPublicClient,
  type Hex,
  http,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { base, mainnet } from 'viem/chains';
import { coreEnv } from './env.js';
import { FacilitatorError, SettlementError, TimeoutError } from './errors.js';
import { type FetchLike, fetchWithTimeout, readJson } from './http.js';
import { settleResultSchema, verifyResultSchema } from './schemas.js';
import { CHAIN_ID_BASE, CHAIN_ID_ETHEREUM } from './tokens.js';
import type { SettleParams, SettleResult, VerifyParams, VerifyResult } from './types.js';

export const FACILITATOR_HEALTH_TIMEOUT_MS = 2_000;
export const SETTLEMENT_TIMEOUT_MS = 30_000;
export const SETTLEMENT_POLL_INTERVAL_MS = 2_000;

export interface FacilitatorOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  apiKey?: string;
  /** Overrides `FACILITATOR_URL`. */
  primaryUrl?: string;
  /** Overrides `FACILITATOR_FALLBACK_URL`. */
  fallbackUrl?: string;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

async function isHealthy(url: string, options: FacilitatorOptions): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${trimTrailingSlash(url)}/health`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      {
        timeoutMs: options.timeoutMs ?? FACILITATOR_HEALTH_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      },
    );
    // Facilitators that do not expose /health still answer with 4xx rather than
    // 5xx, which is good enough to prove the host is reachable.
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Resolves the facilitator to use, health-checking the primary with a 2s budget
 * and failing over to `FACILITATOR_FALLBACK_URL` when it is unhealthy (FR-3).
 */
export async function getFacilitatorUrl(options: FacilitatorOptions = {}): Promise<string> {
  const primary = trimTrailingSlash(options.primaryUrl ?? coreEnv.facilitatorUrl);
  if (await isHealthy(primary, options)) return primary;

  const fallback = options.fallbackUrl ?? coreEnv.facilitatorFallbackUrl;
  if (!fallback) {
    throw new FacilitatorError('Primary facilitator is unhealthy and no fallback is configured', {
      details: { primary },
    });
  }

  const normalizedFallback = trimTrailingSlash(fallback);
  if (await isHealthy(normalizedFallback, options)) return normalizedFallback;

  throw new FacilitatorError('No healthy facilitator available', {
    details: { primary, fallback: normalizedFallback },
  });
}

function headersFor(options: FacilitatorOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
  return headers;
}

async function resolveBaseUrl(
  explicit: string | undefined,
  options: FacilitatorOptions,
): Promise<string> {
  return explicit ? trimTrailingSlash(explicit) : getFacilitatorUrl(options);
}

/** POST /verify — asks the facilitator whether an authorization would settle. */
export async function verifyPayment(
  params: VerifyParams,
  options: FacilitatorOptions = {},
): Promise<VerifyResult> {
  const baseUrl = await resolveBaseUrl(params.facilitatorUrl, options);
  const response = await fetchWithTimeout(
    `${baseUrl}/verify`,
    {
      method: 'POST',
      headers: headersFor({ ...options, apiKey: params.apiKey ?? options.apiKey }),
      body: JSON.stringify({
        x402Version: params.paymentPayload.x402Version,
        paymentPayload: params.paymentPayload,
        paymentRequirements: params.paymentRequirements,
      }),
    },
    { timeoutMs: options.timeoutMs ?? 10_000, fetchImpl: options.fetchImpl },
  );

  if (!response.ok) {
    throw new FacilitatorError(`Facilitator /verify returned HTTP ${response.status}`, {
      details: { status: response.status, body: await response.text(), facilitator: baseUrl },
    });
  }

  const parsed = verifyResultSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new FacilitatorError('Facilitator /verify returned an unexpected payload', {
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

/** POST /settle — submits the signed authorization on-chain via the facilitator. */
export async function settlePayment(
  params: SettleParams,
  options: FacilitatorOptions = {},
): Promise<SettleResult> {
  const baseUrl = await resolveBaseUrl(params.facilitatorUrl, options);
  const response = await fetchWithTimeout(
    `${baseUrl}/settle`,
    {
      method: 'POST',
      headers: headersFor({ ...options, apiKey: params.apiKey ?? options.apiKey }),
      body: JSON.stringify({
        x402Version: params.paymentPayload.x402Version,
        paymentPayload: params.paymentPayload,
        paymentRequirements: params.paymentRequirements,
        signedAuthorization: params.paymentPayload.payload,
      }),
    },
    { timeoutMs: options.timeoutMs ?? 20_000, fetchImpl: options.fetchImpl },
  );

  const raw = await readJson<unknown>(response);

  if (!response.ok) {
    throw new SettlementError(`Facilitator /settle returned HTTP ${response.status}`, {
      details: { status: response.status, body: raw, facilitator: baseUrl },
    });
  }

  const parsed = settleResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SettlementError('Facilitator /settle returned an unexpected payload', {
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const blockNumber = data.blockNumber === undefined ? null : Number(data.blockNumber);

  return {
    success: data.success,
    txHash: data.txHash ?? data.transaction ?? null,
    blockNumber: Number.isFinite(blockNumber) ? blockNumber : null,
    network: data.network ?? null,
    payer: data.payer ?? null,
    error: data.errorReason ?? null,
    raw,
  };
}

const CHAINS = {
  [CHAIN_ID_BASE]: base,
  [CHAIN_ID_ETHEREUM]: mainnet,
} as const;

export function createChainClient(chainId: number, rpcUrl?: string): PublicClient {
  const chain = CHAINS[chainId as keyof typeof CHAINS];
  const url = rpcUrl ?? coreEnv.rpcUrl(chainId);
  if (!chain || !url) {
    throw new SettlementError(`No RPC configuration for chain ${chainId}`, {
      details: { chainId },
    });
  }
  return createPublicClient({ chain, transport: http(url) }) as PublicClient;
}

export interface WaitForSettlementOptions {
  client?: PublicClient;
  rpcUrl?: string;
  timeoutMs?: number;
  pollingIntervalMs?: number;
  confirmations?: number;
}

/** Polls for the settlement receipt, giving up after 30s with a typed timeout. */
export async function waitForSettlement(
  txHash: string,
  chainId: number,
  options: WaitForSettlementOptions = {},
): Promise<TransactionReceipt> {
  const client = options.client ?? createChainClient(chainId, options.rpcUrl);
  const timeoutMs = options.timeoutMs ?? SETTLEMENT_TIMEOUT_MS;
  try {
    return await client.waitForTransactionReceipt({
      hash: txHash as Hex,
      timeout: timeoutMs,
      pollingInterval: options.pollingIntervalMs ?? SETTLEMENT_POLL_INTERVAL_MS,
      confirmations: options.confirmations ?? 1,
    });
  } catch (error) {
    throw new TimeoutError(`Settlement ${txHash} was not confirmed within ${timeoutMs}ms`, {
      details: { txHash, chainId, timeoutMs },
      cause: error,
    });
  }
}
