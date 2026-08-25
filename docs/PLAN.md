# AnyX / AnyAIx402 — Master Build Plan

**Product:** AnyX (repo: AnyAIx402)  
**Tagline:** Pay with any token. Settle on x402.  
**Status:** v0 scaffold (Quote API + UPA SDK + MAS + config surface)  
**Sources:** whitepaper, PRD, AGENTS.md, low-hanging-fruit, AI integrations, market/GTM docs.

This plan is the single build sequence for humans and for the multi-agent orchestrator. Later phases must not start until the current phase's acceptance checks pass.

---

## 1. Product vision

x402 is a machine-payment protocol that settles in **USDC on Base** via HTTP 402 + EIP-3009. That design is correct for API providers. It is painful for payers who hold ETH, USDT, WBTC, SOL, or BTC.

AnyX is a **payer-side universal adapter**, not a new protocol:

1. Intercept the 402 challenge.
2. Read USDC amount + `payTo`.
3. Quote a DEX route from the payer's token → USDC.
4. Apply a transparent swap spread (0.05–0.75% depending on pair).
5. Obtain USDC (float in v0; on-chain swap later).
6. Sign EIP-3009 `transferWithAuthorization`.
7. Submit to an x402 facilitator (Coinbase CDP, with failover).
8. Return the 200 OK resource + a `PaymentReceipt`.

API providers keep receiving standard USDC. AnyX earns the spread. No x402 spec change required.

**Non-goals for v1:** fiat on-ramp, custodial user wallets, NFT payments, changing server-side `accepts` arrays as a protocol fork.

---

## 2. Why v0 is the Quote API + USDT/ETH SDK (not contracts)

The low-hanging-fruit doc ranks **Quote API (3–5 days)** and **USDT→USDC SDK (1–2 weeks)** as the fastest path to a shippable slice. AGENTS.md Phase 0–1 and the whitepaper Phase 0 agree: off-chain quoting + a funded USDC float beats shipping unaudited Solidity first.

**v0 ships:**

| Slice | Why |
|-------|-----|
| Token registry (Base USDC/USDT/WETH/cbBTC/ETH) | P0 in the PRD |
| x402 challenge parser (v2 schema) | Every flow starts here |
| DEX quote engine (1inch + 0x, fee baked in, 30s TTL) | Quote API product + SDK backbone |
| Hono REST: health, tokens, quote, pay (stub/float), receipt | Public API |
| `@anyx/sdk` `UPA.fetch()` / `quote()` / `pay()` | Drop-in developer surface |
| Config schema + `/setup` wizard + `check-config` | Humans can connect keys without stalling agents |
| MAS orchestrator (plan → implement → test → bugfix → deploy/config) | This repo's operating system |
| CI lint/test + gated deploy dry-run | Nothing ships without tests |

**v0 explicitly stubs / later:**

- On-chain `AnyXRouter.sol` swap-and-pay (Phase 2 / week 4–6)
- Circle CCTP + ReservePool (Phase 2)
- Lightning invoices (Phase 3)
- Stripe Pro billing (Phase 6)
- Full LangChain/MCP/AgentKit publish (Phase 7) — packages exist as stubs
- Next.js analytics dashboard (Phase 5) — v0 uses a static developer portal
- Marketing automation (docs only; no product surface)

---

## 3. Architecture (summary)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams.

```
Payer (agent / app / wallet)
        │  fetch()
        ▼
   @anyx/sdk  UPA  ──►  AnyX API  /v1/quote  /v1/pay
                              │
                    ┌─────────┼──────────┐
                    ▼         ▼          ▼
               x402 parse   DEX quote   EIP-3009 + facilitator
                    │         │          │
                    └─────────┴──────────┘
                              ▼
                    USDC on Base to payTo
```

**Locked stack (from AGENTS.md):** TypeScript, Hono, viem 2.x, Zod, Vitest, Drizzle schema (Postgres when `DATABASE_URL` is set; in-memory otherwise), Redis optional for quote cache, Docker + GitHub Actions. Bun/Turborepo are the intended runtime; this scaffold also runs on Node 22 + npm so CI works without Bun.

---

## 4. Phases

Aligned with whitepaper + AGENTS.md + PRD milestones. Orchestrator `goal` names match phase ids.

### Phase 0 — Foundation (this PR)

- Monorepo packages: `config`, `core`, `sdk`, `db`, `integrations/*`, `contracts` stubs
- Apps: `api` (Hono), `dashboard` (setup + portal)
- Agents: orchestrator + 11 specialists
- Docker Compose: Postgres 16 + Redis 7
- Env/YAML config with validation

**Exit:** `npm test` green, `npm run check-config` explains missing secrets, `npm run agents:run` completes a verify loop.

### Phase 1 — Core engine (MVP)

Live Quote + Pay on **Base** for USDT and ETH using a pre-funded USDC float (no router contract). Facilitator verify/settle. Receipts persisted.

**Exit:** P0 user stories US-001 and US-002 (Base path) against a real x402 endpoint in stub-then-live mode.

### Phase 2 — Smart contracts

`AnyXRouter.sol`, Permit2, Foundry fork tests, Base Sepolia then mainnet (post-audit).

### Phase 3 — Cross-chain

CCTP v2, Stargate fallback, Solana Jupiter path, ReservePool float.

### Phase 4 — Lightning

LND, BOLT-11 invoices, cbBTC replenishment. Highest spread, highest compliance questions (see risks).

### Phase 5 — Developer experience

Fumadocs/Next.js docs site, OpenAPI already drafted, llms.txt published at a public URL.

### Phase 6 — Monetization infra

Hashed API keys, rate limits, Stripe $49 Pro, partner `X-Partner-ID` 20% rev share.

### Phase 7 — AI integrations

Publish `@anyx/langchain`, `@anyx/mcp-server`, `@anyx/agentkit`. Highest GTM leverage per market research — **build the plugin first, then announce**.

---

## 5. Domain agents (who does what)

Full roster, prompts, and handoff schema: [AGENTS.md](./AGENTS.md) (MAS section) and `agents/*/SYSTEM.md`.

| Agent | Phase 0 job |
|-------|-------------|
| Orchestrator | Run the loop; never block on missing keys |
| Product | Keep v0 = quote + USDT/ETH SDK; reject out-of-scope |
| x402 | Challenge fixtures, parser, facilitator failover |
| Backend | Hono routes + in-memory store |
| Frontend | `/setup` config wizard |
| AI integrations | Tool stubs that wrap UPA |
| Security | Secret hygiene, signer gated behind config |
| QA | Vitest; file bugs on failure |
| Bug reporter / fixer | Structured JSON → patch → retest |
| DevOps | CI + deploy dry-run |
| Config broker | Plain-language missing env/YAML fields |

---

## 6. Config surface (human-in-the-loop)

Anything that needs a key, wallet, RPC, OAuth, or payment processor **must** go through:

1. `.env.example` (commented)
2. `config/user.config.example.yaml` (non-engineer form)
3. `packages/config` Zod schema
4. `npm run check-config` (plain English)
5. Browser wizard at `http://localhost:3000/setup`
6. Orchestrator **ConfigRequest** files in `.anyx/config-requests/`

**Required for live pay:** Base RPC, hot-signer `PRIVATE_KEY` (or MPC later), facilitator URL, USDC float in the signer wallet.  
**Required for live quotes:** at least one of 1inch or 0x API keys (otherwise quote engine uses a clearly labeled stub).  
**Optional:** Redis, Postgres, Stripe, LND, OpenAI/Anthropic (MAS LLM assist), CoinGecko.

Never commit `.env.local` or real keys.

---

## 7. Risks and decisions already made

| Risk | Decision |
|------|----------|
| Unaudited router | v0 uses float + off-chain quote; contracts are stubs |
| DEX API outage | 1inch and 0x in parallel; stub mode if both missing |
| Facilitator 5xx | Primary CDP + fallback URL, 2s health timeout |
| Hot signer compromise | Time-boxed EIP-3009 (5 min); v0 local key; production MPC |
| Slippage / user loss | `minAmountOut` = required USDC; revert; no partial pay |
| Lightning custody / MSB | Phase 4 open question — do not ship LN in v0 |
| x402 adds native multi-token | Position AnyX as reference adapter; keep protocol-compatible |
| Bun not in every CI image | Node 22 + npm workspaces; Bun still documented as preferred |

---

## 8. Acceptance for this repository slice

- [x] Source documents copied to `docs/` with clean names
- [x] PLAN + ARCHITECTURE + extended AGENTS roster
- [x] Runnable orchestrator with bug/config/deploy loop
- [x] Easy API/payment configuration
- [x] Product skeleton matching PRD (adapter, quote, pay, tokens, receipts)
- [x] Tests that pass on the scaffold
- [x] CI lint/test + gated deploy workflow
- [x] Root README: product, MAS, config, test, deploy
