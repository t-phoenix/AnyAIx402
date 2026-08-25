import { beforeEach, describe, expect, test } from 'bun:test';
import { InMemoryCacheStore } from '../cache.js';
import {
  assertNoPartialPayment,
  assertQuoteFresh,
  assertSwapOutputSufficient,
  cacheQuote,
  DEFAULT_SLIPPAGE_BPS,
  get0xQuote,
  get1inchQuote,
  getBestQuote,
  getCachedQuote,
  isQuoteExpired,
} from '../quote.js';
import { getToken } from '../tokens.js';
import type { Token } from '../types.js';

const ETH_BASE = getToken('ETH', 8453) as Token;
const USDC_REQUIRED = '1000000';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Routes by URL so each aggregator can be made to fail independently. */
function stubFetch(routes: { oneInch?: () => Response; zeroEx?: () => Response }): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('1inch')) {
      return routes.oneInch ? routes.oneInch() : json({ dstAmount: '1002500', gas: 120_000 });
    }
    if (url.includes('0x.org')) {
      return routes.zeroEx ? routes.zeroEx() : json({ buyAmount: '1001500', gas: '130000' });
    }
    return new Response('unexpected host', { status: 500 });
  }) as unknown as typeof fetch;
}

const baseParams = {
  inputToken: ETH_BASE,
  usdcRequired: USDC_REQUIRED,
  chainId: 8453,
};

describe('individual aggregators', () => {
  test('reads the 1inch response shape', async () => {
    const quote = await get1inchQuote(baseParams, {
      apiKey: 'test',
      fetchImpl: stubFetch({}),
    });
    expect(quote.source).toBe('1inch');
    expect(quote.amountOut).toBe('1002500');
  });

  test('reads the 0x response shape', async () => {
    const quote = await get0xQuote(baseParams, {
      apiKey: 'test',
      fetchImpl: stubFetch({}),
    });
    expect(quote.source).toBe('0x');
    expect(quote.amountOut).toBe('1001500');
  });

  test('throws when an aggregator returns an error status', async () => {
    await expect(
      get1inchQuote(baseParams, {
        apiKey: 'test',
        fetchImpl: stubFetch({ oneInch: () => new Response('rate limited', { status: 429 }) }),
      }),
    ).rejects.toThrow();
  });
});

describe('getBestQuote', () => {
  test('picks the aggregator offering the most USDC', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
    });

    // 1inch quoted 1002500 against 0x's 1001500.
    expect(quote.route.source).toBe('1inch');
  });

  test('picks 0x when it is the better route', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({
        oneInch: () => json({ dstAmount: '1000100' }),
        zeroEx: () => json({ buyAmount: '1009000' }),
      }),
    });

    expect(quote.route.source).toBe('0x');
  });

  test('falls back to 0x when 1inch fails, and records why', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({ oneInch: () => new Response('down', { status: 503 }) }),
    });

    expect(quote.route.source).toBe('0x');
    expect(quote.route.rejected).toHaveLength(1);
    expect(quote.route.rejected[0]?.source).toBe('1inch');
    expect(quote.route.rejected[0]?.reason).toBeTruthy();
  });

  test('falls back to 1inch when 0x fails', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({ zeroEx: () => new Response('down', { status: 500 }) }),
    });

    expect(quote.route.source).toBe('1inch');
  });

  test('throws a typed error when both aggregators fail', async () => {
    await expect(
      getBestQuote(baseParams, {
        oneInch: { apiKey: 'a' },
        zeroEx: { apiKey: 'b' },
        fetchImpl: stubFetch({
          oneInch: () => new Response('down', { status: 503 }),
          zeroEx: () => new Response('down', { status: 503 }),
        }),
      }),
    ).rejects.toThrow();
  });

  test('applies the spread on top of the required amount', async () => {
    const quote = await getBestQuote(
      { ...baseParams, feeBps: 20 },
      { oneInch: { apiKey: 'a' }, zeroEx: { apiKey: 'b' }, fetchImpl: stubFetch({}) },
    );

    expect(quote.usdcRequired).toBe(USDC_REQUIRED);
    expect(BigInt(quote.usdcGross)).toBeGreaterThan(BigInt(quote.usdcRequired));
    expect(BigInt(quote.fee.usdc)).toBe(BigInt(quote.usdcGross) - BigInt(quote.usdcRequired));
  });

  test('sets minAmountOut to the exact required amount', async () => {
    // This is what makes a partial payment unrepresentable: the swap floor is
    // the full amount owed, so a short fill reverts rather than underpaying.
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
    });

    expect(quote.minAmountOut).toBe(quote.usdcRequired);
  });

  test('carries an expiry, and a fresh quote has not reached it', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
      ttlSeconds: 30,
    });

    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(isQuoteExpired(quote)).toBe(false);
  });

  test('defaults the slippage tolerance when none is supplied', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
    });

    expect(quote.slippageBps).toBe(DEFAULT_SLIPPAGE_BPS);
  });

  test('rejects an unsupported chain', async () => {
    await expect(
      getBestQuote(
        { ...baseParams, chainId: -1 },
        { oneInch: { apiKey: 'a' }, fetchImpl: stubFetch({}) },
      ),
    ).rejects.toThrow();
  });
});

describe('quote caching', () => {
  let cache: InMemoryCacheStore;

  beforeEach(() => {
    cache = new InMemoryCacheStore();
  });

  test('a cached quote can be read back by id', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
      cache,
    });

    await cacheQuote(quote, { cache, ttlSeconds: 30 });
    const found = await getCachedQuote(quote.quoteId, { cache });

    expect(found?.quoteId).toBe(quote.quoteId);
    expect(found?.usdcRequired).toBe(quote.usdcRequired);
  });

  test('an unknown id reads back as null', async () => {
    expect(await getCachedQuote('does-not-exist', { cache })).toBeNull();
  });

  test('the in-memory store works with no Redis configured', async () => {
    // Degraded operation is a supported mode, not an accident.
    await cache.set('key', 'value', 30);
    expect(await cache.get('key')).toBe('value');
  });
});

describe('payment safety assertions', () => {
  test('swap output at or above the requirement is accepted', () => {
    expect(() => assertSwapOutputSufficient(1_000_000n, 1_000_000n)).not.toThrow();
    expect(() => assertSwapOutputSufficient(1_000_001n, 1_000_000n)).not.toThrow();
  });

  test('swap output one unit short is rejected', () => {
    // Not "close enough". One atomic unit short is a partial payment.
    expect(() => assertSwapOutputSufficient(999_999n, 1_000_000n)).toThrow();
  });

  test('assertNoPartialPayment rejects a quote whose floor was lowered', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
    });

    expect(() => assertNoPartialPayment(quote)).not.toThrow();

    // Lowering minAmountOut below the required amount is exactly how a partial
    // payment would slip through, so the guard catches it before settlement.
    expect(() => assertNoPartialPayment({ ...quote, minAmountOut: '999999' })).toThrow(
      /partial payments are illegal/i,
    );
  });

  test('assertQuoteFresh rejects an expired quote', async () => {
    const quote = await getBestQuote(baseParams, {
      oneInch: { apiKey: 'a' },
      zeroEx: { apiKey: 'b' },
      fetchImpl: stubFetch({}),
    });

    expect(() => assertQuoteFresh(quote)).not.toThrow();

    const stale = { ...quote, expiresAt: new Date(Date.now() - 1000).toISOString() };
    expect(() => assertQuoteFresh(stale)).toThrow();
    expect(isQuoteExpired(stale)).toBe(true);
  });
});
