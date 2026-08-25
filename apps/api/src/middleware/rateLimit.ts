import { AnyxError } from '@anyx/core';
import type { MiddlewareHandler } from 'hono';
import { getRedisClient } from '../lib/redis';
import type { Plan } from './auth';

const LIMITS_PER_MINUTE: Record<Plan, number> = {
  free: 100,
  pro: 1_000,
  enterprise: 100_000,
};

const WINDOW_SECONDS = 60;

/**
 * Fixed-window rate limiter backed by Redis (INCR + EXPIRE). Keys by API key id when present,
 * otherwise by client IP. Fails open (allows the request) if Redis is unavailable — a cache
 * outage should not take down the API.
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const plan = c.get('plan') ?? 'free';
  const apiKeyId = c.get('apiKeyId');
  const identifier =
    apiKeyId ?? c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP') ?? 'anonymous';

  const limit = LIMITS_PER_MINUTE[plan];
  const windowBucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `anyx:ratelimit:${identifier}:${windowBucket}`;

  try {
    const redis = getRedisClient();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > limit) {
      const retryAfter = WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);
      c.header('Retry-After', String(retryAfter));
      const err = new AnyxError(
        'RATE_LIMITED',
        `Rate limit of ${limit} req/min exceeded for ${plan} tier`,
        {
          plan,
          limit,
          retryAfterSeconds: retryAfter,
        },
      );
      return c.json(err.toJSON(), 429);
    }
  } catch (err) {
    console.warn('[rateLimit] Redis unavailable, failing open:', (err as Error).message);
  }

  await next();
};
