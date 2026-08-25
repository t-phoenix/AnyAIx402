import {
  AnyxError,
  fetch402Challenge,
  findBaseUsdcOption,
  getBestQuote,
  getToken,
} from '@anyx/core';
import { quotes } from '@anyx/db';
import { Hono } from 'hono';
import { formatUnits } from 'viem';
import { z } from 'zod';
import { getDb } from '../lib/db';

export const quoteRoute = new Hono();

const quoteRequestSchema = z.object({
  endpointUrl: z.string().url(),
  inputToken: z.string().min(1),
  inputChainId: z.number().int().positive(),
  slippageBps: z.number().int().min(0).max(10_000).optional(),
});

quoteRoute.post('/v1/quote', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnyxError('INVALID_INPUT', 'Invalid request body', parsed.error.flatten());
  }

  const { endpointUrl, inputToken: inputTokenSymbol, inputChainId, slippageBps } = parsed.data;

  const token = getToken(inputTokenSymbol, inputChainId);
  if (!token) {
    throw new AnyxError(
      'INVALID_INPUT',
      `Unsupported token "${inputTokenSymbol}" on chain ${inputChainId}`,
    );
  }

  const challenge = await fetch402Challenge(endpointUrl);
  if (!challenge) {
    throw new AnyxError(
      'INVALID_INPUT',
      `${endpointUrl} did not return an HTTP 402 payment challenge`,
    );
  }

  const paymentOption = findBaseUsdcOption(challenge);
  const usdcRequired = formatUnits(BigInt(paymentOption.amount), 6);

  const bestQuote = await getBestQuote({
    inputToken: token,
    usdcRequired,
    chainId: inputChainId,
    slippageBps,
  });

  try {
    const db = getDb();
    await db.insert(quotes).values({
      id: bestQuote.quoteId,
      expiresAt: new Date(bestQuote.expiresAt),
      endpointUrl,
      inputToken: token.symbol,
      inputTokenAddress: token.address,
      inputChainId,
      inputAmount: bestQuote.inputAmount,
      usdcRequired: bestQuote.usdcRequired,
      usdcOnChain: bestQuote.usdcOutput,
      feeBps: bestQuote.feeBps,
      routeData: bestQuote.route,
      status: 'pending',
    });
  } catch (err) {
    console.warn('[quote] failed to persist quote to DB:', (err as Error).message);
  }

  return c.json({
    quoteId: bestQuote.quoteId,
    inputToken: token.symbol,
    inputAmount: bestQuote.inputAmount,
    usdcRequired: bestQuote.usdcRequired,
    fee: bestQuote.fee,
    expiresAt: bestQuote.expiresAt,
    route: bestQuote.route,
    payTo: paymentOption.payTo,
  });
});
