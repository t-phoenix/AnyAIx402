import type { BestQuote, PaymentReceipt, Token } from "@anyx/core";

export type UPAConfig = {
  apiKey?: string;
  apiBaseUrl?: string;
  preferredToken: string;
  preferredChainId: number;
  maxSlippage?: number;
  maxFeePercent?: number;
  maxMonthlySpendUSD?: number;
  maxPerCallSpendUSD?: number;
  wallet?: { address?: string };
  fetchImpl?: typeof fetch;
  onPayment?: (receipt: PaymentReceipt) => void;
  onError?: (error: Error) => void;
};

export type PaymentQuote = BestQuote;
export type { PaymentReceipt, Token };
