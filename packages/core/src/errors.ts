/**
 * Error codes shared across the core engine and the API layer.
 * These map 1:1 onto the `{ error: { code, message, details? } }` response shape
 * documented in docs/AGENTS.md Task 1.6.
 */
export type AnyxErrorCode =
  | 'CONFIG_MISSING'
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_EXPIRED'
  | 'RECEIPT_NOT_FOUND'
  | 'SWAP_FAILED'
  | 'SETTLEMENT_FAILED'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_BALANCE'
  | 'NO_COMPATIBLE_PAYMENT_OPTION'
  | 'FACILITATOR_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_IMPLEMENTED'
  | 'ALL_PROVIDERS_FAILED';

/** Optional `{ details, cause }` bag used by the orchestrator/PR#1 call sites. */
interface ErrorOptionsBag {
  details?: unknown;
  cause?: unknown;
}

function isOptionsBag(value: unknown): value is ErrorOptionsBag {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => key === 'details' || key === 'cause');
}

export function httpStatusFor(code: AnyxErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'NO_COMPATIBLE_PAYMENT_OPTION':
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
    case 'NOT_IMPLEMENTED':
      return 501;
    case 'CONFIG_MISSING':
    case 'FACILITATOR_UNAVAILABLE':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'SWAP_FAILED':
    case 'SETTLEMENT_FAILED':
    case 'ALL_PROVIDERS_FAILED':
      return 502;
    default:
      return 500;
  }
}

export class AnyxError extends Error {
  readonly code: AnyxErrorCode;
  readonly details?: unknown;
  readonly httpStatus: number;

  constructor(code: AnyxErrorCode, message: string, details?: unknown) {
    const bag = isOptionsBag(details) ? details : undefined;
    super(message, bag?.cause !== undefined ? { cause: bag.cause as Error } : undefined);
    this.name = 'AnyxError';
    this.code = code;
    this.details = bag ? bag.details : details;
    this.httpStatus = httpStatusFor(code);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

/** Alias used by the orchestrator-era API modules (`AnyXError` spelling). */
export class AnyXError extends AnyxError {
  constructor(code: AnyxErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'AnyXError';
  }
}

export function isAnyXError(error: unknown): error is AnyxError {
  return error instanceof AnyxError;
}

export function toAnyXError(error: unknown): AnyxError {
  if (error instanceof AnyxError) return error;
  if (error instanceof Error) return new AnyxError('INVALID_INPUT', error.message);
  return new AnyxError('INVALID_INPUT', String(error));
}

/** Thrown when a required env var (per docs/CONFIGURATION.md tiers) is unset. */
export class ConfigMissingError extends AnyxError {
  readonly varName: string;

  constructor(varName: string, extra?: string) {
    super(
      'CONFIG_MISSING',
      `Missing required configuration: ${varName}.${extra ? ` ${extra}` : ''} See docs/CONFIGURATION.md.`,
      { varName },
    );
    this.name = 'ConfigMissingError';
    this.varName = varName;
  }
}

export class QuoteError extends AnyxError {}
export class X402Error extends AnyxError {}
export class FacilitatorError extends AnyxError {}
export class TimeoutError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('TIMEOUT', message, details);
    this.name = 'TimeoutError';
  }
}

export class ConfigError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('CONFIG_MISSING', message, details);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('INVALID_INPUT', message, details);
    this.name = 'ValidationError';
  }
}

export class InsufficientBalanceError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('INSUFFICIENT_BALANCE', message, details);
    this.name = 'InsufficientBalanceError';
  }
}

export class NotImplementedError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('NOT_IMPLEMENTED', message, details);
    this.name = 'NotImplementedError';
  }
}

export class SwapError extends AnyxError {
  constructor(message: string, details?: unknown) {
    super('SWAP_FAILED', message, details);
    this.name = 'SwapError';
  }
}

/** Reads an env var, throwing a typed ConfigMissingError (not a generic exception) if unset/blank. */
export function requireEnv(varName: string, extra?: string): string {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    throw new ConfigMissingError(varName, extra);
  }
  return value;
}

/** Reads an env var, returning `undefined` instead of throwing when unset/blank. */
export function optionalEnv(varName: string): string | undefined {
  const value = process.env[varName];
  return value && value.trim() !== '' ? value : undefined;
}
