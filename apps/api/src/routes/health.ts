import { Hono } from 'hono';

export const healthRoute = new Hono();

const VERSION = '0.1.0';

healthRoute.get('/health', (c) => {
  const persistence = process.env.DATABASE_URL ? 'postgres' : 'memory';
  const rateLimiter = process.env.REDIS_URL ? 'redis' : 'memory';
  return c.json({
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
    degraded: [],
    capabilities: {},
    persistence,
    rateLimiter,
  });
});
