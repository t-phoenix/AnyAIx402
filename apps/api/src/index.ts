import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggerMiddleware } from './middleware/requestLogger';
import { healthRoute } from './routes/health';
import { lightningRoute } from './routes/lightning';
import { payRoute } from './routes/pay';
import { quoteRoute } from './routes/quote';
import { receiptRoute } from './routes/receipt';
import { tokensRoute } from './routes/tokens';

export const app = new Hono();

app.use('*', corsMiddleware());
app.use('*', requestIdMiddleware);
app.use('*', requestLoggerMiddleware);
app.use('*', authMiddleware);
app.use('/v1/*', rateLimitMiddleware);

app.onError(errorHandler);

app.route('/', healthRoute);
app.route('/', tokensRoute);
app.route('/', quoteRoute);
app.route('/', payRoute);
app.route('/', receiptRoute);
app.route('/', lightningRoute);

app.notFound((c) =>
  c.json(
    { error: { code: 'INVALID_INPUT', message: `No route matches ${c.req.method} ${c.req.path}` } },
    404,
  ),
);

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (import.meta.main) {
  console.log(`[api] AnyX API listening on http://localhost:${port}`);
}

export default {
  port,
  fetch: app.fetch,
};
