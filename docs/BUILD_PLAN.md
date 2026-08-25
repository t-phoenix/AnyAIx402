# AnyAIx402 build plan

Status: accepted MVP architecture; implementation is in progress. External production gates
remain mandatory.

## 1. Product finding and recommended boundary

The source set specifies **AnyX, a multi-token x402 payment adapter**, not an AI inference
gateway. Its vision is to convert payer assets into x402-compatible USDC while leaving
merchants unchanged
([PRD lines 13–65](source/x402-universal-adapter-prd.md#L13-L65);
[whitepaper lines 259–275](source/x402-universal-adapter-whitepaper.md#L259-L275)).
The repository name, AnyAIx402, previously created an identity question. AI documents describe
framework adapters that consume the payment SDK, not model inference or routing
([AI integrations lines 12–18](source/anyx-ai-integrations.md#L12-L18)).

Under resolved [Decision D1](DECISIONS_REQUIRED.md#d1-product-identity), the build target is:

> A Base-first, self-custodial x402 payment adapter. It quotes a payer-authorized swap to USDC
> delivered to the payer, obtains the payer's EIP-3009 signature, and replays the original HTTP
> request using the pinned x402 v2 protocol. The merchant owns verification and settlement.

If AI inference is approved, it becomes a separate AI gateway plane. Payment is an enforcement
dependency, not mixed into model-routing code; see
[ADR 0003](adr/0003-ai-payment-plane-separation.md).

## 2. Scope

### MVP

- TypeScript SDK exposing `fetch`, `quote`, `pay`, token discovery, policy hooks, and receipts.
- Current x402 v2 wire behavior pinned by package version and conformance fixtures:
  `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`.
- CAIP-2 network IDs and CAIP-19 asset IDs at AnyX boundaries; the x402 v2 EVM wire asset remains
  its specified contract address and is normalized immediately. Numeric chain IDs may be
  adapter-local conveniences only.
- Base Sepolia first, then capped Base mainnet canaries.
- Canonical Base USDC settlement with qualified native ETH/WETH and USDT acquisition routes.
  cbBTC follows only after route qualification.
- Swap output sent to the payer's address; payer signs EIP-3009 from an address holding USDC.
- Exact request replay, including method, query, safe headers, and replayable body.
- DEX-provider abstraction, initially one provider plus deterministic mocks.
- Durable payment state machine, operation-level idempotency, append-only receipt journal,
  reconciliation, budget limits, and fee disclosure.
- Hosted quote/metering API only where it adds value. Wallet authority remains client-side.

### Not MVP

- Ethereum/Solana/Tron bridging; arbitrary ERC-20 claims; CCTP or reserve inventory.
- Lightning, native BTC, managed wallets, hot signers, or treasury-funded settlement.
- Custom swap-and-pay router, upgradeable contracts, or ERC-4337 paymaster.
- Server-side non-standard `accepts` entries.
- Stripe, partner payouts, analytics marketplace, or white-label licensing.
- Storing arbitrary paid API response bodies.
- Production AI inference routing.

Those items have distinct custody, liquidity, security, legal, and operating models. The source
itself identifies Lightning custody as unresolved
([PRD lines 726–732](source/x402-universal-adapter-prd.md#L726-L732)).

## 3. Why the source transaction design cannot be implemented as written

1. `/v1/pay` supplies only a quote ID and wallet address; an address is not authority to pull
   funds ([AGENTS lines 509–517](source/AGENTS.md#L509-L517)).
2. AnyX cannot sign EIP-3009 “on behalf of” a payer. The signer must control the `from` address
   holding the USDC. A treasury signer can authorize only treasury-owned USDC.
3. The proposed router swaps USDC into the contract and then calls
   `transferWithAuthorization(from=msg.sender)`; the payer was not funded with that output
   ([AGENTS lines 669–689](source/AGENTS.md#L669-L689)).
4. A Solidity contract cannot keep a private hot-signing key. The whitepaper notices the
   intermediate ownership problem but resolves it with an external hot signer, changing the
   flow into treasury custody
   ([whitepaper lines 295–340](source/x402-universal-adapter-whitepaper.md#L295-L340)).
5. The source has AnyX settle and then retry the resource
   ([AGENTS lines 509–517](source/AGENTS.md#L509-L517)). In the standard v2 flow the merchant
   owns verify/settle; independently settling risks replay or duplicate ownership.
6. A DEX transaction, HTTP request, merchant verification, and facilitator settlement are not
   atomically commit-able. “One call” is an SDK experience, not one atomic transaction.

## 4. User journeys

### Autonomous payer

1. An agent calls `anyx.fetch(request)`.
2. SDK receives and validates the 402 challenge.
3. Policy checks host allowlist, method, CAIP asset/network, fee ceiling, per-call and period
   budgets, and whether human approval is required.
4. Quote is bound to a challenge fingerprint, request fingerprint, payer, route, maximum input,
   minimum output, fee, and expiry.
5. Payer authorizes the swap; USDC is delivered to the payer.
6. After confirmation, the payer signs the EIP-3009 authorization.
7. SDK retries the exact resource request with `PAYMENT-SIGNATURE`.
8. Merchant verifies and settles; SDK validates `PAYMENT-RESPONSE`, returns the resource, and
   records an immutable receipt.

### Human-confirmed payer

The user sees input maximum, API cost, DEX price impact, estimated gas, AnyX fee, and total
before wallet authorization. Cancellation before authorization spends nothing. If the swap
succeeds but payment fails, the user retains USDC and receives recovery instructions.

### Integrator

The developer installs one canonical SDK, configures wallet and policy, uses a sandbox merchant,
and replaces a `fetch` call. Framework/MCP packages remain thin adapters over this SDK. The
source's `<10 lines` objective is retained
([PRD lines 158–166](source/x402-universal-adapter-prd.md#L158-L166)).

### Inventory or Lightning payer (future)

Confirmed source funds trigger a separately authorized Base inventory payment, followed by
asynchronous replenishment. This requires a double-entry ledger, exposure limits, refunds,
solvency monitoring, and human treasury controls; it is not the self-custodial MVP.

## 5. Architecture and bounded contexts

| Context | Responsibility | Invariants |
| --- | --- | --- |
| Protocol client | Parse challenges, select terms, encode signatures/responses | Pinned v2 schema; CAIP identifiers |
| Payment orchestrator | Durable lifecycle and recovery | One state transition per idempotent operation |
| Policy engine | Allowlist, budgets, confirmation, fee ceilings | Runs before every spend/sign |
| Quote/routing | Provider normalization, route and fee calculation | Integer units; quote fully bound and expiring |
| Wallet execution | Approval, swap, EIP-3009 signing | No server-held payer key; output to payer |
| HTTP replay | Preserve original request safely | Never silently replay non-replayable or unsafe input |
| Receipt/reconciliation | Append-only attempts, transactions and outcomes | No mutable “settled” overwrite; no response body by default |
| Identity/metering | API keys, limits, attribution | Cannot authorize assets |
| Inventory treasury | Future float, exposure, replenishment | Double-entry ledger; segregated roles |
| AI gateway | Future model routing and inference accounting | Separate deployment/data plane from payments |
| Engineering control plane | Build-time SDLC orchestration | Never becomes a runtime payment agent |

The payment lifecycle is:

`challenged → quoted → swap_authorized → swap_submitted → swap_confirmed → payment_signed → resource_retried → settlement_observed → completed`

Terminal/recovery outcomes include `cancelled`, `quote_expired`, `swap_failed`,
`payment_rejected`, `resource_failed_after_swap`, `settlement_unknown`, and `manual_review`.
Each expensive operation has its own idempotency key; a single request-level key is insufficient.

### Optional AI plane

If approved, the realistic first AI gateway supports OpenAI direct and one
OpenAI-compatible endpoint. Anthropic is an abstraction-validation candidate, not an automatic
MVP promise. Model routing and payment enforcement are deterministic services. LLMs may assist
planning or evaluation but never decide settlement, price arithmetic, identity, policy, or
ledger transitions.

## 6. Requirements

### Functional

- Select compatible requirements from all advertised options using exact CAIP IDs.
- Reject unknown protocol versions, assets, networks, recipients, amounts, and expired terms.
- Bind quotes to payer and request; use integer atomic units and explicit decimal metadata.
- Validate balance, allowance, route target, function selector, output recipient, minimum output,
  maximum input, and quote expiry before execution.
- Preserve request semantics; reject non-replayable streams and unsafe redirect transitions.
- Provide idempotent recovery for process crashes and duplicate callbacks.
- Return receipts for both completed and partial outcomes with transaction links and actual fees.
- Never treat quote response, swap submission, or facilitator response as finality by itself.

### Security and privacy

- Defend hosted endpoint fetching against SSRF: HTTPS policy, DNS/IP checks, private/link-local
  and metadata denial, redirect revalidation, egress isolation, size/time limits.
- Strip or redact authorization, cookies, payment signatures, wallet material, and response data.
- Never accept opaque aggregator calldata without target, selector, allowance, token,
  minimum-output, and recipient validation.
- Use bounded allowances or permits; no unbounded approval by default.
- Separate deployer, operator, fee collector, treasury, and emergency roles.
- Keep payer keys client-side. Future service signers require MPC/HSM, transaction policy,
  rotation, rate/value limits, and break-glass evidence.
- Default retention: payment metadata and hashes only; no paid content.

### Reliability and performance

- Deterministic unit/property tests for amounts, decimals, fees, CAIP conversion, and nonces.
- Zero duplicate settlements under retry, timeout, concurrency, and worker-crash fault injection.
- 100% enforcement of maximum input/minimum output.
- Quote latency and payment completion measured separately by dependency segment. The source's
  sub-six-second target is a hypothesis to validate, not an SLA
  ([PRD lines 520–560](source/x402-universal-adapter-prd.md#L520-L560)).

## 7. Phased roadmap and gates

### Phase 0 — decisions and protocol proof

- Keep resolved D1–D8 and accepted ADRs consistent with executable behavior.
- Pin current x402 client/server packages and facilitator compatibility.
- Capture canonical wire fixtures for all three payment headers.
- Demonstrate a payer-funded USDC payment and a swap-output-to-payer payment.
- Confirm DEX fee-recipient mechanics and commercial terms.
- Complete custody, fee, sanctions, and money-transmission legal analysis.

**Gate:** executable end-to-end test against a reference merchant proves merchant-owned
verify/settle; approved ADRs define custody and product boundary.

### Phase 1 — sandbox vertical slice

- Monorepo/CI foundation and schema-versioned domain contracts.
- Protocol parser, state machine, policy engine, DEX mock, wallet mock, and receipt journal.
- Base Sepolia SDK flow and sandbox x402 merchant.
- SSRF, HTTP replay, idempotency, and failure-recovery suites.

**Gate:** one self-custodial end-to-end payment plus every terminal/recovery state demonstrated;
no real-value hot key or inventory.

### Phase 2 — capped Base MVP

- One production DEX adapter; qualified MVP tokens.
- Durable PostgreSQL journal and Redis locks/cache.
- Reconciliation, structured telemetry, API keys, metering, OpenAPI, and operator runbooks.
- Mainnet canaries with low per-operation and daily value limits.

**Gate:** at least 100 controlled payments per route, ≥99% completion, zero duplicate
settlements, exact receipt/on-chain reconciliation, and no unresolved critical/high findings.

### Phase 3 — hardening and distribution

- Second DEX adapter with conformance tests.
- MCP, LangChain, and AgentKit adapters over the canonical SDK.
- Webhooks, receipt exports, portal, and billing after metering correctness.
- Staged release, canary, rollback, incident automation, and published compatibility matrix.

**Gate:** SLOs met in canary; rollback and dependency-failure exercises pass.

### Phase 4 — account abstraction or contracts

Evaluate session keys/account abstraction for lower-interaction UX. A custom router proceeds
only if protocol compatibility, value flow, audit scope, upgrade policy, and failure recovery
are proven.

### Phase 5 — cross-chain inventory

Implement a separate treasury context, double-entry ledger, CCTP saga, finality policy,
replenishment, exposure limits, insolvency behavior, and human treasury approvals.

### Phase 6 — Lightning

Proceed only after legal classification, node security, liquidity, refunds, sanctions controls,
and jurisdictional operating policy are approved.

## 8. Dependencies

- Pinned x402 v2 packages, reference merchant, facilitator, and conformance fixtures.
- Base RPC providers with independent fallback and finality policy.
- Canonical USDC domain/contract data and CAIP registry.
- DEX API commercial access, fee-routing terms, calldata schemas, and rate limits.
- Wallet adapters capable of typed-data signing.
- PostgreSQL/Redis only when durable orchestration is introduced.
- GitHub, artifact registry, cloud, DNS, telemetry, KMS/secrets, and deployment identities.
- Independent appsec and contract review where value-moving code warrants it.
- Legal review before spread collection, inventory, Lightning, or hosted signer operation.
- Fresh primary-source market validation; August 2025 research is not current evidence.

## 9. Risk register

| Risk | Severity | Control/gate |
| --- | --- | --- |
| Wrong EIP-3009 ownership or settlement flow | Critical | Protocol proof before implementation |
| Duplicate charge from retries | Critical | Durable state machine and operation idempotency |
| SSRF/credential leakage via target URL | Critical | Egress policy, URL validation, header isolation |
| Malicious calldata or allowance theft | Critical | Decoding, allowlists, bounded approvals |
| Swap succeeds but resource fails | High | Output to payer, explicit recovery state |
| Key/inventory compromise | Critical | Excluded from MVP; later MPC, limits, segregation |
| Gas dominates micropayment | High | Route-level minimum economic size |
| Bridge/float insolvency | Critical | Separate ledger, exposure gates, stress testing |
| Regulatory classification | High | Counsel approval before custodial flows |
| Protocol/provider drift | High | Versioned adapters and conformance CI |
| Paid-content retention | High | Metadata-only default |
| AI nondeterminism in value movement | Critical | Deterministic runtime services only |

## 10. Contradictions and invalid claims

- PRD non-custody conflicts with pre-funded float/hot signer
  ([PRD lines 61–66](source/x402-universal-adapter-prd.md#L61-L66);
  [AGENTS lines 1232–1241](source/AGENTS.md#L1232-L1241)).
- Standard unchanged-server positioning conflicts with proposed server-side extended `accepts`
  middleware ([low-hanging-fruit lines 222–258](source/x402-low-hanging-fruit.md#L222-L258)).
- Package names conflict: `@upa/x402-client` versus `@anyx/sdk`
  ([PRD lines 158–166](source/x402-universal-adapter-prd.md#L158-L166);
  [AGENTS lines 536–598](source/AGENTS.md#L536-L598)).
- Phase names and Lightning dates conflict across the PRD, roadmap, marketing, and GTM.
- Fee schedules range from 0.05% to 0.75%, include both minimum/flat fees and “no flat fees”
  ([AGENTS lines 159–161](source/AGENTS.md#L159-L161);
  [llms lines 194–205](source/anyx-llms.txt#L194-L205)).
- 5% of $24M/month is $1.2M/month (~$40K/day), not $500K/day
  ([whitepaper lines 576–594](source/x402-universal-adapter-whitepaper.md#L576-L594)).
- $1M/month at 0.20% is $2K/month, not $2K/day
  ([PRD lines 608–620](source/x402-universal-adapter-prd.md#L608-L620)).
- $5M/month at 0.05–0.10% is roughly $83–$167/day, not $500–$3K/day
  ([low-hanging-fruit lines 14–34](source/x402-low-hanging-fruit.md#L14-L34)).
- “Zero competitors,” “first ever,” volume, and market-size claims are August 2025 assertions and
  require current primary-source verification
  ([market research lines 10–50](source/anyx-market-research.md#L10-L50);
  [marketing lines 54–90](source/anyx-marketing-social.md#L54-L90)).

## 11. Acceptance evidence

Every phase produces immutable:

- approved ADRs and threat-model delta;
- protocol/provider compatibility manifest;
- source, dependency lockfile, SBOM, provenance, signatures, and checksums;
- unit, property, integration, end-to-end, appsec, and fault-injection reports;
- reconciliation report for every value-moving test;
- deployment/canary/rollback record;
- human approval record where required.

No schedule or revenue forecast is an acceptance criterion. Progress is gated by reproducible
technical and operational evidence.
