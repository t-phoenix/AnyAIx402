import { describe, expect, it } from "vitest";
import { getFacilitatorUrl, verifyPayment } from "../facilitator.ts";

describe("facilitator client", () => {
  it("fails over when primary returns 503", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("primary")) return new Response("down", { status: 503 });
      return new Response("ok", { status: 200 });
    };
    const url = await getFacilitatorUrl(
      {
        facilitatorUrl: "https://primary.example/x402",
        facilitatorFallbackUrl: "https://fallback.example/x402",
      },
      fetchImpl,
    );
    expect(url).toContain("fallback");
  });

  it("verifyPayment posts to /verify", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("/verify");
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ isValid: true, signer: "0xabc" }), { status: 200 });
    };
    const result = await verifyPayment(
      { paymentPayload: {}, paymentRequirements: {} },
      "https://fac.test",
      fetchImpl,
    );
    expect(result.isValid).toBe(true);
  });
});
