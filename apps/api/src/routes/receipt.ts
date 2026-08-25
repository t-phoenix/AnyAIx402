import { AnyXError } from '@anyx/core';
import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';

export function registerReceiptRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/receipt/:id', async (c) => {
    const deps = c.get('deps');
    const id = c.req.param('id');

    const receipt = await deps.store.getReceipt(id);
    if (!receipt) {
      throw new AnyXError('QUOTE_NOT_FOUND', `No receipt with id ${id}.`, {
        details: { receiptId: id },
      });
    }

    return c.json(receipt);
  });

  app.get('/v1/receipts', async (c) => {
    const deps = c.get('deps');
    const limitParam = Number.parseInt(c.req.query('limit') ?? '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    return c.json({ receipts: await deps.store.listReceipts(limit) });
  });
}
