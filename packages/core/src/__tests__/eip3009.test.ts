import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { buildAuthorizationPayload, signAuthorization, verifyAuthorization } from '../eip3009';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

describe('buildAuthorizationPayload', () => {
  it('sets validAfter to 0 (immediate)', () => {
    const payload = buildAuthorizationPayload({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });
    expect(payload.validAfter).toBe(0n);
  });

  it('sets validBefore to ~5 minutes from now', () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = buildAuthorizationPayload({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });
    const after = Math.floor(Date.now() / 1000);
    const delta = Number(payload.validBefore) - before;
    expect(delta).toBeGreaterThanOrEqual(300);
    expect(delta).toBeLessThanOrEqual(300 + (after - before) + 2);
  });

  it('generates unique nonces across 100 calls', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const payload = buildAuthorizationPayload({
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: 1_000_000n,
        chainId: 8453,
        usdcAddress: USDC_BASE,
      });
      nonces.add(payload.nonce);
    }
    expect(nonces.size).toBe(100);
  });

  it('produces a 32-byte (66-char hex) nonce', () => {
    const payload = buildAuthorizationPayload({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });
    expect(payload.nonce).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('signAuthorization / verifyAuthorization', () => {
  it('signs then successfully verifies (recovers the correct signer)', async () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const payload = buildAuthorizationPayload({
      from: account.address,
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });

    const signed = await signAuthorization(payload, privateKey);
    expect(signed.v).toBeGreaterThanOrEqual(27);
    expect(signed.r).toMatch(/^0x/);
    expect(signed.s).toMatch(/^0x/);

    const isValid = await verifyAuthorization(signed);
    expect(isValid).toBe(true);
  });

  it('fails verification if the signature is tampered with', async () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const payload = buildAuthorizationPayload({
      from: account.address,
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });

    const signed = await signAuthorization(payload, privateKey);
    const tampered = { ...signed, value: 2_000_000n };

    const isValid = await verifyAuthorization(tampered);
    expect(isValid).toBe(false);
  });

  it('rejects signing when the private key does not match payload.from', async () => {
    const privateKey = generatePrivateKey();
    const wrongFrom = '0x3333333333333333333333333333333333333333' as const;

    const payload = buildAuthorizationPayload({
      from: wrongFrom,
      to: '0x2222222222222222222222222222222222222222',
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE,
    });

    await expect(signAuthorization(payload, privateKey)).rejects.toThrow();
  });
});
