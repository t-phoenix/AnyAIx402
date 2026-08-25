# AnyAIx402 Multi-Agent System Plan

**Product:** AnyX (AnyAIx402 / x402 Universal Adapter)  
**Branch foundation:** Multi-agent orchestration for plan → implement → test → bug-report → fix → retest → deploy  
**Sources of truth:** Documents in [`docs/`](./README.md) — do not invent requirements that contradict them.

---

## 1. Product summary

### What it is

AnyX is a **universal payment adapter for the x402 protocol**. It lets any token holder (ETH, USDT, WBTC, cbBTC, SOL, BTC via Lightning, any ERC-20) pay x402-gated APIs without manually acquiring USDC on Base.

### How it works

1. Intercept HTTP **402 Payment Required** from any x402-compatible API  
2. Parse required USDC amount, `payTo`, and network from the challenge  
3. Quote/swap payer token → USDC via DEX aggregators (1inch, 0x) or bridges (CCTP)  
4. Sign **EIP-3009** `transferWithAuthorization`  
5. Submit to x402 facilitator (Coinbase CDP primary; self-hosted failover)  
6. Return 200 OK + payment receipt  

API providers receive standard USDC on Base — **unchanged**. No x402 protocol changes.

### Locked tech stack (from docs/agents.md)

| Layer | Technology |
|-------|------------|
| Runtime | Bun 1.x |
| API | Hono |
| Contracts | Solidity 0.8.24 + Foundry |
| SDK | TypeScript + viem 2.x |
| ORM | Drizzle + PostgreSQL |
| Cache | Redis (ioredis) |
| Monorepo | Turborepo + Bun workspaces |
| Testing | Vitest + Foundry |
| DEX | 1inch Fusion + 0x Swap |
| Bridge | Circle CCTP v2 (+ Stargate fallback) |
| Deploy | Docker + Fly.io |
| CI/CD | GitHub Actions |

### Revenue model

- Primary: **0.05–0.75% swap spread** on non-USDC payments  
- Secondary: Pro SaaS ($49/mo), partner rev-share (20% of spread)  
- Day-1 path: Quote API + USDT→USDC SDK **without smart contracts** (pre-funded USDC float)

### Non-goals (v1)

- Changing x402 server protocol / `accepts` structure  
- Fiat inputs  
- Custodial long-term wallet storage of user funds  
- NFT payment inputs  

---

## 2. Agent roster

Agents are derived from the uploaded docs (engineering roadmap, PRD, whitepaper, AI integrations, GTM, marketing, market research, security sections). Each agent owns a domain; the **Orchestrator** alone advances pipeline state.

### 2.1 Orchestrator

| Field | Value |
|-------|-------|
| **Name** | `orchestrator` |
| **Domain** | End-to-end pipeline control |
| **Responsibilities** | Prioritize work from roadmap/PRD; assign tasks; enforce acceptance criteria; run plan→implement→test→bug-report→fix→retest→deploy; gate deploys; escalate human-in-the-loop for secrets |
| **Inputs** | `docs/MULTI_AGENT_PLAN.md`, phase backlog, CI status, bug reports |
| **Outputs** | Task briefs, status artifacts under `artifacts/`, deploy decisions |
| **Tools** | Git, GH Actions status, file system, specialist handoffs, `scripts/orchestrate.sh` |

### 2.2 Domain specialists

| ID | Name | Domain | Responsibilities | Key inputs | Key outputs | Primary tools |
|----|------|--------|------------------|------------|-------------|---------------|
| `x402-protocol` | x402 Protocol Agent | x402 v2, facilitators | Challenge parse, PAYMENT-REQUIRED header, EIP-3009 payload shape, facilitator verify/settle/failover | Whitepaper §3, PRD FR-3, core `x402.ts` / `facilitator.ts` specs | Protocol client code, schema zod types, failover tests | HTTP, zod, viem |
| `payments-dex` | Payments / DEX Agent | Quotes, swaps, fees | Token registry, 1inch/0x aggregation, fee BPS, quote cache, slippage | AGENTS Phase 1.1–1.2, low-hanging fruit #1–3 | `quote.ts`, `swap.ts`, `tokens.ts`, fee math tests | 1inch API, 0x API, Redis |
| `contracts` | Smart Contracts Agent | Solidity / Foundry | AnyXRouter, SwapExecutor, FeeCollector, ReservePool, deploy scripts, fork tests | Whitepaper §5e, AGENTS Phase 2 | `.sol` contracts, Foundry tests, deployment JSON | Foundry, OpenZeppelin |
| `bridge-cctp` | Circle / Bridge Agent | CCTP, Stargate, float | Cross-chain USDC burn/mint, Iris attestation poll, float pool replenish | Whitepaper §5d, AGENTS Phase 3 | `bridge/cctp.ts`, ReservePool integration | Circle Iris API, viem |
| `lightning` | Lightning / BTC Agent | LN → x402 | LND invoices, sats conversion, reserve drawdown, status API | PRD US-003, AGENTS Phase 4, low-hanging fruit #4 | Lightning service, `/v1/lightning/*` | LND gRPC, CoinGecko |
| `wallet` | Wallet / Signing Agent | Wallets, MPC, Permit2 | viem WalletClient flows, Permit2, hot-signer (Turnkey/Lit later), Phantom/CDP wallet notes | PRD open Qs, AI integrations AgentKit | Wallet helpers, signing abstraction | viem, Permit2 |
| `api-backend` | API Backend Agent | Hono + Bun API | Routes quote/pay/receipt/tokens, middleware, rate limits, OpenAPI serve | AGENTS Task 1.6, llms.txt | `apps/api`, OpenAPI | Hono, Bun, Redis, Drizzle |
| `sdk-dx` | SDK / DX Agent | `@anyx/sdk` | UPA class, `upa.fetch()`, events, npm package README | AGENTS Task 1.7, llms.txt | `packages/sdk` | TypeScript, viem |
| `db` | Database Agent | Schema & migrations | quotes, payments, api_keys, lightning_invoices, partner_credits | AGENTS Task 0.2 | `packages/db` | Drizzle Kit |
| `ai-integrations` | AI Integrations Agent | LLM frameworks | LangChain tool, AgentKit action, MCP server, OpenAI/CrewAI/Eliza/AutoGen | anyx-ai-integrations.md, AGENTS Phase 7 | `packages/integrations/*` | LangChain, MCP SDK |
| `product` | Product / PRD Agent | Requirements fidelity | Map P0/P1 stories to tasks; acceptance criteria; reject scope creep | PRD, low-hanging fruit priority | Backlog YAML, AC checklists | Docs only + review |
| `security` | Security Agent | Threat model & secrets | Slippage revert, hot-signer limits, nonce, oracle checks, secrets hygiene | Whitepaper §6, PRD G6 | Security review notes, threat checklist | Static analysis, code review |
| `qa` | QA / Test Agent | Tests & bugs | Vitest/Foundry coverage, bug reports, retest gates, launch checklist | AGENTS Phase 1.8, PRD §6 | Test suites, `artifacts/bugs/*.md` | Vitest, forge, curl |
| `devops` | DevOps / Deploy Agent | CI/CD & infra | Docker Compose, GHA workflows, Fly.io deploy, health gates | AGENTS CI section | Workflows, Dockerfiles, deploy scripts | Docker, flyctl, GHA |
| `monetization` | GTM / Monetization Agent | Billing & pricing | API keys, Stripe Pro, partner rev-share, usage tracking | monetization-gtm.md, AGENTS Phase 6 | Billing routes, portal APIs | Stripe SDK |
| `marketing` | Marketing Agent | Growth content | Brand voice, launch posts, integration outreach drafts | marketing-social.md | Content drafts under `artifacts/marketing/` | Docs (no live posting unless asked) |
| `research` | Market Research Agent | Competitive intel | Watch competitors, size assumptions, positioning refresh | market-research.md | Research notes | Docs / public web |

Spec files: [`agents/`](../agents/) (canonical) and [`.cursor/agents/`](../.cursor/agents/) (Cursor mirrors).

---

## 3. Orchestrator workflow (state machine)

```
┌─────────┐    ┌────────────┐    ┌──────┐    ┌────────────┐
│  PLAN   │───▶│ IMPLEMENT  │───▶│ TEST │───▶│ BUG_REPORT │
└─────────┘    └────────────┘    └──────┘    └─────┬──────┘
     ▲                                              │
     │         ┌─────────┐    ┌────────┐            │
     │         │ DEPLOY  │◀───│ RETEST │◀─── FIX ◀──┘
     │         └────┬────┘    └────────┘     ▲
     │              │                        │
     │              ▼                        │
     │         ┌─────────┐              (bugs open)
     └─────────│  DONE   │◀──── all AC pass, no P0/P1 bugs
               └─────────┘
```

### States

| State | Owner | Exit criteria |
|-------|-------|---------------|
| `PLAN` | Orchestrator + Product | Task brief written; AC listed; secrets needed flagged |
| `IMPLEMENT` | Domain specialist(s) | Code + unit tests landed on feature branch |
| `TEST` | QA (+ DevOps for CI) | CI green or failure captured |
| `BUG_REPORT` | QA | Structured bug file if failures; else skip to RETEST/DEPLOY |
| `FIX` | Owning specialist | Patch + regression test |
| `RETEST` | QA | Previously failing cases pass |
| `DEPLOY` | DevOps | Deploy gates pass (see §4); health check OK |
| `DONE` | Orchestrator | Phase AC satisfied; artifacts archived |

### Pipeline rules

1. **Never skip TEST** after IMPLEMENT.  
2. **Never DEPLOY** with open P0 bugs or failing CI on the deploy branch.  
3. **Human gate** before mainnet contract deploy, before committing real secrets, and before production Fly.io promote.  
4. Prefer **existing monorepo layout** from `agents.md` once scaffolding exists.  
5. Parallelize only independent specialists (e.g. marketing drafts while contracts compile); serialize shared core (`@anyx/core`) changes.

---

## 4. Automation

### 4.1 CI test (every PR)

From roadmap CI.1:

- Biome lint  
- `tsc --noEmit`  
- `bun test` (Vitest)  
- `forge test` (when contracts present)  
- `bun run build`  

Workflow scaffold: `.github/workflows/ci.yml`

### 4.2 Bug triage loop

1. QA writes `artifacts/bugs/BUG-YYYYMMDD-NNN.md` with: severity, repro, expected/actual, owner agent, related commit  
2. Orchestrator assigns `FIX` to owning specialist  
3. Fix must include regression test when feasible  
4. QA retests; closes bug file with `status: closed`  

### 4.3 Auto-fix loop

`scripts/orchestrate.sh` and `AGENTS.md` instruct cloud agents to:

```
while CI_FAIL or OPEN_P0_BUGS:
  FIX → RETEST
  max_iterations = 5 (then escalate to human)
```

### 4.4 Deploy gates

| Gate | Requirement |
|------|-------------|
| G1 | CI green on commit |
| G2 | No open P0 bugs in `artifacts/bugs/` |
| G3 | `.env` / secrets present in runtime (not in git) — human confirmed |
| G4 | Health: `GET /health` → 200 |
| G5 | Contracts: audit/review note attached before **mainnet** (testnet allowed earlier) |
| G6 | Fly.io / Docker image tagged; migrations applied |

Deploy workflow scaffold: `.github/workflows/deploy-api.yml` (manual/`workflow_dispatch` until secrets filled).

---

## 5. Manual config checklist (human-in-the-loop)

Fill **one surface**: copy [`.env.example`](../.env.example) → `.env.local` and optionally map values in [`config/secrets.example.yaml`](../config/secrets.example.yaml). **Never commit real secrets.**

| Category | Variables / items | Needed by phase |
|----------|-------------------|-----------------|
| Database | `DATABASE_URL` | Phase 0 |
| Redis | `REDIS_URL` | Phase 0 |
| RPC | `RPC_URL_BASE`, `RPC_URL_ETHEREUM`, `RPC_URL_SOLANA`, `RPC_URL_BASE_SEPOLIA` | Phase 1+ |
| Hot signer | `PRIVATE_KEY` (dev only) → later Turnkey/Lit MPC | Phase 1 |
| DEX | `ONEINCH_API_KEY`, `ZEROX_API_KEY` | Phase 1 |
| Circle CCTP | `CCTP_ATTESTER_URL` (Iris) | Phase 3 |
| x402 facilitator | `FACILITATOR_URL`, `FACILITATOR_FALLBACK_URL` | Phase 1 |
| Fees | `FEE_BPS`, `MIN_FEE_USDC` | Phase 1 |
| API | `PORT`, `API_SECRET`, later `ANYX_API_KEY` issuance | Phase 1 |
| Contracts | `USDC_BASE`, `ANYX_ROUTER`, `FEE_COLLECTOR`, `BASESCAN_API_KEY` | Phase 2 |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | Phase 6 |
| Lightning | `LND_TLS_CERT_PATH`, `LND_MACAROON_PATH`, or LNC creds | Phase 4 |
| Deploy | `FLY_API_TOKEN`, `NPM_TOKEN` | Deploy / publish |
| CDP / AgentKit (optional) | `CDP_API_KEY_NAME`, `CDP_API_KEY_PRIVATE_KEY` | AI integrations |
| Wallet (optional) | Phantom / WalletConnect project IDs if widget built | Widget play |

Orchestrator must **stop and request human fill** when a task needs any of the above and they are missing.

---

## 6. Phased build roadmap (technical phases)

Calendar estimates from source docs are **not** used as commitments here — phases are capability gates.

### Phase 0 — Foundation

- Turborepo + Bun workspaces: `@anyx/core`, `@anyx/sdk`, `@anyx/contracts`, `@anyx/db`, `apps/api`, `apps/dashboard`  
- Drizzle schema + Docker Compose (Postgres, Redis)  
- `.env.example`, setup script  

**Exit:** `bun run build` works; compose up healthy.

### Phase 1 — Core engine (MVP)

- Token registry, quote engine, x402 parser, EIP-3009 builder, facilitator client  
- API routes: health, tokens, quote, pay, receipt; lightning stub  
- `@anyx/sdk` with `upa.fetch()`  
- Unit tests >80% on core  
- **MVP shortcut (roadmap note):** pre-funded USDC float; off-chain swap path before contracts  

**Exit:** Live quote + pay against a test x402 endpoint on Base with USDT/ETH; receipts accurate.

### Phase 2 — Smart contracts

- AnyXRouter, FeeCollector, SwapExecutor; Foundry fork tests; Base Sepolia then mainnet (post review)  

**Exit:** On-chain swapAndPay path verified on testnet.

### Phase 3 — Cross-chain

- Circle CCTP, ReservePool float, Stargate fallback, Solana→Base path  

**Exit:** Cross-chain payment with float fronting; replenish async.

### Phase 4 — Lightning

- LND service, invoice/status APIs, BTC rate + fee  

**Exit:** LN invoice → USDC settle → API 200 within PRD latency targets (with float).

### Phase 5 — Developer experience

- Docs site, `llms.txt`, OpenAPI 3.1, Swagger UI  

**Exit:** Public docs + OpenAPI served from API.

### Phase 6 — Monetization infra

- API keys, rate limits, Stripe Pro, partner credits  

**Exit:** Free→Pro upgrade path works with webhook.

### Phase 7 — AI integrations

- LangChain, AgentKit, MCP server, OpenAI/CrewAI stubs  

**Exit:** At least LangChain + MCP proven against a real x402 API.

### Parallel / later plays (from low-hanging fruit)

- ETH browser widget, Express multi-token accept middleware, analytics dashboard, white-label — prioritize after Phase 1 MVP unless Orchestrator pulls Quote API / USDT SDK as Phase 1 itself (recommended day-1 stack).

---

## 7. How agents collaborate

### Handoffs

| From → To | Artifact |
|-----------|----------|
| Product → Orchestrator | Prioritized backlog item + AC |
| Orchestrator → Specialist | Task brief in `artifacts/tasks/TASK-*.md` |
| Specialist → QA | PR / commit SHA + test plan |
| QA → Specialist | Bug file |
| Security → Contracts/API | Review blockers |
| DevOps → Orchestrator | Deploy status + health log |
| Monetization ↔ API | Billing route contracts |
| AI Integrations → SDK | Depends on published UPA API surface |

### Shared artifacts directory

```
artifacts/
  tasks/          # orchestrator briefs
  bugs/           # QA bug reports
  reviews/        # security / product AC checks
  marketing/      # drafts only
  deploys/        # health check logs, release notes
```

### Shared memory conventions

1. **Docs are canonical** — code must match PRD/roadmap; conflicts escalate to Product + Orchestrator.  
2. **Types live in `@anyx/core` / `@anyx/db`** — specialists import, do not duplicate.  
3. **Receipts & quotes** — DB is source of truth for payment history.  
4. **Agent specs** — update `agents/*.md` acceptance criteria when product AC change.  
5. **No silent secret commits** — Security agent rejects any PR with credential patterns.

### Communication protocol (Cursor / cloud)

- One specialist per task brief unless Orchestrator explicitly fans out.  
- Prefer writing status to `artifacts/` over chat-only memory.  
- On blocked secrets: write `artifacts/tasks/BLOCKED-*.md` and stop.

---

## 8. Immediate next actions for implementers

1. Human: copy `.env.example` → `.env.local` and fill Phase 0–1 keys.  
2. Orchestrator: start **Phase 0** Task 0.1 (Turborepo init) per `agents.md`.  
3. Parallel: Product confirms P0 stories US-001/US-002/US-005 as MVP slice.  
4. QA: prepare empty `artifacts/bugs/` and CI workflow.  

---

*This plan synthesizes the uploaded AnyX documents. When sources disagree on naming (`@anyx/sdk` vs `@upa/x402-client`), prefer **AnyX / `@anyx/*`** naming from the build roadmap and llms.txt.*
