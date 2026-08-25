import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  buildAuthorizationPayload,
  randomNonce,
  signAuthorization,
  verifyAuthorization,
} from "../eip3009.ts";
import { USDC_BASE } from "../tokens.ts";

describe("EIP-3009", () => {
  it("generates unique nonces", () => {
    const set = new Set(Array.from({ length: 100 }, () => randomNonce()));
    expect(set.size).toBe(100);
  });

  it("sets validBefore about 5 minutes from now", () => {
    const now = 1_700_000_000;
    const payload = buildAuthorizationPayload({
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE as `0x${string}`,
      nowSeconds: now,
    });
    expect(payload.validBefore).toBe(BigInt(now + 300));
    expect(payload.validAfter).toBe(0n);
  });

  it("signs and recovers the from address", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const payload = buildAuthorizationPayload({
      from: account.address,
      to: "0x00000000000000000000000000000000000000aa",
      value: 1_000_000n,
      chainId: 8453,
      usdcAddress: USDC_BASE as `0x${string}`,
    });
    const signed = await signAuthorization(payload, key);
    expect(await verifyAuthorization(signed)).toBe(true);
    expect(signed.signature).toMatch(/^0x/);
  });
});
