import { loadConfig } from "@anyx/config";
import { resetStore } from "@anyx/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.ts";

const challenge = {
  x402Version: 2,
  error: "Payment required",
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x00000000000000000000000000000000000000aa",
      maxTimeoutSeconds: 300,
    },
  ],
};

describe("AnyX API", () => {
  it("health and tokens", async () => {
    const app = createApp(loadConfig({ env: { ANYX_STUB_PAYMENTS: "true" } as NodeJS.ProcessEnv }));
    const health = await app.request("/health");
    expect(health.status).toBe(200);
    const body = await health.json();
    expect(body.status).toBe("ok");
    const tokens = await app.request("/v1/tokens");
    const list = await tokens.json();
    expect(list.tokens.some((t: { symbol: string }) => t.symbol === "ETH")).toBe(true);
  });

  it("setup wizard is HTML", async () => {
    const app = createApp(loadConfig({ env: {} as NodeJS.ProcessEnv }));
    const res = await app.request("/setup");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Connecting APIs");
  });

  it("config status never includes private keys", async () => {
    const app = createApp(
      loadConfig({ env: { PRIVATE_KEY: `0x${"11".repeat(32)}` } as NodeJS.ProcessEnv }),
    );
    const res = await app.request("/v1/config/status");
    const text = await res.text();
    expect(text).not.toContain("111111");
    const json = JSON.parse(text);
    expect(json.groups.some((g: { id: string }) => g.id === "signer")).toBe(true);
  });

  it("quote + stub pay", async () => {
    resetStore();
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes("example.com")) {
        return new Response(JSON.stringify(challenge), { status: 402 });
      }
      return original(input as never);
    }) as typeof fetch;

    try {
      const app = createApp(
        loadConfig({ env: { ANYX_STUB_PAYMENTS: "true" } as NodeJS.ProcessEnv }),
      );
      const quoteRes = await app.request("/v1/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpointUrl: "https://api.example.com/data",
          inputToken: "USDT",
          inputChainId: 8453,
        }),
      });
      expect(quoteRes.status).toBe(200);
      const quote = await quoteRes.json();
      expect(quote.quoteId).toBeTruthy();
      expect(quote.feeBps).toBe(5);

      const payRes = await app.request("/v1/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          walletAddress: "0x0000000000000000000000000000000000000001",
        }),
      });
      const receipt = await payRes.json();
      expect(receipt.status).toBe("settled");
      expect(receipt.stub).toBe(true);

      const got = await app.request(`/v1/receipt/${receipt.receiptId}`);
      expect((await got.json()).receiptId).toBe(receipt.receiptId);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("lightning stub", async () => {
    const app = createApp(loadConfig({ env: {} as NodeJS.ProcessEnv }));
    const res = await app.request("/v1/lightning/invoice", { method: "POST" });
    expect((await res.json()).invoice).toBe("not_implemented");
  });
});
