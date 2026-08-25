import { describe, expect, it } from "vitest";
import { AnyxError } from "../types.ts";
import {
  decodePaymentRequiredHeader,
  fetch402Challenge,
  parsePaymentRequired,
  selectBaseUsdcOption,
} from "../x402.ts";

const valid = {
  x402Version: 2,
  error: "Payment required",
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      amount: "1000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0xRecipient",
      maxTimeoutSeconds: 300,
    },
  ],
};

describe("x402 parser", () => {
  it("parses JSON body", () => {
    const parsed = parsePaymentRequired(valid);
    expect(parsed.accepts[0].amount).toBe("1000");
  });

  it("parses base64 PAYMENT-REQUIRED header", () => {
    const header = Buffer.from(JSON.stringify(valid), "utf8").toString("base64");
    const body = decodePaymentRequiredHeader(header);
    expect(parsePaymentRequired(body).x402Version).toBe(2);
  });

  it("throws when no Base USDC option", () => {
    expect(() =>
      selectBaseUsdcOption(
        parsePaymentRequired({
          ...valid,
          accepts: [{ ...valid.accepts[0], network: "eip155:1" }],
        }),
      ),
    ).toThrow(AnyxError);
  });

  it("fetch402Challenge reads 402 JSON", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(valid), { status: 402 });
    const challenge = await fetch402Challenge("https://x.test/r", fetchImpl);
    expect(challenge?.accepts[0].payTo).toBe("0xRecipient");
  });

  it("returns null when not 402", async () => {
    const fetchImpl: typeof fetch = async () => new Response("ok", { status: 200 });
    expect(await fetch402Challenge("https://x.test/r", fetchImpl)).toBeNull();
  });
});
