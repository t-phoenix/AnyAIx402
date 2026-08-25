import { AnyxError } from '@anyx/core';
import { Hono } from 'hono';
import { z } from 'zod';

export const lightningRoute = new Hono();

const lightningInvoiceRequestSchema = z.object({
  endpointUrl: z.string().url(),
});

/**
 * POST /v1/lightning/invoice — stub for Phase 3/4 (Lightning/BTC Agent).
 * Still validates input so callers get a clear INVALID_INPUT rather than a silent no-op.
 */
lightningRoute.post('/v1/lightning/invoice', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = lightningInvoiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AnyxError('INVALID_INPUT', 'Invalid request body', parsed.error.flatten());
  }

  return c.json(
    {
      invoice: 'not_implemented',
      message: 'Lightning coming in Phase 3/4 — see docs/AGENTS.md Task 4.1 (Lightning/BTC Agent)',
    },
    501,
  );
});
