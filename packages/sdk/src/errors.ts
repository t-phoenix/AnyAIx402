import type { UPAErrorCode } from './types';

/**
 * Thrown by every UPA method on failure. `code` matches the AnyX API error codes documented
 * in docs/anyx-llms.txt ("Error Reference") plus two SDK-only codes: NETWORK_ERROR (the fetch
 * to the AnyX API itself failed) and NOT_A_402 (the target endpoint never returned a 402).
 */
export class UPAError extends Error {
  readonly code: UPAErrorCode;
  readonly details?: unknown;

  constructor(code: UPAErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'UPAError';
    this.code = code;
    this.details = details;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Converts a non-2xx AnyX API response into a typed UPAError. */
export async function toUPAError(response: Response): Promise<UPAError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error body — fall through to a generic message below.
  }

  const code = (body.error?.code as UPAErrorCode) ?? 'NETWORK_ERROR';
  const message = body.error?.message ?? `AnyX API returned HTTP ${response.status}`;
  return new UPAError(code, message, body.error?.details);
}
