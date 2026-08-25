import { afterEach, describe, expect, it, vi } from 'vitest';
import { X402Error } from '../errors';
import type { EIP3009Auth, PaymentRequired } from '../types';
import {
  BASE_USDC_ADDRESS,
  BASE_USDC_NETWORK,
  buildPaymentHeader,
  fetch402Challenge,
  findBaseUsdcOption,
  parsePaymentRequired,
  submitPayment,
} from '../x402';

const validChallenge: PaymentRequired = {
  x402Version: 2,
  error: 'Payment required',
  accepts: [
    {
      scheme: 'exact',
      network: BASE_USDC_NETWORK,
      amount: '1000000',
      asset: BASE_USDC_ADDRESS,
      payTo: '0x000000000000000000000000000000000000dEaD',
      maxTimeoutSeconds: 300,
      extra: { facilitatorVerify: 'https://facilitator.example/verify' },
    },
  ],
};

describe('parsePaymentRequired', () => {
  it('parses a valid x402 v2 body', () => {
    const parsed = parsePaymentRequired(validChallenge);
    expect(parsed.accepts).toHaveLength(1);
  });

  it('throws X402Error on invalid body', () => {
    expect(() => parsePaymentRequired({ foo: 'bar' })).toThrow(X402Error);
  });

  it('throws X402Error when x402Version is not 2', () => {
    expect(() => parsePaymentRequired({ ...validChallenge, x402Version: 1 })).toThrow(X402Error);
  });
});

describe('findBaseUsdcOption', () => {
  it('finds the Base USDC option when present', () => {
    const option = findBaseUsdcOption(validChallenge);
    expect(option.network).toBe(BASE_USDC_NETWORK);
  });

  it('throws NO_COMPATIBLE_PAYMENT_OPTION when Base USDC is absent', () => {
    const other: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:1',
          amount: '1000000',
          asset: '0xdeadbeef00000000000000000000000000dead',
          payTo: '0x000000000000000000000000000000000000dEaD',
          maxTimeoutSeconds: 300,
        },
      ],
    };
    try {
      findBaseUsdcOption(other);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(X402Error);
      expect((err as X402Error).code).toBe('NO_COMPATIBLE_PAYMENT_OPTION');
    }
  });
});

describe('fetch402Challenge', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null when the response is not a 402', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await fetch402Challenge('https://api.example.com/data');
    expect(result).toBeNull();
  });

  it('parses a base64-encoded PAYMENT-REQUIRED header', async () => {
    const encoded = Buffer.from(JSON.stringify(validChallenge)).toString('base64');
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 402,
        headers: { 'PAYMENT-REQUIRED': encoded },
      }),
    );
    const result = await fetch402Challenge('https://api.example.com/data');
    expect(result?.accepts[0]?.payTo).toBe('0x000000000000000000000000000000000000dEaD');
  });

  it('parses the JSON body directly when no header is present', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validChallenge), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await fetch402Challenge('https://api.example.com/data');
    expect(result?.x402Version).toBe(2);
  });
});

describe('buildPaymentHeader / submitPayment', () => {
  const auth: EIP3009Auth = {
    from: '0x1111111111111111111111111111111111111111',
    to: '0x000000000000000000000000000000000000dEaD',
    value: '1000000',
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 300,
    nonce: '0xabc',
    v: 27,
    r: '0xdef',
    s: '0x123',
  };

  it('base64-encodes the auth as JSON', () => {
    const header = buildPaymentHeader(auth);
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    expect(decoded.from).toBe(auth.from);
    expect(decoded.value).toBe(auth.value);
  });

  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retries with X-PAYMENT header and returns the 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    global.fetch = fetchMock;

    const header = buildPaymentHeader(auth);
    const response = await submitPayment('https://api.example.com/data', header);

    expect(response.status).toBe(200);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['X-PAYMENT']).toBe(header);
  });

  it('throws SETTLEMENT_FAILED when the retried request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 402 }));
    const header = buildPaymentHeader(auth);
    await expect(submitPayment('https://api.example.com/data', header)).rejects.toThrow(X402Error);
  });
});
