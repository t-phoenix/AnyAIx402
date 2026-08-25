/**
 * Drizzle schema for Postgres. v0 uses the in-memory store in @anyx/core
 * until DATABASE_URL is set. Keep this file as the source of truth for columns.
 */
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const quoteStatusEnum = pgEnum("quote_status", ["pending", "used", "expired"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "settled", "failed"]);
export const planEnum = pgEnum("plan", ["free", "pro", "enterprise"]);
export const lightningStatusEnum = pgEnum("lightning_status", ["pending", "paid", "expired"]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  inputToken: varchar("input_token", { length: 32 }).notNull(),
  inputTokenAddress: text("input_token_address"),
  inputChainId: integer("input_chain_id").notNull(),
  inputAmount: varchar("input_amount", { length: 78 }).notNull(),
  usdcRequired: varchar("usdc_required", { length: 78 }).notNull(),
  usdcOnChain: varchar("usdc_on_chain", { length: 64 }).notNull(),
  feeBps: integer("fee_bps").notNull(),
  routeData: jsonb("route_data"),
  status: quoteStatusEnum("status").default("pending").notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey(),
  quoteId: uuid("quote_id").references(() => quotes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  txHash: text("tx_hash"),
  blockNumber: integer("block_number"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  inputToken: varchar("input_token", { length: 32 }),
  inputAmount: varchar("input_amount", { length: 78 }),
  usdcAmount: varchar("usdc_amount", { length: 78 }),
  feeUsdc: varchar("fee_usdc", { length: 78 }),
  apiEndpoint: text("api_endpoint"),
  facilitatorUrl: text("facilitator_url"),
  xPaymentResponse: text("x_payment_response"),
  status: paymentStatusEnum("status").default("pending").notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email"),
  plan: planEnum("plan").default("free").notNull(),
  monthlyLimitUsd: integer("monthly_limit_usd"),
  currentMonthVolumeUsd: integer("current_month_volume_usd"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const lightningInvoices = pgTable("lightning_invoices", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  bolt11: text("bolt11").notNull(),
  paymentHash: text("payment_hash").notNull(),
  amountSats: integer("amount_sats").notNull(),
  usdcEquivalent: varchar("usdc_equivalent", { length: 78 }).notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  status: lightningStatusEnum("status").default("pending").notNull(),
});
