import { randomUUID } from 'node:crypto';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';
import { ConfigMissingError, QuoteError, optionalEnv } from './errors';
import { getRedisClient } from './lib/redis';
import type { BestQuote, DEXQuote, QuoteParams, Token } from './types';

const DEFAULT_SLIPPAGE_BPS = 50;
const DEFAULT_FEE_BPS = 20;
const QUOTE_CACHE_TTL_SECONDS = 30;

/** 1inch/0x sentinel address used to represent the native gas token (ETH). */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/** USDC addresses known-good for quoting, keyed by chainId. Base + Ethereum only in Phase 1. */
const USDC_ADDRESS_BY_CHAIN: Record<number, string> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  1: '0xA0b86991c6218B36c1d19D4a2e9Eb0cE3606eB48',
};

function getUsdcAddressForChain(chainId: number): string {
  const address = USDC_ADDRESS_BY_CHAIN[chainId];
  if (!address) {
    throw new QuoteError(
      'INVALID_INPUT',
      `No USDC address configured for chainId ${chainId}. Supported: ${Object.keys(USDC_ADDRESS_BY_CHAIN).join(', ')}.`,
    );
  }
  return address;
}

const tokenSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable(),
  chainId: z.number().int(),
  decimals: z.number().int().min(0).max(36),
  coingeckoId: z.string().min(1),
  isNative: z.boolean(),
  swapPath: z.enum(['direct', 'bridge', 'lightning']),
});

export const quoteParamsSchema = z.object({
  inputToken: tokenSchema,
  usdcRequired: z.string().regex(/^\d+(\.\d+)?$/, 'usdcRequired must be a positive decimal string'),
  chainId: z.number().int().positive(),
  slippageBps: z.number().int().min(0).max(10_000).optional(),
});

/** Validates QuoteParams with zod, throwing a typed QuoteError('INVALID_INPUT', ...) on failure. */
export function validateQuoteParams(params: QuoteParams): QuoteParams {
  const result = quoteParamsSchema.safeParse(params);
  if (!result.success) {
    throw new QuoteError('INVALID_INPUT', 'Invalid quote parameters', result.error.flatten());
  }
  return result.data as QuoteParams;
}

/**
 * We probe each DEX aggregator with exactly "1 unit" of the input token (10^decimals base
 * units) to discover the current exchange rate, then getBestQuote() scales that rate linearly
 * to compute the exact input amount needed to produce `usdcRequired + fee`. This sidesteps the
 * fact that 1inch/0x quote APIs are sell-amount-based (you specify what you're selling, not
 * what you want to receive) — a standard technique for "reverse" quoting against them.
 */
function probeAmountBaseUnits(token: Token): bigint {
  return parseUnits('1', token.decimals);
}

const oneInchQuoteResponseSchema = z.object({
  dstAmount: z.string().optional(),
  toAmount: z.string().optional(),
  estimatedGas: z.union([z.string(), z.number()]).optional(),
  protocols: z.unknown().optional(),
});

/**
 * Task 1.2.1 — GET https://api.1inch.dev/swap/v6.0/{chainId}/quote
 * Returns the DEX quote for exactly 1 unit of `params.inputToken`, priced in USDC.
 * Throws ConfigMissingError (not a raw network exception) if ONEINCH_API_KEY is unset.
 */
export async function get1inchQuote(params: QuoteParams): Promise<DEXQuote> {
  validateQuoteParams(params);
  const apiKey = optionalEnv('ONEINCH_API_KEY');
  if (!apiKey) {
    throw new ConfigMissingError('ONEINCH_API_KEY', 'Set it to fetch real 1inch swap quotes.');
  }

  const { inputToken, chainId } = params;
  const src = inputToken.isNative ? NATIVE_TOKEN_ADDRESS : inputToken.address;
  const dst = getUsdcAddressForChain(chainId);
  if (!src) {
    throw new QuoteError('INVALID_INPUT', 'inputToken.address is required for non-native tokens');
  }
  const amount = probeAmountBaseUnits(inputToken).toString();

  const url = new URL(`https://api.1inch.dev/swap/v6.0/${chainId}/quote`);
  url.searchParams.set('src', src);
  url.searchParams.set('dst', dst);
  url.searchParams.set('amount', amount);
  url.searchParams.set('includeProtocols', 'true');
  url.searchParams.set('includeGas', 'true');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
  } catch (err) {
    throw new QuoteError('SWAP_FAILED', `1inch request failed: ${(err as Error).message}`, {
      provider: '1inch',
    });
  }

  if (!response.ok) {
    throw new QuoteError('SWAP_FAILED', `1inch returned HTTP ${response.status}`, {
      provider: '1inch',
      status: response.status,
    });
  }

  const json = await response.json();
  const parsed = oneInchQuoteResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new QuoteError('SWAP_FAILED', '1inch response failed validation', {
      provider: '1inch',
      issues: parsed.error.flatten(),
    });
  }

  const amountOut = parsed.data.dstAmount ?? parsed.data.toAmount;
  if (!amountOut) {
    throw new QuoteError('SWAP_FAILED', '1inch response missing dstAmount/toAmount', {
      provider: '1inch',
    });
  }

  return {
    source: '1inch',
    amountOut,
    estimatedGas: String(parsed.data.estimatedGas ?? '0'),
    protocols: parsed.data.protocols ?? null,
    priceImpact: 0,
  };
}

const zeroXQuoteResponseSchema = z.object({
  buyAmount: z.string().optional(),
  estimatedGas: z.union([z.string(), z.number()]).optional(),
  gas: z.union([z.string(), z.number()]).optional(),
  route: z.unknown().optional(),
  estimatedPriceImpact: z.union([z.string(), z.number()]).nullable().optional(),
});

/**
 * Task 1.2.2 — GET https://api.0x.org/swap/permit2/quote
 * Returns the DEX quote for exactly 1 unit of `params.inputToken`, priced in USDC.
 * Throws ConfigMissingError (not a raw network exception) if ZEROX_API_KEY is unset.
 */
export async function get0xQuote(params: QuoteParams): Promise<DEXQuote> {
  validateQuoteParams(params);
  const apiKey = optionalEnv('ZEROX_API_KEY');
  if (!apiKey) {
    throw new ConfigMissingError('ZEROX_API_KEY', 'Set it to fetch real 0x fallback quotes.');
  }

  const { inputToken, chainId } = params;
  const sellToken = inputToken.isNative ? NATIVE_TOKEN_ADDRESS : inputToken.address;
  const buyToken = getUsdcAddressForChain(chainId);
  if (!sellToken) {
    throw new QuoteError('INVALID_INPUT', 'inputToken.address is required for non-native tokens');
  }
  const sellAmount = probeAmountBaseUnits(inputToken).toString();

  const url = new URL('https://api.0x.org/swap/permit2/quote');
  url.searchParams.set('sellToken', sellToken);
  url.searchParams.set('buyToken', buyToken);
  url.searchParams.set('sellAmount', sellAmount);
  url.searchParams.set('chainId', String(chainId));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        '0x-api-key': apiKey,
        '0x-chain-id': String(chainId),
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw new QuoteError('SWAP_FAILED', `0x request failed: ${(err as Error).message}`, {
      provider: '0x',
    });
  }

  if (!response.ok) {
    throw new QuoteError('SWAP_FAILED', `0x returned HTTP ${response.status}`, {
      provider: '0x',
      status: response.status,
    });
  }

  const json = await response.json();
  const parsed = zeroXQuoteResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new QuoteError('SWAP_FAILED', '0x response failed validation', {
      provider: '0x',
      issues: parsed.error.flatten(),
    });
  }

  if (!parsed.data.buyAmount) {
    throw new QuoteError('SWAP_FAILED', '0x response missing buyAmount', { provider: '0x' });
  }

  const priceImpact = parsed.data.estimatedPriceImpact
    ? Number.parseFloat(String(parsed.data.estimatedPriceImpact))
    : 0;

  return {
    source: '0x',
    amountOut: parsed.data.buyAmount,
    estimatedGas: String(parsed.data.estimatedGas ?? parsed.data.gas ?? '0'),
    protocols: parsed.data.route ?? null,
    priceImpact: Number.isFinite(priceImpact) ? priceImpact : 0,
  };
}

function feeBpsFromEnv(): number {
  const raw = optionalEnv('FEE_BPS');
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FEE_BPS;
}

/**
 * Task 1.2.3 — Calls 1inch and 0x in parallel (Promise.allSettled), picks the best rate,
 * applies the AnyX fee on top of usdcRequired, and caches the result in Redis for 30s.
 *
 * Fee math (docs/AGENTS.md "Notes for Cursor Agents" #6): if the API costs $1.00 USDC and
 * feeBps = 20 (0.20%), the payer swaps $1.00 / (1 - 0.002) = $1.002 worth of their token;
 * AnyX keeps the $0.002 difference.
 */
export async function getBestQuote(params: QuoteParams): Promise<BestQuote> {
  const validated = validateQuoteParams(params);
  const feeBps = validated.slippageBps !== undefined ? feeBpsFromEnv() : feeBpsFromEnv();

  const [oneInchResult, zeroXResult] = await Promise.allSettled([
    get1inchQuote(validated),
    get0xQuote(validated),
  ]);

  const successes: DEXQuote[] = [];
  if (oneInchResult.status === 'fulfilled') successes.push(oneInchResult.value);
  if (zeroXResult.status === 'fulfilled') successes.push(zeroXResult.value);

  if (successes.length === 0) {
    const failures = [oneInchResult, zeroXResult]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as Error);

    const allConfigMissing = failures.every((f) => f instanceof ConfigMissingError);
    if (allConfigMissing) {
      // Surface the first missing-config error so callers can react to CONFIG_MISSING specifically.
      throw failures[0];
    }
    throw new QuoteError('ALL_PROVIDERS_FAILED', 'Both 1inch and 0x quote providers failed', {
      errors: failures.map((f) => ({ name: f.name, message: f.message })),
    });
  }

  // Best rate = highest amountOut for the same 1-unit probe (i.e. best price for the payer).
  const best = successes.reduce((a, b) => (BigInt(b.amountOut) > BigInt(a.amountOut) ? b : a));

  const usdcRequired = Number.parseFloat(validated.usdcRequired);
  const usdcWithFee = usdcRequired / (1 - feeBps / 10_000);
  const fee = usdcWithFee - usdcRequired;

  // rateHuman = USDC received per 1 unit of input token, from the winning probe quote.
  const probeUsdcHuman = Number.parseFloat(formatUnits(BigInt(best.amountOut), 6));
  if (!Number.isFinite(probeUsdcHuman) || probeUsdcHuman <= 0) {
    throw new QuoteError('SWAP_FAILED', 'Winning quote returned a non-positive rate', { best });
  }
  const inputAmountHuman = usdcWithFee / probeUsdcHuman;

  const quoteId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_CACHE_TTL_SECONDS * 1000);

  const bestQuote: BestQuote = {
    quoteId,
    inputToken: validated.inputToken,
    inputAmount: inputAmountHuman.toFixed(
      validated.inputToken.decimals > 8 ? 8 : validated.inputToken.decimals,
    ),
    usdcRequired: usdcRequired.toFixed(6),
    usdcOutput: usdcWithFee.toFixed(6),
    fee: fee.toFixed(6),
    feeBps,
    route: best,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  await cacheQuote(bestQuote).catch((err) => {
    console.warn('[quote] failed to cache quote in redis:', (err as Error).message);
  });

  return bestQuote;
}

async function cacheQuote(quote: BestQuote): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`quote:${quote.quoteId}`, JSON.stringify(quote), 'EX', QUOTE_CACHE_TTL_SECONDS);
}

/**
 * Task 1.2.4 — Redis lookup with a 30s TTL (set at write time by getBestQuote).
 * Returns null (not an error) if the quote doesn't exist or has expired.
 */
export async function getCachedQuote(quoteId: string): Promise<BestQuote | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`quote:${quoteId}`).catch((err: Error) => {
    console.warn('[quote] redis lookup failed:', err.message);
    return null;
  });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BestQuote;
  } catch {
    return null;
  }
}

export { DEFAULT_SLIPPAGE_BPS, DEFAULT_FEE_BPS, QUOTE_CACHE_TTL_SECONDS };
