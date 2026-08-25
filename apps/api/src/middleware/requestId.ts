import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

/** Assigns (or forwards) an X-Request-ID header for tracing. */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header('X-Request-ID');
  const requestId = incoming ?? randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
};
