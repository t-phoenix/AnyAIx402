import { type ApiErrorBody, UPAError, type UPAErrorCode } from './types.js';

const KNOWN_CODES: ReadonlySet<string> = new Set([
  'QUOTE_NOT_FOUND',
  'QUOTE_EXPIRED',
  'SWAP_FAILED',
  'SETTLEMENT_FAILED',
  'INVALID_INPUT',
  'RATE_LIMITED',
  'INSUFFICIENT_BALANCE',
]);

export interface ClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string | undefined;
  readonly partnerId?: string | undefined;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as { code?: unknown }).code === 'string';
}

function codeFor(raw: string, status: number): UPAErrorCode {
  if (KNOWN_CODES.has(raw)) return raw as UPAErrorCode;
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'QUOTE_NOT_FOUND';
  if (status === 400 || status === 422) return 'INVALID_INPUT';
  return 'UNKNOWN';
}

/** Thin HTTP client for the AnyX REST API. */
export class ApiClient {
  constructor(private readonly options: ClientOptions) {}

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.options.baseUrl.replace(/\/+$/, '')}${path}`;
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (this.options.apiKey) headers.set('x-api-key', this.options.apiKey);
    if (this.options.partnerId) headers.set('x-partner-id', this.options.partnerId);

    let response: Response;
    try {
      response = await this.options.fetchImpl(url, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (cause) {
      throw new UPAError('NETWORK_ERROR', `Could not reach the AnyX API at ${url}.`, { cause });
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text === '' ? undefined : JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      if (isApiErrorBody(parsed)) {
        throw new UPAError(codeFor(parsed.error.code, response.status), parsed.error.message, {
          status: response.status,
          details: parsed.error.details,
        });
      }
      throw new UPAError(
        codeFor('', response.status),
        `AnyX API returned ${response.status} for ${path}.`,
        { status: response.status, details: text.slice(0, 500) },
      );
    }

    return parsed as T;
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }
}
