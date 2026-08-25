import type { BestQuote, PaymentReceipt } from '@anyx/core';

export interface StoredQuote {
  quote: BestQuote;
  status: 'pending' | 'used' | 'expired';
}

/**
 * Persistence seam. The in-memory implementation is what runs without a
 * database, so the API boots and serves in a degraded but honest mode; the
 * Postgres implementation satisfies the same contract.
 */
export interface PaymentStore {
  readonly kind: 'memory' | 'postgres';
  saveQuote(quote: BestQuote): Promise<void>;
  getQuote(quoteId: string): Promise<StoredQuote | null>;
  markQuoteUsed(quoteId: string): Promise<void>;
  saveReceipt(receipt: PaymentReceipt): Promise<void>;
  getReceipt(receiptId: string): Promise<PaymentReceipt | null>;
  listReceipts(limit?: number): Promise<readonly PaymentReceipt[]>;
}

/**
 * Bounded so a long-running process without a database cannot leak memory.
 * Entries are evicted oldest-first.
 */
export class MemoryStore implements PaymentStore {
  readonly kind = 'memory' as const;

  private readonly quotes = new Map<string, StoredQuote>();
  private readonly receipts = new Map<string, PaymentReceipt>();

  constructor(private readonly maxEntries = 1_000) {}

  private evict<T>(map: Map<string, T>): void {
    while (map.size > this.maxEntries) {
      const oldest = map.keys().next();
      if (oldest.done === true) break;
      map.delete(oldest.value);
    }
  }

  async saveQuote(quote: BestQuote): Promise<void> {
    this.quotes.set(quote.quoteId, { quote, status: 'pending' });
    this.evict(this.quotes);
  }

  async getQuote(quoteId: string): Promise<StoredQuote | null> {
    const found = this.quotes.get(quoteId);
    if (!found) return null;
    if (found.status === 'pending' && new Date(found.quote.expiresAt).getTime() <= Date.now()) {
      found.status = 'expired';
    }
    return found;
  }

  async markQuoteUsed(quoteId: string): Promise<void> {
    const found = this.quotes.get(quoteId);
    if (found) found.status = 'used';
  }

  async saveReceipt(receipt: PaymentReceipt): Promise<void> {
    this.receipts.set(receipt.receiptId, receipt);
    this.evict(this.receipts);
  }

  async getReceipt(receiptId: string): Promise<PaymentReceipt | null> {
    return this.receipts.get(receiptId) ?? null;
  }

  async listReceipts(limit = 50): Promise<readonly PaymentReceipt[]> {
    return [...this.receipts.values()].slice(-limit).reverse();
  }
}
