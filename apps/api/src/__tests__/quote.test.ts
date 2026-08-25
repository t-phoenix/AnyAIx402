import { getToken } from '@anyx/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insertedRows: unknown[] = [];

vi.mock('../lib/db', () => ({
  getDb: () => ({
    insert: () => ({
      values: async (row: unknown) => {
        insertedRows.push(row);
      },
    }),
  }),
}));

vi.mock('@anyx/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anyx/core')>();
  return {
    ...actual,
    fetch402Challenge: vi.fn(),
    findBaseUsdcOption: vi.fn(),
    getBestQuote: vi.fn(),
  };
});

const core = await import('@anyx/core');
const { app } = await import('../index');

describe('POST /v1/quote', () => {
  beforeEach(() => {
    insertedRows.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a quote for a valid 402-gated endpoint (happy path)', async () => {
    (core.fetch402Challenge as ReturnType<typeof vi.fn>).mockResolvedValue({
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          payTo: '0x000000000000000000000000000000000000dEaD',
          maxTimeoutSeconds: 300,
        },
      ],
    });
    (core.findBaseUsdcOption as ReturnType<typeof vi.fn>).mockReturnValue({
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0x000000000000000000000000000000000000dEaD',
      maxTimeoutSeconds: 300,
    });
    (core.getBestQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      quoteId: '11111111-1111-1111-1111-111111111111',
      inputToken: getToken('ETH', 8453),
      inputAmount: '0.0004',
      usdcRequired: '1.000000',
      usdcOutput: '1.002004',
      fee: '0.002004',
      feeBps: 20,
      route: {
        source: '1inch',
        amountOut: '2500000000',
        estimatedGas: '150000',
        protocols: null,
        priceImpact: 0,
      },
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    const res = await app.request('/v1/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointUrl: 'https://api.example.com/data',
        inputToken: 'ETH',
        inputChainId: 8453,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quoteId).toBe('11111111-1111-1111-1111-111111111111');
    expect(body.usdcRequired).toBe('1.000000');
    expect(insertedRows).toHaveLength(1);
  });

  it('returns INVALID_INPUT for a malformed body', async () => {
    const res = await app.request('/v1/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointUrl: 'not-a-url', inputToken: 'ETH', inputChainId: 8453 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT when the endpoint never returns a 402', async () => {
    (core.fetch402Challenge as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request('/v1/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointUrl: 'https://api.example.com/free',
        inputToken: 'ETH',
        inputChainId: 8453,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });
});
