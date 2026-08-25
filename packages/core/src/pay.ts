import { randomUUID } from "node:crypto";
import type { AnyxConfig } from "@anyx/config";
import { parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildAuthorizationPayload, signAuthorization } from "./eip3009.ts";
import { getFacilitatorUrl, settlePayment } from "./facilitator.ts";
import { getQuote, markQuoteUsed, saveReceipt } from "./store.ts";
import { BASE_CHAIN_ID, USDC_BASE } from "./tokens.ts";
import { AnyxError, type PaymentReceipt } from "./types.ts";
import { buildPaymentHeader, submitPayment } from "./x402.ts";

function baseReceipt(
  quote: ReturnType<typeof getQuote>,
  walletAddress: string,
  facilitator: string,
): Omit<
  PaymentReceipt,
  "receiptId" | "txHash" | "blockNumber" | "xPaymentResponse" | "status" | "stub"
> {
  return {
    timestamp: new Date().toISOString(),
    endpoint: quote.endpointUrl,
    quoteId: quote.quoteId,
    fromAddress: walletAddress,
    inputToken: quote.inputToken.symbol,
    inputTokenAddress: quote.inputToken.address,
    inputAmount: quote.inputAmount,
    inputAmountUSD: quote.inputAmountUsd,
    apiCostUSDC: quote.usdcRequired,
    adapterFeeUSDC: quote.fee,
    swapSlippage: quote.route.priceImpact,
    facilitator,
  };
}

export async function executePay(args: {
  quoteId: string;
  walletAddress: string;
  config: AnyxConfig;
  fetchImpl?: typeof fetch;
}): Promise<PaymentReceipt> {
  const quote = getQuote(args.quoteId);
  const fetchImpl = args.fetchImpl ?? fetch;
  const facilitator = await getFacilitatorUrl(args.config, fetchImpl);
  const shared = baseReceipt(quote, args.walletAddress, facilitator);

  if (args.config.stubPayments || !args.config.privateKey) {
    const receipt: PaymentReceipt = {
      ...shared,
      receiptId: randomUUID(),
      txHash: `0xstub${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      blockNumber: 0,
      xPaymentResponse: null,
      status: "settled",
      stub: true,
    };
    markQuoteUsed(quote.quoteId);
    saveReceipt(receipt);
    return receipt;
  }

  const account = privateKeyToAccount(args.config.privateKey as `0x${string}`);
  const value = parseUnits(quote.usdcRequired, 6);
  const unsigned = buildAuthorizationPayload({
    from: account.address,
    to: quote.payTo as `0x${string}`,
    value,
    chainId: BASE_CHAIN_ID,
    usdcAddress: USDC_BASE as `0x${string}`,
  });
  const signed = await signAuthorization(unsigned, args.config.privateKey as `0x${string}`);
  if (!signed.v || !signed.r || !signed.s) {
    throw new AnyxError("SETTLEMENT_FAILED", "EIP-3009 signature incomplete");
  }

  let settle: { txHash: string; blockNumber: number; success: boolean };
  try {
    settle = await settlePayment(signed, facilitator, fetchImpl);
  } catch (err) {
    throw new AnyxError("SETTLEMENT_FAILED", err instanceof Error ? err.message : "settle failed");
  }

  const header = buildPaymentHeader({
    from: signed.from,
    to: signed.to,
    value: signed.value.toString(),
    validAfter: signed.validAfter.toString(),
    validBefore: signed.validBefore.toString(),
    nonce: signed.nonce,
    v: signed.v,
    r: signed.r,
    s: signed.s,
  });

  let xPaymentResponse: string | null = null;
  try {
    const apiRes = await submitPayment(quote.endpointUrl, header, fetchImpl);
    xPaymentResponse = apiRes.headers.get("X-PAYMENT-RESPONSE");
  } catch {
    xPaymentResponse = null;
  }

  const receipt: PaymentReceipt = {
    ...shared,
    receiptId: randomUUID(),
    txHash: settle.txHash,
    blockNumber: settle.blockNumber,
    xPaymentResponse,
    status: settle.success ? "settled" : "failed",
    stub: false,
  };
  markQuoteUsed(quote.quoteId);
  saveReceipt(receipt);
  return receipt;
}
