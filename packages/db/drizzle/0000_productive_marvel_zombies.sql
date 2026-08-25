CREATE TYPE "public"."api_key_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."lightning_invoice_status" AS ENUM('pending', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "public"."partner_credit_status" AS ENUM('accrued', 'settled', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'settled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('pending', 'used', 'expired');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_hash" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"owner_email" varchar(256) NOT NULL,
	"plan" "api_key_plan" DEFAULT 'free' NOT NULL,
	"monthly_limit_usd" numeric(20, 6) DEFAULT '100' NOT NULL,
	"current_month_volume_usd" numeric(20, 6) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightning_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"bolt11" text NOT NULL,
	"payment_hash" varchar(128) NOT NULL,
	"amount_sats" bigint NOT NULL,
	"usdc_equivalent" varchar(78) NOT NULL,
	"api_endpoint" text NOT NULL,
	"status" "lightning_invoice_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"partner_id" varchar(128) NOT NULL,
	"payment_id" uuid,
	"api_key_id" uuid,
	"fee_usdc" varchar(78) NOT NULL,
	"credit_usdc" varchar(78) NOT NULL,
	"share_bps" integer DEFAULT 2000 NOT NULL,
	"status" "partner_credit_status" DEFAULT 'accrued' NOT NULL,
	"settled_at" timestamp with time zone,
	"settlement_tx_hash" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"tx_hash" varchar(128),
	"block_number" bigint,
	"from_address" varchar(128),
	"to_address" varchar(128),
	"input_token" varchar(32) NOT NULL,
	"input_amount" varchar(78) NOT NULL,
	"usdc_amount" varchar(78) NOT NULL,
	"fee_usdc" varchar(78) NOT NULL,
	"api_endpoint" text NOT NULL,
	"facilitator_url" text,
	"x_payment_response" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"endpoint_url" text NOT NULL,
	"input_token" varchar(32) NOT NULL,
	"input_token_address" varchar(128),
	"input_chain_id" integer NOT NULL,
	"input_amount" varchar(78) NOT NULL,
	"usdc_required" varchar(78) NOT NULL,
	"usdc_on_chain" varchar(78) NOT NULL,
	"fee_bps" integer NOT NULL,
	"route_data" jsonb,
	"status" "quote_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_credits" ADD CONSTRAINT "partner_credits_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credits" ADD CONSTRAINT "partner_credits_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_owner_email_idx" ON "api_keys" USING btree ("owner_email");--> statement-breakpoint
CREATE UNIQUE INDEX "lightning_invoices_payment_hash_idx" ON "lightning_invoices" USING btree ("payment_hash");--> statement-breakpoint
CREATE INDEX "lightning_invoices_status_idx" ON "lightning_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partner_credits_partner_id_idx" ON "partner_credits" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_credits_status_idx" ON "partner_credits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partner_credits_payment_id_idx" ON "partner_credits" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_quote_id_idx" ON "payments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_tx_hash_idx" ON "payments" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "payments_from_address_idx" ON "payments" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_expires_at_idx" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "quotes_endpoint_url_idx" ON "quotes" USING btree ("endpoint_url");