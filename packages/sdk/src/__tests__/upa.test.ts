import { beforeEach, describe, expect, test } from 'bun:test';
import type { PaymentQuote, PaymentReceipt } from '../types.js';
import { UPAError } from '../types.js';
import { UPA } from '../upa.js';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Records every request and replies from a scripted route table. */
function mockFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    for (const [pattern, respond] of Object.entries(routes)) {
      if (url.includes(pattern)) return respond();
    }
    return new Response('no route', { status: 500 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function quoteFixture(overrides: Partial<PaymentQuote> = {}): PaymentQuote {
  return {
    quoteId: 'quote-1',
    endpointUrl: 'https://api.example.com/data',
    inputToken: {
      symbol: 'ETH',
      name: 'Ether',
      address: null,
      chainId: 8453,
      decimals: 18,
      isNative: true,
    },
    inputAmount: '421400000000000',
    usdcRequired: '1000000',
    usdcGross: '1002000',
    fee: { bps: 20, usdc: '2000' },
    minAmountOut: '1000000',
    slippageBps: 50,
    route: {
      source: '1inch',
      amountIn: '421400000000000',
      amountOut: '1002000',
      estimatedGas: '120000',
      priceImpact: 0.0012,
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    ...overrides,
  };
}

function receiptFixture(): PaymentReceipt {
  return {
    receiptId: 'receipt-1',
    timestamp: new Date().toISOString(),
    endpoint: 'https://api.example.com/data',
    inputToken: 'ETH',
    inputTokenAddress: null,
    inputAmount: '0.0004214',
    inputAmountUSD: '1.0023',
    apiCostUSDC: '1.000',
    adapterFeeUSDC: '0.002',
    swapSlippage: '0.0012',
    txHash: '0xabc',
    blockNumber: 22891234,
    facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
    xPaymentResponse: 'base64-receipt',
    status: 'settled',
  };
}

const CHALLENGE = {
  x402Version: 2,
  error: 'Payment required',
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0x1111111111111111111111111111111111111111',
      maxTimeoutSeconds: 300,
    },
  ],
};

function makeUpa(fetchImpl: typeof fetch, overrides = {}) {
  return new UPA({
    preferredToken: 'ETH',
    preferredChainId: 8453,
    apiBaseUrl: 'https://api.anyx.test',
    fetchImpl,
    ...overrides,
  });
}

describe('construction', () => {
  test('rejects a config without a preferred token', () => {
    expect(() => new UPA({ preferredToken: '', preferredChainId: 8453 })).toThrow(UPAError);
  });

  test('rejects a config without a chain id', () => {
    expect(() => new UPA({ preferredToken: 'ETH', preferredChainId: Number.NaN })).toThrow(
      UPAError,
    );
  });
});

describe('fetch', () => {
  test('passes a non-402 response through untouched', async () => {
    const { impl, calls } = mockFetch({
      'api.example.com': () => json({ ok: true }),
    });
    const upa = makeUpa(impl);

    const res = await upa.fetch('https://api.example.com/data');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // No quote and no payment: the SDK must not touch the AnyX API at all.
    expect(calls).toHaveLength(1);
  });

  test('quotes, pays and returns the resource on a 402', async () => {
    const { impl, calls } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture()),
      '/v1/pay': () =>
        json({
          receipt: receiptFixture(),
          apiResponse: { status: 200, body: { data: 'the resource' } },
        }),
    });
    const upa = makeUpa(impl);

    const res = await upa.fetch('https://api.example.com/data');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: 'the resource' });
    expect(res.headers.get('x-anyx-receipt-id')).toBe('receipt-1');
    expect(res.headers.get('x-anyx-tx-hash')).toBe('0xabc');
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.com/data',
      'https://api.anyx.test/v1/quote',
      'https://api.anyx.test/v1/pay',
    ]);
  });

  test('emits payment and swap events', async () => {
    const swap = {
      quoteId: 'quote-1',
      source: '1inch',
      inputToken: 'ETH',
      inputAmount: '421400000000000',
      usdcReceived: '1002000',
      txHash: '0xdef',
      at: new Date().toISOString(),
    };
    const { impl } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture()),
      '/v1/pay': () =>
        json({ receipt: receiptFixture(), swap, apiResponse: { status: 200, body: {} } }),
    });

    const payments: PaymentReceipt[] = [];
    const swaps: unknown[] = [];
    const upa = makeUpa(impl, {
      onPayment: (receipt: PaymentReceipt) => payments.push(receipt),
      onSwap: (event: unknown) => swaps.push(event),
    });

    await upa.fetch('https://api.example.com/data');

    expect(payments).toHaveLength(1);
    expect(payments[0]?.receiptId).toBe('receipt-1');
    expect(swaps).toHaveLength(1);
  });

  test('skipPayment returns the raw 402', async () => {
    const { impl, calls } = mockFetch({ 'api.example.com': () => json(CHALLENGE, 402) });
    const upa = makeUpa(impl);

    const res = await upa.fetch('https://api.example.com/data', { skipPayment: true });

    expect(res.status).toBe(402);
    expect(calls).toHaveLength(1);
  });

  test('reuses a supplied quote instead of requesting another', async () => {
    const { impl, calls } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture({ quoteId: 'should-not-be-used' })),
      '/v1/pay': () => json({ receipt: receiptFixture(), apiResponse: { status: 200, body: {} } }),
    });
    const upa = makeUpa(impl);

    await upa.fetch('https://api.example.com/data', { useQuote: quoteFixture() });

    expect(calls.some((call) => call.url.includes('/v1/quote'))).toBe(false);
    const payCall = calls.find((call) => call.url.includes('/v1/pay'));
    expect(JSON.parse(String(payCall?.init?.body)).quoteId).toBe('quote-1');
  });
});

describe('guardrails', () => {
  test('refuses a quote whose fee exceeds maxFeePercent', async () => {
    const { impl, calls } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      // 5% fee against a 1% ceiling.
      '/v1/quote': () => json(quoteFixture({ fee: { bps: 500, usdc: '50000' } })),
    });
    const upa = makeUpa(impl, { maxFeePercent: 0.01 });

    await expect(upa.fetch('https://api.example.com/data')).rejects.toThrow(/fee is 5/i);
    // Critically, /v1/pay was never called: no money moved.
    expect(calls.some((call) => call.url.includes('/v1/pay'))).toBe(false);
  });

  test('accepts a fee at exactly the configured ceiling', async () => {
    const { impl } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture({ fee: { bps: 100, usdc: '10000' } })),
      '/v1/pay': () =>
        json({ receipt: receiptFixture(), apiResponse: { status: 200, body: { ok: true } } }),
    });
    const upa = makeUpa(impl, { maxFeePercent: 0.01 });

    const res = await upa.fetch('https://api.example.com/data');
    expect(res.status).toBe(200);
  });

  test('refuses a quote whose slippage exceeds maxSlippage', async () => {
    const { impl, calls } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture({ slippageBps: 200 })),
    });
    const upa = makeUpa(impl, { maxSlippage: 0.005 });

    await expect(upa.fetch('https://api.example.com/data')).rejects.toThrow(/slippage/i);
    expect(calls.some((call) => call.url.includes('/v1/pay'))).toBe(false);
  });

  test('refuses an already-expired quote', async () => {
    const { impl } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () =>
        json(quoteFixture({ expiresAt: new Date(Date.now() - 1000).toISOString() })),
    });
    const upa = makeUpa(impl);

    await expect(upa.fetch('https://api.example.com/data')).rejects.toThrow(/expired/i);
  });

  test('sends the configured slippage to the quote endpoint', async () => {
    const { impl, calls } = mockFetch({ '/v1/quote': () => json(quoteFixture()) });
    const upa = makeUpa(impl, { maxSlippage: 0.003 });

    await upa.quote('https://api.example.com/data');

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.slippageBps).toBe(30);
    expect(body.inputToken).toBe('ETH');
    expect(body.inputChainId).toBe(8453);
  });
});

describe('errors', () => {
  test('maps a structured API error onto its code', async () => {
    const { impl } = mockFetch({
      '/v1/quote': () =>
        json({ error: { code: 'QUOTE_EXPIRED', message: 'quote has expired' } }, 400),
    });
    const upa = makeUpa(impl);

    await expect(upa.quote('https://api.example.com/data')).rejects.toMatchObject({
      code: 'QUOTE_EXPIRED',
    });
  });

  test('maps a 429 without a body onto RATE_LIMITED', async () => {
    const { impl } = mockFetch({ '/v1/quote': () => new Response('slow down', { status: 429 }) });
    const upa = makeUpa(impl);

    await expect(upa.quote('https://api.example.com/data')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  test('reports an unreachable API as NETWORK_ERROR', async () => {
    const impl = (async () => {
      throw new TypeError('connection refused');
    }) as unknown as typeof fetch;
    const upa = makeUpa(impl);

    await expect(upa.quote('https://api.example.com/data')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  test('emits an error event as well as throwing', async () => {
    const { impl } = mockFetch({
      '/v1/quote': () => json({ error: { code: 'SWAP_FAILED', message: 'no route' } }, 502),
    });
    const errors: UPAError[] = [];
    const upa = makeUpa(impl, { onError: (error: UPAError) => errors.push(error) });

    await expect(upa.quote('https://api.example.com/data')).rejects.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('SWAP_FAILED');
  });

  test('fails clearly when the payment settles but no response is relayed', async () => {
    const { impl } = mockFetch({
      'api.example.com': () => json(CHALLENGE, 402),
      '/v1/quote': () => json(quoteFixture()),
      '/v1/pay': () => json({ receipt: receiptFixture() }),
    });
    const upa = makeUpa(impl);

    await expect(upa.fetch('https://api.example.com/data')).rejects.toMatchObject({
      code: 'SETTLEMENT_FAILED',
    });
  });
});

describe('api surface', () => {
  let upa: UPA;
  let calls: Call[];

  beforeEach(() => {
    const mock = mockFetch({
      '/v1/receipt/': () => json(receiptFixture()),
      '/v1/tokens': () =>
        json({
          tokens: [
            {
              symbol: 'ETH',
              name: 'Ether',
              address: null,
              chainId: 8453,
              decimals: 18,
              isNative: true,
            },
          ],
        }),
      '/v1/pay': () => json({ receipt: receiptFixture(), apiResponse: { status: 200, body: {} } }),
      '/v1/quote': () => json(quoteFixture()),
    });
    calls = mock.calls;
    upa = makeUpa(mock.impl);
  });

  test('getReceipt fetches by id', async () => {
    const receipt = await upa.getReceipt('receipt-1');
    expect(receipt.receiptId).toBe('receipt-1');
    expect(calls[0]?.url).toBe('https://api.anyx.test/v1/receipt/receipt-1');
  });

  test('getSupportedTokens unwraps the response', async () => {
    const tokens = await upa.getSupportedTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.symbol).toBe('ETH');
  });

  test('pay quotes first when given no quote id', async () => {
    const receipt = await upa.pay('https://api.example.com/data');
    expect(receipt.receiptId).toBe('receipt-1');
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.anyx.test/v1/quote',
      'https://api.anyx.test/v1/pay',
    ]);
  });

  test('pay skips quoting when given a quote id', async () => {
    await upa.pay('https://api.example.com/data', 'quote-existing');
    expect(calls.some((call) => call.url.includes('/v1/quote'))).toBe(false);
  });

  test('on returns an unsubscribe function', async () => {
    const seen: PaymentReceipt[] = [];
    const off = upa.on('payment', (receipt) => seen.push(receipt));

    await upa.pay('https://api.example.com/data', 'q1');
    expect(seen).toHaveLength(1);

    off();
    await upa.pay('https://api.example.com/data', 'q2');
    expect(seen).toHaveLength(1);
  });

  test('a throwing listener does not fail the payment', async () => {
    upa.on('payment', () => {
      throw new Error('listener exploded');
    });
    const receipt = await upa.pay('https://api.example.com/data', 'q1');
    expect(receipt.receiptId).toBe('receipt-1');
  });
});

describe('authentication headers', () => {
  test('sends the API key and partner id when configured', async () => {
    const { impl, calls } = mockFetch({ '/v1/tokens': () => json({ tokens: [] }) });
    const upa = makeUpa(impl, { apiKey: 'anyx_test_key', partnerId: 'partner-7' });

    await upa.getSupportedTokens();

    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('x-api-key')).toBe('anyx_test_key');
    expect(headers.get('x-partner-id')).toBe('partner-7');
  });

  test('sends no API key header when none is configured', async () => {
    const { impl, calls } = mockFetch({ '/v1/tokens': () => json({ tokens: [] }) });
    const upa = makeUpa(impl);

    await upa.getSupportedTokens();

    expect(new Headers(calls[0]?.init?.headers).has('x-api-key')).toBe(false);
  });

  test('derives the wallet address from a viem-shaped wallet client', async () => {
    const { impl, calls } = mockFetch({
      '/v1/pay': () => json({ receipt: receiptFixture(), apiResponse: { status: 200, body: {} } }),
    });
    const upa = makeUpa(impl, {
      wallet: { account: { address: '0x2222222222222222222222222222222222222222' } },
    });

    await upa.pay('https://api.example.com/data', 'quote-1');

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.walletAddress).toBe('0x2222222222222222222222222222222222222222');
  });
});
