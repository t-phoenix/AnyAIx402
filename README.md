# AnyX (AnyAIx402)

**Pay with any token. Settle on x402.**

AnyX is a universal payment adapter for the [x402](https://x402.org) protocol. AI agents and apps that hold ETH, USDT, WBTC, or other tokens can call x402-gated APIs without first buying USDC on Base. AnyX intercepts HTTP 402, quotes a DEX swap, signs EIP-3009, and submits to a standard facilitator. API providers still receive USDC.

This repository is the **v0 scaffold**: Quote API, UPA SDK, config wizard, tests, CI, and a multi-agent orchestrator that can plan, test, file bugs, and dry-run deploy.

Product docs (vision, PRD, research): [`docs/`](docs/). Start with [`docs/PLAN.md`](docs/PLAN.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## What works today vs later

| Shipped in this slice | Still TODO (see PLAN phases) |
|-----------------------|------------------------------|
| Token registry (Base USDC/USDT/WETH/ETH/cbBTC) | On-chain `AnyXRouter.sol` swap-and-pay |
| x402 v2 challenge parser | Circle CCTP / Solana path |
| DEX quote engine (1inch + 0x, stub if no keys) | Lightning invoices |
| Fee math (USDT 0.05%, ETH 0.20%, …) | Stripe Pro billing |
| Hono API: health, tokens, quote, stub pay, receipts | Redis-backed rate limits in production |
| `@anyx/sdk` `UPA.fetch()` / `quote()` / `pay()` | npm publish |
| `/setup` config wizard + `npm run check-config` | Next.js analytics dashboard |
| MAS orchestrator loop | LLM-backed auto-patcher |
| LangChain / MCP / AgentKit **stubs** | Published integration packages |
| CI + secret-gated deploy workflow | Live Fly.io deploy |

---

## Quick start

```bash
npm install
cp .env.example .env.local
npm test
npm run check-config
npm run dev:api
```

Then open [http://localhost:3000/setup](http://localhost:3000/setup) and [http://localhost:3000/health](http://localhost:3000/health).

Optional: `docker compose up -d` for Postgres + Redis (quotes work in memory without them).

---

## Connecting APIs & Payments

You do **not** need every key to start. The API boots with demo quotes and simulated payments until you opt into live mode.

### 1. Pick a file (either is fine)

- **`.env.local`** — copy from `.env.example`. Each line has a comment.
- **`config/user.config.yaml`** — copy from `config/user.config.example.yaml`. Written for non-engineers.

Environment variables override the YAML file when both exist.

### 2. See what is missing

```bash
npm run check-config
```

Or start the API and use the wizard: **http://localhost:3000/setup**

That page only shows *whether* a secret is present. It never prints the secret.

### 3. What each group is for

| You want to… | Fill in | Where to get it |
|--------------|---------|-----------------|
| Run the API locally | nothing extra | `npm run dev:api` |
| **Live** ETH/USDT cost quotes | `ONEINCH_API_KEY` or `ZEROX_API_KEY` | [1inch portal](https://portal.1inch.dev/) · [0x dashboard](https://dashboard.0x.org/) |
| **Live** USDC settlement | `PRIVATE_KEY` + Base RPC, then set `ANYX_STUB_PAYMENTS=false` | A **dedicated** test wallet that holds USDC on Base. Not your savings wallet. |
| x402 facilitator | `FACILITATOR_URL` (default is Coinbase CDP) | Already set in `.env.example` |
| Cross-chain USDC later | Circle `CCTP_ATTESTER_URL` (default Iris) | Phase 2 — skip for v0 |
| Agent LLM planning | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Optional. Tests and the agent loop run without them. |
| Bitcoin Lightning | LND paths | Phase 3 — skip |
| Pro SaaS billing | Stripe keys | Phase 6 — skip |

Keep `ANYX_STUB_PAYMENTS=true` until the signer wallet is funded. Stub receipts are marked `"stub": true`.

**Never commit** `.env.local` or a filled `config/user.config.yaml`.

---

## Multi-agent system

```bash
npm run agents:run
npm run agents:run -- --goal verify-v0
```

The orchestrator:

1. Plans and assigns work to domain agents  
2. Specialists check protocol, API, UI, security, integrations  
3. QA runs Vitest (skipped when already inside Vitest)  
4. On failure → Bug Reporter files `.anyx/bugs/*.json` → Bug Fixer acknowledges → re-test  
5. DevOps prints a **dry-run** deploy checklist (live Fly deploy only if `FLY_API_TOKEN` exists)  
6. Missing keys become **Config Requests** in `.anyx/config-requests/` instead of hanging  

| Agent | Role |
|-------|------|
| Orchestrator | Tech lead, loop, run reports |
| Product | Keep v0 scope (quote + SDK) |
| x402 | 402 parse, fees, EIP-3009, facilitator |
| Backend | Hono routes |
| Frontend | `/setup` wizard |
| AI integrations | LangChain / MCP / OpenAI / AgentKit stubs |
| Security | Signer + gitignore secrets |
| Config broker | Plain-language missing keys |
| QA | Tests |
| Bug reporter / fixer | Structured bugs → retest |
| DevOps | CI + gated deploy |

Prompts: `agents/*/SYSTEM.md`. Types: `agents/orchestrator/types.ts`.

---

## Tests and deploy

```bash
npm test           # Vitest
npm run lint       # Biome
npm run typecheck  # tsc --noEmit
```

GitHub Actions:

- `.github/workflows/ci.yml` — lint, typecheck, test, config check  
- `.github/workflows/deploy.yml` — build Docker image; **Fly.io deploy only when `FLY_API_TOKEN` is set**

---

## Repo layout

```
apps/api            Hono API + setup UI
apps/dashboard      v0 static portal
packages/core       tokens, x402, quotes, EIP-3009
packages/sdk        UPA client
packages/config     Zod schema + YAML/env merge
packages/db         Drizzle schema
packages/integrations  Agent framework stubs
packages/contracts  Solidity stub (Phase 2)
agents/             MAS orchestrator + specialists
docs/               Source documents + PLAN + ARCHITECTURE
```

License: Apache-2.0.
