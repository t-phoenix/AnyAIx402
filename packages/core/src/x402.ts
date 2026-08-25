import { z } from "zod";
import { AnyxError, type PaymentRequired } from "./types.ts";
import { USDC_BASE } from "./tokens.ts";

export const paymentOptionSchema = z.object({
  scheme: z.enum(["exact", "upto"]),
  network: z.string(),
  amount: z.string(),
  asset: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number(),
  extra: z
    .object({
      facilitatorVerify: z.string().optional(),
      facilitatorSettle: z.string().optional(),
    })
    .optional(),
});

export const paymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  error: z.string(),
  accepts: z.array(paymentOptionSchema).min(1),
});

export function parsePaymentRequired(body: unknown): PaymentRequired {
  const parsed = paymentRequiredSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnyxError("INVALID_INPUT", "Not a valid x402 v2 PaymentRequired body", parsed.error.flatten());
  }
  return parsed.data;
}

export function selectBaseUsdcOption(challenge: PaymentRequired) {
  const option = challenge.accepts.find(
    (item) =>
      item.network === "eip155:8453" &&
      item.asset.toLowerCase() === USDC_BASE.toLowerCase(),
  );
  if (!option) {
    throw new AnyxError(
      "NO_ROUTE",
      "This endpoint does not advertise USDC on Base (eip155:8453). AnyX v0 can only settle that option.",
    );
  }
  return option;
}

export function decodePaymentRequiredHeader(header: string): unknown {
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      throw new AnyxError("INVALID_INPUT", "PAYMENT-REQUIRED header is not JSON or base64 JSON");
    }
  }
}

export async function fetch402Challenge(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PaymentRequired | null> {
  const response = await fetchImpl(url, { method: "GET", redirect: "manual" });
  if (response.status !== 402) return null;

  const header =
    response.headers.get("PAYMENT-REQUIRED") ?? response.headers.get("payment-required");
  if (header) {
    return parsePaymentRequired(decodePaymentRequiredHeader(header));
  }

  const body = await response.json().catch(() => null);
  if (!body) {
    throw new AnyxError("ENDPOINT_NOT_X402", "402 response had no PaymentRequired body");
  }
  return parsePaymentRequired(body);
}

export function buildPaymentHeader(auth: {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  v: number;
  r: string;
  s: string;
}): string {
  return Buffer.from(JSON.stringify(auth), "utf8").toString("base64");
}

export async function submitPayment(
  url: string,
  paymentHeader: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpl(url, {
    method: "GET",
    headers: { "X-PAYMENT": paymentHeader },
  });
}

export function usdcRequiredFromAmount(amountAtomic: string, decimals = 6): number {
  const raw = BigInt(amountAtomic);
  return Number(raw) / 10 ** decimals;
}
