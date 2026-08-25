import { describe, expect, test } from 'bun:test';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AUTHORIZATION_VALIDITY_SECONDS,
  buildAuthorizationPayload,
  buildDomain,
  isAuthorizationExpired,
  randomNonce,
  serializeAuthorization,
  signAuthorization,
  splitSignature,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  USDC_EIP712_NAME,
  USDC_EIP712_VERSION,
  verifyAuthorization,
} from '../eip3009.js';
import { USDC_BASE_ADDRESS } from '../tokens.js';

const PRIVATE_KEY = `0x${'11'.repeat(32)}` as const;
const account = privateKeyToAccount(PRIVATE_KEY);
const RECIPIENT = '0x1111111111111111111111111111111111111111';

function payload(overrides: Record<string, unknown> = {}) {
  return buildAuthorizationPayload({
    from: account.address,
    to: RECIPIENT,
    value: 1_000_000n,
    chainId: 8453,
    usdcAddress: USDC_BASE_ADDRESS,
    ...overrides,
  });
}

describe('nonce generation', () => {
  test('produces a 32-byte hex value', () => {
    const nonce = randomNonce();
    expect(nonce).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  test('100 nonces are all distinct', () => {
    // A collision would let a payment be replayed, so this is not a formality.
    const nonces = new Set(Array.from({ length: 100 }, () => randomNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe('buildAuthorizationPayload', () => {
  test('is valid immediately', () => {
    expect(payload().validAfter).toBe(0n);
  });

  test('expires five minutes out, bounding a stolen signature', () => {
    const now = Math.floor(Date.now() / 1000);
    const validBefore = Number(payload().validBefore);

    expect(AUTHORIZATION_VALIDITY_SECONDS).toBe(300);
    expect(validBefore).toBeGreaterThan(now + 290);
    expect(validBefore).toBeLessThanOrEqual(now + 301);
  });

  test('carries the payment details through unchanged', () => {
    const built = payload();
    expect(built.from.toLowerCase()).toBe(account.address.toLowerCase());
    expect(built.to).toBe(RECIPIENT);
    expect(built.value).toBe(1_000_000n);
    expect(built.chainId).toBe(8453);
  });

  test('gives each payload a fresh nonce', () => {
    expect(payload().nonce).not.toBe(payload().nonce);
  });
});

describe('the EIP-712 domain', () => {
  test('matches USDC FiatTokenV2_2 exactly', () => {
    // Any drift here produces a signature USDC will reject on-chain, which is
    // the sort of bug that only shows up when real money is moving.
    const domain = buildDomain({ chainId: 8453, usdcAddress: USDC_BASE_ADDRESS });

    expect(domain.name).toBe(USDC_EIP712_NAME);
    expect(domain.name).toBe('USD Coin');
    expect(domain.version).toBe(USDC_EIP712_VERSION);
    expect(domain.version).toBe('2');
    expect(domain.chainId).toBe(8453);
    expect(domain.verifyingContract).toBe(USDC_BASE_ADDRESS);
  });

  test('the typed-data struct matches the EIP-3009 specification', () => {
    const fields = TRANSFER_WITH_AUTHORIZATION_TYPES.TransferWithAuthorization;
    expect(fields.map((field) => field.name)).toEqual([
      'from',
      'to',
      'value',
      'validAfter',
      'validBefore',
      'nonce',
    ]);
    expect(fields.map((field) => field.type)).toEqual([
      'address',
      'address',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ]);
  });
});

describe('signing and verification', () => {
  test('a signature recovers to the declared payer', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    expect(await verifyAuthorization(signed)).toBe(true);
  });

  test('splits into v, r and s', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);

    expect(signed.r).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(signed.s).toMatch(/^0x[0-9a-f]{64}$/i);
    expect([27, 28]).toContain(signed.v);
    expect(signed.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  test('splitSignature agrees with the parts on the signed object', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    const parts = splitSignature(signed.signature);

    expect(parts.r).toBe(signed.r);
    expect(parts.s).toBe(signed.s);
    expect(parts.v).toBe(signed.v);
  });

  test('a tampered amount fails verification', async () => {
    // The single most important property: an intermediary must not be able to
    // raise the amount after the payer has signed.
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    expect(await verifyAuthorization({ ...signed, value: 999_999_999n })).toBe(false);
  });

  test('a tampered recipient fails verification', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    const attacker = '0x9999999999999999999999999999999999999999';
    expect(await verifyAuthorization({ ...signed, to: attacker })).toBe(false);
  });

  test('a tampered nonce fails verification', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    expect(await verifyAuthorization({ ...signed, nonce: randomNonce() })).toBe(false);
  });

  test('a signature for one chain does not verify against another', async () => {
    // Without the chainId in the domain, a Base signature would be replayable
    // on every other EVM chain.
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    expect(await verifyAuthorization({ ...signed, chainId: 1 })).toBe(false);
  });

  test('two payments produce different signatures', async () => {
    const first = await signAuthorization(payload(), PRIVATE_KEY);
    const second = await signAuthorization(payload(), PRIVATE_KEY);
    expect(first.signature).not.toBe(second.signature);
  });
});

describe('expiry', () => {
  test('a fresh authorization is not expired', () => {
    expect(isAuthorizationExpired(payload())).toBe(false);
  });

  test('a past deadline is expired', () => {
    const stale = { ...payload(), validBefore: BigInt(Math.floor(Date.now() / 1000) - 1) };
    expect(isAuthorizationExpired(stale)).toBe(true);
  });
});

describe('serialization', () => {
  test('renders bigints as decimal strings so the payload is JSON-safe', async () => {
    const signed = await signAuthorization(payload(), PRIVATE_KEY);
    const serialized = serializeAuthorization(signed);

    expect(serialized.value).toBe('1000000');
    expect(serialized.validAfter).toBe('0');
    expect(typeof serialized.validBefore).toBe('string');
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});
