import { loadConfig } from "@anyx/config";
import { describe, expect, it } from "vitest";
import { getBestQuote, quoteForEndpoint, stubDexQuote } from "../quote.ts";
import { resetStore } from "../store.ts";
import { getToken } from "../tokens.ts";

const usdt = getToken("USDT", 8453)!;

const challenge = {
  x402Version: 2 as const,
  error: "Payment required",
  accepts: [
    {
      scheme: "exact" as const,
      network: "eip155:8453",
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x00000000000000000000000000000000000000aa",
      maxTimeoutSeconds: 300,
    },
  ],
};

describe("quote engine", () => {
  it("falls back to stub when no DEX keys", async () => {
    const config = loadConfig({ env: {} as NodeJS.ProcessEnv });
    const best = await getBestQuote({ inputToken: usdt, usdcRequired: "1", chainId: 8453 }, config);
    expect(best.dex.source).toBe("stub");
    expect(best.feeBps).toBe(5);
  });

  it("picks the higher amountOut when 1inch fails and 0x succeeds", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("1inch")) return new Response("fail", { status: 500 });
      return new Response(JSON.stringify({ buyAmount: "2000000" }), { status: 200 });
    };
    const config = loadConfig({
      env: { ONEINCH_API_KEY: "k1", ZEROX_API_KEY: "k2" } as NodeJS.ProcessEnv,
    });
    const best = await getBestQuote(
      { inputToken: usdt, usdcRequired: "1", chainId: 8453 },
      config,
      fetchImpl,
    );
    expect(best.dex.source).toBe("0x");
  });

  it("quotes an x402 endpoint and expires in ~30s", async () => {
    resetStore();
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(challenge), {
        status: 402,
        headers: { "content-type": "application/json" },
      });
    const config = loadConfig({ env: {} as NodeJS.ProcessEnv });
    const quote = await quoteForEndpoint({
      endpointUrl: "https://api.example.com/data",
      inputToken: "USDT",
      inputChainId: 8453,
      config,
      fetchImpl,
      now: new Date("2025-08-25T12:00:00Z"),
    });
    expect(quote.usdcRequired).toBe("1.000000");
    expect(quote.payTo).toBe("0x00000000000000000000000000000000000000aa");
    expect(quote.expiresAt.toISOString()).toBe("2025-08-25T12:00:30.000Z");
    expect(quote.route.dex).toBe("stub");
  });

  it("stub quote is deterministic-ish", () => {
    const dex = stubDexQuote({ inputToken: usdt, usdcRequired: "1", chainId: 8453 });
    expect(dex.source).toBe("stub");
    expect(Number(dex.amountOut)).toBeGreaterThan(1_000_000);
  });
});
