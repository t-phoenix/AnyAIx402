import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new TypeError("Canonical values must use finite safe integers");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        const entry = record[key];
        if (entry === undefined) {
          throw new TypeError("Canonical values cannot contain undefined");
        }
        return `${JSON.stringify(key)}:${canonicalize(entry)}`;
      });
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical value type: ${typeof value}`);
}

export function fingerprint(domain: string, value: unknown): string {
  if (!/^[a-z][a-z0-9.-]+\/v[1-9][0-9]*$/.test(domain)) {
    throw new TypeError(`Invalid fingerprint domain: ${domain}`);
  }
  return createHash("sha256").update(`${domain}\n${canonicalize(value)}`, "utf8").digest("hex");
}

export function challengeFingerprint(challenge: unknown): string {
  return fingerprint("anyx.challenge/v1", challenge);
}

export interface QuoteFingerprintInput {
  challengeFingerprint: string;
  payer: string;
  inputAsset: string;
  settlementAsset: string;
  apiCostAtomic: string;
  grossAtomic: string;
  feeAtomic: string;
  feeBps: number;
  expiresAt: string;
}

export function quoteFingerprint(quote: QuoteFingerprintInput): string {
  return fingerprint("anyx.quote/v1", quote);
}

export type PaymentOperation =
  | "quote"
  | "swap-authorize"
  | "swap-submit"
  | "payment-sign"
  | "resource-retry";

export function deriveOperationIdempotencyKey(
  attemptId: string,
  operation: PaymentOperation,
  bindingFingerprint: string,
): string {
  if (!attemptId.trim()) {
    throw new TypeError("attemptId cannot be empty");
  }
  return `${operation}:${fingerprint("anyx.operation/v1", {
    attemptId,
    bindingFingerprint,
    operation,
  })}`;
}
