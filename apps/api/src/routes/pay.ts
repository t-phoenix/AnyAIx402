import type { BestQuote, PaymentReceipt, SwapEvent } from '@anyx/core';
import {
  formatTokenAmount,
  formatUsdc,
  NotImplementedError,
  PrefundedFloatExecutor,
  QuoteExpiredError,
  QuoteNotFoundError,
  ValidationError,
} from '@anyx/core';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app.js';
import { capabilities } from '../config.js';

const payRequestSchema = z.object({
  quoteId: z.string().min(1),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'walletAddress must be a 20-byte hex address')
    .optional(),
  endpointUrl: z.string().url().optional(),
});

function buildReceipt(
  quote: BestQuote,
  swap: SwapEvent,
  endpoint: string,
  facilitator: string | null,
  timestamp: string,
): PaymentReceipt {
  return {
    receiptId: crypto.randomUUID(),
    timestamp,
    endpoint,
    inputToken: quote.inputToken.symbol,
    inputTokenAddress: quote.inputToken.address,
    inputAmount: formatTokenAmount(BigInt(quote.inputAmount), quote.inputToken.decimals),
    inputAmountUSD: null,
    apiCostUSDC: formatUsdc(BigInt(quote.usdcRequired)),
    adapterFeeUSDC: formatUsdc(BigInt(quote.fee.usdc)),
    swapSlippage: null,
    txHash: swap.txHash,
    blockNumber: null,
    facilitator,
    xPaymentResponse: null,
    status: swap.txHash === null ? 'pending' : 'settled',
  };
}

export function registerPayRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/pay', async (c) => {
    const deps = c.get('deps');

    const parsed = payRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid pay request.', { details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const stored = await deps.store.getQuote(body.quoteId);
    if (!stored) {
      throw new QuoteNotFoundError(
        `Quote ${body.quoteId} is unknown. Quotes are held for ${deps.config.quoteTtlSeconds}s; request a new one.`,
      );
    }
    if (stored.status === 'used') {
      throw new ValidationError(
        `Quote ${body.quoteId} has already been settled. Each quote pays exactly once.`,
      );
    }
    if (stored.status === 'expired' || new Date(stored.quote.expiresAt).getTime() <= deps.now()) {
      throw new QuoteExpiredError(body.quoteId, stored.quote.expiresAt);
    }

    const quote = stored.quote;
    const endpoint = body.endpointUrl ?? quote.endpointUrl;
    if (!endpoint) {
      throw new ValidationError('endpointUrl is required when the quote did not record one.');
    }

    // Settlement needs a signer to authorize the transfer and a facilitator to
    // submit it. Without both, refuse before touching the quote: returning 200
    // here would consume a one-time quote and hand back a receipt for a payment
    // the recipient never received.
    const settlement = capabilities(deps.config).settlement;
    if (!settlement.enabled) {
      throw new NotImplementedError(
        `Cannot settle this payment: ${settlement.reason}. The quote has not been consumed; it stays valid until ${quote.expiresAt}.`,
        { details: { quoteId: quote.quoteId, capability: 'settlement' } },
      );
    }

    // Phase 1 settles from the pre-funded USDC float rather than an on-chain
    // swap, per roadmap note 8. The executor interface is the seam where the
    // AnyXRouter path drops in unchanged.
    const executor = new PrefundedFloatExecutor({
      now: deps.now,
      ...(deps.floatBalance ? { float: deps.floatBalance } : {}),
    });
    const swap = await executor.execute({
      quote,
      payer: body.walletAddress ?? '0x0000000000000000000000000000000000000000',
    });

    const receipt = buildReceipt(
      quote,
      swap.event,
      endpoint,
      deps.config.facilitatorUrl ?? null,
      new Date(deps.now()).toISOString(),
    );

    // Only a quote that actually produced a settlement is spent.
    await deps.store.markQuoteUsed(quote.quoteId);
    await deps.store.saveReceipt(receipt);

    c.header('x-anyx-receipt-id', receipt.receiptId);

    return c.json({
      receipt,
      swap: swap.event,
      // Relaying the origin response requires a settled authorization, which
      // requires a configured signer. Reported plainly rather than faked.
      apiResponse: null,
      status: receipt.status,
    });
  });
}
