export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Unix seconds when the current window resets. */
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  readonly kind: 'memory' | 'redis';
  check(key: string, limitPerMinute: number): Promise<RateLimitDecision>;
}

/**
 * Fixed-window counter. Per-process, so it is correct for a single instance and
 * approximate across a fleet — which is why /health reports rate limiting as
 * degraded when Redis is absent rather than claiming it works.
 */
export class MemoryRateLimiter implements RateLimiter {
  readonly kind = 'memory' as const;

  private readonly windows = new Map<string, { count: number; resetAtMs: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async check(key: string, limitPerMinute: number): Promise<RateLimitDecision> {
    const nowMs = this.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAtMs <= nowMs) {
      const resetAtMs = nowMs + 60_000;
      this.windows.set(key, { count: 1, resetAtMs });
      this.sweep(nowMs);
      return {
        allowed: true,
        limit: limitPerMinute,
        remaining: limitPerMinute - 1,
        resetAt: Math.ceil(resetAtMs / 1000),
        retryAfterSeconds: 0,
      };
    }

    existing.count += 1;
    const remaining = Math.max(0, limitPerMinute - existing.count);
    const allowed = existing.count <= limitPerMinute;

    return {
      allowed,
      limit: limitPerMinute,
      remaining,
      resetAt: Math.ceil(existing.resetAtMs / 1000),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
    };
  }

  private sweep(nowMs: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAtMs <= nowMs) this.windows.delete(key);
    }
  }
}
