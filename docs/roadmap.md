# Roadmap

The delivery plan, phase by phase. Difficulty is expressed as `small` /
`medium` / `large`, never as calendar time — an autonomous agent's throughput
has no relationship to a human work-week, and estimating in weeks would be
inventing precision that does not exist.

The live state is always `./scripts/orchestrate plan`.

## The ordering principle

Revenue before smart contracts.

The low-hanging-fruit analysis is unambiguous: the quote path and the SDK can
earn a spread with no contract deployed, using the pre-funded USDC float that
the build roadmap explicitly recommends for Phase 1. Contracts add audit cost
and exploit risk, and deferring them until the model is proven is the single
biggest risk reduction available.

## Phase 0 — Foundation

Monorepo, database schema, local service stack.

| Task | Agent | Size |
| --- | --- | --- |
| `0.1-monorepo` | devops | medium |
| `0.2-db-schema` | data | medium |
| `0.3-docker-compose` | devops | small |

Turborepo with Bun workspaces, strict TypeScript, Biome. Drizzle schema for
quotes, payments, API keys, Lightning invoices and partner credits. A compose
stack that is optional, because the whole system runs without it.

## Phase 1 — Core engine

The largest phase, and the one that makes the first dollar.

| Task | Agent | Size | Depends on |
| --- | --- | --- | --- |
| `1.1-token-registry` | swap-routing | small | 0.1 |
| `1.2-quote-engine` | swap-routing | large | 1.1, 0.2 |
| `1.3-x402-parser` | protocol | medium | 1.1 |
| `1.4-eip3009` | protocol | medium | 1.3 |
| `1.5-facilitator` | protocol | medium | 1.4 |
| `1.6-api-server` | backend | large | 1.2, 1.5, 0.2 |
| `1.7-sdk` | sdk | large | 1.6 |
| `1.8-unit-tests` | qa | medium | 1.2–1.5, 1.7 |
| `qa.1-integration-suite` | qa | medium | 1.8 |

Quote aggregation across 1inch and 0x with the spread applied. x402 v2 challenge
parsing. EIP-3009 signing via viem. Facilitator client with failover. The Hono
API. The `@anyx/sdk` drop-in.

Settlement in this phase uses the pre-funded USDC float rather than an on-chain
swap, which keeps smart contract risk out of the first release entirely.

**Done when** ETH and USDT payments on Base settle at 99%+ success, under 6
seconds at p95, with accurate receipts.

## Phase 2 — Smart contracts

| Task | Agent | Size |
| --- | --- | --- |
| `2.1-anyx-router` | contracts | large |
| `sec.1-threat-model` | security | medium |
| `2.2-deploy-scripts` | contracts | medium |
| `sec.2-preflight-audit` | security | medium |

`AnyXRouter`, `SwapExecutor` and `FeeCollector` in Solidity 0.8.24, with Permit2
for gasless approvals. Atomic swap-and-pay in one transaction.

Deployment is gated on the security review, which is gated on the threat model.
The audit sign-off is a `manual` criterion — no machine attests to it.

**Done when** contracts are audited with no unresolved critical or high
findings, deployed to Base Sepolia and then mainnet, and verified on Basescan.

## Phase 3 — Cross-chain

| Task | Agent | Size |
| --- | --- | --- |
| `3.1-cctp` | crosschain | large |
| `3.2-reserve-pool` | crosschain | large |

Circle CCTP v2 for native USDC across chains, Stargate as fallback, and the
`ReservePool` contract holding the Base float. Opens Solana via Jupiter.

Requires real working capital, not just an API key.

**Done when** a Solana payer settles a Base x402 payment in under 5 seconds
through the float.

## Phase 4 — Bitcoin

| Task | Agent | Size |
| --- | --- | --- |
| `4.1-lightning` | lightning | large |

An LND service issuing BOLT-11 invoices, watching for settlement, and drawing
from the reserve pool. The largest excluded market and the one with no
competitor.

Custodial for the seconds between Lightning settlement and USDC authorization —
a deliberate decision with regulatory implications flagged as an open question
in the PRD.

**Done when** a Lightning payment produces an x402 receipt in under 10 seconds.

## Phase 5 — Developer experience

| Task | Agent | Size |
| --- | --- | --- |
| `5.1-docs-site` | docs | medium |
| `5.2-llms-txt` | docs | small |
| `5.3-openapi` | docs | medium |

`llms.txt` is a small task with outsized effect. The payers here are AI agents,
and an agent that cannot discover AnyX will not use it.

## Phase 6 — Monetization

| Task | Agent | Size |
| --- | --- | --- |
| `6.1-api-keys-billing` | backend | large |
| `6.2-stripe` | backend | medium |
| `growth.1-revenue-path` | growth | small |

Hashed API keys, monthly volume metering, tiered rate limits, partner fee
sharing, and the $49/month Pro plan through Stripe.

## Phase 7 — Agent integrations

| Task | Agent | Size |
| --- | --- | --- |
| `7.1-langchain-tool` | integrations | medium |
| `7.2-agentkit` | integrations | small |
| `growth.2-distribution` | growth | small |

LangChain tool, OpenAI function definitions, an MCP server, and Coinbase
AgentKit. Distribution to where the agents already are.

## Cross-cutting

| Task | Agent | Size |
| --- | --- | --- |
| `ci.1-github-actions` | devops | medium |
| `devops.1-deploy-api` | devops | medium |
| `launch.1-checklist` | orchestrator | medium |

`launch.1-checklist` depends on every other terminal task and verifies the
roadmap's launch checklist. Machine-checkable items are checked automatically;
the audit sign-off and the real-payment reconciliation are `manual`.

## Beyond

Two directions the source documents point at, not yet in the graph:

**Account abstraction.** An ERC-4337 paymaster letting payers cover gas in their
input token, plus a Safe module. Removes the last reason a payer needs ETH.

**Protocol extension.** Propose a multi-token extension to the x402 foundation
with AnyX as the reference implementation. If x402 adds native multi-token
support, the adapter's value drops — contributing the proposal is how that risk
becomes an advantage.

## Sources

- [`docs/reference/agent-build-roadmap.md`](reference/agent-build-roadmap.md) — task-level specification
- [`docs/reference/prd.md`](reference/prd.md) — milestones and acceptance criteria
- [`docs/reference/low-hanging-fruit.md`](reference/low-hanging-fruit.md) — sequencing for earliest revenue
- [`MASTER_PLAN.md`](../MASTER_PLAN.md) — agent ownership and the dependency graph
