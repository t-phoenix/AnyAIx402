import { describe, expect, it } from "vitest";
import { getConfigStatus, loadConfig } from "../load.ts";

describe("config loader", () => {
  it("defaults stub payments and Base RPC", () => {
    const config = loadConfig({ env: {} as NodeJS.ProcessEnv, yamlPath: "/tmp/does-not-exist.yaml" });
    expect(config.stubPayments).toBe(true);
    expect(config.rpcUrlBase).toContain("base");
    expect(config.feeBps).toBe(20);
  });

  it("treats empty private key as unset", () => {
    const config = loadConfig({
      env: { PRIVATE_KEY: "" } as NodeJS.ProcessEnv,
      yamlPath: "/tmp/does-not-exist.yaml",
    });
    expect(config.privateKey).toBeUndefined();
    const status = getConfigStatus(config);
    expect(status.capabilities.pay_live).toBe(false);
    expect(status.capabilities.quote_stub).toBe(true);
  });

  it("enables live quotes when a DEX key is present", () => {
    const config = loadConfig({
      env: { ONEINCH_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      yamlPath: "/tmp/does-not-exist.yaml",
    });
    expect(getConfigStatus(config).capabilities.quote_live).toBe(true);
  });
});
