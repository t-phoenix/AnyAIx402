# AnyAIx402 — Multi-Agent Build Plan

How AnyX gets built: fifteen specialist agents, a dependency graph of thirty-one
tasks, and an orchestrator that plans, dispatches, verifies, files bugs, fixes
them, and deploys — stopping only where a human genuinely has to intervene.

This document is the plan. The plan is also executable: every agent and task
described here exists as code under `orchestrator/`, and
`./scripts/orchestrate plan` prints the live state of it.

---

## 1. What is being built

**AnyX** is a universal payment adapter for the x402 protocol.

x402 lets a server answer an HTTP request with `402 Payment Required` and a
machine-readable challenge; the payer signs an EIP-3009 authorization and a
facilitator settles it on-chain. It works, it is growing, and it settles
exclusively in USDC on Base.

That last part is the problem. The world's crypto liquidity is in BTC, ETH,
USDT and SOL, not in USDC on Base. An agent holding ETH cannot pay an x402 API
without manually acquiring USDC first. A Bitcoin holder cannot participate at
all.

AnyX sits on the payer's side and closes that gap. It intercepts the 402
challenge, reads the required USDC amount, routes the payer's token through a
DEX aggregator, signs the authorization, and submits it to the facilitator. The
API provider sees an ordinary USDC payment and never learns that anything
happened. The payer denominates their budget in whatever they hold.

**The business model is the spread.** AnyX quotes a slightly worse rate than it
executes, and keeps the difference — 0.05% on stablecoin pairs up to 0.50% on
BTC. No protocol change, no governance, no new token, and the payer still comes
out ahead of using a centralized exchange.

Full background: [`docs/reference/whitepaper.md`](docs/reference/whitepaper.md),
[`docs/reference/prd.md`](docs/reference/prd.md), and
[`docs/reference/agent-build-roadmap.md`](docs/reference/agent-build-roadmap.md).

---

## 2. Why a multi-agent system

The work splits cleanly along domain lines that barely overlap. Writing an
EIP-712 signer has almost nothing in common with tuning a Solidity fee
calculation, which has nothing in common with writing an LND gRPC client. Each
needs different background knowledge and different judgement about what
"correct" means.

Three properties make the split work:

**Disjoint file ownership.** Every agent declares the paths it may touch. The
scheduler refuses to run two agents whose ownership globs intersect, so
concurrent agents cannot collide in a shared working tree. This is enforced in
code, not by convention.

**Machine-checkable acceptance.** A task is not done because an agent says so.
It is done when its acceptance criteria pass — a command exiting zero, a file
existing, a file matching a pattern. Anything a machine cannot check is marked
`manual` and explicitly requires human attestation.

**Bounded autonomy.** The loop fixes what it can and escalates what it cannot,
with a hard attempt limit. It never decides on its own to ship to production,
and it never invents a credential.

---

## 3. The agent roster

Fifteen agents, one per domain. Defined in `orchestrator/agents/`; run
`./scripts/orchestrate agents <id>` to print any of them in full.

| Agent | Domain | Owns | Tasks |
| --- | --- | --- | --- |
| `orchestrator` | Planning, scheduling, cross-agent coordination | `orchestrator/`, `.github/`, `scripts/` | 1 |
| `protocol` | x402 v2 challenges, EIP-3009 authorization, facilitator client | `core/src/x402.ts`, `eip3009.ts`, `facilitator.ts` | 3 |
| `swap-routing` | DEX quote aggregation, fee and spread maths, slippage policy | `core/src/quote.ts`, `swap.ts`, `tokens.ts`, `fees.ts` | 2 |
| `contracts` | Solidity 0.8.24 and Foundry | `packages/contracts/` | 2 |
| `backend` | Hono API server, routes, middleware, rate limiting | `apps/api/` | 3 |
| `sdk` | `@anyx/sdk` — the `UPA` class and `upa.fetch()` drop-in | `packages/sdk/` | 1 |
| `data` | Drizzle schema, migrations, Redis caching | `packages/db/` | 1 |
| `crosschain` | Circle CCTP v2, Stargate fallback, USDC float pool | `core/src/bridge/` | 2 |
| `lightning` | LND service, BOLT-11 invoices, sats/USD conversion | `apps/lightning/` | 1 |
| `security` | Threat model, secret scanning, static analysis, audit prep | `security/` | 2 |
| `qa` | Unit, integration and contract suites; coverage gates | `tests/`, `__tests__/` | 2 |
| `devops` | Docker, CI, Fly.io, migrations, health checks, rollback | compose files, `Dockerfile`, `fly.toml` | 4 |
| `docs` | Quickstart, SDK reference, OpenAPI, `llms.txt` | `apps/docs/`, `docs/` | 3 |
| `integrations` | LangChain, OpenAI functions, MCP server, AgentKit | `packages/integrations/` | 2 |
| `growth` | Go-to-market and monetization execution | `growth/` | 2 |

Each definition carries a mission statement, owned paths, capabilities,
required config keys, required manual gates, allowed commands, a definition of
done, the source documents to read first, and domain-specific rules. All of it
is injected into the dispatch prompt, so an agent is briefed identically whether
a human or the scheduler invokes it.

Adding a sixteenth agent means adding one file to `orchestrator/agents/`.

---

## 4. The build graph

Thirty-one tasks across roadmap phases 0–7 plus cross-cutting CI, security, QA,
growth and launch work. Dependencies are real: they encode what genuinely
cannot start until something else finishes.

```
Phase 0   0.1-monorepo ──┬── 0.2-db-schema ──────────────┐
                         ├── 0.3-docker-compose          │
                         ├── ci.1-github-actions ────────┼───┐
                         └── 1.1-token-registry ──┬──────┤   │
                                                  │      │   │
Phase 1                    1.2-quote-engine ◄─────┴──────┤   │
                           1.3-x402-parser ◄─────────────┘   │
                                  │                          │
                           1.4-eip3009                       │
                                  │                          │
                           1.5-facilitator                   │
                                  │                          │
                    ┌─────────────┴──────────────┐           │
                    │                            │           │
             1.6-api-server ◄── (quote-engine, db-schema)     │
                    │                            │           │
        ┌───────────┼──────────┬─────────┐  sec.1-threat-model
        │           │          │         │       │           │
    1.7-sdk    5.2-llms-txt  5.3-openapi │       │           │
        │           │          │    3.1-cctp     │           │
        │           │          │         │       │           │
        │           │     6.1-api-keys-billing   │           │
        │           │          │         │       │           │
   1.8-unit-tests   │     6.2-stripe     │       │  devops.1-deploy-api ◄┘
        │           │                    │       │
 qa.1-integration   │              3.2-reserve-pool ◄── 2.1-anyx-router
        │           │                    │              (◄── 1.4-eip3009)
        │           │              4.1-lightning              │
   5.1-docs-site    │                                  2.2-deploy-scripts
        │           │                                         │
 7.1-langchain-tool │                                 sec.2-preflight-audit
        │           │
   7.2-agentkit  growth.2-distribution
        │           │
        └───────────┴──────► launch.1-checklist ◄── (everything above)
```

Difficulty is expressed as `small` / `medium` / `large`, never as calendar time.
An autonomous agent's throughput has no relationship to a human work-week, and
the source roadmap's week ranges are not reproducible.

| Phase | Tasks | Delivers |
| --- | --- | --- |
| 0 | 3 | Monorepo, database schema, local service stack |
| 1 | 9 | The core engine: tokens, quotes, x402, EIP-3009, facilitator, API, SDK, tests |
| 2 | 4 | `AnyXRouter` and friends, deploy scripts, threat model, pre-mainnet review |
| 3 | 2 | CCTP bridging and the USDC float pool |
| 4 | 1 | The Lightning gateway |
| 5 | 3 | Docs site, `llms.txt`, OpenAPI spec |
| 6 | 3 | API keys, usage metering, Stripe billing, day-one revenue path |
| 7 | 3 | LangChain, MCP, AgentKit, distribution |
| CI | 2 | Workflows and the deploy pipeline |
| Launch | 1 | Verification of the whole launch checklist |

---

## 5. The automation loop

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                                                                  │
   ▼                                                                  │
PLAN ──► SCHEDULE ──► DISPATCH ──► VERIFY ──┬── pass ──► mark done ───┘
                                            │
                                            └── fail
                                                 │
                                                 ▼
                                        INTAKE (normalize)
                                                 │
                                                 ▼
                                        FINGERPRINT (dedupe)
                                                 │
                                                 ▼
                                        TRIAGE (owner + severity)
                                                 │
                                                 ▼
                            ┌──────────► AUTO-FIX ──► re-verify ──┬── pass ──► resolved
                            │                                     │
                            └────── attempts remaining ◄──────────┘
                                                 │
                                          attempts exhausted
                                                 │
                                                 ▼
                                    ESCALATE (reproduction report)
```

**Plan.** The task graph is validated for cycles and dangling dependencies, then
each task's readiness is computed from its dependencies, required credentials
and manual gates.

**Schedule.** Ready tasks are ordered by priority. The scheduler enforces the
concurrency limit and refuses to select a task whose owned paths overlap an
in-flight one.

**Dispatch.** The task and its agent definition are rendered into a complete
prompt and handed to an executor. Three exist behind one interface: `dry-run`
(renders the prompt, does nothing — the default), `shell` (invokes a configured
CLI agent), and `http` (POSTs to a configured endpoint). No provider is compiled
in and no credential is stored.

**Verify.** The task's acceptance criteria and verification commands run, with
stdout, stderr and exit codes captured to `.orchestrator/logs/<taskId>/`. A
command whose binary is missing is skipped with a stated reason rather than
failing.

**Intake.** Failures arrive from six adapters: failed verification commands,
failed acceptance criteria, test transcripts (individual failing test names are
extracted), typecheck, lint, GitHub Actions logs via `gh`, and runtime reports
dropped as JSON into `.orchestrator/inbox/`.

**Fingerprint.** Timestamps, durations, hex addresses, hashes, line/column
numbers and absolute paths are stripped before hashing, so the same failure
produces the same fingerprint on different machines on different days. A
recurring failure increments an occurrence count instead of creating a
hundredth duplicate.

**Triage.** Deterministic and rules-based. Content signatures map a failure to a
domain — anything mentioning slippage or `minAmountOut` goes to `swap-routing`
as critical; `transferWithAuthorization` goes to `protocol`; CCTP and float
issues go to `crosschain`. For lint and typecheck the file paths are
authoritative instead, because a whole-repo transcript quotes unrelated source
and a line containing the word "slippage" does not make a formatting failure a
payment bug. Operators can override any of it by regex in config.

**Auto-fix.** The bug becomes a synthetic task dispatched to its owning agent,
carrying the failing command, the captured output and the implicated files. The
exact failing command is then re-run. Attempts are bounded (default 3) with
exponential backoff, and the prompt explicitly forbids silencing the check,
loosening a threshold or deleting the failing test.

**Escalate.** On exhaustion the bug is marked `needs-human` and a full
reproduction report is written to `.orchestrator/escalations/` — the command,
the output, the files, the triage rationale and the complete attempt history. A
GitHub issue body is drafted alongside it; actually creating the issue is
opt-in and never implicit.

### Test gates

Six staged gates: lint → typecheck → unit → integration → contracts → coverage.
Every command is configurable. A stage whose script does not exist yet, or whose
binary is not installed, is skipped with the reason stated. Failures flow
straight into intake, so one `test` run both reports and files.

### Deploy pipeline

Per environment: preflight gate validation → approval → build → deploy →
migrate → health check → rollback on failure. Health checks poll with retries.
**Production requires an explicit `--approve` and will refuse without it.** A
release that never becomes healthy is rolled back automatically before the
pipeline reports failure.

---

## 6. Where a human is required

This is the answer to "where do I plug things in". Nothing here blocks the
repository from running — every capability degrades to a reported off state.

Run `./scripts/orchestrate gates` or `bun run config:missing` for this same
table, live, with per-key instructions.

| Gate | Set in `.env.local` | Where to get it | Blocked without it |
| --- | --- | --- | --- |
| EVM RPC | `RPC_URL_BASE`, `RPC_URL_ETHEREUM` | [alchemy.com](https://dashboard.alchemy.com/) | EIP-3009, facilitator, contracts |
| Solana RPC | `RPC_URL_SOLANA` | [helius.dev](https://www.helius.dev/) | CCTP cross-chain flow |
| 1inch | `ONEINCH_API_KEY` | [portal.1inch.dev](https://portal.1inch.dev/) | Primary DEX quote source |
| 0x | `ZEROX_API_KEY` | [dashboard.0x.org](https://dashboard.0x.org/) | Quote comparison and failover |
| CoinGecko | `COINGECKO_API_KEY` *(optional)* | [coingecko.com](https://www.coingecko.com/en/api/pricing) | Unthrottled USD pricing |
| Facilitator | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `FACILITATOR_URL` | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/) | On-chain settlement |
| Hot signer | `PRIVATE_KEY` *(dev)* or `TURNKEY_*` / `LIT_*` *(prod)* | [app.turnkey.com](https://app.turnkey.com/) | Signing any authorization |
| Postgres | `DATABASE_URL` | [neon.tech](https://neon.tech/) or `docker compose up -d postgres` | Persistence, receipts, API keys |
| Redis | `REDIS_URL` | [upstash.com](https://upstash.com/) | Quote cache, rate limiting |
| USDC float | `FLOAT_FUNDING_WALLET` + funded USDC | your own wallet, ideally a Safe | Instant cross-chain and Lightning settlement |
| Lightning | `LND_GRPC_HOST`, `LND_TLS_CERT_PATH`, `LND_MACAROON_PATH` | [voltage.cloud](https://voltage.cloud/) | Bitcoin payers |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | [dashboard.stripe.com](https://dashboard.stripe.com/) | Pro plan billing |
| Basescan | `BASESCAN_API_KEY` | [basescan.org/myapikey](https://basescan.org/myapikey) | Contract source verification |
| Fly.io | `FLY_API_TOKEN` | [fly.io](https://fly.io/) | API deployment |
| npm | `NPM_TOKEN` | [npmjs.com](https://www.npmjs.com/) | Publishing `@anyx/sdk` |

Two gates are not credentials at all and cannot be automated away:

- **Funding the USDC float.** Cross-chain and Lightning settlement front real
  money while the bridge clears behind them.
- **Approving a production deploy.** `deploy production` refuses without
  `--approve`.

Two more require human judgement rather than a value: the smart contract audit
before mainnet, and the launch checklist attestations that no machine can
verify.

---

## 7. Risk register

From the whitepaper's threat model and the PRD's risk table, with the control
that addresses each and the agent who owns it.

| Risk | Severity | Control | Owner |
| --- | --- | --- | --- |
| Slippage manipulation / front-running | High | `minAmountOut` enforced on-chain and client-side; the transaction reverts rather than paying partially. Never allow a partial payment. | `swap-routing`, `contracts` |
| Hot signer key compromise | High | MPC in production (Turnkey or Lit); per-session spend cap; 5-minute `validBefore` window; `local` signer mode rejected by `config:check --env production`. | `security`, `protocol` |
| Bridge latency exceeding `maxTimeoutSeconds` | Medium | USDC float pool on Base fronts the payment; CCTP replenishes asynchronously. | `crosschain` |
| Oracle price manipulation | Medium | Dual-source pricing with a deviation ceiling; reject rather than guess. | `swap-routing` |
| Facilitator censorship or outage | Low | Mandatory fallback facilitator with a 2-second health-check failover. | `protocol` |
| DEX aggregator outage, rate limit or ToS change | Medium | Two aggregators queried in parallel; either alone is sufficient. | `swap-routing` |
| Smart contract exploit | Critical | Audit before mainnet; slippage reverts; `Ownable2Step`; `ReentrancyGuard`; upgradeable proxy for patching. | `contracts`, `security` |
| Committed credential | Critical | CI secret scan that is not `continue-on-error`; secrets masked in every CLI output; `.env.local` and the live config file git-ignored. | `security` |
| x402 adds native multi-token support | Low | Contribute the extension proposal; position AnyX as the reference implementation. | `growth` |
| An agent silences a failing check instead of fixing it | Medium | Fix prompts forbid it explicitly; verification re-runs the original command; escalation preserves the full history. | `orchestrator`, `qa` |

---

## 8. Sequencing

The low-hanging-fruit analysis is unambiguous about where to start, and the
graph reflects it: **revenue before smart contracts.**

**First — the quote path.** `1.1-token-registry` → `1.2-quote-engine` →
`1.3-x402-parser` → `1.4-eip3009` → `1.5-facilitator` → `1.6-api-server`. This
is the smallest set that can quote and settle a real payment. The Quote API is
simultaneously the product and the internal infrastructure the SDK consumes.

**Second — the SDK.** `1.7-sdk` turns the API into a one-line integration. USDT
first: it is the largest stablecoin by market cap and a stablecoin pair has
near-zero slippage, which makes it the highest margin efficiency and the lowest
risk way to prove the model.

**Third — monetize.** `6.1-api-keys-billing` and `growth.1-revenue-path`. Fees
are collectible with no contract deployed, using the pre-funded USDC float path
the roadmap explicitly recommends for Phase 1.

**Only then — contracts.** `2.1-anyx-router` onward. Smart contracts add audit
cost and exploit risk. Deferring them until the model is proven is the single
biggest risk reduction available.

**Then reach.** Cross-chain (Phase 3) opens Solana; Lightning (Phase 4) opens
Bitcoin, the largest excluded market and the one with no competitor. Both depend
on a funded float pool, which is why they sit behind `3.2-reserve-pool`.

**Throughout — discovery.** `5.2-llms-txt` and `7.1-langchain-tool` are small
tasks with outsized effect: the payers here are AI agents, and an agent that
cannot discover AnyX will not use it.

---

## 9. Operating it

```bash
./scripts/setup.sh                    # bootstrap; works with no accounts at all
./scripts/orchestrate doctor          # toolchain, config and service health
./scripts/orchestrate gates           # what a human still has to supply
./scripts/orchestrate plan            # the graph, progress, and what is ready
./scripts/orchestrate run --dry-run   # walk the graph, render every prompt, change nothing
./scripts/orchestrate run --auto-fix  # dispatch for real, fixing failures as they appear
./scripts/orchestrate test --continue # all gates, collecting every failure in one pass
./scripts/orchestrate bugs list       # what is open, who owns it, how many attempts
./scripts/orchestrate bugs fix        # run the auto-fix loop
./scripts/orchestrate deploy staging  # deploy with health checks and rollback
./scripts/orchestrate report          # a markdown summary of everything above
```

The default executor is `dry-run`, so a fresh clone can safely run every one of
these. To let agents actually write code, set `orchestrator.agentCommand` or
`orchestrator.agentEndpoint` in `config/anyx.config.jsonc`.

---

## 10. Definition of done

From the roadmap's launch checklist, encoded as `launch.1-checklist`, which
depends on every other terminal task:

- Unit, integration and contract suites pass; coverage at or above 80%
- Contracts audited, deployed to Base Sepolia and then Base mainnet, verified on Basescan
- API deployed with a passing health check; `@anyx/sdk@0.1.0` published
- `llms.txt`, the OpenAPI spec and Swagger UI live
- Fee collection verified against a real payment; receipts reconciled against on-chain logs
- Rate limiting verified; LangChain, AgentKit and MCP integrations tested against a live x402 API

The machine-checkable items are checked automatically. The audit sign-off and
the real-payment reconciliation are marked `manual`, and the orchestrator will
not claim them on anyone's behalf.
