import { describe, expect, it } from "vitest";
import { TOKEN_REGISTRY, getToken, isSupported, v0Tokens } from "../tokens.ts";

describe("token registry", () => {
  it("includes Base USDC, USDT, ETH, WETH, cbBTC", () => {
    const symbols = v0Tokens()
      .map((t) => t.symbol)
      .sort();
    expect(symbols).toEqual(["ETH", "USDC", "USDT", "WETH", "cbBTC"].sort());
  });

  it("looks up by symbol and chain", () => {
    const usdt = getToken("USDT", 8453);
    expect(usdt?.address).toBe("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2");
    expect(getToken("USDT", 1)?.swapPath).toBe("bridge");
  });

  it("isSupported matches addresses case-insensitively", () => {
    expect(isSupported("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 8453)).toBe(true);
    expect(isSupported("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 8453)).toBe(true);
    expect(isSupported(null, 8453)).toBe(true);
    expect(TOKEN_REGISTRY.length).toBeGreaterThan(8);
  });
});
