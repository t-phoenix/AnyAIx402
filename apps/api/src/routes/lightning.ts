import { NotImplementedError } from '@anyx/core';
import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';

/**
 * Phase 4. The routes exist so clients get a precise answer instead of a 404
 * that reads like a broken deployment.
 */
export function registerLightningRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/lightning/invoice', () => {
    throw new NotImplementedError(
      'The Lightning gateway is Phase 4. It needs an LND node (LND_GRPC_HOST, LND_TLS_CERT_PATH, LND_MACAROON_PATH) and a funded USDC reserve pool.',
    );
  });

  app.get('/v1/lightning/status/:paymentHash', () => {
    throw new NotImplementedError('The Lightning gateway is Phase 4.');
  });
}
