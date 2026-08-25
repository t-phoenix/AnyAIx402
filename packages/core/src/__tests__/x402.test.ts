import { describe, expect, test } from 'bun:test';
import { USDC_BASE_ADDRESS } from '../tokens.js';
import {
  BASE_MAINNET_CAIP2,
  buildPaymentHeader,
  caip2ForChain,
  chainIdFromCaip2,
  decodePaymentHeader,
  fetch402Challenge,
  findBaseUsdcOption,
  isBaseUsdcOption,
  PAYMENT_HEADER,
  PAYMENT_REQUIRED_HEADER,
  parsePaymentRequired,
  X402_VERSION,
} from '../x402.js';

const BASE_USDC_OPTION = {
  scheme: 'exact',
  network: BASE_MAINNET_CAIP2,
  amount: '1000000',
  asset: USDC_BASE_ADDRESS,
  payTo: '0x1111111111111111111111111111111111111111',
  maxTimeoutSeconds: 300,
};

const CHALLENGE = {
  x402Version: X402_VERSION,
  error: 'Payment required',
  accepts: [BASE_USDC_OPTION],
};

function jsonResponse(body: unknown, status = 402, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function fetchReturning(response: Response): typeof fetch {
  return (async () => response.clone()) as unknown as typeof fetch;
}

describe('parsePaymentRequired', () => {
  test('accepts a well-formed v2 challenge', () => {
    const parsed = parsePaymentRequired(CHALLENGE);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts).toHaveLength(1);
    expect(parsed.accepts[0]?.amount).toBe('1000000');
  });

  test('rejects a body that is not a challenge at all', () => {
    for (const bad of [null, undefined, 'nope', 42, {}, { accepts: [] }]) {
      expect(() => parsePaymentRequired(bad)).toThrow();
    }
  });

  test('rejects a challenge with no payment options', () => {
    expect(() => parsePaymentRequired({ ...CHALLENGE, accepts: [] })).toThrow();
  });

  test('rejects an option missing the recipient', () => {
    const { payTo, ...withoutPayTo } = BASE_USDC_OPTION;
    expect(payTo).toBeTruthy();
    expect(() => parsePaymentRequired({ ...CHALLENGE, accepts: [withoutPayTo] })).toThrow();
  });

  test('keeps every option, not just the one we can settle', () => {
    const multi = {
      ...CHALLENGE,
      accepts: [
        { ...BASE_USDC_OPTION, network: 'eip155:1' },
        BASE_USDC_OPTION,
        { ...BASE_USDC_OPTION, network: 'solana:mainnet' },
      ],
    };
    expect(parsePaymentRequired(multi).accepts).toHaveLength(3);
  });
});

describe('findBaseUsdcOption', () => {
  test('finds the Base USDC option among several', () => {
    const challenge = parsePaymentRequired({
      ...CHALLENGE,
      accepts: [{ ...BASE_USDC_OPTION, network: 'eip155:1' }, BASE_USDC_OPTION],
    });

    const option = findBaseUsdcOption(challenge);
    expect(option?.network).toBe(BASE_MAINNET_CAIP2);
    expect(option?.amount).toBe('1000000');
  });

  test('returns nothing when the endpoint wants USDC on another chain', () => {
    // Hand-built rather than parsed: parsePaymentRequired rejects a challenge
    // with no settleable option before the finder would ever see it.
    const challenge = {
      x402Version: X402_VERSION,
      error: 'Payment required',
      accepts: [{ ...BASE_USDC_OPTION, network: 'eip155:1' }],
    } as unknown as Parameters<typeof findBaseUsdcOption>[0];

    expect(findBaseUsdcOption(challenge)).toBeUndefined();
  });

  test('returns nothing when the endpoint wants a different asset on Base', () => {
    const challenge = {
      x402Version: X402_VERSION,
      error: 'Payment required',
      accepts: [{ ...BASE_USDC_OPTION, asset: '0x4200000000000000000000000000000000000006' }],
    } as unknown as Parameters<typeof findBaseUsdcOption>[0];

    expect(findBaseUsdcOption(challenge)).toBeUndefined();
  });

  test('parsePaymentRequired rejects a challenge AnyX cannot settle', () => {
    // Failing at parse time is the right call: there is no point quoting a swap
    // for a payment that could never be delivered.
    expect(() =>
      parsePaymentRequired({
        ...CHALLENGE,
        accepts: [{ ...BASE_USDC_OPTION, network: 'eip155:1' }],
      }),
    ).toThrow(/USDC on Base/i);
  });

  test('matches the USDC address case-insensitively', () => {
    const challenge = parsePaymentRequired({
      ...CHALLENGE,
      accepts: [{ ...BASE_USDC_OPTION, asset: USDC_BASE_ADDRESS.toLowerCase() }],
    });
    expect(findBaseUsdcOption(challenge)).toBeDefined();
  });

  test('isBaseUsdcOption agrees with the finder', () => {
    const challenge = parsePaymentRequired(CHALLENGE);
    const option = challenge.accepts[0];
    expect(option).toBeDefined();
    if (option) expect(isBaseUsdcOption(option)).toBe(true);
  });
});

describe('fetch402Challenge', () => {
  test('parses a JSON body on a 402', async () => {
    const challenge = await fetch402Challenge('https://api.example.com/data', {
      fetchImpl: fetchReturning(jsonResponse(CHALLENGE)),
    });
    expect(challenge?.accepts[0]?.amount).toBe('1000000');
  });

  test('parses a base64 PAYMENT-REQUIRED header', async () => {
    const encoded = Buffer.from(JSON.stringify(CHALLENGE), 'utf8').toString('base64');
    const response = new Response('', {
      status: 402,
      headers: { [PAYMENT_REQUIRED_HEADER]: encoded },
    });

    const challenge = await fetch402Challenge('https://api.example.com/data', {
      fetchImpl: fetchReturning(response),
    });
    expect(challenge?.accepts[0]?.payTo).toBe(BASE_USDC_OPTION.payTo);
  });

  test('returns null when the endpoint is not asking for payment', async () => {
    const challenge = await fetch402Challenge('https://api.example.com/data', {
      fetchImpl: fetchReturning(jsonResponse({ data: 'free' }, 200)),
    });
    expect(challenge).toBeNull();
  });

  test('throws on a 402 whose body is not a valid challenge', async () => {
    await expect(
      fetch402Challenge('https://api.example.com/data', {
        fetchImpl: fetchReturning(jsonResponse({ nonsense: true })),
      }),
    ).rejects.toThrow();
  });
});

describe('payment header encoding', () => {
  const signedAuth = {
    from: '0x2222222222222222222222222222222222222222',
    to: BASE_USDC_OPTION.payTo,
    value: 1_000_000n,
    validAfter: 0n,
    validBefore: 1_893_456_000n,
    nonce: `0x${'11'.repeat(32)}`,
    chainId: 8453,
    usdcAddress: USDC_BASE_ADDRESS,
    v: 28,
    r: `0x${'aa'.repeat(32)}`,
    s: `0x${'bb'.repeat(32)}`,
    signature: `0x${'cc'.repeat(65)}`,
  } as unknown as Parameters<typeof buildPaymentHeader>[0];

  test('encodes the authorization as base64, not raw JSON', () => {
    const header = buildPaymentHeader(signedAuth);
    expect(header).not.toContain('{');
    expect(header).not.toContain('"');
  });

  test('decodes back to the same payload', () => {
    const header = buildPaymentHeader(signedAuth);
    const decoded = decodePaymentHeader(header);

    expect(decoded.x402Version).toBe(X402_VERSION);
    expect(decoded.network).toBe(BASE_MAINNET_CAIP2);
    // bigints must survive as decimal strings; JSON cannot carry them natively.
    expect(decoded.payload.authorization.value).toBe('1000000');
    expect(decoded.payload.authorization.to).toBe(BASE_USDC_OPTION.payTo);
  });

  test('the header name is the one x402 specifies', () => {
    expect(PAYMENT_HEADER.toLowerCase()).toBe('x-payment');
  });

  test('rejects a header that is not valid base64 JSON', () => {
    expect(() => decodePaymentHeader('not base64 at all !!!')).toThrow();
  });
});

describe('CAIP-2 handling', () => {
  test('Base mainnet is eip155:8453', () => {
    expect(BASE_MAINNET_CAIP2).toBe('eip155:8453');
    expect(caip2ForChain(8453)).toBe('eip155:8453');
  });

  test('round-trips a chain id', () => {
    for (const chainId of [1, 8453, 84532]) {
      expect(chainIdFromCaip2(caip2ForChain(chainId))).toBe(chainId);
    }
  });

  test('returns null for a non-EVM namespace rather than guessing', () => {
    expect(chainIdFromCaip2('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBeNull();
  });
});
