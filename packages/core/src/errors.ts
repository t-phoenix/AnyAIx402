/**
 * Error codes that form part of the public API contract. Every HTTP error body
 * emitted by `apps/api` uses one of these values in `error.code`.
 */
export const API_ERROR_CODES = {
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  SWAP_FAILED: 'SWAP_FAILED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Internal codes that never appear in the documented contract. */
export const INTERNAL_ERROR_CODES = {
  QUOTE_UNAVAILABLE: 'QUOTE_UNAVAILABLE',
  X402_INVALID_CHALLENGE: 'X402_INVALID_CHALLENGE',
  X402_UNSUPPORTED_PAYMENT: 'X402_UNSUPPORTED_PAYMENT',
  FACILITATOR_UNAVAILABLE: 'FACILITATOR_UNAVAILABLE',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  TIMEOUT: 'TIMEOUT',
  CONFIG_ERROR: 'CONFIG_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type InternalErrorCode = (typeof INTERNAL_ERROR_CODES)[keyof typeof INTERNAL_ERROR_CODES];

export type AnyXErrorCode = ApiErrorCode | InternalErrorCode;

export interface AnyXErrorOptions {
  details?: unknown;
  cause?: unknown;
  httpStatus?: number;
}

export class AnyXError extends Error {
  readonly code: AnyXErrorCode;
  readonly details?: unknown;
  readonly httpStatus: number;

  constructor(code: AnyXErrorCode, message: string, options: AnyXErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = options.details;
    this.httpStatus = options.httpStatus ?? defaultHttpStatus(code);
  }

  toJSON(): { code: AnyXErrorCode; message: string; details?: unknown } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

function defaultHttpStatus(code: AnyXErrorCode): number {
  switch (code) {
    case API_ERROR_CODES.INVALID_INPUT:
      return 400;
    case API_ERROR_CODES.QUOTE_NOT_FOUND:
      return 404;
    case API_ERROR_CODES.QUOTE_EXPIRED:
      return 410;
    case API_ERROR_CODES.INSUFFICIENT_BALANCE:
      return 402;
    case API_ERROR_CODES.RATE_LIMITED:
      return 429;
    case API_ERROR_CODES.SWAP_FAILED:
    case API_ERROR_CODES.SETTLEMENT_FAILED:
      return 502;
    case INTERNAL_ERROR_CODES.QUOTE_UNAVAILABLE:
    case INTERNAL_ERROR_CODES.FACILITATOR_UNAVAILABLE:
      return 503;
    case INTERNAL_ERROR_CODES.X402_INVALID_CHALLENGE:
    case INTERNAL_ERROR_CODES.X402_UNSUPPORTED_PAYMENT:
    case INTERNAL_ERROR_CODES.SIGNATURE_INVALID:
      return 422;
    case INTERNAL_ERROR_CODES.TIMEOUT:
      return 504;
    case INTERNAL_ERROR_CODES.NOT_IMPLEMENTED:
      return 501;
    default:
      return 500;
  }
}

export class ValidationError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(API_ERROR_CODES.INVALID_INPUT, message, options);
  }
}

export class QuoteError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.QUOTE_UNAVAILABLE, message, options);
  }
}

export class QuoteNotFoundError extends AnyXError {
  constructor(quoteId: string) {
    super(API_ERROR_CODES.QUOTE_NOT_FOUND, `Quote ${quoteId} was not found`, {
      details: { quoteId },
    });
  }
}

export class QuoteExpiredError extends AnyXError {
  constructor(quoteId: string, expiresAt: string) {
    super(API_ERROR_CODES.QUOTE_EXPIRED, `Quote ${quoteId} expired at ${expiresAt}`, {
      details: { quoteId, expiresAt },
    });
  }
}

export class SwapError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(API_ERROR_CODES.SWAP_FAILED, message, options);
  }
}

export class SettlementError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(API_ERROR_CODES.SETTLEMENT_FAILED, message, options);
  }
}

export class InsufficientBalanceError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(API_ERROR_CODES.INSUFFICIENT_BALANCE, message, options);
  }
}

export class RateLimitError extends AnyXError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number, options: AnyXErrorOptions = {}) {
    super(API_ERROR_CODES.RATE_LIMITED, message, options);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class X402ChallengeError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.X402_INVALID_CHALLENGE, message, options);
  }
}

export class UnsupportedPaymentError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.X402_UNSUPPORTED_PAYMENT, message, options);
  }
}

export class FacilitatorError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.FACILITATOR_UNAVAILABLE, message, options);
  }
}

export class SignatureError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.SIGNATURE_INVALID, message, options);
  }
}

export class TimeoutError extends AnyXError {
  constructor(message: string, options: AnyXErrorOptions = {}) {
    super(INTERNAL_ERROR_CODES.TIMEOUT, message, options);
  }
}

export class ConfigError extends AnyXError {
  constructor(message: string, details?: unknown) {
    super(INTERNAL_ERROR_CODES.CONFIG_ERROR, message, { details });
  }
}

export class NotImplementedError extends AnyXError {
  constructor(message: string, details?: unknown) {
    super(INTERNAL_ERROR_CODES.NOT_IMPLEMENTED, message, { details });
  }
}

export function isAnyXError(error: unknown): error is AnyXError {
  return error instanceof AnyXError;
}

export function toAnyXError(error: unknown): AnyXError {
  if (isAnyXError(error)) return error;
  if (error instanceof Error) {
    return new AnyXError(INTERNAL_ERROR_CODES.INTERNAL_ERROR, error.message, { cause: error });
  }
  return new AnyXError(INTERNAL_ERROR_CODES.INTERNAL_ERROR, 'Unknown error', { details: error });
}
