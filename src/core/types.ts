import { z } from 'zod';

export const PaymentOptionSchema = z.object({
  scheme: z.enum(['exact', 'upto']).default('exact'),
  network: z.string(), // e.g. 'eip155:8453' or 'aptos:mainnet'
  amount: z.string(),
  asset: z.string(), // token address
  payTo: z.string(),
  maxTimeoutSeconds: z.number().default(300),
  extra: z.object({
    facilitatorVerify: z.string().optional(),
    facilitatorSettle: z.string().optional()
  }).optional()
});

export type PaymentOption = z.infer<typeof PaymentOptionSchema>;

export const PaymentRequiredSchema = z.object({
  x402Version: z.number().default(2),
  error: z.string().default('Payment required'),
  accepts: z.array(PaymentOptionSchema)
});

export type PaymentRequired = z.infer<typeof PaymentRequiredSchema>;

export interface PaymentQuote {
  quoteId: string;
  endpointUrl: string;
  inputToken: string;
  inputChainId: number;
  inputAmount: string;
  inputAmountUSD: string;
  usdcRequired: string;
  feeUsdc: string;
  feeBps: number;
  route: {
    dex: string;
    priceImpact: string;
    path: string[];
  };
  expiresAt: string;
}

export interface PaymentReceipt {
  receiptId: string;
  timestamp: string;
  endpoint: string;
  inputToken: string;
  inputAmount: string;
  usdcSettled: string;
  feeUsdc: string;
  txHash: string;
  blockNumber: number;
  facilitator: string;
  status: 'settled' | 'pending' | 'failed';
  apiResponse?: any;
}
