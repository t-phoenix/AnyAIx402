import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const quoteStatus = pgEnum('quote_status', ['pending', 'used', 'expired'])
export const paymentStatus = pgEnum('payment_status', ['pending', 'settled', 'failed'])
export const apiKeyPlan = pgEnum('api_key_plan', ['free', 'pro', 'enterprise'])
export const lightningInvoiceStatus = pgEnum('lightning_invoice_status', [
  'pending',
  'paid',
  'expired',
])
export const partnerCreditStatus = pgEnum('partner_credit_status', ['accrued', 'settled', 'void'])

/**
 * Amounts are stored as decimal strings in atomic (base) units so that no
 * precision is lost round-tripping bigint values through the database.
 */
export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endpointUrl: text('endpoint_url').notNull(),
    inputToken: varchar('input_token', { length: 32 }).notNull(),
    inputTokenAddress: varchar('input_token_address', { length: 128 }),
    inputChainId: integer('input_chain_id').notNull(),
    inputAmount: varchar('input_amount', { length: 78 }).notNull(),
    usdcRequired: varchar('usdc_required', { length: 78 }).notNull(),
    usdcOnChain: varchar('usdc_on_chain', { length: 78 }).notNull(),
    feeBps: integer('fee_bps').notNull(),
    routeData: jsonb('route_data'),
    status: quoteStatus('status').notNull().default('pending'),
  },
  (table) => [
    index('quotes_status_idx').on(table.status),
    index('quotes_expires_at_idx').on(table.expiresAt),
    index('quotes_endpoint_url_idx').on(table.endpointUrl),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    txHash: varchar('tx_hash', { length: 128 }),
    blockNumber: bigint('block_number', { mode: 'number' }),
    fromAddress: varchar('from_address', { length: 128 }),
    toAddress: varchar('to_address', { length: 128 }),
    inputToken: varchar('input_token', { length: 32 }).notNull(),
    inputAmount: varchar('input_amount', { length: 78 }).notNull(),
    usdcAmount: varchar('usdc_amount', { length: 78 }).notNull(),
    feeUsdc: varchar('fee_usdc', { length: 78 }).notNull(),
    apiEndpoint: text('api_endpoint').notNull(),
    facilitatorUrl: text('facilitator_url'),
    xPaymentResponse: text('x_payment_response'),
    status: paymentStatus('status').notNull().default('pending'),
  },
  (table) => [
    index('payments_quote_id_idx').on(table.quoteId),
    index('payments_status_idx').on(table.status),
    index('payments_tx_hash_idx').on(table.txHash),
    index('payments_from_address_idx').on(table.fromAddress),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    keyHash: text('key_hash').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    ownerEmail: varchar('owner_email', { length: 256 }).notNull(),
    plan: apiKeyPlan('plan').notNull().default('free'),
    monthlyLimitUsd: numeric('monthly_limit_usd', { precision: 20, scale: 6 })
      .notNull()
      .default('100'),
    currentMonthVolumeUsd: numeric('current_month_volume_usd', { precision: 20, scale: 6 })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
    index('api_keys_owner_email_idx').on(table.ownerEmail),
  ],
)

export const lightningInvoices = pgTable(
  'lightning_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    bolt11: text('bolt11').notNull(),
    paymentHash: varchar('payment_hash', { length: 128 }).notNull(),
    amountSats: bigint('amount_sats', { mode: 'number' }).notNull(),
    usdcEquivalent: varchar('usdc_equivalent', { length: 78 }).notNull(),
    apiEndpoint: text('api_endpoint').notNull(),
    status: lightningInvoiceStatus('status').notNull().default('pending'),
  },
  (table) => [
    uniqueIndex('lightning_invoices_payment_hash_idx').on(table.paymentHash),
    index('lightning_invoices_status_idx').on(table.status),
  ],
)

/**
 * Fee sharing for embedded integrations (roadmap Task 6.1): when a request
 * carries `X-Partner-ID`, a share of the AnyX fee accrues to that partner and is
 * settled out-of-band via USDC transfer.
 */
export const partnerCredits = pgTable(
  'partner_credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    partnerId: varchar('partner_id', { length: 128 }).notNull(),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    feeUsdc: varchar('fee_usdc', { length: 78 }).notNull(),
    creditUsdc: varchar('credit_usdc', { length: 78 }).notNull(),
    shareBps: integer('share_bps').notNull().default(2000),
    status: partnerCreditStatus('status').notNull().default('accrued'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    settlementTxHash: varchar('settlement_tx_hash', { length: 128 }),
  },
  (table) => [
    index('partner_credits_partner_id_idx').on(table.partnerId),
    index('partner_credits_status_idx').on(table.status),
    index('partner_credits_payment_id_idx').on(table.paymentId),
  ],
)

export const quotesRelations = relations(quotes, ({ many }) => ({
  payments: many(payments),
}))

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  quote: one(quotes, { fields: [payments.quoteId], references: [quotes.id] }),
  partnerCredits: many(partnerCredits),
}))

export const apiKeysRelations = relations(apiKeys, ({ many }) => ({
  partnerCredits: many(partnerCredits),
}))

export const partnerCreditsRelations = relations(partnerCredits, ({ one }) => ({
  payment: one(payments, { fields: [partnerCredits.paymentId], references: [payments.id] }),
  apiKey: one(apiKeys, { fields: [partnerCredits.apiKeyId], references: [apiKeys.id] }),
}))

export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type LightningInvoice = typeof lightningInvoices.$inferSelect
export type NewLightningInvoice = typeof lightningInvoices.$inferInsert
export type PartnerCredit = typeof partnerCredits.$inferSelect
export type NewPartnerCredit = typeof partnerCredits.$inferInsert

export type QuoteStatus = (typeof quoteStatus.enumValues)[number]
export type PaymentStatus = (typeof paymentStatus.enumValues)[number]
export type ApiKeyPlan = (typeof apiKeyPlan.enumValues)[number]
export type LightningInvoiceStatus = (typeof lightningInvoiceStatus.enumValues)[number]
export type PartnerCreditStatus = (typeof partnerCreditStatus.enumValues)[number]
