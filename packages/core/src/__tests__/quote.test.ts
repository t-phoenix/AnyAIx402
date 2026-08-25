import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigMissingError, QuoteError } from '../errors';
import { getToken } from '../tokens';
import type { QuoteParams } from '../types';

// Mock ioredis before importing quote.ts so the module never opens a real socket.
const redisStore = new Map<string, string>();
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      on() {}
      async get(key: string) {
        return redisStore.get(key) ?? null;
      }
      async set(key: string, value: string) {
        redisStore.set(key, value);
        return 'OK';
      }
      async quit() {}
    },
  };
});

const { get1inchQuote, get0xQuote, getBestQuote, getCachedQuote } = await import('../quote');

const maybeEthToken = getToken('ETH', 8453);
if (!maybeEthToken)
  throw new Error('Fixture error: ETH on chain 8453 must exist in TOKEN_REGISTRY');
const ethToken = maybeEthToken;

function baseParams(): QuoteParams {
  return {
    inputToken: ethToken,
    usdcRequired: '1.00',
    chainId: 8453,
  };
}

describe('get1inchQuote', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    redisStore.clear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('throws ConfigMissingError when ONEINCH_API_KEY is unset', async () => {
    delete process.env.ONEINCH_API_KEY;
    await expect(get1inchQuote(baseParams())).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('returns a DEXQuote when the API responds with dstAmount', async () => {
    process.env.ONEINCH_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ dstAmount: '2500000000', estimatedGas: '150000', protocols: [] }),
        {
          status: 200,
        },
      ),
    );

    const quote = await get1inchQuote(baseParams());
    expect(quote.source).toBe('1inch');
    expect(quote.amountOut).toBe('2500000000');
  });

  it('throws QuoteError (not a raw fetch error) on non-2xx response', async () => {
    process.env.ONEINCH_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    await expect(get1inchQuote(baseParams())).rejects.toBeInstanceOf(QuoteError);
  });

  it('throws QuoteError when the network call itself rejects', async () => {
    process.env.ONEINCH_API_KEY = 'test-key';
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(get1inchQuote(baseParams())).rejects.toBeInstanceOf(QuoteError);
  });
});

describe('get0xQuote', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    redisStore.clear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('throws ConfigMissingError when ZEROX_API_KEY is unset', async () => {
    delete process.env.ZEROX_API_KEY;
    await expect(get0xQuote(baseParams())).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('returns a DEXQuote when the API responds with buyAmount', async () => {
    process.env.ZEROX_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ buyAmount: '2490000000', estimatedGas: '140000' }), {
        status: 200,
      }),
    );

    const quote = await get0xQuote(baseParams());
    expect(quote.source).toBe('0x');
    expect(quote.amountOut).toBe('2490000000');
  });
});

describe('getBestQuote', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    redisStore.clear();
    process.env = { ...originalEnv, FEE_BPS: '20' };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('picks the higher amountOut between 1inch and 0x, and applies the fee', async () => {
    process.env.ONEINCH_API_KEY = 'key-1inch';
    process.env.ZEROX_API_KEY = 'key-0x';

    global.fetch = vi.fn().mockImplementation((input: string | URL) => {
      const url = input.toString();
      if (url.includes('1inch')) {
        // 1 ETH probe -> 2500 USDC (better rate)
        return Promise.resolve(
          new Response(JSON.stringify({ dstAmount: '2500000000', estimatedGas: '150000' }), {
            status: 200,
          }),
        );
      }
      // 1 ETH probe -> 2490 USDC (worse rate)
      return Promise.resolve(
        new Response(JSON.stringify({ buyAmount: '2490000000', estimatedGas: '140000' }), {
          status: 200,
        }),
      );
    });

    const quote = await getBestQuote(baseParams());

    expect(quote.route.source).toBe('1inch');
    expect(quote.feeBps).toBe(20);

    // usdcRequired=1.00, fee 0.20% => usdcWithFee = 1.00 / 0.998 ≈ 1.002004
    expect(Number.parseFloat(quote.usdcOutput)).toBeCloseTo(1.002004, 5);
    expect(Number.parseFloat(quote.fee)).toBeCloseTo(0.002004, 5);

    // rate = 2500 USDC per 1 ETH => inputAmount ≈ 1.002004 / 2500 ETH
    expect(Number.parseFloat(quote.inputAmount)).toBeCloseTo(1.002004 / 2500, 6);
  });

  it('falls back to the other provider when one fails', async () => {
    process.env.ONEINCH_API_KEY = 'key-1inch';
    process.env.ZEROX_API_KEY = 'key-0x';

    global.fetch = vi.fn().mockImplementation((input: string | URL) => {
      const url = input.toString();
      if (url.includes('1inch')) {
        return Promise.resolve(new Response('server error', { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ buyAmount: '2490000000' }), { status: 200 }),
      );
    });

    const quote = await getBestQuote(baseParams());
    expect(quote.route.source).toBe('0x');
  });

  it('throws ConfigMissingError when both API keys are unset', async () => {
    delete process.env.ONEINCH_API_KEY;
    delete process.env.ZEROX_API_KEY;
    await expect(getBestQuote(baseParams())).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('throws QuoteError ALL_PROVIDERS_FAILED when both providers error (not config)', async () => {
    process.env.ONEINCH_API_KEY = 'key-1inch';
    process.env.ZEROX_API_KEY = 'key-0x';
    global.fetch = vi.fn().mockResolvedValue(new Response('down', { status: 503 }));

    await expect(getBestQuote(baseParams())).rejects.toMatchObject({
      code: 'ALL_PROVIDERS_FAILED',
    });
  });

  it('caches the resulting quote so getCachedQuote can retrieve it', async () => {
    process.env.ONEINCH_API_KEY = 'key-1inch';
    process.env.ZEROX_API_KEY = 'key-0x';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ dstAmount: '2500000000', buyAmount: '2500000000' }), {
        status: 200,
      }),
    );

    const quote = await getBestQuote(baseParams());
    const cached = await getCachedQuote(quote.quoteId);
    expect(cached?.quoteId).toBe(quote.quoteId);
  });
});

describe('getCachedQuote', () => {
  beforeEach(() => {
    redisStore.clear();
  });

  it('returns null for a quoteId that was never cached', async () => {
    const result = await getCachedQuote('does-not-exist');
    expect(result).toBeNull();
  });
});
