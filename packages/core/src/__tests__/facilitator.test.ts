import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilitatorError } from '../errors';
import {
  DEFAULT_FACILITATOR_URL,
  KNOWN_FALLBACK_FACILITATOR_URL,
  getFacilitatorUrl,
  getFallbackFacilitatorUrl,
  resolveFacilitatorUrl,
  settlePayment,
  verifyPayment,
} from '../facilitator';
import type { SignedAuthorization } from '../types';

describe('getFacilitatorUrl / getFallbackFacilitatorUrl', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the documented default when FACILITATOR_URL is unset', () => {
    delete process.env.FACILITATOR_URL;
    expect(getFacilitatorUrl()).toBe(DEFAULT_FACILITATOR_URL);
  });

  it('returns FACILITATOR_URL when set', () => {
    process.env.FACILITATOR_URL = 'https://custom.facilitator.example';
    expect(getFacilitatorUrl()).toBe('https://custom.facilitator.example');
  });

  it('returns the known fallback when FACILITATOR_FALLBACK_URL is unset', () => {
    delete process.env.FACILITATOR_FALLBACK_URL;
    expect(getFallbackFacilitatorUrl()).toBe(KNOWN_FALLBACK_FACILITATOR_URL);
  });
});

describe('resolveFacilitatorUrl (failover)', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FACILITATOR_URL: 'https://primary.example',
      FACILITATOR_FALLBACK_URL: 'https://fallback.example',
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('uses the primary when its health check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const url = await resolveFacilitatorUrl();
    expect(url).toBe('https://primary.example');
  });

  it('fails over to the fallback when the primary returns 503', async () => {
    global.fetch = vi.fn().mockImplementation((input: string | URL) => {
      if (input.toString().includes('primary')) {
        return Promise.resolve(new Response('unavailable', { status: 503 }));
      }
      return Promise.resolve(new Response('ok', { status: 200 }));
    });
    const url = await resolveFacilitatorUrl();
    expect(url).toBe('https://fallback.example');
  });

  it('fails over when the primary health check times out (aborts) within ~2s', async () => {
    global.fetch = vi.fn().mockImplementation((_input, opts?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const url = await resolveFacilitatorUrl();
    expect(url).toBe('https://fallback.example');
  }, 5000);
});

describe('verifyPayment', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts to /verify and returns the parsed result', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ isValid: true, signer: '0xabc' }), { status: 200 }),
      );

    const result = await verifyPayment({
      paymentPayload: { foo: 'bar' },
      paymentRequirements: { baz: 'qux' },
      facilitatorUrl: 'https://facilitator.example',
    });

    expect(result.isValid).toBe(true);
    expect(result.signer).toBe('0xabc');
  });

  it('returns isValid: false (does not throw) when the facilitator is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await verifyPayment({
      paymentPayload: {},
      paymentRequirements: {},
      facilitatorUrl: 'https://facilitator.example',
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('settlePayment', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const signedAuthorization: SignedAuthorization = {
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: 1_000_000n,
    validAfter: 0n,
    validBefore: 9_999_999_999n,
    nonce: '0xabc',
    chainId: 8453,
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    v: 27,
    r: '0xdead',
    s: '0xbeef',
    signature: '0xdeadbeef',
  };

  it('posts to /settle and returns the settlement result', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ txHash: '0xtx', blockNumber: 123, success: true }), {
        status: 200,
      }),
    );

    const result = await settlePayment({
      signedAuthorization,
      facilitatorUrl: 'https://facilitator.example',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xtx');
  });

  it('throws FacilitatorError on a non-2xx settle response', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));
    await expect(
      settlePayment({ signedAuthorization, facilitatorUrl: 'https://facilitator.example' }),
    ).rejects.toBeInstanceOf(FacilitatorError);
  });
});
