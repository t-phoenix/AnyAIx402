import { parseAtomicAmount } from "./amount.js";
import { type Caip19Id, type Caip2Id, erc20Caip19, parseCaip2, parseEvmAddress } from "./caip.js";
import { challengeFingerprint } from "./fingerprint.js";

export interface ResourceInfo extends Record<string, unknown> {
  url: string;
  description?: string;
  mimeType?: string;
}

export interface PaymentRequirement extends Record<string, unknown> {
  scheme: string;
  network: Caip2Id;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentRequired extends Record<string, unknown> {
  x402Version: 2;
  resource: ResourceInfo;
  accepts: PaymentRequirement[];
  error?: string;
  extensions?: Record<string, unknown>;
}

export interface PaymentSelectionPolicy {
  schemes: readonly string[];
  networks: readonly Caip2Id[];
  settlementAssets: readonly Caip19Id[];
  payToAllowlist?: readonly string[];
  maxAmountAtomic?: bigint;
  minTimeoutSeconds?: number;
}

export interface SelectedPayment {
  requirement: PaymentRequirement;
  network: Caip2Id;
  asset: Caip19Id;
  amountAtomic: bigint;
  payTo: `0x${string}`;
  challengeFingerprint: string;
}

export class ChallengeValidationError extends Error {
  override readonly name = "ChallengeValidationError";
}

export class UnsupportedPaymentError extends Error {
  override readonly name = "UnsupportedPaymentError";

  constructor(readonly reasons: readonly string[]) {
    super(`No supported payment requirement: ${reasons.join("; ")}`);
  }
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ChallengeValidationError(`${field} must be an object`);
  }
}

function requiredString(record: Record<string, unknown>, field: string, label = field): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new ChallengeValidationError(`${label} must be a non-empty string`);
  }
  return value;
}

function parseResource(value: unknown): ResourceInfo {
  assertRecord(value, "resource");
  const url = requiredString(value, "url", "resource.url");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ChallengeValidationError("resource.url must be an absolute URL");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new ChallengeValidationError("resource.url must use HTTP or HTTPS");
  }
  for (const field of ["description", "mimeType"]) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      throw new ChallengeValidationError(`resource.${field} must be a string`);
    }
  }
  return value as ResourceInfo;
}

function parseRequirement(value: unknown, index: number): PaymentRequirement {
  assertRecord(value, `accepts[${index}]`);
  const amount = requiredString(value, "amount");
  try {
    parseAtomicAmount(amount);
  } catch (error) {
    throw new ChallengeValidationError((error as Error).message);
  }
  const timeout = value.maxTimeoutSeconds;
  if (!Number.isSafeInteger(timeout) || (timeout as number) <= 0) {
    throw new ChallengeValidationError("maxTimeoutSeconds must be a positive safe integer");
  }
  if (value.extra !== undefined) {
    assertRecord(value.extra, "extra");
  }
  let network: Caip2Id;
  try {
    network = parseCaip2(requiredString(value, "network"));
  } catch (error) {
    throw new ChallengeValidationError((error as Error).message);
  }
  return {
    ...value,
    scheme: requiredString(value, "scheme"),
    network,
    amount,
    asset: requiredString(value, "asset"),
    payTo: requiredString(value, "payTo"),
    maxTimeoutSeconds: timeout as number,
  };
}

export function parsePaymentRequired(value: unknown): PaymentRequired {
  assertRecord(value, "PaymentRequired");
  if (value.x402Version !== 2) {
    throw new ChallengeValidationError("x402Version must be 2");
  }
  if (!Array.isArray(value.accepts) || value.accepts.length === 0) {
    throw new ChallengeValidationError("accepts must be a non-empty array");
  }
  if (value.error !== undefined && typeof value.error !== "string") {
    throw new ChallengeValidationError("error must be a string");
  }
  if (value.extensions !== undefined) {
    assertRecord(value.extensions, "extensions");
  }
  return {
    ...value,
    x402Version: 2,
    resource: parseResource(value.resource),
    accepts: value.accepts.map(parseRequirement),
  };
}

export function decodePaymentRequiredHeader(header: string, maxBytes = 64 * 1024): PaymentRequired {
  if (
    header.length === 0 ||
    header.length > Math.ceil((maxBytes * 4) / 3) + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(header)
  ) {
    throw new ChallengeValidationError("PAYMENT-REQUIRED is not valid bounded base64");
  }
  let decoded: Uint8Array;
  try {
    decoded = Uint8Array.from(Buffer.from(header, "base64"));
  } catch {
    throw new ChallengeValidationError("PAYMENT-REQUIRED is not valid base64");
  }
  if (decoded.byteLength > maxBytes) {
    throw new ChallengeValidationError("PAYMENT-REQUIRED exceeds maximum decoded size");
  }
  const normalizedInput = header.replace(/=+$/, "");
  const normalizedOutput = Buffer.from(decoded).toString("base64").replace(/=+$/, "");
  if (normalizedInput !== normalizedOutput) {
    throw new ChallengeValidationError("PAYMENT-REQUIRED is not canonical base64");
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
  } catch {
    throw new ChallengeValidationError("PAYMENT-REQUIRED is not valid UTF-8 JSON");
  }
  return parsePaymentRequired(value);
}

export function selectPayment(
  challenge: PaymentRequired,
  policy: PaymentSelectionPolicy,
): SelectedPayment {
  const reasons: string[] = [];
  const allowedRecipients = policy.payToAllowlist?.map((value) => parseEvmAddress(value));

  for (const requirement of challenge.accepts) {
    try {
      if (!policy.schemes.includes(requirement.scheme)) {
        throw new Error(`unsupported scheme ${requirement.scheme}`);
      }
      if (!policy.networks.includes(requirement.network)) {
        throw new Error(`unsupported network ${requirement.network}`);
      }
      const address = parseEvmAddress(requirement.asset);
      const asset = erc20Caip19(requirement.network, address);
      if (!policy.settlementAssets.includes(asset)) {
        throw new Error(`unsupported asset ${asset}`);
      }
      const payTo = parseEvmAddress(requirement.payTo);
      if (allowedRecipients && !allowedRecipients.includes(payTo)) {
        throw new Error(`recipient ${payTo} is not allowed`);
      }
      const amountAtomic = parseAtomicAmount(requirement.amount);
      if (amountAtomic === 0n) {
        throw new Error("zero amount is not payable");
      }
      if (policy.maxAmountAtomic !== undefined && amountAtomic > policy.maxAmountAtomic) {
        throw new Error("amount exceeds policy maximum");
      }
      if (
        policy.minTimeoutSeconds !== undefined &&
        requirement.maxTimeoutSeconds < policy.minTimeoutSeconds
      ) {
        throw new Error("timeout is below policy minimum");
      }
      return {
        requirement,
        network: requirement.network,
        asset,
        amountAtomic,
        payTo,
        challengeFingerprint: challengeFingerprint(challenge),
      };
    } catch (error) {
      reasons.push(`accepts[${reasons.length}]: ${(error as Error).message}`);
    }
  }
  throw new UnsupportedPaymentError(reasons);
}
