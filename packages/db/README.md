# @anyx/db

Drizzle ORM schema and migrations for AnyX (PostgreSQL 16).

## Tables

| Table                | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `quotes`             | DEX swap quotes with a 30s validity window and the applied spread   |
| `payments`           | Completed x402 payment records and settlement metadata              |
| `api_keys`           | Developer API keys (SHA-256 hash only) with plan and volume tracking |
| `lightning_invoices` | Lightning invoice tracking for the Phase 3 BTC path                 |
| `partner_credits`    | Fee-share accruals for embedded integrations (`X-Partner-ID`)       |

Amounts are stored as decimal strings in atomic (base) units so `bigint`
precision survives the round trip. USD volume columns use `numeric(20, 6)`.

## Usage

```ts
import { createDatabase, payments, quotes } from '@anyx/db'

const { db, close } = createDatabase() // reads DATABASE_URL
const rows = await db.select().from(quotes).limit(10)
await close()
```

`tryCreateDatabase()` returns `null` when `DATABASE_URL` is absent, which is how
`apps/api` boots in degraded mode without Postgres. Importing the package (types
included) never opens a connection — postgres.js connects lazily.

## Migrations

```bash
# regenerate SQL from src/schema.ts (no database needed)
bun run db:generate

# apply pending migrations against DATABASE_URL
bun run db:migrate
```

Generated SQL and the Drizzle journal live in `drizzle/` and are committed.

## Configuration

This package reads `DATABASE_URL` from the process environment through
`src/env.ts`. `@anyx/config` is the eventual single source of truth for typed
configuration across the monorepo; the local helper keeps `@anyx/db`
dependency-free until then, and the variable name is identical either way.
