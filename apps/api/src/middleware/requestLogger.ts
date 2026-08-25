import type { MiddlewareHandler } from 'hono';

/** Logs method, path, status, and duration for every request. */
export const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const durationMs = (performance.now() - start).toFixed(1);
  const requestId = c.get('requestId') ?? '-';
  console.log(
    `[api] ${c.req.method} ${c.req.path} -> ${c.res.status} (${durationMs}ms) [${requestId}]`,
  );
};
