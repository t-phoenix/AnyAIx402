# Decisions required

Status: MVP defaults resolved on 2026-08-25. Reversible engineering defaults are authorized for
implementation. Legal, commercial, and production-release decisions remain explicit gates.

## Decision register

| ID | Status | MVP decision or remaining gate |
| --- | --- | --- |
| D1 | Resolved for MVP | AnyX x402 payment-adapter kernel first; AI inference is a separate future plane. |
| D2 | Resolved for MVP | Self-custodial Base-only flow; swap output belongs to payer; payer signs. No AnyX wallet, float, bridge, Lightning, or treasury movement. |
| D3 | Resolved for MVP | x402 v2; resource server owns facilitator verify/settle; client never pre-settles. |
| D4 | Resolved for MVP | Disclosed fee-on-top using integer round-up; production default 20 bps, local/test 0, configurable cap; no onchain fee collection yet. |
| D5 | Resolved for MVP | Base canonical USDC settlement; native ETH/WETH and USDT acquisition inputs. cbBTC remains route-qualified follow-up. CAIP IDs and address allowlists are authoritative. |
| D6 | Resolved for MVP | Replay only explicitly replayable requests; append-only metadata/hashes; no arbitrary paid bodies or secrets by default. |
| D7 | Resolved for MVP | Public client package is `@anyx/sdk`; internal packages use `@anyx/*`. Publication still requires namespace/trademark checks. |
| D8 | Resolved for MVP | No custom value-moving contract. |
| D9 | Open external | DEX provider, route qualification, API terms, calldata guarantees, and fee mechanics. |
| D10 | Partially resolved | Public SDK/protocol packages use Apache-2.0. Repository-wide and hosted control-plane licensing await ownership/legal decisions. |
| D11 | Deferred | Hosted identity, metering, and billing. API keys must never grant wallet authority. |
| D12 | Deferred | AI inference gateway and provider scope are outside this milestone. |
| D13 | Resolved for MVP | Append-only payment/receipt metadata and hashes only; explicit approved retention period remains open. |
| D14 | Open external | Facilitator selection and conformance; no fallback before equivalent conformance. |
| D15 | Open external | Mainnet release requires service/security approval, legal readiness, low-value canary, and automatic stop controls. |
| D16 | Deferred/legal gate | Inventory and cross-chain movement are a separate custodial treasury product. |
| D17 | Deferred/legal gate | Lightning requires counsel, custody, liquidity, refund, sanctions, and jurisdiction decisions. |
| D18 | Deferred/business gate | Partner revenue share requires accounting, attribution, tax, sanctions, and payout controls. |

## Decision briefs

### D1 Product identity

**Conflict.** All nine sources center on a payment adapter. AI content covers integration with
agent frameworks, not inference
([AI integrations lines 12–18](source/anyx-ai-integrations.md#L12-L18)).
The repository name “AnyAIx402” may imply an inference gateway.

**Default.** Ship AnyX payment infrastructure. If inference is commercially required, maintain
separate AI gateway and payment planes with independent APIs, data, SLOs, deployments, and
security boundaries.

**Resolution.** Accepted for the MVP in
[ADR 0003](adr/0003-ai-payment-plane-separation.md). Product naming and future inference scope
remain business decisions.

### D2 Custody and signing

**Conflict.** The PRD excludes custody
([lines 61–66](source/x402-universal-adapter-prd.md#L61-L66)), while roadmap flows use a funded
float/hot signer ([AGENTS lines 1232–1241](source/AGENTS.md#L1232-L1241)). A server cannot pull
funds from a bare wallet address or sign for payer-owned USDC.

**Default.** Swap output goes to payer; payer signs EIP-3009. No server payer key, float, or
inventory in MVP.

**Resolution.** Accepted for the MVP in
[ADR 0001](adr/0001-self-custodial-base-mvp.md). Counsel must approve production claims and
operations; that gate does not require introducing custody.

### D3 x402 version and settlement ownership

**Conflict.** Historical sources use older/ambiguous header names and have AnyX call settlement
before resource retry ([AGENTS lines 353–397,443–474](source/AGENTS.md#L353-L474)).

**Default.** Pin current x402 v2 library/source commit and standard
`PAYMENT-REQUIRED`/`PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE` schemas. Merchant invokes verify and
settle. Use CAIP-2/CAIP-19.

**Resolution.** Accepted for the MVP in
[ADR 0002](adr/0002-merchant-owned-x402-settlement.md). Facilitator compatibility remains an
executable external conformance gate.

### D4 Fee formula and collection

**Conflict.** Sources specify 0.05–0.75%, 0.10–0.75%, default 0.20%, token schedules, minimum
fees, optional flat fees, and no flat fees
([AGENTS lines 14–16,159–161](source/AGENTS.md#L14-L16);
[llms lines 194–205](source/anyx-llms.txt#L194-L205)).

**Decision.** Configure one disclosed fee-on-top in basis points per qualified route. Production
configuration defaults to 20 bps; local/test fixtures use 0 bps. Enforce a configurable cap.
Define:

```text
requiredGrossUsdc = ceil(apiCostUsdc * 10_000 / (10_000 - feeBps))
feeUsdc = requiredGrossUsdc - apiCostUsdc
```

Use atomic integer units, disclose fee and rounding, and bind both into the quote. The MVP
calculates but does not move or collect this fee onchain. No minimum or flat fee initially.

**Blocking proof.** Property tests, legal classification, DEX commercial terms, and
reconciliation.

### D5 MVP tokens and routes

**Conflict.** “Any ERC-20” is not safe: fee-on-transfer, rebasing, malicious and illiquid tokens
violate assumptions. Token and phase lists conflict across source files.

**Decision.** Canonical Base USDC is settlement. Native ETH/WETH and USDT are first acquisition
inputs. Add cbBTC only after allowance, recipient, liquidity, price-impact, gas, and failure
tests. Registry is CAIP/address based, never symbol based.

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

**Decision.** Use `@anyx/sdk` for the public client and `@anyx/*` for internal packages.
Publishing remains conditional on npm namespace and trademark checks.

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

**Decision.** Apache-2.0 for public SDK and protocol packages. Do not add a repository-wide
license until ownership and legal status are clear. Hosted-service licensing, contribution
policy, dependency review, and trademark review remain open.

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
