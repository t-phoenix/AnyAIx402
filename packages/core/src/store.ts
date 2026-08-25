import type { BestQuote, PaymentReceipt } from "./types.ts";
import { AnyxError } from "./types.ts";

type StoredQuote = BestQuote & { status: "pending" | "used" | "expired" };

const quotes = new Map<string, StoredQuote>();
const receipts = new Map<string, PaymentReceipt>();

export function saveQuote(quote: BestQuote): void {
  quotes.set(quote.quoteId, { ...quote, status: "pending" });
}

export function getQuote(quoteId: string): StoredQuote {
  const quote = quotes.get(quoteId);
  if (!quote) throw new AnyxError("QUOTE_NOT_FOUND", `No quote ${quoteId}`);
  if (quote.status === "expired" || quote.expiresAt.getTime() < Date.now()) {
    quote.status = "expired";
    throw new AnyxError("QUOTE_EXPIRED", "Quote older than 30 seconds; call /v1/quote again");
  }
  return quote;
}

export function markQuoteUsed(quoteId: string): void {
  const quote = quotes.get(quoteId);
  if (quote) quote.status = "used";
}

export function saveReceipt(receipt: PaymentReceipt): void {
  receipts.set(receipt.receiptId, receipt);
}

export function getReceipt(receiptId: string): PaymentReceipt {
  const receipt = receipts.get(receiptId);
  if (!receipt) throw new AnyxError("QUOTE_NOT_FOUND", `No receipt ${receiptId}`);
  return receipt;
}

export function resetStore(): void {
  quotes.clear();
  receipts.clear();
}
