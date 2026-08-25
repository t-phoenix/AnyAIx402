import { z } from 'zod';
import { X402Error } from './errors';
import type { EIP3009Auth, PaymentOption, PaymentRequired } from './types';

const paymentOptionSchema = z.object({
  scheme: z.enum(['exact', 'upto']),
  network: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  payTo: z.string().min(1),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z
    .object({
      facilitatorVerify: z.string().optional(),
      facilitatorSettle: z.string().optional(),
    })
    .optional(),
});

const paymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  error: z.string(),
  accepts: z.array(paymentOptionSchema).min(1),
});

/** Base mainnet USDC, CAIP-2 encoded per the x402 v2 `network` field. */
export const BASE_USDC_NETWORK = 'eip155:8453';
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Task 1.3.2 — Validates an arbitrary payload against the x402 v2 PaymentRequired schema.
 * Throws X402Error('INVALID_INPUT', ...) on schema mismatch.
 */
export function parsePaymentRequired(body: unknown): PaymentRequired {
  const result = paymentRequiredSchema.safeParse(body);
  if (!result.success) {
    throw new X402Error('INVALID_INPUT', 'Payload is not a valid x402 v2 PaymentRequired body', {
      issues: result.error.flatten(),
    });
  }
  return result.data as PaymentRequired;
}

/**
 * Finds the Base USDC payment option within a parsed PaymentRequired challenge.
 * Throws X402Error('NO_COMPATIBLE_PAYMENT_OPTION', ...) if none is present — Phase 1 only
 * settles on Base USDC (see docs/AGENTS.md Phase 1 scope / off-chain float notes).
 */
export function findBaseUsdcOption(paymentRequired: PaymentRequired): PaymentOption {
  const option = paymentRequired.accepts.find(
    (opt) =>
      opt.network === BASE_USDC_NETWORK &&
      opt.asset.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase(),
  );
  if (!option) {
    throw new X402Error(
      'NO_COMPATIBLE_PAYMENT_OPTION',
      `No Base USDC (${BASE_USDC_NETWORK}) payment option found in the 402 challenge`,
      { accepts: paymentRequired.accepts },
    );
  }
  return option;
}

/**
 * Task 1.3.1 — Fetches `url` and, if the response is HTTP 402, parses the challenge from
 * either the `PAYMENT-REQUIRED` header (base64-encoded JSON) or the JSON response body.
 * Returns null when the response is not a 402 (i.e. no payment needed).
 */
export async function fetch402Challenge(
  url: string,
  init?: RequestInit,
): Promise<PaymentRequired | null> {
  const response = await fetch(url, init);
  if (response.status !== 402) {
    return null;
  }

  const headerValue =
    response.headers.get('PAYMENT-REQUIRED') ?? response.headers.get('payment-required');
  if (headerValue) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf-8'));
    } catch (err) {
      throw new X402Error('INVALID_INPUT', 'Failed to base64-decode PAYMENT-REQUIRED header', {
        cause: (err as Error).message,
      });
    }
    return parsePaymentRequired(decoded);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new X402Error(
      'INVALID_INPUT',
      '402 response has no PAYMENT-REQUIRED header and body is not JSON',
      {
        cause: (err as Error).message,
      },
    );
  }
  return parsePaymentRequired(body);
}

/**
 * Task 1.3.3 — Base64-encodes a signed EIP-3009 authorization as JSON for the X-PAYMENT header.
 */
export function buildPaymentHeader(auth: EIP3009Auth): string {
  return Buffer.from(JSON.stringify(auth), 'utf-8').toString('base64');
}

/**
 * Task 1.3.4 — Retries the original request with the X-PAYMENT header set, expecting a 200 OK.
 * Throws X402Error('SETTLEMENT_FAILED', ...) if the retried request still fails.
 */
export async function submitPayment(
  url: string,
  paymentHeader: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'X-PAYMENT': paymentHeader },
  });

  if (!response.ok) {
    throw new X402Error(
      'SETTLEMENT_FAILED',
      `Retried request with X-PAYMENT header still failed: HTTP ${response.status}`,
      { status: response.status },
    );
  }

  return response;
}
