import {
  fetch402Challenge,
  findBaseUsdcOption,
  getBestQuote,
  getToken,
  UnsupportedPaymentError,
  ValidationError,
} from '@anyx/core';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app.js';

const quoteRequestSchema = z.object({
  endpointUrl: z.string().url('endpointUrl must be an absolute URL'),
  inputToken: z.string().min(1, 'inputToken is required, for example "ETH"'),
  inputChainId: z.number().int().positive(),
  slippageBps: z.number().int().min(0).max(1000).optional(),
});

export function registerQuoteRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/quote', async (c) => {
    const deps = c.get('deps');

    const parsed = quoteRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid quote request.', { details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const token = getToken(body.inputToken, body.inputChainId);
    if (!token) {
      throw new UnsupportedPaymentError(
        `${body.inputToken} on chain ${body.inputChainId} is not a supported input token. GET /v1/tokens lists what is.`,
      );
    }

    // Read the price from the origin rather than trusting the caller: the
    // amount that gets paid must be the amount the server actually asked for.
    const challenge = await fetch402Challenge(body.endpointUrl, { fetchImpl: deps.fetchImpl });
    if (!challenge) {
      throw new ValidationError(
        `${body.endpointUrl} did not return a 402 payment challenge, so there is nothing to pay.`,
      );
    }

    const option = findBaseUsdcOption(challenge);
    if (!option) {
      throw new UnsupportedPaymentError(
        'The endpoint does not accept USDC on Base, which is the only settlement asset AnyX can produce.',
        { details: { accepts: challenge.accepts } },
      );
    }

    const quote = await getBestQuote(
      {
        inputToken: token,
        usdcRequired: option.amount,
        chainId: body.inputChainId,
        slippageBps: body.slippageBps ?? deps.config.defaultSlippageBps,
        feeBps: deps.config.feeBps,
        endpointUrl: body.endpointUrl,
      },
      {
        ttlSeconds: deps.config.quoteTtlSeconds,
        fetchImpl: deps.fetchImpl,
        now: deps.now,
        oneInch: { apiKey: deps.config.oneInchApiKey },
        zeroEx: { apiKey: deps.config.zeroExApiKey },
      },
    );

    await deps.store.saveQuote(quote);
    return c.json(quote);
  });
}
