import { beforeEach, describe, expect, test } from 'bun:test';
import type { Hono } from 'hono';
import { type AppEnv, createApp } from '../app.js';
import { MemoryRateLimiter } from '../lib/rateLimit.js';
import { MemoryStore } from '../lib/store.js';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const CHALLENGE = {
  x402Version: 2,
  error: 'Payment required',
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      asset: USDC_BASE,
      payTo: '0x1111111111111111111111111111111111111111',
      maxTimeoutSeconds: 300,
    },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Stands in for the origin API and both DEX aggregators. No test in this file
 * makes a real network call.
 */
function stubFetch(overrides: Record<string, () => Response> = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [pattern, respond] of Object.entries(overrides)) {
      if (url.includes(pattern)) return respond();
    }
    if (url.includes('api.1inch.dev')) return json({ dstAmount: '1002000', gas: 120_000 });
    if (url.includes('api.0x.org')) return json({ buyAmount: '1001000', gas: '130000' });
    if (url.includes('paid.example.com')) return json(CHALLENGE, 402);
    if (url.includes('free.example.com')) return json({ ok: true }, 200);
    return new Response('unexpected', { status: 500 });
  }) as unknown as typeof fetch;
}

function makeApp(options: Parameters<typeof createApp>[0] = {}): Hono<AppEnv> {
  return createApp({
    config: {
      oneInchApiKey: 'test-1inch',
      zeroExApiKey: 'test-0x',
      facilitatorUrl: 'https://facilitator.test',
      ...options.config,
    },
    store: options.store ?? new MemoryStore(),
    rateLimiter: options.rateLimiter ?? new MemoryRateLimiter(),
    fetchImpl: options.fetchImpl ?? stubFetch(),
    ...(options.now ? { now: options.now } : {}),
  });
}

async function post(app: Hono<AppEnv>, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('health', () => {
  test('serves 200 with no database and no redis, listing what is degraded', async () => {
    const app = createApp({
      config: { databaseUrl: undefined, redisUrl: undefined },
      fetchImpl: stubFetch(),
    });

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      status: string;
      degraded: string[];
      persistence: string;
      capabilities: Record<string, { enabled: boolean; reason?: string }>;
    };

    expect(body.status).toBe('ok');
    expect(body.persistence).toBe('memory');
    expect(body.degraded).toContain('persistence');
    expect(body.degraded).toContain('quoteCache');
    // Every disabled capability must say why, or /health is just a shrug.
    for (const [, report] of Object.entries(body.capabilities)) {
      if (!report.enabled) expect(report.reason).toBeTruthy();
    }
  });

  test('reports persistence and caching as enabled once configured', async () => {
    const app = createApp({
      config: {
        databaseUrl: 'postgresql://localhost:5432/anyx',
        redisUrl: 'redis://localhost:6379',
      },
      fetchImpl: stubFetch(),
    });

    const body = (await (await app.request('/health')).json()) as { degraded: string[] };
    expect(body.degraded).not.toContain('persistence');
    expect(body.degraded).not.toContain('quoteCache');
  });

  test('attaches a request id, echoing a supplied one', async () => {
    const app = makeApp();

    const generated = await app.request('/health');
    expect(generated.headers.get('x-request-id')).toBeTruthy();

    const echoed = await app.request('/health', { headers: { 'x-request-id': 'req-123' } });
    expect(echoed.headers.get('x-request-id')).toBe('req-123');
  });
});

describe('discovery', () => {
  test('lists supported tokens', async () => {
    const res = await makeApp().request('/v1/tokens');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { tokens: { symbol: string; chainId: number }[] };
    expect(body.tokens.length).toBeGreaterThan(0);
    expect(body.tokens.some((token) => token.symbol === 'ETH' && token.chainId === 8453)).toBe(
      true,
    );
  });

  test('advertises the adapter at /.well-known/x402', async () => {
    const body = (await (await makeApp().request('/.well-known/x402')).json()) as {
      x402Version: number;
      settlementNetwork: string;
    };
    expect(body.x402Version).toBe(2);
    expect(body.settlementNetwork).toBe('eip155:8453');
  });

  test('serves an OpenAPI document covering the documented routes', async () => {
    const body = (await (await makeApp().request('/openapi.json')).json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(body.openapi).toBe('3.1.0');
    for (const path of ['/health', '/v1/quote', '/v1/pay', '/v1/receipt/{id}', '/v1/tokens']) {
      expect(body.paths[path]).toBeDefined();
    }
  });
});

describe('POST /v1/quote', () => {
  test('quotes a 402 endpoint and applies the spread on top of the price', async () => {
    const res = await post(makeApp(), '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });

    expect(res.status).toBe(200);
    const quote = (await res.json()) as {
      quoteId: string;
      usdcRequired: string;
      usdcGross: string;
      minAmountOut: string;
      fee: { bps: number; usdc: string };
    };

    expect(quote.quoteId).toBeTruthy();
    expect(quote.usdcRequired).toBe('1000000');
    // The fee is added on top: the provider still receives the full price.
    expect(BigInt(quote.usdcGross)).toBeGreaterThan(BigInt(quote.usdcRequired));
    expect(BigInt(quote.fee.usdc)).toBe(BigInt(quote.usdcGross) - BigInt(quote.usdcRequired));
    // A partial payment must be unrepresentable.
    expect(quote.minAmountOut).toBe(quote.usdcRequired);
  });

  test('rejects a request missing required fields', async () => {
    const res = await post(makeApp(), '/v1/quote', { inputToken: 'ETH' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_INPUT');
  });

  test('rejects an unsupported token', async () => {
    const res = await post(makeApp(), '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'DOGE',
      inputChainId: 8453,
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('X402_UNSUPPORTED_PAYMENT');
  });

  test('rejects an endpoint that is not asking for payment', async () => {
    const res = await post(makeApp(), '/v1/quote', {
      endpointUrl: 'https://free.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });
    expect(res.status).toBe(400);
  });

  test('rejects a challenge that does not accept USDC on Base', async () => {
    const app = makeApp({
      fetchImpl: stubFetch({
        'paid.example.com': () =>
          json(
            {
              x402Version: 2,
              error: 'Payment required',
              accepts: [
                {
                  scheme: 'exact',
                  network: 'eip155:1',
                  amount: '1000000',
                  asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                  payTo: '0x1111111111111111111111111111111111111111',
                  maxTimeoutSeconds: 300,
                },
              ],
            },
            402,
          ),
      }),
    });

    const res = await post(app, '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });
    expect(res.status).toBe(422);
  });

  test('survives one aggregator failing', async () => {
    const app = makeApp({
      fetchImpl: stubFetch({ 'api.1inch.dev': () => new Response('down', { status: 503 }) }),
    });

    const res = await post(app, '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });

    expect(res.status).toBe(200);
    expect((await res.json()).route.source).toBe('0x');
  });

  test('fails with a typed error when both aggregators are down', async () => {
    const app = makeApp({
      fetchImpl: stubFetch({
        'api.1inch.dev': () => new Response('down', { status: 503 }),
        'api.0x.org': () => new Response('down', { status: 503 }),
      }),
    });

    const res = await post(app, '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect((await res.json()).error.code).toBeTruthy();
  });
});

describe('POST /v1/pay', () => {
  let app: Hono<AppEnv>;
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    app = makeApp({ store });
  });

  async function quote(): Promise<{ quoteId: string }> {
    const res = await post(app, '/v1/quote', {
      endpointUrl: 'https://paid.example.com/data',
      inputToken: 'ETH',
      inputChainId: 8453,
    });
    return (await res.json()) as { quoteId: string };
  }

  test('settles a quote and returns an itemized receipt', async () => {
    const { quoteId } = await quote();

    const res = await post(app, '/v1/pay', {
      quoteId,
      walletAddress: '0x2222222222222222222222222222222222222222',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      receipt: { receiptId: string; apiCostUSDC: string; adapterFeeUSDC: string; endpoint: string };
    };

    expect(body.receipt.receiptId).toBeTruthy();
    expect(body.receipt.apiCostUSDC).toBe('1.000000');
    expect(Number(body.receipt.adapterFeeUSDC)).toBeGreaterThan(0);
    expect(body.receipt.endpoint).toBe('https://paid.example.com/data');
    expect(res.headers.get('x-anyx-receipt-id')).toBe(body.receipt.receiptId);
  });

  test('refuses to settle the same quote twice', async () => {
    const { quoteId } = await quote();

    expect((await post(app, '/v1/pay', { quoteId })).status).toBe(200);

    const second = await post(app, '/v1/pay', { quoteId });
    expect(second.status).toBe(400);
    expect((await second.json()).error.message).toMatch(/already been settled/i);
  });

  test('rejects an unknown quote', async () => {
    const res = await post(app, '/v1/pay', { quoteId: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('QUOTE_NOT_FOUND');
  });

  test('rejects an expired quote', async () => {
    const { quoteId } = await quote();
    const stored = await store.getQuote(quoteId);
    if (stored) stored.quote.expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = await post(app, '/v1/pay', { quoteId });
    expect(res.status).toBe(410);
    expect((await res.json()).error.code).toBe('QUOTE_EXPIRED');
  });

  test('rejects a malformed wallet address', async () => {
    const { quoteId } = await quote();
    const res = await post(app, '/v1/pay', { quoteId, walletAddress: 'not-an-address' });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/receipt/:id', () => {
  test('returns a receipt that exists and 404s one that does not', async () => {
    const app = makeApp();

    const { quoteId } = (await (
      await post(app, '/v1/quote', {
        endpointUrl: 'https://paid.example.com/data',
        inputToken: 'ETH',
        inputChainId: 8453,
      })
    ).json()) as { quoteId: string };

    const paid = (await (await post(app, '/v1/pay', { quoteId })).json()) as {
      receipt: { receiptId: string };
    };

    const found = await app.request(`/v1/receipt/${paid.receipt.receiptId}`);
    expect(found.status).toBe(200);
    expect((await found.json()).receiptId).toBe(paid.receipt.receiptId);

    const missing = await app.request('/v1/receipt/nope');
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.message).toBe('No receipt with id nope.');
  });
});

describe('lightning', () => {
  test('answers 501 rather than 404, and says what it needs', async () => {
    const res = await post(makeApp(), '/v1/lightning/invoice', {
      endpointUrl: 'https://paid.example.com/data',
    });
    expect(res.status).toBe(501);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toMatch(/LND_GRPC_HOST/);
  });
});

describe('rate limiting', () => {
  test('limits the anonymous tier and sets the standard headers', async () => {
    const app = makeApp({ config: { rateLimitFreeRpm: 3 } });

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await app.request('/v1/tokens')).status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);

    const limited = await app.request('/v1/tokens');
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect((await limited.json()).error.code).toBe('RATE_LIMITED');
  });

  test('gives an API key the higher limit', async () => {
    const app = makeApp({ config: { rateLimitFreeRpm: 1, rateLimitProRpm: 10 } });

    for (let i = 0; i < 5; i += 1) {
      const res = await app.request('/v1/tokens', { headers: { 'x-api-key': 'anyx_test' } });
      expect(res.status).toBe(200);
    }
  });

  test('never rate-limits health, so a limited client can still diagnose itself', async () => {
    const app = makeApp({ config: { rateLimitFreeRpm: 1 } });

    await app.request('/v1/tokens');
    await app.request('/v1/tokens');

    expect((await app.request('/health')).status).toBe(200);
  });
});

describe('errors', () => {
  test('unknown routes return the structured error shape', async () => {
    const res = await makeApp().request('/not-a-route');
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/not-a-route');
  });
});
