export type SwapPath = "direct" | "bridge" | "lightning";

export type Token = {
  symbol: string;
  name: string;
  address: string | null;
  chainId: number;
  decimals: number;
  coingeckoId: string;
  isNative: boolean;
  swapPath: SwapPath;
};

export type PaymentOption = {
  scheme: "exact" | "upto";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    facilitatorVerify?: string;
    facilitatorSettle?: string;
  };
};

export type PaymentRequired = {
  x402Version: 2;
  error: string;
  accepts: PaymentOption[];
};

export type DEXQuote = {
  source: "1inch" | "0x" | "stub";
  amountOut: string;
  estimatedGas?: string;
  protocols?: unknown;
  priceImpact?: string;
};

export type BestQuote = {
  quoteId: string;
  inputToken: Token;
  inputAmount: string;
  inputAmountUsd: string;
  usdcRequired: string;
  fee: string;
  feeBps: number;
  route: { dex: DEXQuote["source"]; priceImpact: string };
  expiresAt: Date;
  usdcOnChain: string;
  endpointUrl: string;
  payTo: string;
  usdcAmountAtomic: string;
};

export type EIP3009Auth = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  v?: number;
  r?: `0x${string}`;
  s?: `0x${string}`;
  signature?: `0x${string}`;
  chainId: number;
  usdcAddress: `0x${string}`;
};

export type PaymentReceipt = {
  receiptId: string;
  timestamp: string;
  endpoint: string;
  quoteId?: string;
  fromAddress?: string;
  inputToken: string;
  inputTokenAddress: string | null;
  inputAmount: string;
  inputAmountUSD: string;
  apiCostUSDC: string;
  adapterFeeUSDC: string;
  swapSlippage: string;
  txHash: string | null;
  blockNumber: number | null;
  facilitator: string;
  xPaymentResponse: string | null;
  status: "pending" | "settled" | "failed";
  stub: boolean;
};

export type ErrorCode =
  | "QUOTE_NOT_FOUND"
  | "QUOTE_EXPIRED"
  | "SWAP_FAILED"
  | "SETTLEMENT_FAILED"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_BALANCE"
  | "SLIPPAGE_EXCEEDED"
  | "NO_ROUTE"
  | "ENDPOINT_NOT_X402"
  | "CONFIG_REQUIRED";

export class AnyxError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AnyxError";
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
