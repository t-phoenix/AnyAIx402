import { UPAError, toUPAError } from './errors';

export const DEFAULT_API_BASE_URL = 'https://api.anyx.xyz';

export interface HttpClientOptions {
  apiBaseUrl?: string;
  apiKey?: string;
}

/** Thin JSON HTTP client for the AnyX REST API — used by every UPA method. */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    this.apiKey = options.apiKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      ...extra,
    };
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new UPAError('NETWORK_ERROR', `Request to ${path} failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw await toUPAError(response);
    }
    return (await response.json()) as T;
  }

  async getJson<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), { headers: this.headers() });
    } catch (err) {
      throw new UPAError('NETWORK_ERROR', `Request to ${path} failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw await toUPAError(response);
    }
    return (await response.json()) as T;
  }
}
