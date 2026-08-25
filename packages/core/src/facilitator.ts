import type { AnyxConfig } from "@anyx/config";
import { AnyxError } from "./types.ts";

export type VerifyParams = {
  paymentPayload: unknown;
  paymentRequirements: unknown;
};

export type VerifyResult = { isValid: boolean; signer?: string; error?: string };
export type SettleResult = { txHash: string; blockNumber: number; success: boolean };

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new AnyxError("SETTLEMENT_FAILED", "Facilitator timeout")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getFacilitatorUrl(
  config: Pick<AnyxConfig, "facilitatorUrl" | "facilitatorFallbackUrl">,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const primary = config.facilitatorUrl.replace(/\/$/, "");
  try {
    const res = await withTimeout(fetchImpl(primary, { method: "GET" }), 2000);
    if (res.ok || res.status === 404 || res.status === 405) return primary;
    if (res.status >= 500 && config.facilitatorFallbackUrl) {
      return config.facilitatorFallbackUrl.replace(/\/$/, "");
    }
  } catch {
    if (config.facilitatorFallbackUrl) return config.facilitatorFallbackUrl.replace(/\/$/, "");
  }
  return primary;
}

export async function verifyPayment(
  params: VerifyParams,
  facilitatorUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyResult> {
  const res = await fetchImpl(`${facilitatorUrl.replace(/\/$/, "")}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    return { isValid: false, error: `verify HTTP ${res.status}` };
  }
  return (await res.json()) as VerifyResult;
}

export async function settlePayment(
  signedAuthorization: unknown,
  facilitatorUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SettleResult> {
  const res = await fetchImpl(`${facilitatorUrl.replace(/\/$/, "")}/settle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedAuthorization }),
  });
  if (!res.ok) {
    throw new AnyxError("SETTLEMENT_FAILED", `Facilitator settle failed (${res.status})`);
  }
  return (await res.json()) as SettleResult;
}
