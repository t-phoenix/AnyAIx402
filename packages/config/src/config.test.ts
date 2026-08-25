import { describe, expect, test } from "bun:test";
import { BASE_ASSETS, BASE_MAINNET } from "@anyx/sdk";
import example from "../config.example.json";
import { ConfigSecurityError, parseAnyxConfig } from "./index.js";

function config(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: "config.anyx.dev/v1alpha1",
    environment: "test",
    payments: {
      protocolVersion: 2,
      network: BASE_MAINNET,
      settlementAsset: BASE_ASSETS.usdc,
      acquisitionAssets: [BASE_ASSETS.eth, BASE_ASSETS.weth, BASE_ASSETS.usdtBridged],
      maxFeeBps: 100,
      collectFeeOnchain: false,
      rpcRef: "secret://payments/base-rpc",
    },
    ...overrides,
  };
}

describe("public configuration validation", () => {
  test("validates the checked-in redacted example", () => {
    const parsed = parseAnyxConfig(example);
    expect(parsed.environment).toBe("local");
    expect(parsed.payments.feeBps).toBe(0);
    expect(parsed.payments.settlementAsset).toBe(BASE_ASSETS.usdc);
  });

  test("applies production 20 bps and non-production 0 bps defaults", () => {
    expect(parseAnyxConfig(config()).payments.feeBps).toBe(0);
    expect(parseAnyxConfig(config({ environment: "staging" })).payments.feeBps).toBe(0);
    expect(parseAnyxConfig(config({ environment: "production" })).payments.feeBps).toBe(20);
  });

  test("enforces the fee cap and forbids enabling collection", () => {
    expect(() =>
      parseAnyxConfig(
        config({
          payments: { ...config().payments, feeBps: 101, maxFeeBps: 100 },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseAnyxConfig(
        config({
          payments: { ...config().payments, collectFeeOnchain: true },
        }),
      ),
    ).toThrow();
  });

  test.each([
    ["apiKey", "sk-live-not-allowed"],
    ["privateKey", "0xdeadbeef"],
    ["mnemonic", "one two three four five six seven eight nine ten eleven twelve"],
    ["databasePassword", "not-allowed"],
  ])("rejects inline field %s", (key, value) => {
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, [key]: value },
      }),
    ).toThrow(ConfigSecurityError);
  });

  test("rejects private-key-shaped values even under an innocent key", () => {
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, walletMaterial: `0x${"a".repeat(64)}` },
      }),
    ).toThrow(ConfigSecurityError);
  });

  test("rejects inline authenticated URLs and malformed references", () => {
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, endpoint: "https://user:password@example.test" },
      }),
    ).toThrow(ConfigSecurityError);
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, rpcRef: "https://rpc.example.test/key" },
      }),
    ).toThrow(ConfigSecurityError);
  });

  test("rejects unknown keys, wrong network, and wrong settlement asset", () => {
    expect(() => parseAnyxConfig({ ...config(), unexpected: true })).toThrow();
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, network: "eip155:1" },
      }),
    ).toThrow();
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: { ...config().payments, settlementAsset: BASE_ASSETS.weth },
      }),
    ).toThrow();
  });

  test("rejects duplicate acquisition assets by normalized identity", () => {
    expect(() =>
      parseAnyxConfig({
        ...config(),
        payments: {
          ...config().payments,
          acquisitionAssets: [BASE_ASSETS.weth, BASE_ASSETS.weth.toUpperCase()],
        },
      }),
    ).toThrow();
  });
});
