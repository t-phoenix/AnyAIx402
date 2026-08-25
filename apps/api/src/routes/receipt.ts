import { AnyxError, type PaymentReceipt } from '@anyx/core';
import { payments, quotes } from '@anyx/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../lib/db';

export const receiptRoute = new Hono();

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * GET /v1/receipt/:id — full PaymentReceipt (docs/x402-universal-adapter-prd.md FR-5 shape).
 */
receiptRoute.get('/v1/receipt/:id', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    throw new AnyxError('INVALID_INPUT', 'receipt id must be a UUID');
  }

  const db = getDb();
  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!payment) {
    throw new AnyxError('RECEIPT_NOT_FOUND', `No payment receipt found for id ${id}`);
  }

  let inputTokenAddress: string | null = null;
  let swapSlippage = '0';
  if (payment.quoteId) {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, payment.quoteId)).limit(1);
    if (quote) {
      inputTokenAddress = quote.inputTokenAddress ?? null;
      const routeData = quote.routeData as { priceImpact?: number } | null;
      if (typeof routeData?.priceImpact === 'number') {
        swapSlippage = String(routeData.priceImpact);
      }
    }
  }

  const usdcAmount = Number.parseFloat(payment.usdcAmount);
  const feeUsdc = Number.parseFloat(payment.feeUsdc);

  const receipt: PaymentReceipt = {
    receiptId: payment.id,
    timestamp: (payment.completedAt ?? payment.createdAt).toISOString(),
    endpoint: payment.apiEndpoint,
    inputToken: payment.inputToken,
    inputTokenAddress,
    inputAmount: payment.inputAmount,
    inputAmountUSD: (usdcAmount + feeUsdc).toFixed(6),
    apiCostUSDC: payment.usdcAmount,
    adapterFeeUSDC: payment.feeUsdc,
    swapSlippage,
    txHash: payment.txHash ?? null,
    blockNumber: payment.blockNumber ? Number(payment.blockNumber) : null,
    facilitator: payment.facilitatorUrl ?? '',
    xPaymentResponse: payment.xPaymentResponse ?? null,
    status: payment.status,
  };

  return c.json(receipt);
});
