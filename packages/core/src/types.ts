import type { Address, Hex } from 'viem'
import type { z } from 'zod'
import type {
  authorizationSchema,
  paymentOptionSchema,
  paymentPayloadSchema,
  paymentRequiredSchema,
  quoteParamsSchema,
  settleResultSchema,
  signedAuthorizationSchema,
  swapPathSchema,
  verifyResultSchema,
} from './schemas.js'

export type SwapPath = z.infer<typeof swapPathSchema>

export interface Token {
  symbol: string
  name: string
  /** `null` for native assets (ETH, SOL, BTC). */
  address: string | null
  chainId: number
  decimals: number
  coingeckoId: string
  isNative: boolean
  swapPath: SwapPath
}

export type QuoteParams = z.infer<typeof quoteParamsSchema>

export type DexSource = '1inch' | '0x'

export interface DEXQuote {
  source: DexSource
  /** Atomic units of the input token that were quoted. */
  amountIn: string
  /** Atomic units of USDC returned for `amountIn`. */
  amountOut: string
  estimatedGas: string | null
  protocols: unknown
  priceImpact: number | null
}

export interface FeeBreakdown {
  feeBps: number
  /** USDC the x402 server requires, atomic units. */
  usdcRequired: string
  /** AnyX spread, atomic units of USDC. */
  feeUsdc: string
  /** `usdcRequired + feeUsdc` — the amount the swap must produce. */
  usdcGross: string
}

export interface QuoteRoute {
  source: DexSource
  amountIn: string
  amountOut: string
  estimatedGas: string | null
  protocols: unknown
  priceImpact: number | null
  /** Sources that were queried but failed, with their reason. */
  rejected: Array<{ source: DexSource; reason: string }>
}

export interface BestQuote {
  quoteId: string
  endpointUrl: string | null
  inputToken: Token
  /** Atomic units of the input token the payer must supply. */
  inputAmount: string
  usdcRequired: string
  usdcGross: string
  fee: { bps: number; usdc: string }
  /**
   * Hard floor on swap output. Always equals `usdcRequired`: a swap that yields
   * less must fail, because partial x402 payments are not representable.
   */
  minAmountOut: string
  slippageBps: number
  route: QuoteRoute
  createdAt: string
  expiresAt: string
}

export type PaymentOption = z.infer<typeof paymentOptionSchema>
export type PaymentRequired = z.infer<typeof paymentRequiredSchema>
export type PaymentPayload = z.infer<typeof paymentPayloadSchema>

/** Serialized (JSON-safe) EIP-3009 authorization. */
export type Authorization = z.infer<typeof authorizationSchema>
export type SignedAuthorizationJson = z.infer<typeof signedAuthorizationSchema>

/** In-memory EIP-3009 authorization, before signing. */
export interface TransferAuthorizationPayload {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: Hex
  chainId: number
  usdcAddress: Address
}

export interface EIP3009Auth extends TransferAuthorizationPayload {
  v: number
  r: Hex
  s: Hex
  signature: Hex
}

export type SignedAuthorization = EIP3009Auth

export type VerifyResult = z.infer<typeof verifyResultSchema>
export type SettleResultRaw = z.infer<typeof settleResultSchema>

export interface VerifyParams {
  paymentPayload: PaymentPayload
  paymentRequirements: PaymentOption
  facilitatorUrl?: string
  apiKey?: string
}

export interface SettleParams {
  paymentPayload: PaymentPayload
  paymentRequirements: PaymentOption
  facilitatorUrl?: string
  apiKey?: string
}

export interface SettleResult {
  success: boolean
  txHash: string | null
  blockNumber: number | null
  network: string | null
  payer: string | null
  error: string | null
  raw: unknown
}

export interface SwapEvent {
  quoteId: string
  source: DexSource | 'prefunded-float'
  inputToken: string
  inputAmount: string
  usdcReceived: string
  txHash: string | null
  at: string
}

/** PRD FR-5 receipt shape. */
export interface PaymentReceipt {
  receiptId: string
  timestamp: string
  endpoint: string
  inputToken: string
  inputTokenAddress: string | null
  /** Human-readable token units. */
  inputAmount: string
  inputAmountUSD: string | null
  /** Human-readable USDC sent to the API provider. */
  apiCostUSDC: string
  adapterFeeUSDC: string
  swapSlippage: string | null
  txHash: string | null
  blockNumber: number | null
  facilitator: string | null
  xPaymentResponse: string | null
  status: 'pending' | 'settled' | 'failed'
}
