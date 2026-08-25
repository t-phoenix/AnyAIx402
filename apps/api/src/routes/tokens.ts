import { getSupportedTokens } from '@anyx/core';
import { Hono } from 'hono';
import { getRedisClient } from '../lib/redis';

export const tokensRoute = new Hono();

const CACHE_KEY = 'anyx:tokens:prices';
const CACHE_TTL_SECONDS = 60;

async function fetchCoingeckoPrices(ids: string[]): Promise<Record<string, number>> {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('vs_currencies', 'usd');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko returned HTTP ${response.status}`);
  }
  const json = (await response.json()) as Record<string, { usd?: number }>;
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(json)) {
    if (typeof value.usd === 'number') result[id] = value.usd;
  }
  return result;
}

/**
 * GET /v1/tokens — list all supported tokens with current USD price (CoinGecko, cached 60s).
 * Degrades gracefully to `usdPrice: null` if CoinGecko/Redis are unavailable — never crashes.
 */
tokensRoute.get('/v1/tokens', async (c) => {
  const tokens = getSupportedTokens();
  const uniqueIds = [...new Set(tokens.map((t) => t.coingeckoId))];

  let prices: Record<string, number> = {};

  try {
    const redis = getRedisClient();
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      prices = JSON.parse(cached) as Record<string, number>;
    } else {
      prices = await fetchCoingeckoPrices(uniqueIds);
      await redis.set(CACHE_KEY, JSON.stringify(prices), 'EX', CACHE_TTL_SECONDS);
    }
  } catch (err) {
    console.warn(
      '[tokens] price fetch/cache failed, returning tokens without prices:',
      (err as Error).message,
    );
  }

  return c.json({
    tokens: tokens.map((t) => ({ ...t, usdPrice: prices[t.coingeckoId] ?? null })),
    updatedAt: new Date().toISOString(),
  });
});
