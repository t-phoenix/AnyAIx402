/**
 * Cache abstraction used for quote caching, price caching and rate limiting.
 *
 * The production implementation is Redis-backed (`apps/api` supplies one built on
 * ioredis). Everything in `@anyx/core` depends only on this interface, so the
 * engine and its tests run with no Redis available.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomically increments a counter, setting the TTL on first write. */
  incr(key: string, ttlSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
}

interface MemoryEntry {
  value: string;
  expiresAtMs: number;
}

export class InMemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  private prune(key: string): MemoryEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    return this.prune(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * 1_000 });
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async incr(key: string, ttlSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const existing = this.prune(key);
    if (!existing) {
      const expiresAtMs = Date.now() + ttlSeconds * 1_000;
      this.entries.set(key, { value: '1', expiresAtMs });
      return { count: 1, ttlSeconds };
    }
    const count = Number.parseInt(existing.value, 10) + 1;
    existing.value = String(count);
    return {
      count,
      ttlSeconds: Math.max(1, Math.ceil((existing.expiresAtMs - Date.now()) / 1_000)),
    };
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

let defaultStore: CacheStore = new InMemoryCacheStore();

export function setDefaultCacheStore(store: CacheStore): void {
  defaultStore = store;
}

export function getDefaultCacheStore(): CacheStore {
  return defaultStore;
}

export function resetDefaultCacheStore(): void {
  defaultStore = new InMemoryCacheStore();
}

export const CACHE_KEYS = {
  quote: (quoteId: string) => `anyx:quote:${quoteId}`,
  price: (coingeckoId: string) => `anyx:price:${coingeckoId}`,
  rateLimit: (identity: string, windowStart: number) => `anyx:ratelimit:${identity}:${windowStart}`,
  facilitatorHealth: (url: string) => `anyx:facilitator:health:${url}`,
} as const;

export const QUOTE_TTL_SECONDS = 30;
export const PRICE_TTL_SECONDS = 60;
