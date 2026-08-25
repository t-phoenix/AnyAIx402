# Getting started

## Requirements

Only [Bun](https://bun.sh) 1.1 or newer is required. Git is assumed.

Everything else is optional and the tooling will tell you what you are missing
rather than failing on it:

| Optional | Needed for | Without it |
| --- | --- | --- |
| Docker | Local Postgres and Redis | Use free hosted tiers, or run degraded |
| Foundry | Solidity build, test, deploy | Contract tasks are skipped with a reason |
| flyctl | Deployment | The deploy pipeline skips the deploy step |
| gh | Ingesting CI failures into the bug store | That intake adapter is skipped |

## Setup

```bash
git clone https://github.com/t-phoenix/AnyAIx402.git
cd AnyAIx402
./scripts/setup.sh
```

The script installs Bun if it is absent, copies `.env.example` to `.env.local`
and `config/anyx.config.example.jsonc` to `config/anyx.config.jsonc`, installs
dependencies, starts Postgres and Redis if Docker is available, runs migrations
if there is a database to migrate, and finishes with a health check.

It is idempotent, so re-running it is safe and it will not overwrite a
`.env.local` you have already edited.

### Doing it manually

```bash
curl -fsSL https://bun.sh/install | bash    # if you do not have Bun
export PATH="$HOME/.bun/bin:$PATH"

cp .env.example .env.local
cp config/anyx.config.example.jsonc config/anyx.config.jsonc
bun install
```

## Running it

```bash
bun run dev          # API and dashboard
bun run test         # test suites
bun run typecheck
bun run lint
bun run build
```

The API starts with no database and no Redis. `GET /health` reports which
capabilities are degraded and why, so an incomplete environment is visible
rather than mysterious.

## Adding credentials

Nothing so far required an account. To go further, find out what you need:

```bash
bun run config:missing     # unset keys, each with its signup URL and steps
bun run config:features    # what is on, and exactly what unlocks the rest
./scripts/orchestrate gates
```

Put secrets in `.env.local`. Neither it nor `config/anyx.config.jsonc` is
committed.

The shortest path to real quotes is two free API keys and a database:

```bash
# .env.local
ONEINCH_API_KEY=...        # https://portal.1inch.dev/
ZEROX_API_KEY=...          # https://dashboard.0x.org/
DATABASE_URL=postgresql://anyx:anyx@localhost:5432/anyx
REDIS_URL=redis://localhost:6379
```

Then confirm:

```bash
bun run config:check
./scripts/orchestrate gates --verify   # actually calls each API to prove the key works
```

The full account-by-account walkthrough is [`config/README.md`](../config/README.md).

### Without Docker

Free hosted tiers work fine and need no local services:

- Postgres: [neon.tech](https://neon.tech/) or [supabase.com](https://supabase.com/) — append `?sslmode=require`
- Redis: [upstash.com](https://upstash.com/)

Put the connection strings in `.env.local` and carry on.

## Running the orchestrator

```bash
./scripts/orchestrate doctor          # toolchain, config and service health
./scripts/orchestrate plan            # the build graph and what is ready
./scripts/orchestrate run --dry-run   # render every prompt, change nothing
./scripts/orchestrate test --continue # every gate, collecting all failures
./scripts/orchestrate bugs list       # what is open and who owns it
```

The executor defaults to dry-run, so none of these will modify your code. To let
agents write code, set `orchestrator.agentCommand` in
`config/anyx.config.jsonc`. See [`orchestrator/README.md`](../orchestrator/README.md).

## Using the SDK

```bash
bun add @anyx/sdk
```

```ts
import { UPA } from '@anyx/sdk';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

const wallet = createWalletClient({ chain: base, transport: http() });

const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453,
  wallet,
  maxSlippage: 0.005,
});

upa.on('payment', (receipt) => {
  console.log(`paid ${receipt.inputAmount} ${receipt.inputToken} → ${receipt.apiCostUSDC} USDC`);
});

const res = await upa.fetch('https://api.example.com/data');
const data = await res.json();
```

`upa.fetch` behaves exactly like `fetch` when the response is not a 402. When it
is, the challenge, quote, swap, authorization and retry all happen inside the
call.

To see the cost before committing:

```ts
const quote = await upa.quote('https://api.example.com/data');
console.log(quote.inputAmount, quote.fee, quote.expiresAt);
```

Quotes are valid for 30 seconds, bound to DEX quote freshness.

## Troubleshooting

**`bun: command not found` after setup** — add Bun to your PATH:
`export PATH="$HOME/.bun/bin:$PATH"`, and put that line in your shell profile.

**`gates` exits 1** — that is correct when a required credential is missing. It
is a checklist, and a non-zero exit is how CI notices.

**Contract tasks always skip** — Foundry is not installed:
`curl -L https://foundry.paradigm.xyz | bash && foundryup`.

**Quotes fail with `QuoteError`** — both aggregators failed. Check
`ONEINCH_API_KEY` and `ZEROX_API_KEY` with `./scripts/orchestrate gates --verify`.

**Everything reports degraded** — expected with no `.env.local`. Run
`bun run config:missing`.

## Next

- [`docs/architecture.md`](architecture.md) — how a payment actually works
- [`MASTER_PLAN.md`](../MASTER_PLAN.md) — the multi-agent build plan
- [`docs/security.md`](security.md) — before you go anywhere near mainnet
