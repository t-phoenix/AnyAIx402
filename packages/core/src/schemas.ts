import { z } from 'zod';

export const swapPathSchema = z.enum(['direct', 'bridge', 'lightning']);

export const tokenSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable(),
  chainId: z.number().int().nonnegative(),
  decimals: z.number().int().min(0).max(36),
  coingeckoId: z.string().min(1),
  isNative: z.boolean(),
  swapPath: swapPathSchema,
});

/** Atomic-unit amount: digits only, no sign, no decimal point. */
export const atomicAmountSchema = z
  .string()
  .regex(/^\d+$/, 'amount must be a non-negative integer string in atomic units');

export const quoteParamsSchema = z.object({
  inputToken: tokenSchema,
  usdcRequired: atomicAmountSchema,
  chainId: z.number().int().nonnegative(),
  slippageBps: z.number().int().min(0).max(5_000).optional(),
  /** Optional probe size used when asking a DEX for a price; defaults to 1 whole token. */
  amountIn: atomicAmountSchema.optional(),
  endpointUrl: z.string().url().optional(),
  feeBps: z.number().int().min(0).max(1_000).optional(),
});

export const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address');

export const hex32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex value');

export const paymentSchemeSchema = z.enum(['exact', 'upto']);

export const paymentOptionSchema = z.object({
  scheme: paymentSchemeSchema,
  network: z.string().min(1),
  amount: atomicAmountSchema,
  asset: z.string().min(1),
  payTo: z.string().min(1),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z
    .object({
      facilitatorVerify: z.string().url().optional(),
      facilitatorSettle: z.string().url().optional(),
    })
    .passthrough()
    .optional(),
});

export const paymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  error: z.string(),
  accepts: z.array(paymentOptionSchema).min(1, 'accepts must contain at least one payment option'),
});

export const authorizationSchema = z.object({
  from: evmAddressSchema,
  to: evmAddressSchema,
  value: atomicAmountSchema,
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: hex32Schema,
});

export const signedAuthorizationSchema = authorizationSchema.extend({
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  v: z.number().int(),
  r: hex32Schema,
  s: hex32Schema,
});

export const paymentPayloadSchema = z.object({
  x402Version: z.literal(2),
  scheme: paymentSchemeSchema,
  network: z.string().min(1),
  payload: z.object({
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    authorization: authorizationSchema,
  }),
});

export const verifyResultSchema = z.object({
  isValid: z.boolean(),
  signer: z.string().optional(),
  invalidReason: z.string().optional(),
  error: z.string().optional(),
});

export const settleResultSchema = z.object({
  success: z.boolean(),
  txHash: z.string().optional(),
  transaction: z.string().optional(),
  blockNumber: z.union([z.number(), z.string()]).optional(),
  network: z.string().optional(),
  payer: z.string().optional(),
  errorReason: z.string().optional(),
});
