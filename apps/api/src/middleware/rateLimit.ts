import type { MiddlewareHandler } from "hono";

/** Redis-backed limiter is Phase 6. v0 is a no-op so local/dev is unblocked. */
export const rateLimit: MiddlewareHandler = async (_c, next) => {
  await next();
};
