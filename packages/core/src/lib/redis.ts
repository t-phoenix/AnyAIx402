import Redis from 'ioredis';

let client: Redis | null = null;

/**
 * Lazily-created, process-wide ioredis client backed by REDIS_URL.
 * `lazyConnect: true` means no socket is opened until the first command runs,
 * so simply importing this module (e.g. transitively, in unit tests) never
 * attempts a network connection. Tests that exercise Redis-touching code paths
 * should `vi.mock('ioredis', ...)` rather than rely on a live server.
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
