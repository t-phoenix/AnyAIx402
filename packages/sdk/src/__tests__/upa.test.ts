import { describe, expect, it } from "vitest";
import { UPA } from "../upa.ts";

describe("UPA SDK", () => {
  it("quotes then pays via the AnyX API", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/v1/quote")) {
        return new Response(
          JSON.stringify({
            quoteId: "q1",
            inputAmount: "1.002",
            usdcRequired: "1",
            fee: "0.002",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/v1/pay")) {
        return new Response(
          JSON.stringify({
            receiptId: "r1",
            status: "settled",
            stub: true,
            txHash: "0xstub",
          }),
          { status: 200 },
        );
      }
      return new Response("no", { status: 404 });
    };

    const upa = new UPA({
      preferredToken: "ETH",
      preferredChainId: 8453,
      apiBaseUrl: "http://anyx.test",
      fetchImpl,
    });
    const quote = await upa.quote("https://api.example.com/data");
    expect(quote.quoteId).toBe("q1");
    const receipt = await upa.pay("https://api.example.com/data", quote.quoteId);
    expect(receipt.receiptId).toBe("r1");
    expect(calls.some((c) => c.includes("/v1/quote"))).toBe(true);
    expect(calls.some((c) => c.includes("/v1/pay"))).toBe(true);
  });

  it("passes through non-402 fetch", async () => {
    const fetchImpl: typeof fetch = async () => new Response("hello", { status: 200 });
    const upa = new UPA({
      preferredToken: "USDT",
      preferredChainId: 8453,
      fetchImpl,
    });
    const res = await upa.fetch("https://free.example/data");
    expect(await res.text()).toBe("hello");
  });
});
