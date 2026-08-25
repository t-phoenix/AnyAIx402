import type { Token } from '@anyx/core';
import { UPAError } from './errors';
import { UPAEventEmitter } from './events';
import { DEFAULT_API_BASE_URL, HttpClient } from './http';
import type {
  PayOptions,
  PaymentQuote,
  PaymentReceipt,
  QuoteOptions,
  RawPayResult,
  UPAConfig,
  UPAFetchOptions,
} from './types';

const DEFAULT_MAX_SLIPPAGE = 0.005;
const DEFAULT_MAX_FEE_PERCENT = 0.01;

/**
 * Task 1.7 — `UPA` (Universal Payment Adapter). Drop-in `fetch()` replacement that transparently
 * handles x402 402 challenges: quote -> pay -> retry, all against the AnyX REST API
 * (`apiBaseUrl`, default docs/anyx-llms.txt `https://api.anyx.xyz`).
 *
 * See packages/sdk/README.md for the full usage example from docs/AGENTS.md Task 1.7.
 */
export class UPA {
  private readonly config: UPAConfig;
  private readonly http: HttpClient;
  private readonly events = new UPAEventEmitter();

  constructor(config: UPAConfig) {
    if (!config.preferredToken) {
      throw new UPAError('INVALID_INPUT', 'UPAConfig.preferredToken is required');
    }
    if (!Number.isInteger(config.preferredChainId)) {
      throw new UPAError('INVALID_INPUT', 'UPAConfig.preferredChainId is required');
    }

    this.config = config;
    this.http = new HttpClient({
      apiBaseUrl: config.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      apiKey: config.apiKey,
    });

    if (config.onPayment) this.events.on('payment', config.onPayment);
    if (config.onError) this.events.on('error', config.onError);
  }

  /** Subscribe to 'payment' | 'swap' | 'error' events (PRD §5.1). */
  on: UPAEventEmitter['on'] = (event, listener) => this.events.on(event, listener);

  /** Unsubscribe a previously registered listener. */
  off: UPAEventEmitter['off'] = (event, listener) => this.events.off(event, listener);

  private walletAddress(): `0x${string}` {
    const address = this.config.wallet?.account?.address;
    if (!address) {
      throw new UPAError(
        'WALLET_REQUIRED',
        'UPAConfig.wallet with a connected account is required to call pay()/fetch()',
      );
    }
    return address;
  }

  private raise(error: UPAError): never {
    this.events.emit('error', { code: error.code, message: error.message, details: error.details });
    throw error;
  }

  /**
   * Task 1.7 — `quote(endpointUrl)`. POSTs /v1/quote with `preferredToken`/`preferredChainId`
   * and returns the AnyX-computed cost breakdown. Valid for ~30 seconds (server-enforced).
   */
  async quote(endpointUrl: string, options: QuoteOptions = {}): Promise<PaymentQuote> {
    const slippageBps =
      options.slippageBps ?? Math.round((this.config.maxSlippage ?? DEFAULT_MAX_SLIPPAGE) * 10_000);

    try {
      const result = await this.http.postJson<PaymentQuote>('/v1/quote', {
        endpointUrl,
        inputToken: this.config.preferredToken,
        inputChainId: this.config.preferredChainId,
        slippageBps,
      });

      const maxFeePercent = this.config.maxFeePercent ?? DEFAULT_MAX_FEE_PERCENT;
      const feeFraction = Number.parseFloat(result.fee) / Number.parseFloat(result.usdcRequired);
      if (Number.isFinite(feeFraction) && feeFraction > maxFeePercent) {
        this.raise(
          new UPAError(
            'FEE_TOO_HIGH',
            `Quoted fee (${(feeFraction * 100).toFixed(3)}%) exceeds maxFeePercent (${(maxFeePercent * 100).toFixed(3)}%)`,
            { quote: result },
          ),
        );
      }

      this.events.emit('swap', {
        endpoint: endpointUrl,
        inputToken: result.inputToken,
        inputAmount: result.inputAmount,
        usdcRequired: result.usdcRequired,
        fee: result.fee,
      });

      return result;
    } catch (err) {
      if (err instanceof UPAError) this.raise(err);
      throw err;
    }
  }

  /**
   * Task 1.7 — `pay(endpointUrl, quoteId?)`. Executes the payment for an existing quote (or
   * obtains one first), then fetches the full itemized receipt so the returned object always
   * matches the `PaymentReceipt` shape (PRD FR-5) regardless of which path was taken.
   */
  async pay(endpointUrl: string, options: PayOptions = {}): Promise<PaymentReceipt> {
    try {
      const quoteId = options.quoteId ?? (await this.quote(endpointUrl)).quoteId;

      const raw = await this.http.postJson<RawPayResult>('/v1/pay', {
        quoteId,
        walletAddress: this.walletAddress(),
      });

      const receipt = await this.enrichReceipt(raw);
      this.events.emit('payment', receipt);
      return receipt;
    } catch (err) {
      if (err instanceof UPAError) this.raise(err);
      throw err;
    }
  }

  private async enrichReceipt(raw: RawPayResult): Promise<PaymentReceipt> {
    try {
      const full = await this.getReceipt(raw.receiptId);
      return { ...full, apiResponse: raw.apiResponse };
    } catch {
      // The itemized receipt endpoint is unreachable/not yet persisted — fall back to the raw
      // /v1/pay fields rather than failing a payment that already settled.
      return {
        receiptId: raw.receiptId,
        timestamp: new Date().toISOString(),
        endpoint: '',
        inputToken: this.config.preferredToken,
        inputTokenAddress: null,
        inputAmount: '0',
        inputAmountUSD: '0',
        apiCostUSDC: '0',
        adapterFeeUSDC: '0',
        swapSlippage: '0',
        txHash: raw.txHash,
        blockNumber: null,
        facilitator: '',
        xPaymentResponse: null,
        status: raw.status,
        apiResponse: raw.apiResponse,
      };
    }
  }

  /** Task 1.7 — `getReceipt(receiptId)`. GET /v1/receipt/:id. */
  async getReceipt(receiptId: string): Promise<PaymentReceipt> {
    try {
      return await this.http.getJson<PaymentReceipt>(`/v1/receipt/${receiptId}`);
    } catch (err) {
      if (err instanceof UPAError) this.raise(err);
      throw err;
    }
  }

  /** Task 1.7 — `getSupportedTokens()`. GET /v1/tokens. */
  async getSupportedTokens(): Promise<Token[]> {
    try {
      const result = await this.http.getJson<{ tokens: Token[]; updatedAt: string }>('/v1/tokens');
      return result.tokens;
    } catch (err) {
      if (err instanceof UPAError) this.raise(err);
      throw err;
    }
  }

  /**
   * Task 1.7 — `fetch(url, init?)`. Drop-in replacement for global `fetch()`:
   * - Not a 402 response -> returned untouched.
   * - A 402 response -> quote() -> pay() -> a synthetic 200 `Response` built from
   *   the settled `apiResponse`, so callers can keep writing `await res.json()` unchanged.
   */
  async fetch(url: string, init?: UPAFetchOptions): Promise<Response> {
    const { useQuote, ...requestInit } = init ?? {};

    let initial: Response;
    try {
      initial = await fetch(url, requestInit);
    } catch (err) {
      this.raise(
        new UPAError('NETWORK_ERROR', `Request to ${url} failed: ${(err as Error).message}`),
      );
    }

    if (initial.status !== 402) {
      return initial;
    }

    const quoteId = useQuote?.quoteId ?? (await this.quote(url)).quoteId;
    const receipt = await this.pay(url, { quoteId });

    const body =
      typeof receipt.apiResponse === 'string'
        ? receipt.apiResponse
        : JSON.stringify(receipt.apiResponse ?? {});
    const headers = new Headers({
      'Content-Type': typeof receipt.apiResponse === 'string' ? 'text/plain' : 'application/json',
    });
    if (receipt.xPaymentResponse) headers.set('X-PAYMENT-RESPONSE', receipt.xPaymentResponse);

    return new Response(body, { status: 200, headers });
  }
}
