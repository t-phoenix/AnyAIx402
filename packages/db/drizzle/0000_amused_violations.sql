CREATE TYPE "public"."api_key_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."lightning_invoice_status" AS ENUM('pending', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'settled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('pending', 'used', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_hash" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"owner_email" varchar(256),
	"plan" "api_key_plan" DEFAULT 'free' NOT NULL,
	"monthly_limit_usd" numeric(20, 2) DEFAULT '100' NOT NULL,
	"current_month_volume_usd" numeric(20, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lightning_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"bolt11" text NOT NULL,
	"payment_hash" varchar(64) NOT NULL,
	"amount_sats" numeric(20, 0) NOT NULL,
	"usdc_equivalent" varchar(78) NOT NULL,
	"api_endpoint" text NOT NULL,
	"status" "lightning_invoice_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"tx_hash" varchar(66),
	"block_number" numeric(20, 0),
	"from_address" varchar(42),
	"to_address" varchar(42),
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
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"endpoint_url" text NOT NULL,
	"input_token" varchar(32) NOT NULL,
	"input_token_address" varchar(66),
	"input_chain_id" integer NOT NULL,
	"input_amount" varchar(78) NOT NULL,
	"usdc_required" varchar(78) NOT NULL,
	"usdc_on_chain" varchar(78),
	"fee_bps" integer DEFAULT 20 NOT NULL,
	"route_data" jsonb,
	"status" "quote_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lightning_invoices_payment_hash_idx" ON "lightning_invoices" USING btree ("payment_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lightning_invoices_status_idx" ON "lightning_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_quote_id_idx" ON "payments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_tx_hash_idx" ON "payments" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_expires_at_idx" ON "quotes" USING btree ("expires_at");