import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisData = new Map<string, string>();
vi.mock('../lib/redis', () => ({
  getRedisClient: () => ({
    get: async (key: string) => redisData.get(key) ?? null,
    set: async (key: string, value: string) => {
      redisData.set(key, value);
      return 'OK';
    },
  }),
}));

const { app } = await import('../index');

describe('GET /v1/tokens', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    redisData.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the full token registry with prices from CoinGecko', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          'usd-coin': { usd: 1 },
          ethereum: { usd: 2500 },
          tether: { usd: 1 },
          weth: { usd: 2500 },
          'coinbase-wrapped-btc': { usd: 65000 },
          'wrapped-bitcoin': { usd: 65000 },
          bitcoin: { usd: 65000 },
          solana: { usd: 150 },
        }),
        { status: 200 },
      ),
    );

    const res = await app.request('/v1/tokens');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tokens)).toBe(true);
    expect(body.tokens.length).toBeGreaterThanOrEqual(11);
    expect(typeof body.updatedAt).toBe('string');

    const eth = body.tokens.find(
      (t: { symbol: string; chainId: number }) => t.symbol === 'ETH' && t.chainId === 8453,
    );
    expect(eth.usdPrice).toBe(2500);
  });

  it('degrades gracefully (usdPrice: null) when CoinGecko is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network unreachable'));

    const res = await app.request('/v1/tokens');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tokens[0].usdPrice).toBeNull();
  });
});
