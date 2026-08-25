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

export class AnyxError extends Error {
  readonly code: AnyxErrorCode;
  readonly details?: unknown;

  constructor(code: AnyxErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AnyxError';
    this.code = code;
    this.details = details;
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
