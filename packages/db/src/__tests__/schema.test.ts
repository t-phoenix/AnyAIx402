import { describe, expect, it } from 'vitest';
import {
  apiKeyPlanEnum,
  apiKeys,
  lightningInvoiceStatusEnum,
  lightningInvoices,
  paymentStatusEnum,
  payments,
  quoteStatusEnum,
  quotes,
} from '../schema';

/**
 * Schema smoke tests — no live Postgres connection required. These exist mainly so
 * `vitest run` has something to execute (drizzle table objects are validated at import time;
 * a malformed column definition throws immediately on module load) and so CI catches
 * accidental table/column renames that would silently break the API layer.
 */
describe('drizzle schema', () => {
  it('defines the quotes table with the columns documented in docs/AGENTS.md Task 0.2', () => {
    expect(quotes).toBeDefined();
    for (const column of [
      'id',
      'createdAt',
      'expiresAt',
      'endpointUrl',
      'inputToken',
      'inputTokenAddress',
      'inputChainId',
      'inputAmount',
      'usdcRequired',
      'usdcOnChain',
      'feeBps',
      'routeData',
      'status',
    ]) {
      expect(quotes).toHaveProperty(column);
    }
  });

  it('defines the payments table with the columns documented in docs/AGENTS.md Task 0.2', () => {
    expect(payments).toBeDefined();
    for (const column of [
      'id',
      'quoteId',
      'createdAt',
      'completedAt',
      'txHash',
      'blockNumber',
      'fromAddress',
      'toAddress',
      'inputToken',
      'inputAmount',
      'usdcAmount',
      'feeUsdc',
      'apiEndpoint',
      'facilitatorUrl',
      'xPaymentResponse',
      'status',
    ]) {
      expect(payments).toHaveProperty(column);
    }
  });

  it('defines the api_keys table', () => {
    expect(apiKeys).toBeDefined();
    for (const column of [
      'id',
      'createdAt',
      'keyHash',
      'name',
      'ownerEmail',
      'plan',
      'monthlyLimitUsd',
      'currentMonthVolumeUsd',
      'isActive',
    ]) {
      expect(apiKeys).toHaveProperty(column);
    }
  });

  it('defines the lightning_invoices table', () => {
    expect(lightningInvoices).toBeDefined();
    for (const column of [
      'id',
      'createdAt',
      'expiresAt',
      'bolt11',
      'paymentHash',
      'amountSats',
      'usdcEquivalent',
      'apiEndpoint',
      'status',
    ]) {
      expect(lightningInvoices).toHaveProperty(column);
    }
  });

  it('exposes the expected enum values', () => {
    expect(quoteStatusEnum.enumValues).toEqual(['pending', 'used', 'expired']);
    expect(paymentStatusEnum.enumValues).toEqual(['pending', 'settled', 'failed']);
    expect(apiKeyPlanEnum.enumValues).toEqual(['free', 'pro', 'enterprise']);
    expect(lightningInvoiceStatusEnum.enumValues).toEqual(['pending', 'paid', 'expired']);
  });
});
