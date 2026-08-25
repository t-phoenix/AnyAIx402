import { Hono } from 'hono';

export const healthRoute = new Hono();

const VERSION = '0.1.0';

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
});
