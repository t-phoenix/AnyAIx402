import { createHash } from 'node:crypto';
import { apiKeys } from '@anyx/db';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { getDb } from '../lib/db';

export type Plan = 'free' | 'pro' | 'enterprise';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    plan: Plan;
    apiKeyId: string | null;
  }
}

/**
 * Resolves the caller's plan from the optional X-API-Key header.
 * No key => 'free' tier (anonymous). Never throws — a DB outage degrades to 'free'
 * rather than blocking requests, matching the "never crash on missing config" philosophy.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    c.set('plan', 'free');
    c.set('apiKeyId', null);
    await next();
    return;
  }

  try {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const db = getDb();
    const [record] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);

    if (record?.isActive) {
      c.set('plan', record.plan);
      c.set('apiKeyId', record.id);
    } else {
      c.set('plan', 'free');
      c.set('apiKeyId', null);
    }
  } catch (err) {
    console.warn('[auth] API key lookup failed, defaulting to free tier:', (err as Error).message);
    c.set('plan', 'free');
    c.set('apiKeyId', null);
  }

  await next();
};
