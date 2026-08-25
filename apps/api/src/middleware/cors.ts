import { cors } from 'hono/cors';

/**
 * CORS_ALLOWED_ORIGINS: comma-separated list, or '*' to allow all (dev default).
 */
export function corsMiddleware() {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? '*';
  const origins = raw.split(',').map((o) => o.trim());

  return cors({
    origin: origins.includes('*') ? '*' : origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-Partner-ID'],
    exposeHeaders: ['X-Request-ID'],
  });
}
