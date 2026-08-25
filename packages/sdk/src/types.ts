/**
 * The SDK carries no runtime dependencies. Anything it needs from viem is
 * described structurally, so installing `@anyx/sdk` never drags a wallet
 * library into a project that does not already have one.
 */
export interface WalletLike {
  readonly account?: { readonly address: string } | undefined;
  readonly address?: string | undefined;
  getAddresses?(): Promise<readonly string[]>;
}

export type TokenSymbol = string;

export interface Token {
  symbol: TokenSymbol;
  name: string;
  address: string | null;
  chainId: number;
  decimals: number;
  isNative: boolean;
  /** USD price at the time of the response, when the SDK could obtain one. */
  priceUsd?: string | null;
}

export interface QuoteFee {
  bps: number;
  /** Atomic USDC units, 6 decimals. */
  usdc: string;
}

export interface QuoteRoute {
  source: string;
  amountIn: string;
  amountOut: string;
  estimatedGas: string | null;
  priceImpact: number | null;
}

export interface PaymentQuote {
  quoteId: string;
  endpointUrl: string | null;
  inputToken: Token;
  /** Atomic units of the input token the payer must supply. */
  inputAmount: string;
  /** Atomic USDC the x402 server requires. */
  usdcRequired: string;
  /** What the swap must produce: `usdcRequired` plus the AnyX spread. */
  usdcGross: string;
  fee: QuoteFee;
  /** Hard floor on swap output. A swap yielding less must fail. */
  minAmountOut: string;
  slippageBps: number;
  route: QuoteRoute;
  createdAt: string;
  expiresAt: string;
}

/** PRD FR-5. Every field an auditor needs to reconcile a payment. */
export interface PaymentReceipt {
  receiptId: string;
  timestamp: string;
  endpoint: string;
  inputToken: string;
  inputTokenAddress: string | null;
  inputAmount: string;
  inputAmountUSD: string | null;
  apiCostUSDC: string;
  adapterFeeUSDC: string;
  swapSlippage: string | null;
  txHash: string | null;
  blockNumber: number | null;
  facilitator: string | null;
  xPaymentResponse: string | null;
  status: 'pending' | 'settled' | 'failed';
}

export interface SwapEvent {
  quoteId: string;
  source: string;
  inputToken: string;
  inputAmount: string;
  usdcReceived: string;
  txHash: string | null;
  at: string;
}

export interface UPAConfig {
  /** Optional on the free tier. */
  apiKey?: string;
  /** Defaults to https://api.anyx.xyz. Point at http://localhost:3000 when self-hosting. */
  apiBaseUrl?: string;
  /** Required for on-chain flows; the hosted float path does not need it. */
  wallet?: WalletLike;
  /** Wallet address to pull tokens from. Derived from `wallet` when omitted. */
  walletAddress?: string;
  /** Symbol of the token to pay with: 'ETH', 'USDT', 'WBTC', … */
  preferredToken: TokenSymbol;
  /** Chain the payer holds that token on. */
  preferredChainId: number;
  /** Fraction, not basis points. Default 0.005 (0.5%). */
  maxSlippage?: number;
  /** Reject a quote whose AnyX fee exceeds this fraction. Default 0.01 (1%). */
  maxFeePercent?: number;
  /** Credited with a share of the AnyX fee on embedded integrations. */
  partnerId?: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** Injectable for testing and for runtimes with a non-global fetch. */
  fetchImpl?: typeof fetch;
  onPayment?: (receipt: PaymentReceipt) => void;
  onSwap?: (event: SwapEvent) => void;
  onError?: (error: UPAError) => void;
}

export type UPAErrorCode =
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_EXPIRED'
  | 'SWAP_FAILED'
  | 'SETTLEMENT_FAILED'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_BALANCE'
  | 'FEE_TOO_HIGH'
  | 'SLIPPAGE_TOO_HIGH'
  | 'NO_WALLET'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class UPAError extends Error {
  readonly code: UPAErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: UPAErrorCode,
    message: string,
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'UPAError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.details !== undefined) this.details = options.details;
  }
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type UPAEventMap = {
  payment: PaymentReceipt;
  swap: SwapEvent;
  error: UPAError;
};

export type UPAEventName = keyof UPAEventMap;
