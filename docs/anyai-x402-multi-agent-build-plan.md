# AnyAIx402 Multi-Agent Build Plan

## 1. Product Goal and Scope

AnyAIx402, referred to as AnyX in the uploaded documents, is a universal payment adapter for the x402 protocol. Its core promise is:

> Pay any x402-gated API with any crypto token. Settle standard USDC through x402.

The product abstracts away token and chain fragmentation for AI agents, developers, wallets, and API users. A payer can hold ETH, USDT, WBTC, cbBTC, SOL, BTC over Lightning, or another supported ERC-20, while the target API provider continues to receive a normal x402-compliant USDC payment on Base.

### Primary Scope

- Intercept HTTP 402 responses from x402-compatible APIs.
- Parse x402 v2 `PaymentRequired` challenges.
- Quote the payer's preferred token into required USDC.
- Route swaps through 1inch, 0x, and later chain-specific aggregators such as Jupiter.
- Settle the required USDC payment through EIP-3009 and an x402 facilitator.
- Return the original API response and a detailed payment receipt.
- Expose SDK, REST API, MCP, and framework integrations so AI agents can pay automatically.
- Automate engineering workflows through domain-specialized agents coordinated by an orchestrator.

### Explicit Non-Goals for MVP

- Do not modify x402 itself or require API providers to change the protocol.
- Do not support fiat payments.
- Do not custody long-lived user funds.
- Do not launch unaudited mainnet contracts for high-value flows.
- Do not support every chain at once; start with the lowest-risk Base token flows.

## 2. Product Surfaces

### Developer SDK

The TypeScript SDK is the main developer surface:

```ts
import { UPA } from '@anyx/sdk'

const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453,
  wallet: walletClient,
  maxSlippage: 0.005,
})

const response = await upa.fetch('https://api.example.com/data')
```

The SDK should provide:

- `fetch(url, init?)`: drop-in replacement for native `fetch()`.
- `quote(endpointUrl, options?)`: cost preview before paying.
- `pay(endpointUrl, options?)`: execute payment from an existing or new quote.
- `getReceipt(receiptId)`: retrieve audit details.
- Event hooks for payment, swap, receipt, and error events.

### REST API

- `GET /health`
- `GET /v1/tokens`
- `POST /v1/quote`
- `POST /v1/pay`
- `GET /v1/receipt/:id`
- `POST /v1/lightning/invoice` in later phase
- `GET /v1/lightning/status/:paymentHash` in later phase

### Agent Integrations

- LangChain tool
- Coinbase AgentKit action
- MCP server with `anyx_quote`, `anyx_pay`, `anyx_receipt`, and `anyx_supported_tokens`
- OpenAI function tool definition
- CrewAI and AutoGen wrappers
- ElizaOS plugin in a later phase

### Admin and Operator Surfaces

- `.env.local` and `.env.example` for local configuration.
- Versioned typed config file, for example `anyx.config.ts` or `config/anyx.yaml`.
- Dashboard for API keys, usage, receipts, partner revenue share, and billing status.
- Admin CLI for setup validation, key rotation checks, contract address updates, and deploy readiness.

## 3. Baseline Technical Architecture

The uploaded documents converge on this stack:

- Runtime: Bun 1.x
- API framework: Hono
- Language: TypeScript with strict mode
- Monorepo: Turborepo with Bun workspaces
- Blockchain client: viem 2.x
- Smart contracts: Solidity 0.8.24 with Foundry
- Database: PostgreSQL with Drizzle ORM
- Cache and rate limiting: Redis
- DEX routing: 1inch Fusion+ and 0x Swap API first, then direct routes and additional aggregators
- Cross-chain: Circle CCTP v2 first, Stargate or Connext as fallback
- BTC: Lightning via LND or Core Lightning in later phase
- Deployment: Docker and Fly.io initially
- CI/CD: GitHub Actions
- Secrets: `.env.local` for local development, provider secret stores for deployed environments

### Target Monorepo Shape

```txt
packages/
  core/          # quote engine, x402 parser, EIP-3009, facilitator client, token registry
  sdk/           # public TypeScript SDK
  contracts/     # Foundry Solidity contracts
  db/            # Drizzle schema and migrations
  integrations/  # LangChain, AgentKit, MCP, OpenAI, CrewAI, AutoGen
apps/
  api/           # Hono API service
  dashboard/     # developer/admin dashboard
  docs/          # public documentation site
  lightning/     # later BTC Lightning service
scripts/
  setup.sh
  deploy.sh
docs/
  source documents and plans
```

## 4. Multi-Agent System Architecture

The engineering system should be a multi-agent delivery system coordinated by a central orchestrator. The orchestrator decomposes work into domain tasks, assigns them to specialized agents, requires acceptance evidence, and gates release promotion.

### Control Plane

```txt
User / Product Owner
        |
        v
Orchestrator Agent
        |
        +-- Product and Requirements Agent
        +-- Protocol and x402 Agent
        +-- Payments and Routing Agent
        +-- Smart Contract Agent
        +-- Backend API Agent
        +-- SDK and Integrations Agent
        +-- Data and Billing Agent
        +-- Security and Risk Agent
        +-- QA and Regression Agent
        +-- DevOps and Release Agent
        +-- Observability and Incident Agent
        +-- Documentation and Developer Experience Agent
        +-- Growth and Partner Integration Agent
```

### Shared State

Agents need common structured state rather than free-form handoffs:

- `docs/`: source-of-truth requirements and decisions.
- Issue tracker: bugs, tasks, incidents, and release blockers.
- Git branches and PRs: code review and CI evidence.
- Test reports: unit, integration, contract, end-to-end, smoke, and security reports.
- Database migrations: schema evolution evidence.
- Deployment manifests: release artifacts and rollback references.
- Observability dashboards: production health and incident signals.
- Configuration registry: supported tokens, chains, contracts, facilitators, fees, limits, and providers.

### Orchestrator Execution Contract

Every task should include:

- Objective
- Inputs and source documents
- Owner agent
- Dependencies
- Files or packages in scope
- Acceptance criteria
- Required tests
- Security review requirement
- Manual configuration requirements
- Rollback plan if it reaches deployment

The orchestrator should block promotion when:

- Required tests are missing or failing.
- Risk owner has not signed off on payment/security-sensitive code.
- New environment variables are undocumented.
- Migrations are not reversible or documented.
- Payment flows lack receipt/audit coverage.
- Deployment readiness checks fail.

## 5. Domain-Specialized Agents

### 5.1 Product and Requirements Agent

Responsibilities:

- Maintain PRD, scope, user stories, and acceptance criteria.
- Convert uploaded strategy documents into dependency-ordered implementation tasks.
- Keep MVP versus later-phase boundaries explicit.
- Track open questions such as hot signer custody, float pool sizing, Lightning compliance, and aggregator ToS.

Primary outputs:

- Product requirements updates
- Acceptance criteria
- Release scope summaries
- Decision records

### 5.2 Protocol and x402 Agent

Responsibilities:

- Own x402 v2 challenge parsing.
- Validate `PaymentRequired` schema and supported `accepts` entries.
- Build and validate `X-PAYMENT` and `X-PAYMENT-RESPONSE` behavior.
- Maintain compatibility with Coinbase CDP facilitator and self-hosted facilitator implementations.

Acceptance evidence:

- Fixture tests for 402 JSON body and payment headers.
- Tests for no compatible payment option.
- Facilitator failover tests.
- Protocol compatibility matrix.

### 5.3 Payments and Routing Agent

Responsibilities:

- Own token registry, quote engine, slippage checks, DEX aggregation, fee calculation, and route selection.
- Integrate 1inch and 0x first.
- Add Jupiter, CCTP, Stargate, and Lightning paths in later phases.
- Enforce quote expiry and no partial payment invariant.

Acceptance evidence:

- Quote calculation unit tests.
- DEX fallback tests.
- Slippage boundary tests.
- Fee transparency in receipt outputs.

### 5.4 Smart Contract Agent

Responsibilities:

- Build `AnyXRouter.sol`, `SwapExecutor.sol`, `FeeCollector.sol`, `ReservePool.sol`, and later `UPA_Paymaster.sol`.
- Own Permit2, DEX router calls, fee extraction, emergency controls, and access control.
- Write Foundry tests and deployment scripts.

Acceptance evidence:

- Foundry unit tests and fork tests.
- Static analysis report.
- Mainnet deployment checklist.
- Audit readiness package.

### 5.5 Backend API Agent

Responsibilities:

- Implement Hono API service.
- Own request validation, route handlers, error formats, CORS, request IDs, rate limiting, and API auth.
- Wire Redis, Postgres, and core package functions.

Acceptance evidence:

- API unit and integration tests.
- OpenAPI spec.
- Health check and smoke tests.
- Error contract tests.

### 5.6 SDK and Integrations Agent

Responsibilities:

- Build `@anyx/sdk`.
- Build framework packages for LangChain, AgentKit, MCP, OpenAI function calling, CrewAI, AutoGen, and later ElizaOS.
- Keep agent-facing descriptions clear enough for LLM tool selection.

Acceptance evidence:

- SDK integration tests against mocked and live x402 fixtures.
- Example apps.
- Published package dry run.
- MCP schema tests.

### 5.7 Data, Billing, and Partner Agent

Responsibilities:

- Own Drizzle schema, migrations, API keys, usage tracking, volume caps, partner credits, and Stripe subscription state.
- Ensure API keys are hashed and plaintext keys are only displayed once.
- Provide usage reporting and revenue share calculations.

Acceptance evidence:

- Migration tests.
- Billing webhook tests.
- Rate limit and volume cap tests.
- Reconciliation reports for payment receipts versus usage counters.

### 5.8 Security and Risk Agent

Responsibilities:

- Threat model payment flows, hot signer custody, DEX interactions, CCTP, Lightning custody, and admin operations.
- Enforce key management requirements.
- Review every change touching private keys, contracts, facilitator calls, payments, billing, or user funds.

Acceptance evidence:

- Threat model updates.
- Secret scanning and dependency audit results.
- Contract static analysis.
- Abuse-case tests.
- Sign-off on mainnet readiness.

### 5.9 QA and Regression Agent

Responsibilities:

- Convert user stories and bug reports into automated tests.
- Maintain unit, integration, contract, end-to-end, smoke, and regression suites.
- Own flaky test quarantine and reproduction fixtures.

Acceptance evidence:

- Test plan by feature.
- Regression test for every fixed bug.
- CI reports.
- Coverage summaries for core payment logic.

### 5.10 DevOps and Release Agent

Responsibilities:

- Own Docker, Fly.io deployment, GitHub Actions, environment setup, migration execution, and rollbacks.
- Build release workflows for API, SDK packages, contracts, docs, and integrations.
- Enforce staging-before-production.

Acceptance evidence:

- Green CI.
- Deployment logs.
- Post-deploy health checks.
- Rollback commands documented and tested.

### 5.11 Observability and Incident Agent

Responsibilities:

- Define metrics, logs, traces, alerts, and incident workflows.
- Detect payment failures, quote errors, facilitator downtime, DEX outages, slippage spikes, reserve pool exhaustion, and billing webhook failures.

Acceptance evidence:

- Dashboards.
- Alert rules.
- Incident templates.
- Synthetic x402 payment probes.

### 5.12 Documentation and Developer Experience Agent

Responsibilities:

- Maintain docs, `llms.txt`, OpenAPI, quickstart, SDK reference, self-hosting guide, and examples.
- Ensure every configuration option has documentation.
- Keep developer onboarding under the target integration size.

Acceptance evidence:

- Docs checks.
- Working examples.
- API reference generated from source.
- LLM-discovery file updated with current endpoints.

### 5.13 Growth and Partner Integration Agent

Responsibilities:

- Translate market, monetization, and marketing docs into integration targets and launch assets.
- Coordinate examples and partner revenue share requirements with engineering.
- Track integration readiness for LangChain, AgentKit, MCP, x402 marketplaces, and wallets.

Acceptance evidence:

- Partner integration checklist.
- Demo scripts.
- Launch copy matched to implemented features.
- Referral and partner attribution tested.

## 6. Orchestrator Responsibilities and Workflows

### 6.1 Intake Workflow

1. Read relevant source documents.
2. Classify the task by domain.
3. Identify dependent systems and risk level.
4. Create an implementation ticket with acceptance criteria.
5. Assign primary and review agents.
6. Require configuration and documentation updates for any new surface.

### 6.2 Build Workflow

1. Product agent confirms scope and MVP/later-phase boundary.
2. Domain agent implements the feature behind typed interfaces.
3. QA agent adds tests before release eligibility.
4. Security agent reviews high-risk code paths.
5. Docs agent updates configuration and usage docs.
6. DevOps agent wires CI/deploy if operational behavior changes.
7. Orchestrator checks all acceptance evidence and merges only when green.

### 6.3 Bug Reporting, Triage, Fixing, and Regression Workflow

Bug reports should be structured:

```yaml
title: Short failure description
severity: critical | high | medium | low
area: protocol | quote | payment | contract | api | sdk | billing | deploy | docs
environment: local | staging | production
detected_by: user | ci | synthetic_probe | alert | agent
steps_to_reproduce: []
expected: ""
actual: ""
artifacts:
  logs: []
  tx_hashes: []
  request_ids: []
  quote_ids: []
  receipt_ids: []
```

Automated triage:

- Critical: user funds at risk, signer compromise, mainnet contract exploit, double charge, incorrect settlement recipient, or production outage.
- High: payment failures, stuck quotes, DEX/facilitator outage with no fallback, billing corruption, or release blocker.
- Medium: SDK compatibility bug, dashboard error, incomplete receipt, non-critical rate limit issue.
- Low: docs, examples, copy, minor DX issues.

Fix loop:

1. Observability or QA agent opens a structured bug.
2. Orchestrator assigns a domain owner and a QA owner.
3. QA agent creates or updates a failing reproduction test.
4. Domain agent fixes the bug.
5. Security reviews if payment, signing, funds, or auth are involved.
6. QA confirms regression test passes.
7. DevOps deploys to staging.
8. Synthetic probes validate the fixed path.
9. Orchestrator promotes to production if release gates pass.
10. Documentation agent updates known issues or troubleshooting docs if user-facing.

### 6.4 Automated Release and Deploy Workflow

Release gates:

- Lint and typecheck pass.
- Unit tests pass.
- Integration tests pass.
- Contract tests pass when contract code changes.
- OpenAPI and docs are updated when API behavior changes.
- Secret/config manifest is current.
- Database migrations are tested.
- Payment smoke test passes in staging.
- Rollback plan exists.

Deploy flow:

1. Merge to main only after release gates pass.
2. Build API Docker image.
3. Run migrations against staging.
4. Deploy API to staging.
5. Run synthetic quote and payment tests with low-value testnet or mocked settlement.
6. Deploy docs/dashboard if changed.
7. Promote API to production.
8. Run post-deploy health and synthetic probes.
9. Record release metadata, commit SHA, config version, and migration version.

Rollback:

- API: redeploy previous image.
- Database: prefer forward-fix migrations; document irreversible migrations.
- Contracts: pause affected routes, switch contract address registry, or use proxy upgrade only after security review.
- Facilitator/DEX: disable route through config and fail over.

## 7. Configuration Model

Manual setup should be explicit, typed, validated at startup, and easy to configure without code changes.

### 7.1 Environment Variables

Local development should use `.env.local`; deployed services should use platform secret storage.

```bash
# Runtime
NODE_ENV=development
PORT=3000
PUBLIC_APP_URL=http://localhost:3000

# Database and cache
DATABASE_URL=postgresql://user:password@localhost:5432/anyx
REDIS_URL=redis://localhost:6379

# API auth and admin
API_SECRET=
ADMIN_API_KEY=
JWT_SECRET=
CORS_ORIGINS=http://localhost:3000

# Chain RPC
RPC_URL_BASE=https://mainnet.base.org
RPC_URL_BASE_SEPOLIA=
RPC_URL_ETHEREUM=https://eth.llamarpc.com
RPC_URL_SOLANA=https://api.mainnet-beta.solana.com

# Signing and custody
PRIVATE_KEY=
MPC_PROVIDER=local
TURNKEY_API_KEY=
TURNKEY_ORG_ID=
LIT_NETWORK=

# DEX aggregators
ONEINCH_API_KEY=
ZEROX_API_KEY=
KYBERSWAP_API_KEY=

# x402 facilitators
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
FACILITATOR_FALLBACK_URL=

# Circle and bridge
CCTP_ATTESTER_URL=https://iris-api.circle.com
CIRCLE_API_KEY=

# Lightning, later phase
LND_GRPC_HOST=
LND_TLS_CERT_PATH=
LND_MACAROON_PATH=
LNC_CONNECTION_STRING=

# Fees and limits
FEE_BPS=20
MIN_FEE_USDC=0.001
MAX_FEE_BPS=100
DEFAULT_SLIPPAGE_BPS=50
QUOTE_TTL_SECONDS=30

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=

# Deployment
FLY_API_TOKEN=
NPM_TOKEN=
BASESCAN_API_KEY=
```

### 7.2 Typed Config File

A checked-in template should document non-secret defaults:

```ts
// anyx.config.example.ts
export default {
  chains: {
    base: { chainId: 8453, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  },
  fees: {
    defaultBps: 20,
    minFeeUsdc: '0.001',
    maxBps: 100,
  },
  quote: {
    ttlSeconds: 30,
    defaultSlippageBps: 50,
  },
  facilitators: [
    'https://api.cdp.coinbase.com/platform/v2/x402',
  ],
  dexPriority: ['1inch', '0x'],
}
```

### 7.3 Admin UI

The dashboard should allow operators to manage:

- API keys and plan assignment.
- Usage and volume caps.
- Partner IDs and revenue-share percentage.
- Fee basis points by token, route, and customer tier.
- Supported token enable/disable.
- Facilitator priority and health status.
- Contract addresses by network.
- Reserve pool balances and replenishment status.
- Billing state and Stripe customer portal links.
- Webhook delivery logs.

### 7.4 Admin CLI

The CLI should support:

- `anyx doctor`: validate env vars, RPC connections, Redis, Postgres, facilitator health, and DEX API credentials.
- `anyx keys create`: generate admin or API keys.
- `anyx config validate`: validate typed config against schema.
- `anyx routes test`: run quote tests for supported token pairs.
- `anyx deploy check`: verify release readiness.
- `anyx receipts reconcile`: compare DB receipts against on-chain events.

## 8. x402 Payment Integration Assumptions

### Core Assumptions

- x402 v2 is the target protocol.
- The dominant settlement path is USDC on Base.
- x402 servers can remain unchanged.
- The adapter can parse a 402 challenge and select a compatible Base USDC payment option.
- EIP-3009 `transferWithAuthorization` is the standard settlement mechanism for USDC.
- A facilitator verifies and submits settlement.
- Coinbase CDP can be primary, with self-hosted facilitator fallback.
- Quote freshness is short; default quote TTL is 30 seconds.
- Payment windows should stay inside the challenge `maxTimeoutSeconds`, typically 300 seconds.

### Implementation Stages

#### Stage A: Quote API and SDK Skeleton

- Parse 402 challenges.
- Read required USDC amount and recipient.
- Quote USDT and ETH on Base through 1inch/0x.
- Return itemized fee and expiry.
- Do not require smart contracts yet.

#### Stage B: MVP Payment Flow on Base

- Support Base USDT, WETH/ETH, cbBTC, and USDC.
- Execute swap through approved DEX route.
- Build EIP-3009 authorization.
- Submit to facilitator.
- Retry the original request with `X-PAYMENT`.
- Store receipt.

#### Stage C: On-Chain Router

- Add `AnyXRouter.sol` and `SwapExecutor.sol`.
- Enforce `minAmountOut >= usdcRequired`.
- Collect fees.
- Refund excess.
- Protect with tests, audit, ownership controls, and pause mechanism.

#### Stage D: Cross-Chain

- Add CCTP for USDC movement.
- Add reserve pool for instant settlement where bridge latency would exceed x402 timeout.
- Add Solana via Jupiter plus CCTP.
- Add Stargate/Connext fallback where appropriate.

#### Stage E: Lightning BTC

- Generate BOLT-11 invoices.
- Confirm settlement from LND/Core Lightning.
- Draw USDC from reserve pool and settle x402.
- Replenish reserve asynchronously with BTC/cbBTC route.
- Add compliance review before production.

#### Stage F: Account Abstraction and Enterprise

- Add ERC-4337 paymaster.
- Enable gas payment in input token.
- Add Safe module and enterprise SDKs.
- Add self-hosted and white-label deployment packaging.

## 9. MVP Versus Later Phases

### MVP

MVP should prove that a developer or AI agent can pay a real x402 API using a non-USDC token on Base with transparent cost and reliable settlement.

MVP includes:

- Bun/Hono API.
- TypeScript SDK with `fetch`, `quote`, and `pay`.
- Token registry for USDC, USDT, WETH/ETH, and cbBTC on Base.
- 402 challenge parser.
- Quote engine with 1inch and 0x fallback.
- Fee calculation and quote caching.
- EIP-3009 builder.
- Facilitator client with failover.
- Payment receipts in Postgres.
- Redis rate limiting.
- `.env.example`, typed config schema, and `anyx doctor`.
- CI for lint, typecheck, tests, and build.
- OpenAPI and `llms.txt`.
- LangChain and MCP integration examples.

### Later Phases

Later phases include:

- Audited on-chain router.
- Full smart contract deployment and verification.
- Solana/SPL support.
- CCTP reserve pool and bridge monitor.
- Lightning BTC gateway.
- Stripe Pro billing and partner revenue share.
- Dashboard analytics.
- AgentKit, CrewAI, AutoGen, ElizaOS production packages.
- ERC-4337 paymaster.
- Self-hosted white-label distribution.
- x402 multi-token protocol proposal.

## 10. Milestones Ordered by Technical Dependency

### M0: Repository and Engineering Foundation

Dependencies: none.

- Initialize Bun/Turborepo monorepo.
- Add TypeScript strict config and Biome.
- Add package boundaries.
- Add Docker Compose for Postgres and Redis.
- Add env/config templates.
- Add CI baseline.

Exit criteria:

- `bun run build`, `bun run test`, and `bun run lint` commands exist.
- Local setup works from documented commands.

### M1: Data and Configuration Foundation

Depends on M0.

- Add Drizzle schema for quotes, payments, API keys, partner credits, and Lightning invoices.
- Add config loader and startup validation.
- Add API key hashing.

Exit criteria:

- Migrations generate and apply.
- Config validation fails fast on missing required production settings.

### M2: x402 Protocol Core

Depends on M0.

- Implement 402 fetch, challenge parse, Base USDC selection, payment header builder, and facilitator client.

Exit criteria:

- Fixtures pass for body/header challenge formats.
- Facilitator failover is tested.

### M3: Token Registry and Quote Engine

Depends on M1 and M2.

- Add supported Base token registry.
- Add 1inch and 0x quote clients.
- Add best route selection, quote TTL, fee calculation, and Redis cache.

Exit criteria:

- Quote tests pass.
- Fallback behavior is deterministic.
- Receipts include fee and route metadata.

### M4: API MVP

Depends on M1, M2, and M3.

- Implement Hono routes.
- Add validation, error format, request logging, rate limits, and API key auth.
- Persist quotes and payment receipts.

Exit criteria:

- API integration tests pass.
- OpenAPI reflects implemented routes.

### M5: SDK MVP

Depends on M4.

- Implement `@anyx/sdk`.
- Add `upa.fetch`, `quote`, `pay`, and receipt events.
- Add examples and quickstart.

Exit criteria:

- SDK integration test handles mocked 402 flow.
- Example code stays under target integration size.

### M6: Payment Execution MVP

Depends on M2, M3, M4, and M5.

- Execute Base token payment path.
- Build EIP-3009 authorization.
- Submit to facilitator.
- Retry original request and store receipt.

Exit criteria:

- End-to-end test passes with mock facilitator.
- Staging smoke test passes with a controlled x402 endpoint.
- No partial settlement path exists.

### M7: Integration Distribution

Depends on M5 and M6.

- Add LangChain package.
- Add MCP server.
- Add OpenAI function examples.
- Add AgentKit action after core SDK stabilizes.

Exit criteria:

- Integration examples pass automated tests.
- MCP schemas validate.

### M8: Smart Contract Path

Depends on stable MVP payment model.

- Implement router, swap executor, fee collector, reserve pool.
- Add Foundry tests, fork tests, deployment scripts, and audit package.

Exit criteria:

- Contract tests pass.
- Static analysis passes.
- Mainnet deployment is blocked until audit sign-off.

### M9: Cross-Chain and Reserve Pool

Depends on M8.

- Add CCTP bridge module and bridge monitor.
- Add reserve pool integration.
- Add Solana/Jupiter path.

Exit criteria:

- Bridge monitor tests pass.
- Reserve pool exhaustion behavior is tested.
- Cross-chain timeout handling is explicit.

### M10: Lightning BTC

Depends on reserve pool and compliance review.

- Add Lightning service.
- Generate invoices.
- Watch settlement.
- Settle x402 from reserve.
- Replenish asynchronously.

Exit criteria:

- Lightning invoice lifecycle is tested.
- Custody/compliance risks are documented and accepted.

### M11: Billing, Dashboard, and Partner Revenue Share

Depends on MVP API and data model.

- Add Stripe checkout and webhooks.
- Add usage dashboard.
- Add partner attribution and credits.

Exit criteria:

- Webhook signature verification passes.
- Billing state reconciles with API key plan.

### M12: Production Automation and Release Hardening

Depends on M6 and expands continuously.

- Add deploy workflows.
- Add observability, alerts, synthetic probes, rollback procedures, and incident templates.

Exit criteria:

- Staging and production deploys are repeatable.
- Health checks and synthetic probes are active.

## 11. Testing Strategy

### Unit Tests

- Token registry lookups.
- Fee calculations.
- Quote selection.
- x402 schema parsing.
- EIP-3009 payload building and signature validation.
- Error mapping.
- Config validation.

### Integration Tests

- 1inch and 0x mocked responses.
- Redis quote cache.
- Postgres quote/payment persistence.
- Hono route validation.
- Facilitator verify/settle mocks.
- SDK-to-API flow.

### Contract Tests

- Swap success.
- Slippage revert.
- Fee collection.
- Refund excess.
- Access control.
- Emergency pause/rescue.
- Reserve pool front and replenish.

### End-to-End Tests

- Mock x402 API returns 402.
- SDK quotes, pays, retries, and receives 200.
- Receipt matches payment details.
- Facilitator failure triggers fallback.
- Quote expiry blocks stale payments.

### Regression Tests

Every production bug gets:

- Reproduction fixture.
- Failing test before fix.
- Passing regression test after fix.
- Linked bug report.

### Security Tests

- Dependency audit.
- Secret scan.
- Signature replay tests.
- Slippage manipulation tests.
- Invalid recipient tests.
- Rate limit abuse tests.
- Billing webhook spoof tests.
- Admin endpoint auth tests.

## 12. Deployment Strategy

### Environments

- Local: Docker Compose, `.env.local`, mock facilitator optional.
- Staging: real deployed API, testnet contracts, mock or low-value facilitator, staging Redis/Postgres.
- Production: mainnet routes, audited contracts, production secrets, active monitoring.

### Release Units

- API service Docker image.
- Dashboard app.
- Documentation site.
- SDK npm package.
- Integration packages.
- Contract deployment artifacts.
- Database migrations.

### Deployment Requirements

- Build artifacts must be traceable to commit SHA.
- Migrations run before API promotion when backward compatible.
- Contract addresses are config values, not hardcoded.
- Feature flags gate new payment routes.
- Post-deploy synthetic quote and payment probes must run.

## 13. Observability

### Metrics

- Quote request count, latency, success/failure.
- Quote expiry rate.
- Payment request count, latency, success/failure.
- Settlement success rate by facilitator.
- DEX quote failure rate by provider.
- Slippage rejection count.
- Revenue by token and route.
- API key usage and volume.
- Rate-limit hits.
- Reserve pool available float and utilization.
- Bridge completion latency.
- Lightning invoice settlement rate.

### Logs

Use structured logs with:

- `requestId`
- `quoteId`
- `receiptId`
- `apiKeyId`
- `partnerId`
- `endpointHost`
- `inputToken`
- `inputChainId`
- `routeProvider`
- `facilitator`
- `txHash`

Never log:

- Private keys
- Full API keys
- Raw secrets
- Macaroons
- Stripe secrets

### Alerts

- Payment success rate below threshold.
- Facilitator primary outage.
- All DEX providers failing.
- Reserve pool below threshold.
- Bridge stuck beyond expected latency.
- Billing webhook failures.
- Unusual fee or slippage spike.
- Unexpected contract event.

## 14. Security and Failure Modes

### Invariants

- Never settle less USDC than the x402 challenge requires.
- Never charge if payment cannot settle.
- Never reuse an EIP-3009 nonce.
- Never accept stale quotes.
- Never send funds to a recipient not present in the x402 challenge.
- Never store plaintext API keys.
- Never commit secrets.

### Major Failure Modes

#### DEX Route Failure

Mitigation:

- Use multiple providers.
- Enforce `minAmountOut`.
- Return actionable `NO_ROUTE`, `SWAP_FAILED`, or `SLIPPAGE_EXCEEDED`.

#### Facilitator Downtime

Mitigation:

- Health-check primary.
- Fail over to self-hosted facilitator.
- Alert when primary fails.

#### Hot Signer Compromise

Mitigation:

- Use MPC or HSM-backed key management.
- Use short authorization windows.
- Limit signer permissions and balances.
- Alert on anomalous signing volume.
- Rotate keys with documented procedure.

#### Bridge Latency Exceeds x402 Timeout

Mitigation:

- Use reserve pool for latency-sensitive paths.
- Reject or warn when no float is available.
- Match quote expiry and invoice expiry to challenge timeout.

#### Reserve Pool Exhaustion

Mitigation:

- Expose pool status.
- Alert below threshold.
- Disable instant cross-chain route via config.
- Fall back to wait-for-bridge mode if acceptable.

#### Billing Webhook Failure

Mitigation:

- Verify Stripe signatures.
- Store webhook events idempotently.
- Retry failed handlers.
- Reconcile subscription state periodically.

#### Incorrect Configuration

Mitigation:

- Startup validation.
- `anyx doctor`.
- Environment-specific config schemas.
- Clear admin UI warnings.

## 15. Manual Setup and User-Configurable Details

The project needs manual help for external accounts and payment infrastructure. These should be exposed through easy configuration rather than code edits.

### Required Manual Setup

- RPC providers for Base, Ethereum, Base Sepolia, and Solana.
- 1inch API key.
- 0x API key.
- Coinbase CDP or chosen x402 facilitator credentials if required.
- Self-hosted facilitator URL if used.
- Circle API or CCTP-related setup where required.
- Stripe account, product, price, and webhook secret.
- Deployment provider account such as Fly.io.
- NPM organization/token for package publishing.
- Basescan API key for verification.
- MPC or signer custody provider.
- LND/Core Lightning node and credentials in the BTC phase.
- Domain, DNS, and status page.

### Configuration Principles

- Non-secret settings live in typed config.
- Secrets live in `.env.local` or deployment secret store.
- Contract addresses are environment/config values.
- Route enablement is feature-flagged.
- Production startup fails if required secrets for enabled routes are missing.
- Dashboard surfaces missing optional integrations as warnings.

## 16. Documentation Requirements

Documentation should be treated as a release gate:

- Quickstart.
- SDK reference.
- REST API reference from OpenAPI.
- Smart contract reference.
- Self-hosting guide.
- AI agent integration guide.
- Configuration reference.
- Troubleshooting guide.
- Security model.
- `llms.txt`.

Every new env var, route, token, chain, fee, or integration must update docs in the same change.

## 17. Initial Automation Backlog

The orchestrator should prioritize automation in this order:

1. CI baseline for lint, typecheck, tests, and build.
2. Config validation and `anyx doctor`.
3. API and SDK test harness with mocked x402 endpoint.
4. Regression test creation workflow for bug reports.
5. Staging deploy workflow.
6. Post-deploy synthetic quote/payment probes.
7. Structured incident templates and alert routing.
8. Contract test and audit readiness workflow.
9. Package publish dry-run workflow.
10. Production deploy and rollback workflow.

## 18. Recommended First Implementation Thread

The fastest low-risk path is:

1. Foundation monorepo.
2. Config, DB, Redis.
3. x402 challenge parser.
4. Quote API for Base USDT and ETH.
5. SDK `quote` and `fetch` wrapper with mocked payment path.
6. Payment execution through controlled facilitator path.
7. LangChain and MCP examples.
8. Observability and deploy automation.
9. Smart contract router after the off-chain model and tests are stable.

This sequence respects the uploaded documents' recommendation to start with the Quote API and Base stablecoin/ETH paths before taking on smart contract, cross-chain, and Lightning risk.
