import {
  AnyXError,
  type FloatBalanceProvider,
  StaticFloatBalanceProvider,
  ValidationError,
  getSupportedTokens,
  isAnyXError,
  toAnyXError,
} from '@anyx/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiConfig } from './config.js';
import { capabilities, loadApiConfig } from './config.js';
import { MemoryRateLimiter, type RateLimiter } from './lib/rateLimit.js';
import { MemoryStore, type PaymentStore } from './lib/store.js';
import { registerLightningRoutes } from './routes/lightning.js';
import { openApiDocument } from './routes/openapi.js';
import { registerPayRoutes } from './routes/pay.js';
import { registerQuoteRoutes } from './routes/quote.js';
import { registerReceiptRoutes } from './routes/receipt.js';

export interface AppDependencies {
  readonly config: ApiConfig;
  readonly store: PaymentStore;
  readonly rateLimiter: RateLimiter;
  readonly now: () => number;
  readonly fetchImpl: typeof fetch;
  /** Absent when no float is configured, which blocks settlement outright. */
  readonly floatBalance: FloatBalanceProvider | undefined;
}

export interface AppOptions {
  config?: Partial<ApiConfig>;
  store?: PaymentStore;
  rateLimiter?: RateLimiter;
  now?: () => number;
  fetchImpl?: typeof fetch;
  floatBalance?: FloatBalanceProvider;
}

export type AppEnv = {
  Variables: {
    requestId: string;
    deps: AppDependencies;
  };
};

export function createApp(options: AppOptions = {}): Hono<AppEnv> {
  const config: ApiConfig = { ...loadApiConfig(), ...options.config };

  // A configured float is a real balance the executor must check before
  // fronting a payment. Leaving it undefined would let every request succeed as
  // if the pool were bottomless.
  const floatBalance =
    options.floatBalance ??
    (config.floatUsdc === undefined
      ? undefined
      : new StaticFloatBalanceProvider(BigInt(config.floatUsdc)));

  const deps: AppDependencies = {
    config,
    store: options.store ?? new MemoryStore(),
    rateLimiter: options.rateLimiter ?? new MemoryRateLimiter(options.now),
    now: options.now ?? Date.now,
    fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
    floatBalance,
  };

  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  app.use(
    '*',
    cors({
      origin: config.corsAllowedOrigins.includes('*') ? '*' : [...config.corsAllowedOrigins],
      allowHeaders: ['content-type', 'x-api-key', 'x-partner-id', 'x-payment'],
      exposeHeaders: ['x-request-id', 'x-anyx-receipt-id', 'x-payment-response'],
    }),
  );

  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);

    const started = deps.now();
    await next();
    const duration = deps.now() - started;

    console.log(
      JSON.stringify({
        requestId,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        durationMs: duration,
      }),
    );
  });

  // Rate limiting applies to the paid surface only; health and discovery stay
  // reachable so a limited client can still find out why it is limited.
  app.use('/v1/*', async (c, next) => {
    const apiKey = c.req.header('x-api-key');
    const identity =
      apiKey ?? c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'anonymous';

    // Key verification is 6.1-api-keys-billing and does not exist yet. Until a
    // key can be checked against a stored hash, an unverified header buys
    // nothing: granting the Pro limit for any string would make the free tier
    // opt-out.
    const limit = config.rateLimitFreeRpm;

    const decision = await deps.rateLimiter.check(identity, limit);
    c.header('x-ratelimit-limit', String(decision.limit));
    c.header('x-ratelimit-remaining', String(decision.remaining));
    c.header('x-ratelimit-reset', String(decision.resetAt));

    if (!decision.allowed) {
      c.header('retry-after', String(decision.retryAfterSeconds));
      throw new AnyXError(
        'RATE_LIMITED',
        `Rate limit of ${decision.limit} requests/minute exceeded.`,
        {
          details: { retryAfterSeconds: decision.retryAfterSeconds },
        },
      );
    }

    await next();
  });

  app.get('/health', (c) => {
    const report = capabilities(config);
    const degraded = Object.entries(report)
      .filter(([, value]) => !value.enabled)
      .map(([name]) => name);

    return c.json({
      status: 'ok',
      version: config.version,
      timestamp: new Date(deps.now()).toISOString(),
      // Degraded is not unhealthy. The process is serving; some capabilities
      // are off, and each says why.
      degraded,
      capabilities: report,
      persistence: deps.store.kind,
      rateLimiter: deps.rateLimiter.kind,
    });
  });

  app.get('/.well-known/x402', (c) =>
    c.json({
      x402Version: 2,
      role: 'payer-adapter',
      name: 'AnyX',
      description:
        'Universal x402 payment adapter. Accepts any supported token and settles USDC on Base.',
      settlementAsset: 'USDC',
      settlementNetwork: 'eip155:8453',
      supportedTokens: getSupportedTokens().map((token) => ({
        symbol: token.symbol,
        chainId: token.chainId,
        address: token.address,
      })),
      endpoints: {
        quote: '/v1/quote',
        pay: '/v1/pay',
        receipt: '/v1/receipt/{id}',
        tokens: '/v1/tokens',
      },
    }),
  );

  app.get('/openapi.json', (c) => c.json(openApiDocument(config)));

  app.get('/v1/tokens', (c) =>
    c.json({
      tokens: getSupportedTokens().map((token) => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        isNative: token.isNative,
        swapPath: token.swapPath,
        // Prices need a pricing provider; null is honest, a guess is not.
        priceUsd: null,
      })),
      updatedAt: new Date(deps.now()).toISOString(),
    }),
  );

  registerQuoteRoutes(app);
  registerPayRoutes(app);
  registerReceiptRoutes(app);
  registerLightningRoutes(app);

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `No route for ${c.req.method} ${new URL(c.req.url).pathname}.`,
        },
      },
      404,
    ),
  );

  app.onError((error, c) => {
    const anyx = isAnyXError(error) ? error : toAnyXError(error);
    // Every AnyXError already carries the status its code maps to; duplicating
    // that table here is how the two drift apart.
    const status = anyx.httpStatus;

    if (status >= 500) {
      console.error(
        JSON.stringify({
          requestId: c.get('requestId'),
          code: anyx.code,
          message: anyx.message,
          stack: anyx.stack,
        }),
      );
    }

    return c.json(
      {
        error: {
          code: anyx.code,
          message: anyx.message,
          ...(anyx.details === undefined ? {} : { details: anyx.details }),
        },
      },
      status as 400,
    );
  });

  return app;
}

export function badRequest(message: string, details?: unknown): never {
  throw new ValidationError(message, details === undefined ? undefined : { details });
}
