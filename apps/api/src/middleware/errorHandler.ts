import { AnyxError } from '@anyx/core';
import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

/**
 * Central error handler: converts any thrown error into the standard
 * `{ error: { code, message, details? } }` shape (docs/AGENTS.md Task 1.6).
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId');

  if (err instanceof AnyxError) {
    const status = statusForCode(err.code);
    return c.json(err.toJSON(), status);
  }

  if (err instanceof ZodError) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Validation failed', details: err.flatten() } },
      400,
    );
  }

  console.error(`[api] unhandled error [${requestId}]:`, err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
};

function statusForCode(code: AnyxError['code']): 400 | 401 | 404 | 409 | 422 | 429 | 500 | 503 {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'QUOTE_NOT_FOUND':
    case 'RECEIPT_NOT_FOUND':
      return 404;
    case 'QUOTE_EXPIRED':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    case 'INSUFFICIENT_BALANCE':
      return 422;
    case 'NO_COMPATIBLE_PAYMENT_OPTION':
      return 422;
    case 'CONFIG_MISSING':
      return 503;
    case 'FACILITATOR_UNAVAILABLE':
      return 503;
    case 'SWAP_FAILED':
    case 'SETTLEMENT_FAILED':
    case 'TIMEOUT':
    case 'ALL_PROVIDERS_FAILED':
      return 500;
    case 'NOT_IMPLEMENTED':
      return 500;
    default:
      return 500;
  }
}
