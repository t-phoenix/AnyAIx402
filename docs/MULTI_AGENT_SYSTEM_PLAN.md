# AnyAIx402 (AnyX) — Multi-Agent Build & Operations Plan

> Status: v1.0 — Draft for review
> Scope: How a team of specialized AI agents (Cursor Cloud Agents / background subagents),
> coordinated by a single Orchestrator, builds, tests, fixes, and deploys the AnyX
> Universal x402 Multi-Token Payment Adapter — with a clear, minimal-friction path for the
> human owner to supply the handful of secrets/credentials that *must* be supplied by a human
> (API keys, wallet keys, payment processor keys).

This document is the source of truth for **how the software gets built**, complementing
`docs/AGENTS.md` (source of truth for **what** gets built — the product roadmap, tech stack,
and per-task specs) and the supporting research/PRD/whitepaper docs also in this folder.

---

## 1. Why a multi-agent system

AnyX spans seven largely independent technical domains — DEX/swap routing, EIP-3009/x402
protocol logic, Solidity smart contracts, a REST API + DB, a TypeScript SDK, cross-chain
bridging, Lightning/BTC, AI-agent framework integrations, developer docs, and billing — plus
the cross-cutting concerns of CI/CD, QA, security, and release management. Each domain has its
own idioms, failure modes, and review criteria. Rather than one generalist agent
context-switching across all of them (slow, error-prone, hard to review), we run a **fleet of
domain-specialized agents**, each with a narrow, well-defined mandate, coordinated by an
**Orchestrator** that owns sequencing, review, merge, CI health, and deployment.

This mirrors how a real engineering org would staff this project — protocol engineer,
Solidity/security engineer, backend engineer, SDK/DX engineer, infra/SRE, QA — except every
"engineer" is a Cursor agent invocation scoped to one PR-sized unit of work at a time.

---

## 2. Agent roster (domains)

| # | Agent | Mandate | Primary inputs | Primary outputs |
|---|-------|---------|-----------------|------------------|
| 0 | **Orchestrator** | Owns the backlog, sequences phases, delegates to domain agents, reviews diffs, merges, watches CI, dispatches bug-fix agents, triggers deploys. Never writes product code directly. | `docs/AGENTS.md` roadmap, CI/PR events, this plan | Task assignments, merged PRs, release decisions |
| 1 | **Foundation/DevOps Agent** | Turborepo/Bun monorepo scaffold, Docker Compose, env/config plumbing, GitHub Actions pipelines, secrets scaffolding | `docs/AGENTS.md` Phase 0 | `turbo.json`, `package.json`, `docker-compose*.yml`, `.github/workflows/*`, `.env.example` |
| 2 | **Core Protocol Engine Agent** | `packages/core`: token registry, x402 challenge parsing, EIP-3009 authorization builder, facilitator client | Phase 1 tasks 1.1–1.5 | `packages/core/src/*.ts` + unit tests |
| 3 | **DEX/Quote Agent** | 1inch/0x aggregation, quote caching, fee math, slippage rules | Phase 1 task 1.2, PRD FR-2 | `packages/core/src/quote.ts` + tests |
| 4 | **API/Backend Agent** | Hono API server, routes, middleware, Drizzle schema/migrations, Redis | Phase 0 task 0.2, Phase 1 task 1.6 | `apps/api/*`, `packages/db/*` |
| 5 | **SDK Agent** | `@anyx/sdk` — `UPA` class, `fetch()`/`quote()`/`pay()` wrapper, typed events | Phase 1 task 1.7 | `packages/sdk/*` |
| 6 | **Smart Contract Agent** | `AnyXRouter.sol`, `SwapExecutor.sol`, `FeeCollector.sol`, `ReservePool.sol`, Foundry tests, deploy scripts | Phase 2 | `packages/contracts/*` |
| 7 | **Cross-Chain/Bridge Agent** | Circle CCTP, Stargate, Solana/Jupiter, float-pool logic | Phase 3 | `packages/core/src/bridge/*` |
| 8 | **Lightning/BTC Agent** | LND gRPC integration, invoice lifecycle, BTC/USD rate feed | Phase 4 | `apps/lightning/*` |
| 9 | **AI-Agent Integrations Agent** | LangChain tool, AgentKit action, MCP server, CrewAI/AutoGen/ElizaOS adapters | Phase 7 | `packages/integrations/*` |
| 10 | **Dashboard/Docs Agent** | Next.js developer portal, Fumadocs site, OpenAPI spec, `llms.txt`, Swagger UI | Phase 5 | `apps/dashboard/*`, `apps/docs/*`, `docs/openapi.yaml` |
| 11 | **Billing/Monetization Agent** | API key issuance, usage metering, rate-limit tiers, Stripe checkout/webhooks, partner rev-share | Phase 6 | `apps/api/src/lib/stripe.ts`, `apps/api/src/routes/portal.ts` |
| 12 | **QA / Bug-Fix Agent** | Writes/maintains tests, triages CI failures, reproduces bugs, opens targeted fix PRs | CI logs, issues | Test files, fix PRs |
| 13 | **Security/Audit Agent** | Static analysis (Slither/Foundry invariants), dependency audit, threat-model review against Section 6 of the whitepaper | Contracts, API auth paths | Audit checklist, findings issues |
| 14 | **Release/Deploy Agent** | Fly.io deploy, DB migrations, npm publish, contract deploy to testnet/mainnet (human-gated), health checks, rollbacks | Merged `main`, tags | Deployed environments, release notes |

Each agent is launched as a Cursor subagent (`Task` tool) with a tightly scoped prompt: the
relevant section(s) of `docs/AGENTS.md`, the acceptance criteria, and instructions to write
tests alongside code and to open/update a single PR for its slice of work. Agents 2–11 are
"builder" agents; 12–14 are "quality gate" agents that run continuously across every builder
agent's output.

---

## 3. Orchestrator responsibilities (this agent, every session)

1. **Phase sequencing** — Work through `docs/AGENTS.md` phases in order (0 → 1 → 2 → …),
   but allow independent domains within a phase to run in parallel once their shared
   dependency (e.g. Phase 0 monorepo scaffold) is merged.
2. **Task decomposition** — Break each phase into PR-sized units matching the roster above;
   avoid handing one agent >1 package/app at a time.
3. **Delegation** — Launch domain agents via the `Task` tool with `run_in_background: true`,
   each on its own git branch (`cursor/<domain>-<slice>-fcaa`), each opening its own PR against
   the integration branch.
4. **Review & merge** — Read every diff before merging; run `bun run lint && bun run typecheck
   && bun test` (and `forge test` for contracts) locally before merge, not just trust CI.
5. **CI monitoring without polling** — Use the `cursor-subscriptions` MCP
   (`subscribe_github_ci`, `subscribe_github_pr`) to be notified the moment a check fails or a
   PR receives review comments, instead of polling `gh run list` in a loop.
6. **Bug dispatch loop** — On a red CI check or a reported bug: open/label a GitHub issue with
   the failing logs, then launch the QA/Bug-Fix Agent scoped to *only* that failure with the
   logs attached, until CI is green again. See §5.
7. **Release gating** — Testnet deploys are automatic on merge to `main`; **mainnet contract
   deploys, Stripe live-mode switch, and any step that moves real funds are always
   human-approved** (Orchestrator prepares the change, a human runs
   `ManagePullRequest`/dashboard approval or types "deploy mainnet" to confirm).
8. **Config custodian** — Maintains `.env.example` and `docs/CONFIGURATION.md` as the single
   source of truth for which secrets exist, whether they're required for the current phase,
   and where to obtain them (see §6).

---

## 4. Build pipeline (CI/CD) — automated testing & deploying

`.github/workflows/`:

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | every PR | Biome lint → `tsc --noEmit` → `bun test` (Vitest, per-package) → `forge test -vvv` (fork tests, only if `packages/contracts` changed) → `turbo build` |
| `deploy-api.yml` | push to `main` (paths: `apps/api/**`, `packages/**`) | Build & push Docker image → `flyctl deploy --app anyx-api` → run Drizzle migrations → `curl /health` smoke check → auto-rollback (`flyctl releases rollback`) on non-200 |
| `deploy-dashboard.yml` | push to `main` (paths: `apps/dashboard/**`, `apps/docs/**`) | Build → deploy to Fly.io / Vercel target |
| `publish-sdk.yml` | tag push `v*` under `packages/sdk` | Build → `bun publish` → GitHub Release with auto-changelog |
| `contracts-testnet.yml` | push to `main` (paths: `packages/contracts/**`) | `forge script Deploy.s.sol --rpc-url $RPC_URL_BASE_SEPOLIA --broadcast --verify` (testnet only, fully automatic) |
| `contracts-mainnet.yml` | manual `workflow_dispatch` only | Same script against Base mainnet — **requires a human to click "Run workflow"**, never runs automatically |
| `bug-report.yml` | any workflow above fails | Opens/updates a GitHub issue titled `CI failure: <workflow> on <branch>` with the job logs and a `needs-agent-fix` label |

Required secrets (all configured once in **GitHub repo settings → Actions secrets**, or via
**Cursor Dashboard → Cloud Agents → Secrets** for agent runs): `FLY_API_TOKEN`, `NPM_TOKEN`,
`BASESCAN_API_KEY`, `DATABASE_URL`, plus whatever the deploy target needs. None of these block
day-to-day agent development — only `deploy-*` and `publish-*` workflows need them.

### 5. Automated bug reporting → fixing loop

```
PR opened/updated
      │
      ▼
 ci.yml runs ──► ✅ pass ──► Orchestrator reviews → merges
      │
      ▼ ❌ fail
 bug-report.yml opens/updates a GitHub issue
 (label: needs-agent-fix, body = failing step + last 200 log lines)
      │
      ▼
 Orchestrator (subscribed via cursor-subscriptions.subscribe_github_ci,
 so this happens the moment CI goes red — no polling) launches the
 QA/Bug-Fix Agent with: the issue, the diff under test, and the logs
      │
      ▼
 QA/Bug-Fix Agent reproduces locally, patches, adds/updates a regression
 test, pushes a fix commit to the same PR branch
      │
      ▼
 ci.yml re-runs automatically on push → loop repeats until green
      │
      ▼
 Orchestrator merges; issue auto-closes (fix commit references "Fixes #N")
```

This loop runs unattended for **build-time bugs** (lint/type/unit/contract-test failures). Two
categories are intentionally **not** fully automatic, per the risk section of the PRD/whitepaper:

- **Production incidents that could move funds** (a bad swap, a stuck reserve-pool
  replenishment, a facilitator settlement mismatch) — the Orchestrator drafts the fix and a
  rollback plan, but a human must approve before it's applied to a live environment.
- **Security-relevant findings** from the Security/Audit Agent — these become issues with a
  `security` label and always wait for human sign-off, never auto-merged.

For runtime/production bug reports (not just CI), the same loop is triggered by:
- Fly.io health-check failures (deploy workflow auto-rollback + issue creation), and
- A lightweight `/v1/admin/report-bug` internal endpoint (Billing/Monetization Agent builds
  this in Phase 6) that lets the dashboard's "Report an issue" button open a GitHub issue with
  the request ID, so real user-reported bugs enter the same automated triage queue.

---

## 6. Configuration & secrets — what's automatic vs. what needs you

Everything the agents can generate, install, or configure themselves, they will. The table
below is the **complete list of things that require a human** (an account, a KYC'd API key, a
funded wallet, or a live payment processor) versus everything else, which is zero-touch.

### 6a. Needs a human, one time (see `docs/CONFIGURATION.md` for step-by-step)

| Variable | Used by | Where to get it | Required for |
|---|---|---|---|
| `PRIVATE_KEY` | Core/hot signer | Generate a fresh EVM wallet (never reuse a personal key); fund with a small amount of ETH+USDC on Base for Phase 1 float | Any real on-chain payment (testnet first) |
| `RPC_URL_BASE`, `RPC_URL_ETHEREUM`, `RPC_URL_SOLANA` | viem/Solana clients | Alchemy/Infura/QuickNode free tier, or public RPCs for dev | Any chain interaction |
| `ONEINCH_API_KEY` | DEX/Quote Agent | https://portal.1inch.dev | Real swap quotes (mocked in tests without it) |
| `ZEROX_API_KEY` | DEX/Quote Agent | https://dashboard.0x.org | Real swap quotes (fallback) |
| `BASESCAN_API_KEY` | Contract deploy | https://basescan.org/apis | Contract verification |
| `FACILITATOR_URL` / `FACILITATOR_FALLBACK_URL` | Facilitator client | Coinbase CDP (https://portal.cdp.coinbase.com) + a self-hosted fallback | Settling real x402 payments |
| `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Billing Agent | https://dashboard.stripe.com | Pro-tier billing |
| `CCTP_ATTESTER_URL` (default provided) / any Circle API key if required | Bridge Agent | https://developers.circle.com | Cross-chain (Phase 3) |
| `LND_TLS_CERT_PATH`, `LND_MACAROON_PATH` (or LNC pairing phrase) | Lightning Agent | Your own LND node or a hosted LN provider (Voltage, etc.) | Lightning/BTC (Phase 4) |
| `FLY_API_TOKEN` | Release Agent | `fly auth token` after `flyctl auth login` | Deploying `apps/api` |
| `NPM_TOKEN` | Release Agent | npmjs.com access token | Publishing `@anyx/sdk` |
| Base mainnet float capital (USDC) | Reserve pool | Your treasury | Any Phase 1+ *mainnet* payment (not needed for testnet/dev) |

**How to supply these:**
- For local dev: copy `.env.example` → `.env.local` and fill in values (never committed —
  it's git-ignored).
- For Cloud Agent runs: add them once in **Cursor Dashboard → Cloud Agents → Secrets** (scoped
  to this repo); they're injected automatically into every future agent VM, so you only do this
  once, not per task.
- Everything is optional-by-default in code: if a key is missing, that feature's tests run
  against mocked responses and the corresponding API route returns a clear
  `CONFIG_MISSING: <VAR_NAME>` error instead of failing silently — the agents will never block
  on a missing key, they'll stub around it and flag it.

### 6b. Fully automatic — no human action needed

Database/Redis provisioning (Docker Compose), migrations, lint/type/test configuration,
Turborepo caching, nonce generation, quote caching, rate-limiting, API-key hashing, CI
pipelines, testnet contract deploys (once RPC/key above exist), documentation generation,
OpenAPI spec, `llms.txt`, changelogs, and the entire QA/bug-fix loop in §5.

### 6c. A single command to check your config

`scripts/setup.sh` (Foundation/DevOps Agent, Phase 0) prints a checklist on every run:
which required-for-this-phase variables are set, which are missing, and a direct link to where
to get each missing one — so at any point you can run one command and see exactly what's left
for you to plug in.

---

## 7. Delivery phases (mapped from `docs/AGENTS.md`) and agent activation order

| Phase | Scope | Agents active | Gate to proceed |
|---|---|---|---|
| 0 — Foundation | Monorepo, DB schema, Docker, CI/CD skeleton, config docs | Foundation/DevOps | `bun run build` + `bun test` green |
| 1 — Core Engine (MVP, off-chain float) | Token registry, quote engine, x402 parser, EIP-3009, facilitator client, API routes, SDK, unit tests | Core Protocol, DEX/Quote, API/Backend, SDK, QA | ≥80% unit coverage; first testnet payment succeeds |
| 2 — Smart Contracts | `AnyXRouter.sol` + tests + testnet deploy | Smart Contract, Security/Audit, QA | Foundry tests pass; testnet deploy verified; no unresolved high/critical findings |
| 3 — Cross-Chain | CCTP, Stargate, Solana, reserve pool | Cross-Chain/Bridge, QA | Testnet bridge round-trip < target latency |
| 4 — Lightning | LND integration, invoice lifecycle | Lightning/BTC, QA | Testnet/regtest invoice → payment flow passes |
| 5 — Developer Experience | Docs site, OpenAPI, `llms.txt`, dashboard | Dashboard/Docs | Docs build + deploy succeed |
| 6 — Monetization | API keys, Stripe, usage metering | Billing/Monetization, Security/Audit | Stripe test-mode checkout end-to-end passes |
| 7 — AI Agent Integrations | LangChain/AgentKit/MCP/CrewAI/AutoGen/ElizaOS packages | AI-Agent Integrations, QA | Each package has a working example against a live/test x402 endpoint |
| Ongoing | CI health, security review, releases | QA, Security/Audit, Release/Deploy | Continuous |

The Orchestrator will not start Phase *N+1* domain agents on packages that depend on Phase *N*
output until Phase *N*'s gate is green — but independent Phase *N* domains (e.g., Dashboard/Docs
vs. Billing in the same phase) run concurrently.

---

## 8. What happens next

Immediately following this plan, the Orchestrator will:
1. Scaffold the Phase 0 monorepo structure, CI/CD workflow files, `.env.example`, and
   `docs/CONFIGURATION.md` (Foundation/DevOps Agent).
2. Kick off Phase 1 core-engine + API + SDK implementation with mocked external calls where
   keys aren't yet configured, full unit tests, and a working `/health` + `/v1/quote` +
   `/v1/tokens` slice runnable via `docker-compose up`.
3. Report back with the PR(s) opened, what's mocked vs. live, and the exact `.env.local`
   entries you'd need to add to see a real (testnet) end-to-end payment.

No further action is required from you to see Phase 0/1 come together. You'll only be asked to
act when a step genuinely requires a credential only you can create (see §6a), or before any
mainnet/production-fund-moving deploy.
