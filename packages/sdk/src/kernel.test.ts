import { describe, expect, test } from "bun:test";
import {
  BASE_ASSETS,
  BASE_MAINNET,
  ChallengeValidationError,
  InvalidPaymentTransitionError,
  LOCAL_TEST_FEE_BPS,
  PRODUCTION_FEE_BPS,
  TERMINAL_PAYMENT_STATES,
  UnsupportedPaymentError,
  allowedPaymentEvents,
  calculateFeeOnTop,
  challengeFingerprint,
  decodePaymentRequiredHeader,
  deriveOperationIdempotencyKey,
  parseAtomicAmount,
  parsePaymentRequired,
  quoteFingerprint,
  selectPayment,
  transitionPaymentAttempt,
  type PaymentAttemptEvent,
  type PaymentAttemptState,
} from "./index.js";

const payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const normalizedPayTo = "0x209693bc6afc0c5328ba36faf03c514ef312287c";

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: "https://api.example.test/weather",
      description: "Weather",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: BASE_MAINNET,
        amount: "1000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo,
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", version: "2" },
      },
    ],
    extensions: {},
    ...overrides,
  };
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

describe("x402 v2 challenge parsing and selection", () => {
  test("decodes a current v2 PAYMENT-REQUIRED fixture and preserves extensions", () => {
    const parsed = decodePaymentRequiredHeader(
      encode(fixture({ futureField: { retained: true } })),
    );
    expect(parsed.x402Version).toBe(2);
    expect(parsed.futureField).toEqual({ retained: true });
    expect(parsed.accepts[0]?.amount).toBe("1000");
  });

  test.each([
    ["non-object", null],
    ["wrong version", fixture({ x402Version: 1 })],
    ["missing resource", fixture({ resource: undefined })],
    ["bad URL", fixture({ resource: { url: "file:///secret" } })],
    ["empty accepts", fixture({ accepts: [] })],
    ["fractional amount", fixture({ accepts: [{ ...fixture().accepts[0], amount: "1.2" }] })],
    ["leading-zero amount", fixture({ accepts: [{ ...fixture().accepts[0], amount: "01" }] })],
    ["invalid network", fixture({ accepts: [{ ...fixture().accepts[0], network: "base" }] })],
    ["invalid timeout", fixture({ accepts: [{ ...fixture().accepts[0], maxTimeoutSeconds: 0 }] })],
  ])("rejects malformed challenge: %s", (_name, value) => {
    expect(() => parsePaymentRequired(value)).toThrow(ChallengeValidationError);
  });

  test.each(["%%%", "e30===", "4", encode(fixture()).slice(0, -1)])(
    "rejects malformed base64 header %s",
    (header) => {
      expect(() => decodePaymentRequiredHeader(header)).toThrow(ChallengeValidationError);
    },
  );

  test("selects exact Base USDC by address and returns normalized CAIP-19", () => {
    const challenge = parsePaymentRequired(fixture());
    const selected = selectPayment(challenge, {
      schemes: ["exact"],
      networks: [BASE_MAINNET],
      settlementAssets: [BASE_ASSETS.usdc],
      payToAllowlist: [normalizedPayTo],
      maxAmountAtomic: 1000n,
      minTimeoutSeconds: 30,
    });
    expect(selected.asset).toBe(BASE_ASSETS.usdc);
    expect(selected.amountAtomic).toBe(1000n);
    expect(selected.payTo).toBe(normalizedPayTo);
  });

  test.each([
    ["scheme", { scheme: "upto" }],
    ["network", { network: "eip155:1" }],
    ["asset", { asset: "0x4200000000000000000000000000000000000006" }],
    ["recipient", { payTo: "0x0000000000000000000000000000000000000001" }],
    ["amount", { amount: "1001" }],
    ["timeout", { maxTimeoutSeconds: 29 }],
  ])("fails closed for unsupported %s", (_name, requirementOverrides) => {
    const original = fixture();
    const challenge = parsePaymentRequired({
      ...original,
      accepts: [{ ...original.accepts[0], ...requirementOverrides }],
    });
    expect(() =>
      selectPayment(challenge, {
        schemes: ["exact"],
        networks: [BASE_MAINNET],
        settlementAssets: [BASE_ASSETS.usdc],
        payToAllowlist: [payTo],
        maxAmountAtomic: 1000n,
        minTimeoutSeconds: 30,
      }),
    ).toThrow(UnsupportedPaymentError);
  });
});

describe("integer amount and fee arithmetic", () => {
  test.each(["-1", "+1", "1.0", "1e6", " 1", "01", ""])(
    "rejects non-canonical atomic amount %s",
    (value) => expect(() => parseAtomicAmount(value)).toThrow(TypeError),
  );

  test("uses explicit environment defaults", () => {
    expect(PRODUCTION_FEE_BPS).toBe(20);
    expect(LOCAL_TEST_FEE_BPS).toBe(0);
  });

  test("rounds gross amount up and never under-collects the disclosed fee", () => {
    for (let cost = 0n; cost < 10_000n; cost += 1n) {
      for (const feeBps of [0, 1, 20, 99, 100, 999]) {
        const result = calculateFeeOnTop(cost, { feeBps, maxFeeBps: 1000 });
        expect(result.grossAtomic).toBeGreaterThanOrEqual(cost);
        expect(result.feeAtomic).toBe(result.grossAtomic - cost);
        expect(result.grossAtomic * BigInt(10_000 - feeBps)).toBeGreaterThanOrEqual(cost * 10_000n);
        if (result.grossAtomic > 0n) {
          expect((result.grossAtomic - 1n) * BigInt(10_000 - feeBps)).toBeLessThan(cost * 10_000n);
        }
        expect(result.collection).toBe("disclosure-only");
      }
    }
  });

  test("enforces configured fee cap and valid integer basis points", () => {
    expect(() => calculateFeeOnTop(100n, { feeBps: 21, maxFeeBps: 20 })).toThrow(RangeError);
    expect(() => calculateFeeOnTop(100n, { feeBps: 0.5, maxFeeBps: 20 })).toThrow(RangeError);
    expect(() => calculateFeeOnTop(100n, { feeBps: 10_000, maxFeeBps: 10_000 })).toThrow(
      RangeError,
    );
  });
});

describe("fingerprints and operation idempotency", () => {
  test("is deterministic across object key order and changes on bound data", () => {
    const first = challengeFingerprint({ b: 2, a: { y: true, x: "value" } });
    const reordered = challengeFingerprint({ a: { x: "value", y: true }, b: 2 });
    expect(first).toBe(reordered);
    expect(first).toBe("8aba2df283a3caf3cfaf21e7809d72069af38d90d3e34d0a7c79afb906ac505d");
    expect(challengeFingerprint({ a: { x: "changed", y: true }, b: 2 })).not.toBe(first);
  });

  test("binds quote fields and operation identity", () => {
    const quote = {
      challengeFingerprint: "a".repeat(64),
      payer: normalizedPayTo,
      inputAsset: BASE_ASSETS.weth,
      settlementAsset: BASE_ASSETS.usdc,
      apiCostAtomic: "1000",
      grossAtomic: "1003",
      feeAtomic: "3",
      feeBps: 20,
      expiresAt: "2026-08-25T09:00:00.000Z",
    };
    const quoteId = quoteFingerprint(quote);
    expect(quoteFingerprint({ ...quote })).toBe(quoteId);
    expect(quoteFingerprint({ ...quote, feeAtomic: "4" })).not.toBe(quoteId);

    const key = deriveOperationIdempotencyKey("attempt-1", "swap-submit", quoteId);
    expect(deriveOperationIdempotencyKey("attempt-1", "swap-submit", quoteId)).toBe(key);
    expect(deriveOperationIdempotencyKey("attempt-1", "payment-sign", quoteId)).not.toBe(key);
    expect(deriveOperationIdempotencyKey("attempt-2", "swap-submit", quoteId)).not.toBe(key);
  });
});

describe("payment attempt state machine", () => {
  test("permits the successful path", () => {
    let state: PaymentAttemptState = "challenged";
    for (const event of [
      "quote_created",
      "swap_authorized",
      "swap_submitted",
      "swap_confirmed",
      "payment_signed",
      "resource_retried",
      "settlement_observed",
      "completed",
    ] as const) {
      state = transitionPaymentAttempt(state, event);
    }
    expect(state).toBe("completed");
  });

  test("makes ambiguity and recovery explicit", () => {
    expect(transitionPaymentAttempt("swap_submitted", "swap_submission_ambiguous")).toBe(
      "swap_submission_unknown",
    );
    expect(transitionPaymentAttempt("swap_submission_unknown", "swap_confirmed")).toBe(
      "swap_confirmed",
    );
    expect(transitionPaymentAttempt("resource_retried", "settlement_ambiguous")).toBe(
      "settlement_unknown",
    );
    expect(transitionPaymentAttempt("settlement_unknown", "settlement_observed")).toBe(
      "settlement_observed",
    );
  });

  test("rejects every event not explicitly allowed from every state", () => {
    const states: PaymentAttemptState[] = [
      "challenged",
      "quoted",
      "swap_authorized",
      "swap_submitted",
      "swap_submission_unknown",
      "swap_confirmed",
      "payment_signed",
      "resource_retried",
      "payment_submission_unknown",
      "settlement_observed",
      "settlement_unknown",
      ...TERMINAL_PAYMENT_STATES,
    ];
    const events: PaymentAttemptEvent[] = [
      "quote_created",
      "swap_authorized",
      "swap_submitted",
      "swap_submission_ambiguous",
      "swap_confirmed",
      "swap_failed",
      "payment_signed",
      "resource_retried",
      "payment_submission_ambiguous",
      "settlement_observed",
      "settlement_ambiguous",
      "payment_rejected",
      "resource_failed",
      "completed",
      "cancelled",
      "quote_expired",
      "manual_review_required",
    ];
    for (const state of states) {
      const allowed = allowedPaymentEvents(state);
      for (const event of events) {
        if (allowed.includes(event)) {
          expect(() => transitionPaymentAttempt(state, event)).not.toThrow();
        } else {
          expect(() => transitionPaymentAttempt(state, event)).toThrow(
            InvalidPaymentTransitionError,
          );
        }
      }
    }
  });
});
