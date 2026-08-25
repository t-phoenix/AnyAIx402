import { http, createPublicClient } from 'viem';
import { base, mainnet } from 'viem/chains';
import { FacilitatorError, TimeoutError, optionalEnv } from './errors';
import type {
  SettleParams,
  SettleResult,
  TransactionReceiptLike,
  VerifyParams,
  VerifyResult,
} from './types';

export const DEFAULT_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
export const KNOWN_FALLBACK_FACILITATOR_URL = 'https://x402.halowerk.com/facilitator';

const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const SETTLEMENT_POLL_INTERVAL_MS = 2_000;
const SETTLEMENT_MAX_WAIT_MS = 30_000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function isHealthy(url: string): Promise<boolean> {
  const { signal, cancel } = withTimeout(HEALTH_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(new URL('/health', url), { signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    cancel();
  }
}

/**
 * Task 1.5.3 — Returns the primary facilitator URL if it's healthy (2s timeout health check),
 * otherwise falls back to FACILITATOR_FALLBACK_URL. Synchronous callers can read the env vars
 * directly via getFacilitatorUrls(); this async variant performs the actual health probe.
 */
export function getFacilitatorUrl(): string {
  return optionalEnv('FACILITATOR_URL') ?? DEFAULT_FACILITATOR_URL;
}

export function getFallbackFacilitatorUrl(): string {
  return optionalEnv('FACILITATOR_FALLBACK_URL') ?? KNOWN_FALLBACK_FACILITATOR_URL;
}

/** Resolves the facilitator to actually use this request, health-checking the primary first. */
export async function resolveFacilitatorUrl(): Promise<string> {
  const primary = getFacilitatorUrl();
  if (await isHealthy(primary)) return primary;
  return getFallbackFacilitatorUrl();
}

/**
 * JSON.stringify replacer that serializes `bigint` values (e.g. EIP-3009 `value`,
 * `validAfter`, `validBefore`) as decimal strings — JSON has no native bigint type and
 * `JSON.stringify` throws ("Do not know how to serialize a BigInt") without this.
 */
function bigIntSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body, bigIntSafeReplacer),
    });
  } catch (err) {
    throw new FacilitatorError(
      'FACILITATOR_UNAVAILABLE',
      `Facilitator request failed: ${(err as Error).message}`,
      {
        url,
      },
    );
  }

  if (!response.ok) {
    throw new FacilitatorError(
      'FACILITATOR_UNAVAILABLE',
      `Facilitator returned HTTP ${response.status}`,
      {
        url,
        status: response.status,
      },
    );
  }

  return (await response.json()) as T;
}

/**
 * Task 1.5.1 — POST {facilitatorUrl}/verify with { paymentPayload, paymentRequirements }.
 */
export async function verifyPayment(params: VerifyParams): Promise<VerifyResult> {
  const facilitatorUrl = params.facilitatorUrl ?? (await resolveFacilitatorUrl());
  try {
    return await postJson<VerifyResult>(new URL('/verify', facilitatorUrl).toString(), {
      paymentPayload: params.paymentPayload,
      paymentRequirements: params.paymentRequirements,
    });
  } catch (err) {
    if (err instanceof FacilitatorError) {
      return { isValid: false, error: err.message };
    }
    throw err;
  }
}

/**
 * Task 1.5.2 — POST {facilitatorUrl}/settle with { signedAuthorization }.
 */
export async function settlePayment(params: SettleParams): Promise<SettleResult> {
  const facilitatorUrl = params.facilitatorUrl ?? (await resolveFacilitatorUrl());
  return postJson<SettleResult>(new URL('/settle', facilitatorUrl).toString(), {
    signedAuthorization: params.signedAuthorization,
  });
}

const CHAINS_BY_ID = { [base.id]: base, [mainnet.id]: mainnet } as const;

function rpcUrlForChain(chainId: number): string | undefined {
  if (chainId === base.id) return optionalEnv('RPC_URL_BASE');
  if (chainId === mainnet.id) return optionalEnv('RPC_URL_ETHEREUM');
  return undefined;
}

/**
 * Task 1.5.4 — Polls for a transaction receipt every 2s, up to a 30s max wait, using viem's
 * publicClient.waitForTransactionReceipt under the hood. Throws TimeoutError on expiry.
 */
export async function waitForSettlement(
  txHash: `0x${string}`,
  chainId: number,
): Promise<TransactionReceiptLike> {
  const chain = CHAINS_BY_ID[chainId as keyof typeof CHAINS_BY_ID];
  if (!chain) {
    throw new FacilitatorError(
      'SETTLEMENT_FAILED',
      `Unsupported chainId for settlement polling: ${chainId}`,
    );
  }

  const rpcUrl = rpcUrlForChain(chainId);
  const publicClient = createPublicClient({
    chain,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: SETTLEMENT_MAX_WAIT_MS,
      pollingInterval: SETTLEMENT_POLL_INTERVAL_MS,
    });

    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
    };
  } catch (err) {
    throw new TimeoutError(
      `Timed out waiting for settlement of ${txHash} after ${SETTLEMENT_MAX_WAIT_MS}ms`,
      {
        txHash,
        chainId,
        cause: (err as Error).message,
      },
    );
  }
}
