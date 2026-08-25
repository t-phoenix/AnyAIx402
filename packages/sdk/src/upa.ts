import { AnyxError, type PaymentReceipt } from "@anyx/core";
import type { PaymentQuote, UPAConfig } from "./types.ts";

type Listener = (receipt: PaymentReceipt) => void;

export class UPA {
  readonly config: UPAConfig;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(config: UPAConfig) {
    this.config = {
      apiBaseUrl: "https://api.anyx.xyz",
      maxSlippage: 0.005,
      maxFeePercent: 0.01,
      ...config,
    };
  }

  on(event: "payment" | "error", handler: Listener): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
  }

  private emit(event: string, receipt: PaymentReceipt) {
    for (const handler of this.listeners.get(event) ?? []) handler(receipt);
    if (event === "payment") this.config.onPayment?.(receipt);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers["X-API-Key"] = this.config.apiKey;
    return headers;
  }

  private get fetchFn(): typeof fetch {
    return this.config.fetchImpl ?? fetch;
  }

  async getSupportedTokens(): Promise<TokenList> {
    const res = await this.fetchFn(`${this.config.apiBaseUrl}/v1/tokens`);
    return (await res.json()) as TokenList;
  }

  async quote(endpointUrl: string): Promise<PaymentQuote> {
    const res = await this.fetchFn(`${this.config.apiBaseUrl}/v1/quote`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        endpointUrl,
        inputToken: this.config.preferredToken,
        inputChainId: this.config.preferredChainId,
        slippageBps: Math.round((this.config.maxSlippage ?? 0.005) * 10_000),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const err = new AnyxError(
        body?.error?.code ?? "INVALID_INPUT",
        body?.error?.message ?? "Quote failed",
        body?.error?.details,
      );
      this.config.onError?.(err);
      throw err;
    }
    return body as PaymentQuote;
  }

  async pay(endpointUrl: string, quoteId?: string): Promise<PaymentReceipt> {
    const id = quoteId ?? (await this.quote(endpointUrl)).quoteId;
    const res = await this.fetchFn(`${this.config.apiBaseUrl}/v1/pay`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        quoteId: id,
        walletAddress: this.config.wallet?.address ?? "0x0000000000000000000000000000000000000001",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const err = new AnyxError(
        body?.error?.code ?? "SETTLEMENT_FAILED",
        body?.error?.message ?? "Pay failed",
      );
      this.config.onError?.(err);
      throw err;
    }
    const receipt = body as PaymentReceipt;
    this.emit("payment", receipt);
    return receipt;
  }

  async getReceipt(receiptId: string): Promise<PaymentReceipt> {
    const res = await this.fetchFn(`${this.config.apiBaseUrl}/v1/receipt/${receiptId}`);
    return (await res.json()) as PaymentReceipt;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const fetchFn = this.fetchFn;
    const first = await fetchFn(url, init);
    if (first.status !== 402) return first;
    const receipt = await this.pay(url);
    const retry = await fetchFn(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        "X-PAYMENT": receipt.xPaymentResponse ?? `stub:${receipt.receiptId}`,
      },
    });
    return retry;
  }
}

type TokenList = { tokens: unknown[]; updatedAt: string };

export { UPA as default };
