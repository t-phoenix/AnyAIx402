/**
 * Shared TypeScript types for @anyx/core. Re-exported by @anyx/sdk and apps/api.
 * PaymentReceipt intentionally matches docs/x402-universal-adapter-prd.md FR-5 exactly.
 */

export type SwapPath = 'direct' | 'bridge' | 'lightning';

export interface Token {
  symbol: string;
  name: string;
  /** null for native assets (ETH, SOL, BTC) */
  address: string | null;
  chainId: number;
  decimals: number;
  /** CoinGecko API id, used for USD price lookups */
  coingeckoId: string;
  isNative: boolean;
  swapPath: SwapPath;
}

/** ---------------- Quote engine (Task 1.2) ---------------- */

export interface QuoteParams {
  inputToken: Token;
  /** USDC required, in USDC base units (6 decimals), as a decimal string */
  usdcRequired: string;
  chainId: number;
  /** default 50 (0.5%) */
  slippageBps?: number;
}

export type DEXSource = '1inch' | '0x';

export interface DEXQuote {
  source: DEXSource;
  amountOut: string;
  estimatedGas: string;
  protocols: unknown;
  priceImpact: number;
}

export interface BestQuote {
  quoteId: string;
  inputToken: Token;
  /** amount of inputToken the payer must supply, in token base units, as a decimal string */
  inputAmount: string;
  usdcRequired: string;
  usdcOutput: string;
  /** AnyX fee, in USDC, as a decimal string */
  fee: string;
  feeBps: number;
  route: DEXQuote;
  expiresAt: string;
  createdAt: string;
}

/** ---------------- x402 protocol (Task 1.3) ---------------- */

export interface PaymentOption {
  scheme: 'exact' | 'upto';
  /** CAIP-2 chain id, e.g. 'eip155:8453' */
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    facilitatorVerify?: string;
    facilitatorSettle?: string;
  };
}

export interface PaymentRequired {
  x402Version: 2;
  error: string;
  accepts: PaymentOption[];
}

export interface EIP3009Auth {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

/** ---------------- EIP-3009 (Task 1.4) ---------------- */

export interface TransferAuthorizationPayload {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  chainId: number;
  usdcAddress: `0x${string}`;
}

export interface SignedAuthorization extends TransferAuthorizationPayload {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  signature: `0x${string}`;
}

/** ---------------- Facilitator (Task 1.5) ---------------- */

export interface VerifyParams {
  paymentPayload: unknown;
  paymentRequirements: unknown;
  facilitatorUrl?: string;
}

export interface VerifyResult {
  isValid: boolean;
  signer?: string;
  error?: string;
}

export interface SettleParams {
  signedAuthorization: SignedAuthorization;
  facilitatorUrl?: string;
}

export interface SettleResult {
  txHash: string;
  blockNumber?: number;
  success: boolean;
}

export interface TransactionReceiptLike {
  transactionHash: string;
  blockNumber: bigint;
  status: 'success' | 'reverted';
}

/** ---------------- Payment receipt (PRD FR-5) ---------------- */

export interface PaymentReceipt {
  receiptId: string;
  /** ISO-8601 */
  timestamp: string;
  endpoint: string;
  inputToken: string;
  inputTokenAddress: string | null;
  /** in token units, as a decimal string */
  inputAmount: string;
  /** USD equivalent at time of swap, as a decimal string */
  inputAmountUSD: string;
  /** amount sent to the API provider, as a decimal string */
  apiCostUSDC: string;
  /** AnyX spread fee, as a decimal string */
  adapterFeeUSDC: string;
  /** actual slippage experienced, as a decimal string (e.g. "0.0012") */
  swapSlippage: string;
  txHash: string | null;
  blockNumber: number | null;
  facilitator: string;
  /** base64-encoded settlement receipt (X-PAYMENT-RESPONSE) */
  xPaymentResponse: string | null;
  status: 'pending' | 'settled' | 'failed';
}
