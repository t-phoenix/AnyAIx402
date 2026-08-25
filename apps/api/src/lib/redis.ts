import Redis from 'ioredis';

let client: Redis | null = null;

/**
 * Lazily-created, process-wide ioredis client for caching (token prices, rate limiting).
 * Importing this module never opens a socket; the first command triggers `lazyConnect`.
 */
export function getRedisClient(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  client.on('error', (err) => {
    console.warn('[redis] connection error:', err.message);
  });
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
