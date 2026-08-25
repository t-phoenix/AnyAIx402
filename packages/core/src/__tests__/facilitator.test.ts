import { describe, expect, test } from 'bun:test';
import {
  FACILITATOR_HEALTH_TIMEOUT_MS,
  getFacilitatorUrl,
  settlePayment,
  verifyPayment,
} from '../facilitator.js';

const PRIMARY = 'https://primary.facilitator.test';
const FALLBACK = 'https://fallback.facilitator.test';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Honours the abort signal, because a stub that ignores it would make the
 * timeout path untestable and quietly assert nothing.
 */
function stubFetch(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const signal = init?.signal;

    if (signal?.aborted === true) throw new DOMException('aborted', 'AbortError');
    if (!signal) return await handler(url);

    return await new Promise<Response>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {
        once: true,
      });
      Promise.resolve(handler(url)).then(resolve, reject);
    });
  }) as unknown as typeof fetch;
}

const PAYMENT_PAYLOAD = {
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: {
    signature: `0x${'ab'.repeat(65)}`,
    authorization: {
      from: '0x2222222222222222222222222222222222222222',
      to: '0x1111111111111111111111111111111111111111',
      value: '1000000',
      validAfter: '0',
      validBefore: '1893456000',
      nonce: `0x${'11'.repeat(32)}`,
    },
  },
} as unknown as Parameters<typeof verifyPayment>[0]['paymentPayload'];

const REQUIREMENTS = {
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000000',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0x1111111111111111111111111111111111111111',
  maxTimeoutSeconds: 300,
} as unknown as Parameters<typeof verifyPayment>[0]['paymentRequirements'];

describe('getFacilitatorUrl', () => {
  test('uses the primary when it is healthy', async () => {
    const url = await getFacilitatorUrl({
      primaryUrl: PRIMARY,
      fallbackUrl: FALLBACK,
      fetchImpl: stubFetch(() => new Response('', { status: 200 })),
    });
    expect(url).toBe(PRIMARY);
  });

  test('fails over to the fallback when the primary returns 5xx', async () => {
    // A single facilitator is a censorship point; this is the mitigation.
    const url = await getFacilitatorUrl({
      primaryUrl: PRIMARY,
      fallbackUrl: FALLBACK,
      fetchImpl: stubFetch((target) =>
        target.startsWith(PRIMARY)
          ? new Response('unavailable', { status: 503 })
          : new Response('', { status: 200 }),
      ),
    });
    expect(url).toBe(FALLBACK);
  });

  test('fails over when the primary connection is refused', async () => {
    const url = await getFacilitatorUrl({
      primaryUrl: PRIMARY,
      fallbackUrl: FALLBACK,
      fetchImpl: stubFetch((target) => {
        if (target.startsWith(PRIMARY)) throw new TypeError('connection refused');
        return new Response('', { status: 200 });
      }),
    });
    expect(url).toBe(FALLBACK);
  });

  test('fails over when the primary exceeds the health-check timeout', async () => {
    const url = await getFacilitatorUrl({
      primaryUrl: PRIMARY,
      fallbackUrl: FALLBACK,
      timeoutMs: 25,
      fetchImpl: stubFetch(async (target) => {
        if (target.startsWith(PRIMARY)) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return new Response('', { status: 200 });
        }
        return new Response('', { status: 200 });
      }),
    });
    expect(url).toBe(FALLBACK);
  });

  test('the default health timeout is the 2 seconds the PRD specifies', () => {
    expect(FACILITATOR_HEALTH_TIMEOUT_MS).toBe(2000);
  });

  test('throws when the primary is unhealthy and no fallback is configured', async () => {
    // Failing loudly beats returning a facilitator we already know is down and
    // letting the settlement fail with a less informative error.
    await expect(
      getFacilitatorUrl({
        primaryUrl: PRIMARY,
        fallbackUrl: '',
        fetchImpl: stubFetch(() => new Response('down', { status: 503 })),
      }),
    ).rejects.toThrow(/no fallback is configured/i);
  });

  test('throws when neither facilitator is healthy', async () => {
    await expect(
      getFacilitatorUrl({
        primaryUrl: PRIMARY,
        fallbackUrl: FALLBACK,
        fetchImpl: stubFetch(() => new Response('down', { status: 503 })),
      }),
    ).rejects.toThrow(/no healthy facilitator/i);
  });
});

describe('verifyPayment', () => {
  test('reports a valid payment', async () => {
    const result = await verifyPayment(
      {
        paymentPayload: PAYMENT_PAYLOAD,
        paymentRequirements: REQUIREMENTS,
        facilitatorUrl: PRIMARY,
      },
      {
        fetchImpl: stubFetch(() =>
          json({ isValid: true, payer: '0x2222222222222222222222222222222222222222' }),
        ),
      },
    );

    expect(result.isValid).toBe(true);
  });

  test('reports an invalid payment with the stated reason', async () => {
    const result = await verifyPayment(
      {
        paymentPayload: PAYMENT_PAYLOAD,
        paymentRequirements: REQUIREMENTS,
        facilitatorUrl: PRIMARY,
      },
      {
        fetchImpl: stubFetch(() => json({ isValid: false, invalidReason: 'insufficient_funds' })),
      },
    );

    expect(result.isValid).toBe(false);
  });

  test('throws when the facilitator itself errors', async () => {
    await expect(
      verifyPayment(
        {
          paymentPayload: PAYMENT_PAYLOAD,
          paymentRequirements: REQUIREMENTS,
          facilitatorUrl: PRIMARY,
        },
        {
          fetchImpl: stubFetch(() => new Response('boom', { status: 500 })),
        },
      ),
    ).rejects.toThrow();
  });
});

describe('settlePayment', () => {
  test('returns the transaction hash on success', async () => {
    const result = await settlePayment(
      {
        paymentPayload: PAYMENT_PAYLOAD,
        paymentRequirements: REQUIREMENTS,
        facilitatorUrl: PRIMARY,
      },
      {
        fetchImpl: stubFetch(() =>
          json({
            success: true,
            transaction: `0x${'cd'.repeat(32)}`,
            network: 'eip155:8453',
            payer: '0x2222222222222222222222222222222222222222',
          }),
        ),
      },
    );

    expect(result.success).toBe(true);
    expect(result.txHash).toBe(`0x${'cd'.repeat(32)}`);
  });

  test('surfaces a settlement refusal rather than pretending it worked', async () => {
    const result = await settlePayment(
      {
        paymentPayload: PAYMENT_PAYLOAD,
        paymentRequirements: REQUIREMENTS,
        facilitatorUrl: PRIMARY,
      },
      {
        fetchImpl: stubFetch(() => json({ success: false, errorReason: 'insufficient_funds' })),
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('throws when the facilitator is unreachable', async () => {
    await expect(
      settlePayment(
        {
          paymentPayload: PAYMENT_PAYLOAD,
          paymentRequirements: REQUIREMENTS,
          facilitatorUrl: PRIMARY,
        },
        {
          fetchImpl: stubFetch(() => {
            throw new TypeError('connection refused');
          }),
        },
      ),
    ).rejects.toThrow();
  });
});
