import { InsufficientBalanceError, NotImplementedError } from './errors.js'
import { assertNoPartialPayment, assertSwapOutputSufficient } from './quote.js'
import type { BestQuote, SwapEvent } from './types.js'

export type SwapExecutorKind = 'prefunded-float' | 'onchain-router'

export interface SwapRequest {
  quote: BestQuote
  /** Wallet the payer supplies the input token from. */
  payer: string
}

export interface SwapResult {
  kind: SwapExecutorKind
  /** USDC atomic units now available to settle the x402 payment. */
  usdcReceived: string
  txHash: string | null
  event: SwapEvent
}

/**
 * Swap-execution seam.
 *
 * Phase 1 settles from a pre-funded USDC float (roadmap note 8) to avoid smart
 * contract risk at launch. The contract-based `AnyXRouter` path implements the
 * same interface and can be swapped in without touching the API routes.
 */
export interface SwapExecutor {
  readonly kind: SwapExecutorKind
  execute(request: SwapRequest): Promise<SwapResult>
}

export interface FloatBalanceProvider {
  /** Available USDC on Base, atomic units. */
  availableUsdc(): Promise<bigint>
}

export class StaticFloatBalanceProvider implements FloatBalanceProvider {
  constructor(private readonly balance: bigint) {}

  async availableUsdc(): Promise<bigint> {
    return this.balance
  }
}

export interface PrefundedFloatExecutorOptions {
  float?: FloatBalanceProvider
  now?: () => number
}

/**
 * Phase 1 executor: AnyX already holds USDC on Base, so "the swap" is a float
 * drawdown. The payer's token is swapped off-chain and the float replenished
 * asynchronously.
 */
export class PrefundedFloatExecutor implements SwapExecutor {
  readonly kind = 'prefunded-float' as const

  private readonly float: FloatBalanceProvider | undefined
  private readonly now: () => number

  constructor(options: PrefundedFloatExecutorOptions = {}) {
    this.float = options.float
    this.now = options.now ?? (() => Date.now())
  }

  async execute(request: SwapRequest): Promise<SwapResult> {
    const { quote } = request
    assertNoPartialPayment(quote)

    const required = BigInt(quote.usdcRequired)
    const gross = BigInt(quote.usdcGross)

    if (this.float) {
      const available = await this.float.availableUsdc()
      if (available < gross) {
        throw new InsufficientBalanceError('USDC float is too small to front this payment', {
          details: {
            availableUsdc: available.toString(),
            requiredUsdc: gross.toString(),
            quoteId: quote.quoteId,
          },
        })
      }
    }

    // The float delivers exactly the gross amount; the shortfall guard still runs
    // so this path cannot silently under-settle.
    const usdcReceived = gross
    assertSwapOutputSufficient(usdcReceived, required)

    return {
      kind: this.kind,
      usdcReceived: usdcReceived.toString(),
      txHash: null,
      event: {
        quoteId: quote.quoteId,
        source: 'prefunded-float',
        inputToken: quote.inputToken.symbol,
        inputAmount: quote.inputAmount,
        usdcReceived: usdcReceived.toString(),
        txHash: null,
        at: new Date(this.now()).toISOString(),
      },
    }
  }
}

/** Placeholder for the Phase 2 `AnyXRouter.swapAndPay` path. */
export class OnchainRouterExecutor implements SwapExecutor {
  readonly kind = 'onchain-router' as const

  async execute(): Promise<SwapResult> {
    throw new NotImplementedError(
      'On-chain swap execution lands with AnyXRouter in Phase 2; use the pre-funded float executor',
    )
  }
}
