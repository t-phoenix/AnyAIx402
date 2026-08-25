import { randomUUID } from 'node:crypto';
import {
  AnyxError,
  BASE_USDC_ADDRESS,
  ConfigMissingError,
  FacilitatorError,
  X402Error,
  buildAuthorizationPayload,
  buildPaymentHeader,
  fetch402Challenge,
  findBaseUsdcOption,
  getCachedQuote,
  requireEnv,
  settlePayment,
  signAuthorization,
  submitPayment,
} from '@anyx/core';
import { payments, quotes } from '@anyx/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import { getDb } from '../lib/db';

export const payRoute = new Hono();

const payRequestSchema = z.object({
  quoteId: z.string().uuid(),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a valid EVM address'),
});

const BASE_CHAIN_ID = 8453;

payRoute.post('/v1/pay', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = payRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnyxError('INVALID_INPUT', 'Invalid request body', parsed.error.flatten());
  }
  const { quoteId, walletAddress } = parsed.data;

  const db = getDb();

  const cachedQuote = await getCachedQuote(quoteId).catch(() => null);
  const [dbQuote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1)
    .catch(() => [undefined]);

  if (!cachedQuote && !dbQuote) {
    throw new AnyxError('QUOTE_NOT_FOUND', `No quote found for id ${quoteId}`);
  }

  const endpointUrl = dbQuote?.endpointUrl ?? '';
  const expiresAt = cachedQuote ? new Date(cachedQuote.expiresAt) : dbQuote?.expiresAt;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    throw new AnyxError('QUOTE_EXPIRED', `Quote ${quoteId} has expired`);
  }

  const usdcRequired = cachedQuote?.usdcRequired ?? dbQuote?.usdcRequired ?? '0';
  const fee = cachedQuote?.fee ?? '0';
  const inputToken = cachedQuote?.inputToken.symbol ?? dbQuote?.inputToken ?? 'UNKNOWN';
  const inputAmount = cachedQuote?.inputAmount ?? dbQuote?.inputAmount ?? '0';

  // Re-fetch the 402 challenge to get a fresh `payTo` (Phase 1 does not persist it separately).
  const challenge = await fetch402Challenge(endpointUrl);
  if (!challenge) {
    throw new AnyxError('SWAP_FAILED', `${endpointUrl} no longer returns a 402 challenge`);
  }
  const paymentOption = findBaseUsdcOption(challenge);

  // Phase 1 MVP: pre-funded off-chain USDC float. No on-chain swap is executed here — the
  // AnyX hot signer already holds USDC and settles directly via EIP-3009. See
  // docs/AGENTS.md "Notes for Cursor Agents" #8.
  let privateKey: `0x${string}`;
  try {
    privateKey = requireEnv(
      'PRIVATE_KEY',
      'Hot signer key for EIP-3009 authorizations.',
    ) as `0x${string}`;
  } catch (err) {
    if (err instanceof ConfigMissingError) throw err;
    throw err;
  }

  const hotSigner = privateKeyToAccount(privateKey);
  const value = parseUnits(usdcRequired, 6);

  const payload = buildAuthorizationPayload({
    from: hotSigner.address,
    to: paymentOption.payTo as `0x${string}`,
    value,
    chainId: BASE_CHAIN_ID,
    usdcAddress: BASE_USDC_ADDRESS as `0x${string}`,
  });

  const signed = await signAuthorization(payload, privateKey);

  let settleResult: Awaited<ReturnType<typeof settlePayment>>;
  try {
    settleResult = await settlePayment({ signedAuthorization: signed });
  } catch (err) {
    if (err instanceof FacilitatorError) {
      throw new AnyxError('SETTLEMENT_FAILED', err.message, err.details);
    }
    throw err;
  }

  const paymentHeader = buildPaymentHeader({
    from: signed.from,
    to: signed.to,
    value: signed.value.toString(),
    validAfter: Number(signed.validAfter),
    validBefore: Number(signed.validBefore),
    nonce: signed.nonce,
    v: signed.v,
    r: signed.r,
    s: signed.s,
  });

  let apiResponse: unknown;
  let xPaymentResponseHeader: string | null = null;
  try {
    const response = await submitPayment(endpointUrl, paymentHeader);
    xPaymentResponseHeader = response.headers.get('X-PAYMENT-RESPONSE');
    apiResponse = await response.json().catch(async () => await response.text());
  } catch (err) {
    if (err instanceof X402Error) {
      throw new AnyxError('SETTLEMENT_FAILED', err.message, err.details);
    }
    throw err;
  }

  const receiptId = randomUUID();
  const now = new Date();

  try {
    await db.insert(payments).values({
      id: receiptId,
      quoteId,
      completedAt: now,
      txHash: settleResult.txHash,
      blockNumber: settleResult.blockNumber?.toString(),
      fromAddress: walletAddress,
      toAddress: paymentOption.payTo,
      inputToken,
      inputAmount,
      usdcAmount: usdcRequired,
      feeUsdc: fee,
      apiEndpoint: endpointUrl,
      facilitatorUrl: process.env.FACILITATOR_URL ?? null,
      xPaymentResponse: xPaymentResponseHeader,
      status: settleResult.success ? 'settled' : 'failed',
    });

    if (dbQuote) {
      await db.update(quotes).set({ status: 'used' }).where(eq(quotes.id, quoteId));
    }
  } catch (err) {
    console.warn('[pay] failed to persist payment to DB:', (err as Error).message);
  }

  return c.json({
    receiptId,
    txHash: settleResult.txHash,
    apiResponse,
    status: settleResult.success ? 'settled' : 'failed',
  });
});
