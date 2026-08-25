import { z } from 'zod';
import { CACHE_KEYS, type CacheStore, getDefaultCacheStore, QUOTE_TTL_SECONDS } from './cache.js';
import { coreEnv } from './env.js';
import { QuoteError, QuoteExpiredError, SwapError, ValidationError } from './errors.js';
import { BPS_DENOMINATOR, computeFeeBreakdown, getFeeBps } from './fees.js';
import {
  buildQuery,
  DEFAULT_TIMEOUT_MS,
  type FetchLike,
  fetchWithTimeout,
  readJson,
} from './http.js';
import { quoteParamsSchema } from './schemas.js';
import { getSettlementToken, oneWholeUnit, toDexAssetAddress } from './tokens.js';
import type { BestQuote, DEXQuote, DexSource, QuoteParams, Token } from './types.js';

export const ONEINCH_BASE_URL = 'https://api.1inch.dev';
export const ZEROX_BASE_URL = 'https://api.0x.org';
export const DEFAULT_SLIPPAGE_BPS = 50;

export interface DexRequestOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** 0x `/quote` requires a taker address; omitted requests fall back to price-only data. */
  taker?: string;
}

/** Persistence seam so quotes can be logged to Postgres without `@anyx/core` depending on it. */
export interface QuotePersistence {
  save(quote: BestQuote): Promise<void>;
}

export interface GetBestQuoteOptions {
  oneInch?: DexRequestOptions;
  zeroEx?: DexRequestOptions;
  cache?: CacheStore;
  persistence?: QuotePersistence;
  ttlSeconds?: number;
  quoteId?: string;
  now?: () => number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

const oneInchQuoteResponseSchema = z
  .object({
    dstAmount: z.string().optional(),
    toAmount: z.string().optional(),
    gas: z.union([z.number(), z.string()]).optional(),
    protocols: z.unknown().optional(),
  })
  .refine((value) => value.dstAmount !== undefined || value.toAmount !== undefined, {
    message: '1inch response is missing dstAmount',
  });

const zeroExQuoteResponseSchema = z.object({
  buyAmount: z.string(),
  route: z.unknown().optional(),
  transaction: z
    .object({
      gas: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough()
    .optional(),
  gas: z.union([z.number(), z.string()]).optional(),
  priceImpact: z.union([z.number(), z.string()]).optional(),
});

function normalizeGas(value: number | string | undefined): string | null {
  if (value === undefined) return null;
  return String(value);
}

function normalizePriceImpact(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseParams(params: QuoteParams): QuoteParams {
  const result = quoteParamsSchema.safeParse(params);
  if (!result.success) {
    throw new ValidationError('Invalid quote parameters', { details: result.error.flatten() });
  }
  return result.data;
}

function probeAmount(params: QuoteParams): string {
  return params.amountIn ?? oneWholeUnit(params.inputToken);
}

function assertDifferentAssets(input: Token, output: Token): void {
  if (
    input.chainId === output.chainId &&
    (input.address ?? '').toLowerCase() === (output.address ?? '').toLowerCase()
  ) {
    throw new ValidationError('Input token is already the settlement asset; no swap is required', {
      details: { symbol: input.symbol, chainId: input.chainId },
    });
  }
}

/**
 * 1inch Fusion+ quote. Returns the USDC received for `amountIn` of the input
 * token, which the caller inverts to size the payer's spend.
 */
export async function get1inchQuote(
  params: QuoteParams,
  options: DexRequestOptions = {},
): Promise<DEXQuote> {
  const parsed = parseParams(params);
  const input: Token = parsed.inputToken;
  const output = getSettlementToken();
  assertDifferentAssets(input, output);

  const apiKey = options.apiKey ?? coreEnv.oneinchApiKey;
  if (!apiKey) {
    throw new QuoteError('1inch is not configured (ONEINCH_API_KEY missing)', {
      details: { source: '1inch' },
    });
  }

  const amountIn = probeAmount(parsed);
  const query = buildQuery({
    src: toDexAssetAddress(input),
    dst: toDexAssetAddress(output),
    amount: amountIn,
    includeProtocols: true,
    includeGas: true,
  });
  const url = `${options.baseUrl ?? ONEINCH_BASE_URL}/swap/v6.0/${parsed.chainId}/quote?${query}`;

  const response = await fetchWithTimeout(
    url,
    { method: 'GET', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
    { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, fetchImpl: options.fetchImpl },
  );

  if (!response.ok) {
    throw new QuoteError(`1inch quote failed with HTTP ${response.status}`, {
      details: { source: '1inch', status: response.status, body: await response.text() },
    });
  }

  const body = oneInchQuoteResponseSchema.safeParse(await readJson(response));
  if (!body.success) {
    throw new QuoteError('1inch returned an unexpected payload', {
      details: { source: '1inch', issues: body.error.flatten() },
    });
  }

  return {
    source: '1inch',
    amountIn,
    amountOut: (body.data.dstAmount ?? body.data.toAmount) as string,
    estimatedGas: normalizeGas(body.data.gas),
    protocols: body.data.protocols ?? null,
    priceImpact: null,
  };
}

/** 0x Swap API (Permit2) quote, same shape as {@link get1inchQuote}. */
export async function get0xQuote(
  params: QuoteParams,
  options: DexRequestOptions = {},
): Promise<DEXQuote> {
  const parsed = parseParams(params);
  const input: Token = parsed.inputToken;
  const output = getSettlementToken();
  assertDifferentAssets(input, output);

  const apiKey = options.apiKey ?? coreEnv.zeroxApiKey;
  if (!apiKey) {
    throw new QuoteError('0x is not configured (ZEROX_API_KEY missing)', {
      details: { source: '0x' },
    });
  }

  const amountIn = probeAmount(parsed);
  const query = buildQuery({
    chainId: parsed.chainId,
    sellToken: toDexAssetAddress(input),
    buyToken: toDexAssetAddress(output),
    sellAmount: amountIn,
    slippageBps: parsed.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
    taker: options.taker,
  });
  const url = `${options.baseUrl ?? ZEROX_BASE_URL}/swap/permit2/quote?${query}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        '0x-api-key': apiKey,
        '0x-chain-id': String(parsed.chainId),
        '0x-version': 'v2',
        Accept: 'application/json',
      },
    },
    { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, fetchImpl: options.fetchImpl },
  );

  if (!response.ok) {
    throw new QuoteError(`0x quote failed with HTTP ${response.status}`, {
      details: { source: '0x', status: response.status, body: await response.text() },
    });
  }

  const body = zeroExQuoteResponseSchema.safeParse(await readJson(response));
  if (!body.success) {
    throw new QuoteError('0x returned an unexpected payload', {
      details: { source: '0x', issues: body.error.flatten() },
    });
  }

  return {
    source: '0x',
    amountIn,
    amountOut: body.data.buyAmount,
    estimatedGas: normalizeGas(body.data.transaction?.gas ?? body.data.gas),
    protocols: body.data.route ?? null,
    priceImpact: normalizePriceImpact(body.data.priceImpact),
  };
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new QuoteError('DEX returned a zero output amount');
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Aggregates every configured DEX, keeps the best rate for the payer, and sizes
 * the payer's spend so the swap clears `usdcRequired` plus the AnyX spread.
 */
export async function getBestQuote(
  params: QuoteParams,
  options: GetBestQuoteOptions = {},
): Promise<BestQuote> {
  const parsed = parseParams(params);
  const input: Token = parsed.inputToken;
  const slippageBps = parsed.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const feeBps = parsed.feeBps ?? getFeeBps(input.symbol);
  const fee = computeFeeBreakdown(BigInt(parsed.usdcRequired), { feeBps });

  const shared = {
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  };
  const settled = await Promise.allSettled([
    get1inchQuote(parsed, { ...shared, ...options.oneInch }),
    get0xQuote(parsed, { ...shared, ...options.zeroEx }),
  ]);

  const sources: DexSource[] = ['1inch', '0x'];
  const successes: DEXQuote[] = [];
  const rejected: Array<{ source: DexSource; reason: string }> = [];

  settled.forEach((result, index) => {
    const source = sources[index] as DexSource;
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      rejected.push({
        source,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  if (successes.length === 0) {
    throw new QuoteError('No DEX aggregator returned a quote', { details: { rejected } });
  }

  const best = successes.reduce((winner, candidate) =>
    BigInt(candidate.amountOut) > BigInt(winner.amountOut) ? candidate : winner,
  );

  const grossUsdc = BigInt(fee.usdcGross);
  const quotedIn = BigInt(best.amountIn);
  const quotedOut = BigInt(best.amountOut);
  if (quotedOut <= 0n) {
    throw new QuoteError(`${best.source} quoted a non-positive output amount`, {
      details: { source: best.source, amountOut: best.amountOut },
    });
  }

  const baseInputAmount = ceilDiv(grossUsdc * quotedIn, quotedOut);
  const inputAmount = ceilDiv(
    baseInputAmount * (BPS_DENOMINATOR + BigInt(slippageBps)),
    BPS_DENOMINATOR,
  );

  const now = options.now?.() ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? QUOTE_TTL_SECONDS;
  const quote: BestQuote = {
    quoteId: options.quoteId ?? crypto.randomUUID(),
    endpointUrl: parsed.endpointUrl ?? null,
    inputToken: input,
    inputAmount: inputAmount.toString(),
    usdcRequired: fee.usdcRequired,
    usdcGross: fee.usdcGross,
    fee: { bps: fee.feeBps, usdc: fee.feeUsdc },
    // Slippage floor is the exact amount owed: a shortfall must fail, never
    // settle partially (roadmap safety rule 7).
    minAmountOut: fee.usdcRequired,
    slippageBps,
    route: {
      source: best.source,
      amountIn: best.amountIn,
      amountOut: best.amountOut,
      estimatedGas: best.estimatedGas,
      protocols: best.protocols,
      priceImpact: best.priceImpact,
      rejected,
    },
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1_000).toISOString(),
  };

  assertNoPartialPayment(quote);
  await cacheQuote(quote, { cache: options.cache, ttlSeconds });
  if (options.persistence) await options.persistence.save(quote);
  return quote;
}

export async function cacheQuote(
  quote: BestQuote,
  options: { cache?: CacheStore; ttlSeconds?: number } = {},
): Promise<void> {
  const store = options.cache ?? getDefaultCacheStore();
  await store.set(
    CACHE_KEYS.quote(quote.quoteId),
    JSON.stringify(quote),
    options.ttlSeconds ?? QUOTE_TTL_SECONDS,
  );
}

export async function getCachedQuote(
  quoteId: string,
  options: { cache?: CacheStore } = {},
): Promise<BestQuote | null> {
  const store = options.cache ?? getDefaultCacheStore();
  const raw = await store.get(CACHE_KEYS.quote(quoteId));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as BestQuote;
  } catch {
    await store.del(CACHE_KEYS.quote(quoteId));
    return null;
  }
}

export function isQuoteExpired(quote: BestQuote, now: number = Date.now()): boolean {
  return Date.parse(quote.expiresAt) <= now;
}

export function assertQuoteFresh(quote: BestQuote, now: number = Date.now()): void {
  if (isQuoteExpired(quote, now)) {
    throw new QuoteExpiredError(quote.quoteId, quote.expiresAt);
  }
}

/**
 * x402 payments are all-or-nothing. A quote whose slippage floor sits below the
 * amount owed could settle short, so it is rejected before it is ever used.
 */
export function assertNoPartialPayment(quote: BestQuote): void {
  if (BigInt(quote.minAmountOut) !== BigInt(quote.usdcRequired)) {
    throw new SwapError('minAmountOut must equal the required USDC; partial payments are illegal', {
      details: {
        quoteId: quote.quoteId,
        minAmountOut: quote.minAmountOut,
        usdcRequired: quote.usdcRequired,
      },
    });
  }
}

/** Enforced after every swap: a shortfall reverts instead of paying partially. */
export function assertSwapOutputSufficient(usdcReceived: bigint, usdcRequired: bigint): void {
  if (usdcReceived < usdcRequired) {
    throw new SwapError('Swap produced less USDC than the x402 payment requires', {
      details: {
        usdcReceived: usdcReceived.toString(),
        usdcRequired: usdcRequired.toString(),
        shortfall: (usdcRequired - usdcReceived).toString(),
      },
    });
  }
}
