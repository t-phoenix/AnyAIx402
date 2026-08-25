# AnyX Architecture

How the product, the multi-agent system, and configuration fit together. Spec sources: whitepaper §5, PRD §5, AGENTS.md repository layout.

---

## 1. Product architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Payer: AI agent / Node app / browser wallet                     │
│ holds ETH · USDT · WBTC · cbBTC · (later SOL, BTC-LN)           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ upa.fetch(url)  or  POST /v1/quote + /v1/pay
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/api  (Hono)                                                │
│  GET  /health                                                   │
│  GET  /v1/tokens                                                │
│  POST /v1/quote     → x402 intercept + DEX quote + fee          │
│  POST /v1/pay       → float or swap + EIP-3009 + facilitator    │
│  GET  /v1/receipt/:id                                           │
│  POST /v1/lightning/invoice  (Phase 3 stub)                     │
│  GET  /setup  /  /v1/config/status   human config wizard        │
└────────────┬────────────┬────────────┬────────────┬─────────────┘
             ▼            ▼            ▼            ▼
      packages/core  packages/db   Redis cache   Facilitators
      tokens,quote,  quotes,       30s quotes    CDP primary
      x402,eip3009   payments,     (optional)    + fallback
                     api_keys
             │
             ▼
      @anyx/sdk  UPA class (drop-in fetch)
             │
             ▼
      packages/integrations  (LangChain, MCP, OpenAI, AgentKit)
```

### v0 settlement path (float)

Per AGENTS.md note 8: the hot signer wallet **already holds USDC on Base**. Quote tells the payer how much of their token the swap *would* cost (including spread). Pay signs EIP-3009 from the float wallet to `payTo` for `usdcRequired`. Live DEX execution and `AnyXRouter.sol` replace this in Phase 2.

### Later settlement path (on-chain)

`AnyXRouter.swapAndPay`: pull input token (Permit2) → aggregator swap → require `usdcReceived >= usdcRequired` → fee to `FeeCollector` → `transferWithAuthorization` → refund excess. Transaction **reverts** on slippage. No partial payments.

### Cross-chain (Phase 3+)

Solana/Ethereum → USDC via Jupiter/DEX then **Circle CCTP** burn/mint to Base. Latency-sensitive calls draw **ReservePool** float and replenish asynchronously.

---

## 2. Package map

| Path | Name | Responsibility |
|------|------|----------------|
| `packages/config` | `@anyx/config` | Zod schema, YAML/env merge, missing-key messages |
| `packages/core` | `@anyx/core` | Tokens, fees, x402, quotes, EIP-3009, facilitator, memory store |
| `packages/sdk` | `@anyx/sdk` | `UPA` client |
| `packages/db` | `@anyx/db` | Drizzle schema (quotes, payments, api_keys, lightning_invoices) |
| `packages/integrations/*` | `@anyx/langchain` etc. | Agent tool stubs wrapping UPA |
| `packages/contracts` | `@anyx/contracts` | Solidity stubs + Foundry config |
| `apps/api` | `@anyx/api` | HTTP API + setup UI |
| `apps/dashboard` | `@anyx/dashboard` | Static portal (Next.js target in Phase 5) |
| `agents` | `@anyx/agents` | Orchestrator + specialists |

---

## 3. Multi-agent system

```
                    npm run agents:run -- --goal verify-v0
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Orchestrator     │
                         │  plan / assign /    │
                         │  retry / report     │
                         └──────────┬──────────┘
          ┌─────────────┬───────────┼───────────┬─────────────┐
          ▼             ▼           ▼           ▼             ▼
     Product        x402        Backend     Frontend      Security
          │             │           │           │             │
          └─────────────┴───────────┴───────────┴─────────────┘
                                    │
                                    ▼
                                   QA  (npm test)
                                    │
                     fail ──────────┼────────── pass
                       │            │            │
                       ▼            │            ▼
                 Bug Reporter       │         DevOps
                       │            │       deploy dry-run
                       ▼            │            │
                  Bug Fixer ────────┘            │
                                                 ▼
                                            Run report
                                         .anyx/runs/*.json

  Any time an agent lacks a secret:
        Config Broker → .anyx/config-requests/*.json
        status = blocked_config  (loop continues; does not hang)
```

### Specialist contracts

Each `agents/<id>/SYSTEM.md` defines role, inputs, outputs, allowed tools, bug format, and when to emit a Config Request. Runtime implementations live in `agents/<id>/agent.ts` and are invoked by `agents/orchestrator/loop.ts`.

Deterministic tools always run (tests, schema checks, file probes). Optional LLM assist runs only when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is present; otherwise those steps are skipped with a Config Request, not a hard failure.

---

## 4. Data model (v0)

**Quotes** (30s TTL): endpoint, input token, chain, USDC required, fee, route JSON, status pending/used/expired.

**Payments:** quote id, tx hash, amounts, facilitator, `x-payment-response`, status pending/settled/failed.

**API keys (schema only in v0):** hashed key, plan free/pro/enterprise, volume caps.

Persistence: in-memory `Map` when `DATABASE_URL` is unset (tests + first boot). Drizzle/Postgres when configured.

---

## 5. Security boundaries

- Secrets only in `.env.local` / environment — never in YAML committed to git, never in logs, never in `/v1/config/status` values.
- `/v1/config/status` returns **presence booleans + hints**, not secret material.
- Hot signer is optional until Pay is used live; Quote works in stub mode.
- EIP-3009 `validBefore` = now + 300s; unique `bytes32` nonce.
- Rate limit hooks exist; Redis-backed limits activate when `REDIS_URL` is set.

---

## 6. Deploy

```
GitHub Actions CI (every PR): biome + tsc + vitest + check-config --allow-missing
GitHub Actions Deploy (main): build API Docker image;
  if FLY_API_TOKEN missing → dry-run checklist only
  if present → flyctl deploy + health GET /health
```

Local: `docker compose up -d` (Postgres/Redis) → `cp .env.example .env.local` → `npm run check-config` → `npm run dev:api`.
