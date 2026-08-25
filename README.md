# AnyX

**Pay with any token. Settle on x402.**

x402 lets a server answer an HTTP request with `402 Payment Required` and settle
the payment on-chain in seconds. It works well, and it settles exclusively in
USDC on Base.

That excludes almost everyone. The world's crypto liquidity is in BTC, ETH, USDT
and SOL. An AI agent holding ETH cannot pay an x402 API without first acquiring
USDC. A Bitcoin holder cannot participate at all.

AnyX closes that gap from the payer's side. It intercepts the 402 challenge,
routes the payer's token through a DEX aggregator, signs the EIP-3009
authorization, and submits it to the facilitator. The API provider receives an
ordinary USDC payment and never learns anything happened.

```ts
import { UPA } from '@anyx/sdk';

const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453, wallet });

// A drop-in replacement for fetch. The 402, the swap and the
// authorization are all handled internally.
const res = await upa.fetch('https://api.example.com/data');
```

No protocol change. No server-side change. AnyX earns a spread on the swap —
0.05% on stablecoin pairs, up to 0.50% on BTC — and the payer still comes out
ahead of routing through a centralized exchange.

---

## This repository builds itself

AnyX is constructed by a multi-agent system that lives in this repo. Fifteen
specialist agents own disjoint parts of the codebase. An orchestrator plans the
work, dispatches each task to the agent that owns that domain, verifies the
result against machine-checkable criteria, turns failures into deduplicated bug
reports, routes each to its owner, attempts a bounded fix, and escalates with a
full reproduction report when it cannot.

```bash
./scripts/orchestrate plan     # the build graph and what is ready
./scripts/orchestrate run      # dispatch, verify, fix
./scripts/orchestrate gates    # what a human still has to supply
```

The plan is [`MASTER_PLAN.md`](MASTER_PLAN.md). The operator manual is
[`orchestrator/README.md`](orchestrator/README.md).

---

## Getting started

```bash
git clone https://github.com/t-phoenix/AnyAIx402.git
cd AnyAIx402
./scripts/setup.sh
```

`setup.sh` installs Bun if it is missing, creates `.env.local` and
`config/anyx.config.jsonc` from their templates, installs dependencies, starts
Postgres and Redis if Docker is available, and runs a health check. **It needs
no accounts and no credentials.** Anything optional that is unavailable is
reported as a skip with a way forward, not as a failure.

Then:

```bash
bun run dev                    # API and dashboard
bun run test                   # the test suites
./scripts/orchestrate doctor   # toolchain, config and service health
```

Without credentials the API runs in a degraded mode it reports at `/health`, and
the orchestrator runs in dry-run: it renders every prompt and dispatches
nothing. Both tell you exactly which capability is off and what would turn it
on.

---

## Configuration

Two files, neither committed:

| File | Contents |
| --- | --- |
| `.env.local` | Secrets: API keys, signing keys, connection strings |
| `config/anyx.config.jsonc` | Settings: fees, slippage, timeouts, deploy targets |

Precedence, strongest first: `process env` → `.env.local` → `.env` →
`config/anyx.config.jsonc` → built-in defaults.

Rather than reading a reference, ask:

```bash
bun run config:missing    # unset keys, each with signup URL and instructions
bun run config:features   # what is on, and exactly what unlocks the rest
```

Every configuration key is declared once, as data, in a single registry — with
its type, whether it is secret, which environments require it, how to obtain it,
and which product capability it gates. `.env.example` and
[`docs/configuration.md`](docs/configuration.md) are generated from that
registry, so they cannot drift from the code.

The full walkthrough of every account to create is
[`config/README.md`](config/README.md).

---

## Repository map

```
apps/
  api/               Hono + Bun API server: quote, pay, receipt, tokens
  dashboard/         Next.js developer portal and analytics
packages/
  core/              Token registry, DEX quotes, x402, EIP-3009, facilitator
  sdk/               @anyx/sdk — the UPA class and upa.fetch() drop-in
  db/                Drizzle schema and migrations
  contracts/         Solidity: AnyXRouter, SwapExecutor, FeeCollector, ReservePool
  config/            @anyx/config — the configuration registry and loader
orchestrator/        The multi-agent build system
config/              Configuration templates and the setup guide
docs/                Architecture, guides, and the source documents
scripts/             setup.sh, orchestrate, deploy.sh
```

---

## How a payment works

```
  payer holds ETH
        │
        ▼
  GET /resource ─────────────────────────────►  x402 API
        │                                            │
        │  ◄──────── 402 + PaymentRequired ──────────┘
        │            (1.00 USDC on Base, payTo 0x…)
        ▼
  ┌─────────────────────────────────────────────┐
  │ AnyX                                        │
  │  1. parse the challenge                     │
  │  2. quote ETH → USDC (1inch ∥ 0x, best win) │
  │  3. apply the spread                        │
  │  4. swap, reverting if short of the amount  │
  │  5. sign EIP-3009 transferWithAuthorization │
  └────────────────────┬────────────────────────┘
                       ▼
              x402 facilitator  ──► transferWithAuthorization on Base
                       │
        ┌──────────────┘
        ▼
  GET /resource + X-PAYMENT ─────────────────►  x402 API
        │                                            │
        │  ◄──────────── 200 OK + resource ──────────┘
        ▼
  payer receives the resource and an itemized receipt
```

Two rules are absolute. The swap reverts rather than settling short — **partial
payments are impossible**. And the fee is applied on top of the required amount,
never taken out of it, so the API provider always receives exactly what it
asked for.

---

## Documentation

| | |
| --- | --- |
| [`MASTER_PLAN.md`](MASTER_PLAN.md) | The multi-agent build plan: roster, graph, automation loop, risks |
| [`orchestrator/README.md`](orchestrator/README.md) | Running the orchestrator |
| [`config/README.md`](config/README.md) | Every account to create, and what it unlocks |
| [`docs/configuration.md`](docs/configuration.md) | Generated reference for every config key |
| [`docs/reference/`](docs/reference/) | Whitepaper, PRD, build roadmap, market and GTM research |

---

## Status

Early, and specific about it. What exists and is tested:

| | |
| --- | --- |
| Core engine | Token registry, DEX quote aggregation, x402 parsing, EIP-3009 signing, facilitator failover — 99 tests, 82% coverage |
| API | All read and payment endpoints, degraded-mode operation — 26 tests |
| SDK | `UPA` with the `fetch` drop-in and client-side guardrails — 26 tests |
| Contracts | `AnyXRouter` and friends — 28 Foundry tests including a fuzz run |
| Orchestrator | Full plan/dispatch/verify/triage/fix/deploy loop — 44 tests |
| Config | Registry, loader precedence, secret masking — 8 tests |
| Dashboard | Four pages, verified in a browser |

231 tests in total: 203 TypeScript and 28 Solidity.

Cross-chain (Phase 3), Lightning (Phase 4), billing (Phase 6) and the agent
integrations (Phase 7) are encoded in the task graph rather than implemented,
which is the intended handoff. `./scripts/orchestrate plan` is the honest answer
to what is done.

The contracts compile and their tests pass, but they are **unaudited and
undeployed**. Do not point them at mainnet funds.

---

## License

Apache-2.0
