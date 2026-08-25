import { UnsupportedPaymentError, ValidationError, X402ChallengeError } from './errors.js';
import {
  base64Decode,
  base64Encode,
  DEFAULT_TIMEOUT_MS,
  type FetchLike,
  fetchWithTimeout,
} from './http.js';
import { paymentRequiredSchema } from './schemas.js';
import { CHAIN_ID_BASE, USDC_BASE_ADDRESS } from './tokens.js';
import type {
  EIP3009Auth,
  PaymentOption,
  PaymentPayload,
  PaymentRequired,
  SignedAuthorization,
} from './types.js';

export const X402_VERSION = 2;
export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
export const PAYMENT_HEADER = 'X-PAYMENT';
export const PAYMENT_RESPONSE_HEADER = 'X-PAYMENT-RESPONSE';
export const BASE_MAINNET_CAIP2 = 'eip155:8453';

export interface Fetch402Options {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  init?: RequestInit;
  /** Skip the Base-USDC compatibility check; useful for inspecting a challenge. */
  requireCompatibleOption?: boolean;
}

export function caip2ForChain(chainId: number): string {
  return `eip155:${chainId}`;
}

export function chainIdFromCaip2(network: string): number | null {
  const match = /^eip155:(\d+)$/.exec(network.trim());
  if (!match?.[1]) return null;
  const chainId = Number.parseInt(match[1], 10);
  return Number.isFinite(chainId) ? chainId : null;
}

function addressesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * True when a payment option is something AnyX can settle today: the x402 `exact`
 * or `upto` scheme, USDC on Base, addressed by CAIP-2.
 */
export function isBaseUsdcOption(option: PaymentOption, usdcAddress = USDC_BASE_ADDRESS): boolean {
  return (
    chainIdFromCaip2(option.network) === CHAIN_ID_BASE && addressesEqual(option.asset, usdcAddress)
  );
}

export function findBaseUsdcOption(
  challenge: PaymentRequired,
  usdcAddress = USDC_BASE_ADDRESS,
): PaymentOption | undefined {
  return challenge.accepts.find((option) => isBaseUsdcOption(option, usdcAddress));
}

/**
 * Validates a 402 body against the x402 v2 schema and confirms AnyX can settle
 * at least one advertised option.
 */
export function parsePaymentRequired(
  body: unknown,
  options: { usdcAddress?: string; requireCompatibleOption?: boolean } = {},
): PaymentRequired {
  const result = paymentRequiredSchema.safeParse(body);
  if (!result.success) {
    throw new X402ChallengeError('Response is not a valid x402 v2 PaymentRequired object', {
      details: result.error.flatten(),
    });
  }

  const challenge = result.data;
  if (options.requireCompatibleOption !== false) {
    const compatible = findBaseUsdcOption(challenge, options.usdcAddress);
    if (!compatible) {
      throw new UnsupportedPaymentError(
        'No compatible payment option: AnyX settles USDC on Base (eip155:8453)',
        {
          details: {
            advertised: challenge.accepts.map((option) => ({
              network: option.network,
              asset: option.asset,
              scheme: option.scheme,
            })),
          },
        },
      );
    }
  }

  return challenge;
}

/** The option AnyX will settle. Throws when none is compatible. */
export function selectPaymentOption(
  challenge: PaymentRequired,
  usdcAddress = USDC_BASE_ADDRESS,
): PaymentOption {
  const option = findBaseUsdcOption(challenge, usdcAddress);
  if (!option) {
    throw new UnsupportedPaymentError('Challenge advertises no USDC-on-Base payment option');
  }
  return option;
}

function decodeChallengeHeader(headerValue: string): unknown {
  const trimmed = headerValue.trim();
  const candidate = trimmed.startsWith('{') ? trimmed : base64Decode(trimmed);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new X402ChallengeError(`Could not decode the ${PAYMENT_REQUIRED_HEADER} header`, {
      cause: error,
    });
  }
}

/**
 * Fetches a URL and returns its x402 challenge, or `null` when the resource is
 * not payment-gated.
 */
export async function fetch402Challenge(
  url: string,
  options: Fetch402Options = {},
): Promise<PaymentRequired | null> {
  const response = await fetchWithTimeout(
    url,
    { method: 'GET', ...options.init },
    { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, fetchImpl: options.fetchImpl },
  );

  if (response.status !== 402) return null;

  const header = response.headers.get(PAYMENT_REQUIRED_HEADER);
  const raw =
    header !== null && header.trim() !== ''
      ? decodeChallengeHeader(header)
      : await parseChallengeBody(response);

  return parsePaymentRequired(raw, {
    requireCompatibleOption: options.requireCompatibleOption,
  });
}

async function parseChallengeBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    throw new X402ChallengeError(
      '402 response carried neither a PAYMENT-REQUIRED header nor a body',
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new X402ChallengeError('402 response body is not valid JSON', { cause: error });
  }
}

function serializeAuthorization(auth: EIP3009Auth): PaymentPayload['payload']['authorization'] {
  return {
    from: auth.from,
    to: auth.to,
    value: auth.value.toString(),
    validAfter: auth.validAfter.toString(),
    validBefore: auth.validBefore.toString(),
    nonce: auth.nonce,
  };
}

/** Builds the x402 `exact`-scheme payment payload for a signed authorization. */
export function buildPaymentPayload(
  auth: SignedAuthorization,
  option?: Pick<PaymentOption, 'scheme' | 'network'>,
): PaymentPayload {
  return {
    x402Version: X402_VERSION,
    scheme: option?.scheme ?? 'exact',
    network: option?.network ?? caip2ForChain(auth.chainId),
    payload: {
      signature: auth.signature,
      authorization: serializeAuthorization(auth),
    },
  };
}

/** Base64 JSON encoding of the payment payload, for the `X-PAYMENT` header. */
export function buildPaymentHeader(
  auth: SignedAuthorization,
  option?: Pick<PaymentOption, 'scheme' | 'network'>,
): string {
  return base64Encode(JSON.stringify(buildPaymentPayload(auth, option)));
}

export function decodePaymentHeader(header: string): PaymentPayload {
  try {
    return JSON.parse(base64Decode(header)) as PaymentPayload;
  } catch (error) {
    throw new ValidationError('X-PAYMENT header is not base64-encoded JSON', { cause: error });
  }
}

export interface SubmitPaymentOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  init?: RequestInit;
}

/** Replays the original request with the `X-PAYMENT` header attached. */
export async function submitPayment(
  url: string,
  paymentHeader: string,
  options: SubmitPaymentOptions = {},
): Promise<Response> {
  const headers = new Headers(options.init?.headers);
  headers.set(PAYMENT_HEADER, paymentHeader);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');

  return fetchWithTimeout(
    url,
    { method: 'GET', ...options.init, headers },
    { timeoutMs: options.timeoutMs ?? 15_000, fetchImpl: options.fetchImpl },
  );
}

export function readPaymentResponseHeader(response: Response): string | null {
  return response.headers.get(PAYMENT_RESPONSE_HEADER);
}

/** Advertisement served at `/.well-known/x402` so agents can discover AnyX. */
export interface X402Capability {
  x402Version: number;
  adapter: string;
  version: string;
  settles: { network: string; asset: string; scheme: string[] };
  acceptsInput: Array<{ symbol: string; chainId: number; swapPath: string }>;
  endpoints: Record<string, string>;
  documentation: string;
}
