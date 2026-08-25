import { ApiClient } from './client.js';
import { Emitter } from './events.js';
import {
  type PaymentQuote,
  type PaymentReceipt,
  type SwapEvent,
  type Token,
  type UPAConfig,
  UPAError,
  type UPAEventMap,
  type UPAEventName,
  type WalletLike,
} from './types.js';

export const DEFAULT_API_BASE_URL = 'https://api.anyx.xyz';
export const DEFAULT_MAX_SLIPPAGE = 0.005;
export const DEFAULT_MAX_FEE_PERCENT = 0.01;
export const DEFAULT_TIMEOUT_MS = 30_000;

/** x402 signals payment is required with this status and nothing else. */
const PAYMENT_REQUIRED = 402;

interface PayResponse {
  receipt: PaymentReceipt;
  swap?: SwapEvent;
  /** Body the origin returned once the payment settled. */
  apiResponse?: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
    bodyText?: string;
  };
}

export interface FetchOptions extends RequestInit {
  /** Settle against an existing quote instead of requesting a fresh one. */
  useQuote?: PaymentQuote;
  /** Return the 402 untouched rather than paying. */
  skipPayment?: boolean;
}

function resolveWalletAddress(config: UPAConfig): string | undefined {
  if (config.walletAddress) return config.walletAddress;
  const wallet: WalletLike | undefined = config.wallet;
  return wallet?.account?.address ?? wallet?.address;
}

export class UPA {
  private readonly config: UPAConfig;
  private readonly client: ApiClient;
  private readonly emitter = new Emitter();

  constructor(config: UPAConfig) {
    if (!config.preferredToken) {
      throw new UPAError('INVALID_INPUT', 'preferredToken is required, for example "ETH".');
    }
    if (!Number.isInteger(config.preferredChainId)) {
      throw new UPAError(
        'INVALID_INPUT',
        'preferredChainId is required, for example 8453 for Base.',
      );
    }

    this.config = config;
    this.client = new ApiClient({
      baseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      apiKey: config.apiKey,
      partnerId: config.partnerId,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetchImpl: config.fetchImpl ?? globalThis.fetch.bind(globalThis),
    });

    if (config.onPayment) this.emitter.on('payment', config.onPayment);
    if (config.onSwap) this.emitter.on('swap', config.onSwap);
    if (config.onError) this.emitter.on('error', config.onError);
  }

  on<K extends UPAEventName>(event: K, listener: (payload: UPAEventMap[K]) => void): () => void {
    return this.emitter.on(event, listener);
  }

  once<K extends UPAEventName>(event: K, listener: (payload: UPAEventMap[K]) => void): () => void {
    return this.emitter.once(event, listener);
  }

  off<K extends UPAEventName>(event: K, listener: (payload: UPAEventMap[K]) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * A drop-in replacement for `fetch`.
   *
   * Anything other than a 402 is returned untouched, so this is safe to swap in
   * globally. On a 402 the challenge is quoted, paid and the original request
   * retried, and the caller sees only the final response.
   */
  async fetch(url: string, init: FetchOptions = {}): Promise<Response> {
    const { useQuote, skipPayment, ...requestInit } = init;
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch.bind(globalThis);

    const response = await fetchImpl(url, requestInit);
    if (response.status !== PAYMENT_REQUIRED || skipPayment === true) return response;

    try {
      const quote = useQuote ?? (await this.quote(url));
      this.assertAcceptable(quote);
      const result = await this.payQuote(url, quote);
      return this.toResponse(result, response);
    } catch (error) {
      const upaError = this.toUPAError(error);
      this.emitter.emit('error', upaError);
      throw upaError;
    }
  }

  /** Price a payment without committing to it. Valid for 30 seconds. */
  async quote(endpointUrl: string): Promise<PaymentQuote> {
    try {
      return await this.client.post<PaymentQuote>('/v1/quote', {
        endpointUrl,
        inputToken: this.config.preferredToken,
        inputChainId: this.config.preferredChainId,
        slippageBps: Math.round((this.config.maxSlippage ?? DEFAULT_MAX_SLIPPAGE) * 10_000),
      });
    } catch (error) {
      const upaError = this.toUPAError(error);
      this.emitter.emit('error', upaError);
      throw upaError;
    }
  }

  /** Settle a payment, quoting first if no quote is supplied. */
  async pay(endpointUrl: string, quoteId?: string): Promise<PaymentReceipt> {
    try {
      const quote = quoteId ? undefined : await this.quote(endpointUrl);
      if (quote) this.assertAcceptable(quote);
      const result = await this.payQuote(endpointUrl, quote, quoteId);
      return result.receipt;
    } catch (error) {
      const upaError = this.toUPAError(error);
      this.emitter.emit('error', upaError);
      throw upaError;
    }
  }

  async getReceipt(receiptId: string): Promise<PaymentReceipt> {
    return await this.client.get<PaymentReceipt>(`/v1/receipt/${encodeURIComponent(receiptId)}`);
  }

  async getSupportedTokens(): Promise<Token[]> {
    const body = await this.client.get<{ tokens: Token[] }>('/v1/tokens');
    return body.tokens;
  }

  private async payQuote(
    endpointUrl: string,
    quote?: PaymentQuote,
    quoteId?: string,
  ): Promise<PayResponse> {
    const id = quote?.quoteId ?? quoteId;
    if (!id) {
      throw new UPAError('QUOTE_NOT_FOUND', 'A quote is required before paying.');
    }

    const walletAddress = resolveWalletAddress(this.config);
    const result = await this.client.post<PayResponse>('/v1/pay', {
      quoteId: id,
      endpointUrl,
      ...(walletAddress ? { walletAddress } : {}),
    });

    if (result.swap) this.emitter.emit('swap', result.swap);
    if (result.receipt) this.emitter.emit('payment', result.receipt);
    return result;
  }

  /**
   * Client-side guardrails, checked before any money moves. The server enforces
   * these too; failing here just means failing before the payer has committed.
   */
  private assertAcceptable(quote: PaymentQuote): void {
    const maxFee = this.config.maxFeePercent ?? DEFAULT_MAX_FEE_PERCENT;
    const required = Number(quote.usdcRequired);
    const fee = Number(quote.fee.usdc);

    if (Number.isFinite(required) && required > 0 && Number.isFinite(fee)) {
      const ratio = fee / required;
      if (ratio > maxFee) {
        throw new UPAError(
          'FEE_TOO_HIGH',
          `AnyX fee is ${(ratio * 100).toFixed(3)}% of the payment, above the configured maximum of ${(maxFee * 100).toFixed(3)}%.`,
          { details: { feeUsdc: quote.fee.usdc, usdcRequired: quote.usdcRequired } },
        );
      }
    }

    const maxSlippageBps = Math.round((this.config.maxSlippage ?? DEFAULT_MAX_SLIPPAGE) * 10_000);
    if (quote.slippageBps > maxSlippageBps) {
      throw new UPAError(
        'SLIPPAGE_TOO_HIGH',
        `Quote slippage of ${quote.slippageBps} bps exceeds the configured maximum of ${maxSlippageBps} bps.`,
        { details: { quoteSlippageBps: quote.slippageBps, maxSlippageBps } },
      );
    }

    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw new UPAError('QUOTE_EXPIRED', `Quote ${quote.quoteId} expired at ${quote.expiresAt}.`);
    }
  }

  /** Rebuilds the origin's response from what the API relayed back. */
  private toResponse(result: PayResponse, original: Response): Response {
    const api = result.apiResponse;
    if (!api) {
      throw new UPAError(
        'SETTLEMENT_FAILED',
        'The payment settled but the API response was not relayed back.',
        { details: { receiptId: result.receipt?.receiptId } },
      );
    }

    const headers = new Headers(api.headers ?? {});
    if (result.receipt?.receiptId) headers.set('x-anyx-receipt-id', result.receipt.receiptId);
    if (result.receipt?.txHash) headers.set('x-anyx-tx-hash', result.receipt.txHash);
    if (result.receipt?.xPaymentResponse) {
      headers.set('x-payment-response', result.receipt.xPaymentResponse);
    }

    const body = api.bodyText ?? (api.body === undefined ? null : JSON.stringify(api.body));
    if (body !== null && !headers.has('content-type')) {
      headers.set('content-type', api.bodyText === undefined ? 'application/json' : 'text/plain');
    }

    return new Response(body, {
      status: api.status ?? original.status,
      headers,
    });
  }

  private toUPAError(error: unknown): UPAError {
    if (error instanceof UPAError) return error;
    if (error instanceof Error) {
      return new UPAError('UNKNOWN', error.message, { cause: error });
    }
    return new UPAError('UNKNOWN', String(error));
  }
}
