import type { AnyxErrorCode, PaymentReceipt as CorePaymentReceipt, Token } from '@anyx/core';
import type { WalletClient } from 'viem';

/** SDK-level error codes: every AnyX API error code, plus SDK-only network/client errors. */
export type UPAErrorCode =
  | AnyxErrorCode
  | 'NETWORK_ERROR'
  | 'NO_QUOTE'
  | 'NOT_A_402'
  | 'FEE_TOO_HIGH'
  | 'WALLET_REQUIRED';

/**
 * Task 1.7 — UPAConfig (docs/AGENTS.md). `wallet` is a viem WalletClient used to derive the
 * `walletAddress` sent to `/v1/pay` and (optionally) to sign requests client-side in a future
 * phase; Phase 1 only reads `wallet.account.address`.
 */
export interface UPAConfig {
  /** AnyX API key (optional for free tier). Sent as `X-API-Key`. */
  apiKey?: string;
  /** Default: https://api.anyx.xyz */
  apiBaseUrl?: string;
  /** viem WalletClient — only `account.address` is required in Phase 1. */
  wallet?: WalletClient;
  /** Token symbol to pay with: 'ETH', 'USDT', 'WBTC', etc. */
  preferredToken: string;
  /** Chain where the payer holds `preferredToken`. */
  preferredChainId: number;
  /** Max slippage tolerance passed through to /v1/quote. Default: 0.005 (0.5%). */
  maxSlippage?: number;
  /** Reject the quote client-side if AnyX's fee exceeds this fraction. Default: 0.01 (1%). */
  maxFeePercent?: number;
  /** Called after every successful payment. */
  onPayment?: (receipt: PaymentReceipt) => void;
  /** Called whenever fetch()/quote()/pay() throws a UPAError. */
  onError?: (error: UPAErrorLike) => void;
}

export interface UPAErrorLike {
  code: UPAErrorCode;
  message: string;
  details?: unknown;
}

/** Shape returned by POST /v1/quote (apps/api/src/routes/quote.ts). */
export interface PaymentQuote {
  quoteId: string;
  inputToken: string;
  inputAmount: string;
  usdcRequired: string;
  fee: string;
  expiresAt: string;
  route: unknown;
  payTo: string;
}

/**
 * The itemized receipt (docs/x402-universal-adapter-prd.md FR-5), enriched with the raw API
 * response body when it's available (immediately after `pay()`; `getReceipt()` on its own does
 * not persist `apiResponse` server-side, so it will be `undefined` there).
 */
export interface PaymentReceipt extends CorePaymentReceipt {
  apiResponse?: unknown;
}

/** Raw shape returned by POST /v1/pay (apps/api/src/routes/pay.ts), before enrichment. */
export interface RawPayResult {
  receiptId: string;
  txHash: string | null;
  apiResponse: unknown;
  status: 'settled' | 'failed' | 'pending';
}

export interface QuoteOptions {
  slippageBps?: number;
}

export interface PayOptions {
  /** Reuse a quote already obtained via quote(); skips a redundant /v1/quote call. */
  quoteId?: string;
}

export interface UPAFetchOptions extends RequestInit {
  /** Reuse a quote already obtained via quote(). */
  useQuote?: PaymentQuote;
}

export type { Token };
