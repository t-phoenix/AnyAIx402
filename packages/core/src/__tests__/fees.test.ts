import { describe, expect, it } from "vitest";
import { feeBpsForToken, feeUsdc, grossUsdcForFee } from "../fees.ts";
import { getToken } from "../tokens.ts";

describe("fee math", () => {
  it("applies 0.20% so $1.00 USDC costs $1.002 gross", () => {
    const gross = grossUsdcForFee(1, 20);
    expect(gross).toBeCloseTo(1.002004008, 8);
    expect(feeUsdc(1, 20)).toBeCloseTo(0.002004008, 8);
  });

  it("uses 5 bps for USDT and 20 for ETH", () => {
    expect(feeBpsForToken(getToken("USDT", 8453)!)).toBe(5);
    expect(feeBpsForToken(getToken("ETH", 8453)!)).toBe(20);
    expect(feeBpsForToken(getToken("cbBTC", 8453)!)).toBe(25);
    expect(feeBpsForToken(getToken("BTC", 0)!)).toBe(50);
  });

  it("zero fee when bps is 0", () => {
    expect(grossUsdcForFee(1, 0)).toBe(1);
  });
});
