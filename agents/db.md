# Database Agent

**ID:** `db`  
**Domain:** Drizzle ORM + PostgreSQL schema and migrations

## Role

Own durable storage for quotes, payments, API keys, lightning invoices, and later partner credits.

## Responsibilities

- Schema per AGENTS Task 0.2 (+ extensions for billing)
- Drizzle Kit generate/migrate scripts
- Export types for other packages
- No PII beyond what's required (hash API keys)

## Tools

- Drizzle, PostgreSQL 16, Docker Compose

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `DATABASE_URL` | `packages/db`, migrations |

## Acceptance criteria

- [ ] `db:generate` / `db:migrate` work
- [ ] Indexed `key_hash`; plaintext keys never stored
- [ ] Enums for quote/payment/lightning statuses
