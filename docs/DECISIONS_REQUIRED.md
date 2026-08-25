# Decisions required

Status: open. Priority order is intentional. Implementation beyond protocol spikes is blocked
until the applicable decision is approved and its ADR marked accepted.

## Decision register

| ID | Priority | Decision | Recommended default | Blocking impact |
| --- | --- | --- | --- | --- |
| D1 | P0 | Product identity | AnyX payment adapter first; reserve AnyAI gateway as a separate plane/product | Blocks scope, naming, architecture, APIs, staffing, GTM |
| D2 | P0 | Custody and signing | Self-custodial: swap output to payer; payer signs EIP-3009 | Blocks value flow, wallet API, contracts, legal model |
| D3 | P0 | x402 version and settlement owner | Pin current v2; merchant owns verify/settle | Blocks wire protocol, state machine, facilitator integration |
| D4 | P0 | Fee formula and collection | One disclosed bps fee, integer round-up, no minimum/flat fee initially | Blocks quotes, execution, receipts, economics |
| D5 | P0 | MVP tokens/routes | Base USDT and WETH first; qualify cbBTC/native ETH by execution tests | Blocks token registry, DEX scope, acceptance suite |
| D6 | P0 | HTTP replay and data handling | Preserve replayable request; metadata-only storage; strict SSRF/redirect policy | Blocks SDK/API and privacy controls |
| D7 | P0 | Package/product naming | `@anyx/sdk` and AnyX payment terminology pending trademark/npm checks | Blocks public API and publishing |
| D8 | P0 | Contract necessity | No custom value-moving contract in MVP | Blocks audit/deployment scope |
| D9 | P1 | DEX provider and commercial terms | One provider behind interface; second after conformance | Blocks production quote/execution adapter |
| D10 | P1 | Licensing/open-core boundary | Apache-2.0 SDK/specs; hosted control plane separately licensed if needed | Blocks repository headers, contributions, partner promises |
| D11 | P1 | Identity, metering, and billing | API keys meter hosted services, never wallet authority; billing post-MVP | Blocks hosted API account model |
| D12 | P1 | AI gateway provider scope | If approved: OpenAI direct + OpenAI-compatible; Anthropic validates abstraction later | Blocks inference API and provider adapters |
| D13 | P1 | Retention and observability | Payment metadata/hashes only; no paid bodies or prompts by default | Blocks schemas, logs, privacy notice |
| D14 | P1 | Facilitator fallback | One pinned facilitator initially; add fallback only with equivalent conformance | Blocks production resilience claims |
| D15 | P1 | Mainnet release authority | Human service + security approval, low-value canary, automatic stop | Blocks production deployment |
| D16 | P2 | Inventory/cross-chain business | Separate custodial treasury product with double-entry ledger | Blocks CCTP/float work |
| D17 | P2 | Lightning/legal jurisdiction | Do not build until counsel, liquidity, refund, sanctions and custody model approved | Blocks BTC/Lightning |
| D18 | P2 | Partner revenue share | Defer; define ledger, attribution, tax, sanctions and payout approvals first | Blocks partner settlement |

## Decision briefs

### D1 Product identity

**Conflict.** All nine sources center on a payment adapter. AI content covers integration with
agent frameworks, not inference
([AI integrations lines 12–18](source/anyx-ai-integrations.md#L12-L18)).
The repository name “AnyAIx402” may imply an inference gateway.

**Default.** Ship AnyX payment infrastructure. If inference is commercially required, maintain
separate AI gateway and payment planes with independent APIs, data, SLOs, deployments, and
security boundaries.

**Approval needed.** Product owner and lead architect. Record in
[ADR 0003](adr/0003-ai-payment-plane-separation.md).

### D2 Custody and signing

**Conflict.** The PRD excludes custody
([lines 61–66](source/x402-universal-adapter-prd.md#L61-L66)), while roadmap flows use a funded
float/hot signer ([AGENTS lines 1232–1241](source/AGENTS.md#L1232-L1241)). A server cannot pull
funds from a bare wallet address or sign for payer-owned USDC.

**Default.** Swap output goes to payer; payer signs EIP-3009. No server payer key, float, or
inventory in MVP.

**Approval needed.** Product, payments, security, and legal. Record in
[ADR 0001](adr/0001-self-custodial-base-mvp.md).

### D3 x402 version and settlement ownership

**Conflict.** Historical sources use older/ambiguous header names and have AnyX call settlement
before resource retry ([AGENTS lines 353–397,443–474](source/AGENTS.md#L353-L474)).

**Default.** Pin current x402 v2 library/source commit and standard
`PAYMENT-REQUIRED`/`PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE` schemas. Merchant invokes verify and
settle. Use CAIP-2/CAIP-19.

**Approval needed.** Protocol specialist and lead architect after executable conformance proof.
Record in [ADR 0002](adr/0002-merchant-owned-x402-settlement.md).

### D4 Fee formula and collection

**Conflict.** Sources specify 0.05–0.75%, 0.10–0.75%, default 0.20%, token schedules, minimum
fees, optional flat fees, and no flat fees
([AGENTS lines 14–16,159–161](source/AGENTS.md#L14-L16);
[llms lines 194–205](source/anyx-llms.txt#L194-L205)).

**Default.** Configure one fee in basis points per qualified route. Define:

```text
requiredGrossUsdc = ceil(apiCostUsdc * 10_000 / (10_000 - feeBps))
feeUsdc = requiredGrossUsdc - apiCostUsdc
```

Use atomic integer units, disclose fee and rounding, bind both into the quote, and validate how
the DEX route realizes the fee before launch. No minimum or flat fee initially.

**Blocking proof.** Property tests, legal classification, DEX commercial terms, and
reconciliation.

### D5 MVP tokens and routes

**Conflict.** “Any ERC-20” is not safe: fee-on-transfer, rebasing, malicious and illiquid tokens
violate assumptions. Token and phase lists conflict across source files.

**Default.** Base USDT and WETH launch candidates. Add cbBTC and native ETH only after allowance,
recipient, liquidity, price-impact, gas, and failure tests. Registry is address/CAIP based, not
symbol based.

### D6 HTTP replay and data handling

**Conflict.** Most APIs accept only `endpointUrl`, while examples include GET/POST without
defining body replay, credentials, redirects or side effects
([AI integrations lines 211–269](source/anyx-ai-integrations.md#L211-L269)).

**Default.** SDK performs client-side request replay. Hosted fetch is opt-in and egress isolated.
Reject non-replayable streams; do not retain resource bodies. Bind request fingerprint to quote.

### D7 Package identity

**Conflict.** PRD uses `@upa/x402-client`
([lines 158–166](source/x402-universal-adapter-prd.md#L158-L166)); roadmap uses `@anyx/sdk`
([AGENTS lines 536–598](source/AGENTS.md#L536-L598)).

**Default.** Use `@anyx/sdk`, `@anyx/mcp-server`, and integration-specific packages if npm,
domain, organization, and trademark checks succeed. Keep class name provisional until D1.

### D8 Contract necessity

**Conflict.** Custom router promises atomic swap/payment but its ownership/signature flow is
invalid ([AGENTS lines 643–709](source/AGENTS.md#L643-L709)).

**Default.** No custom contract in MVP. Reassess only after protocol proof and wallet UX data.
Any contract requires a value-flow specification, immutable/upgrade decision, audit, tests,
admin-role policy, and recovery model.

### D9 DEX provider

**Default.** Choose one provider based on current API, Base route quality, fee-recipient support,
calldata transparency, terms, quotas, and reliability. Keep a versioned provider interface.
Do not claim fallback until equivalent behavior is conformance-tested.

### D10 Licensing

**Conflict.** Sources claim Apache-2.0 and also suggest proprietary/dual-licensed hosted routing
([llms lines 207–212](source/anyx-llms.txt#L207-L212);
[low-hanging-fruit lines 352–389](source/x402-low-hanging-fruit.md#L352-L389)).

**Default.** Apache-2.0 for SDK, schemas, and examples; separately decide hosted-service license
and contribution policy. Complete dependency and trademark review.

### D11 Identity and billing

**Default.** Hosted API keys identify and meter customers; they do not authorize wallet
transactions. Defer Stripe until usage/reconciliation correctness. Decide whether quote API is
free, subscription-funded, or x402-paid only after abuse/economics testing.

### D12 AI gateway providers

**Default.** If D1 includes inference, implement OpenAI direct and one OpenAI-compatible provider.
Use Anthropic only to test whether the provider abstraction is genuinely portable. Routing,
budgeting and payment enforcement remain deterministic.

### D13 Retention

**Default.** Store challenge/request hashes, CAIP IDs, public addresses, quote components,
transaction hashes, state events, and reconciliation metadata for an approved period. Never
store private keys, signatures beyond operational need, cookies, authorization headers, paid
content, or inference prompts/responses by default.

### D14 Facilitator fallback

**Default.** One known-compatible facilitator for MVP. A fallback must pass the same pinned wire,
failure, finality, authentication and receipt conformance suite. User-configurable URLs are not
allowed in hosted infrastructure without SSRF controls.

### D15 Release authority

**Default.** Staging is automated after independent checks. Production requires service and
security humans bound to commit/artifact digest. Payment canary has hard per-payment/daily caps;
one duplicate settlement stops promotion.

### D16 Inventory and cross-chain

**Default.** Treat as a separate balance-sheet product. Require double-entry accounting,
liabilities/assets/revenue accounts, source finality, exposure and counterparty limits,
replenishment, insolvency/refund behavior, reconciliation, signer segregation, and legal approval.

### D17 Lightning

**Default.** Deferred. The source acknowledges custody uncertainty
([PRD lines 726–731](source/x402-universal-adapter-prd.md#L726-L731)). Counsel must decide
jurisdictions and obligations before node or reserve implementation.

### D18 Partner revenue share

**Default.** Deferred until partner authentication, attribution integrity, accounting, tax,
sanctions screening, settlement thresholds, disputes, and two-person payout approvals exist.

## Invalid assumptions that decisions must not inherit

- AnyX cannot sign a payer's EIP-3009 authorization merely because it knows the wallet address.
- A contract cannot hold the described hot private key.
- End-to-end HTTP resource delivery and blockchain swap are not one atomic transaction.
- “Any ERC-20,” “zero competitors,” current market volume, and first-mover claims are unverified.
- Financial projections contain arithmetic errors; see
  [Build plan §10](BUILD_PLAN.md#10-contradictions-and-invalid-claims).
- Timeline labels in historical sources are not commitments or acceptance gates.
