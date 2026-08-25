  PRD — Universal x402 Multi-Token Payment Adapter

# Product Requirements Document

Universal x402 Multi-Token Payment Adapter (UPA)

**Status:** Draft v1.0  
**Date:** August 2025  
**Audience:** Engineering, Product, Investors

1

## Vision & Goals

**Product Vision:** Any entity holding any digital asset — BTC, ETH, USDT, SOL, or any ERC-20 — should be able to pay any x402-gated API or service without manually swapping tokens first. The Universal x402 Adapter makes this happen transparently, in one interaction, while earning a swap spread on every non-USDC payment routed.

### Goals

#

Goal

Success Metric

G1

Enable any ERC-20 token holder to pay x402 APIs on Base

ETH, USDT, WBTC, WETH supported at launch

G2

Enable BTC holders (Lightning) to pay x402 APIs

Lightning invoice → x402 receipt in <10 sec

G3

Zero protocol changes to x402 servers

Works with all existing x402 APIs without server modification

G4

Generate revenue from swap spread

\>0.15% blended margin; >$1K/day within 90 days of launch

G5

Drop-in SDK for developers

TypeScript SDK: <10 lines to integrate; npm install, done

G6

Security: no loss of user funds from adapter bugs

Audit complete before mainnet; slippage revert enforced

### Non-Goals (v1.0)

-   Changing the x402 server-side protocol or `accepts` array structure
-   Supporting fiat (credit card, bank transfer) as input — crypto only
-   Acting as a custodial wallet or storing user funds
-   Supporting NFTs or non-fungible assets as payment input

---

2

## User Personas

Persona

Profile

Assets

Pain Today

**The AI Agent**

Autonomous agent (LLM-based) that calls paid APIs for data, compute, or tools

Whatever the agent wallet holds — often ETH or protocol tokens

Must maintain USDC reserve; complex wallet management

**The DeFi Developer**

Building dApps; familiar with wallets, DEXes; doesn't want to manage USDC specifically

ETH, WBTC, governance tokens

Wants to pay x402 APIs without manual token swaps in their CI/CD pipeline

**The Bitcoin Holder**

Native BTC maximalist; may use Lightning but avoids EVM complexity

BTC (on-chain), Satoshis (Lightning)

Completely excluded from x402 ecosystem today

**The Solana-Native User**

Active in Solana DeFi; holds SOL, JUP, USDT (SPL)

SOL, SPL tokens, USDC on Solana

x402 requires Base USDC; must bridge manually

**The Enterprise Integrator**

Engineering team integrating x402 payments into a product; manages treasury in mixed assets

USDT, USDC, ETH across multiple chains

Treasury optimization; can't lock all liquid assets in USDC on Base

---

3

## User Stories

P0 US-001 — ETH → x402 Payment

_As an AI agent holding ETH on Base, I want to call a paid x402 API endpoint so that I don't need to separately acquire USDC._

**Acceptance Criteria** ✓ Agent calls UPA with: endpoint URL + ETH amount budget  
✓ UPA intercepts 402 challenge and parses required USDC amount  
✓ UPA swaps ETH → USDC on Base via DEX aggregator (≥ required amount)  
✓ UPA signs EIP-3009 authorization and submits to facilitator  
✓ Agent receives 200 OK response + resource within 5 seconds  
✓ ETH not spent if swap slippage would result in insufficient USDC

P0 US-002 — USDT (ERC-20) → x402 Payment

_As a developer holding USDT on Ethereum/Base, I want to pay x402 APIs without bridging or swapping first._

**Acceptance Criteria** ✓ USDT on Base: direct swap USDT→USDC via Curve/1inch (lowest slippage path)  
✓ USDT on Ethereum: bridge via Stargate to Base, then swap, all in one SDK call  
✓ Total latency for USDT on Ethereum path: <3 minutes  
✓ Slippage protection enforced; transaction reverts if rate degrades beyond tolerance

P1 US-003 — Lightning BTC → x402 Payment

_As a Bitcoin Lightning user, I want to pay for x402-gated API calls using satoshis so that I can participate in the machine-payment economy._

**Acceptance Criteria** ✓ UPA generates a Lightning invoice sized to cover required USDC + fee + spread  
✓ User pays Lightning invoice via any LN wallet  
✓ UPA receives payment, acquires USDC from reserve pool, submits EIP-3009 auth  
✓ API response returned within 10 seconds of Lightning settlement  
✓ Invoice expires after 300 seconds (matching x402 maxTimeoutSeconds)

P1 US-004 — SDK Drop-in for Node.js

_As a developer, I want to replace my existing fetch() calls with upa.fetch() so that my app automatically handles multi-token x402 payments._

**Acceptance Criteria** ✓ `npm install @upa/x402-client`  
✓ `const upa = new UPA({ wallet, preferredToken: 'ETH', maxSlippage: 0.005 })`  
✓ `const res = await upa.fetch('https://api.example.com/data')`  
✓ All 402 handling, swap, and auth is internal — developer never sees USDC logic  
✓ SDK emits events for payment amounts and tx hashes (for logging/auditing)

P1 US-005 — Quote Before Pay

_As a payer, I want to see the exact token amount I'll spend (in ETH/BTC/USDT) before my payment is submitted._

**Acceptance Criteria** ✓ `upa.quote(endpoint, { token: 'ETH' })` returns: ETH cost, USDC equivalent, fee, slippage estimate  
✓ Quote is valid for 30 seconds (bound to DEX quote freshness)  
✓ `upa.fetch(endpoint, { useQuote: quote })` executes at quoted rate ± tolerance

P2 US-006 — Solana SOL → x402 on Base

_As a Solana-native agent, I want to pay x402 APIs that settle on Base using SOL or SPL tokens._

**Acceptance Criteria** ✓ Jupiter aggregator used to swap SOL/SPL → USDC on Solana  
✓ Circle CCTP bridges USDC Solana → USDC Base  
✓ UPA float pool fronts USDC on Base immediately; CCTP replenishes async  
✓ Total latency with float: <5 seconds; without float: <10 minutes

P2 US-007 — Fee Transparency

_As a payer, I want to see an itemized breakdown of what I'm paying (swap cost, adapter fee, gas) before and after each payment._

**Acceptance Criteria** ✓ UPA emits a `PaymentReceipt` object after each payment:  
  • inputToken, inputAmount  
  • usdcEquivalent (at time of payment)  
  • apiCost (USDC sent to provider)  
  • adapterFee (USDC or bps)  
  • gasEstimate  
  • txHash, blockNumber  
✓ Receipt is human-readable JSON and can be exported as CSV

---

4

## Functional Requirements

### FR-1: Token Support Matrix

Token

Chain

Phase

Swap Path

Priority

USDT (ERC-20)

Base

1

USDT→USDC via Curve/1inch

P0

ETH / WETH

Base

1

WETH→USDC via Uniswap V3

P0

WBTC

Base / Ethereum

1

WBTC→USDC via 1inch

P0

cbBTC

Base

1

cbBTC→USDC via Aerodrome

P0

Any ERC-20

Base

1

Token→USDC via 0x/1inch routing

P1

ETH

Ethereum

2

ETH→USDC on Ethereum → CCTP bridge

P1

USDT (ERC-20)

Ethereum

2

Stargate bridge → USDC on Base

P1

SOL

Solana

2

Jupiter swap → CCTP bridge

P1

BTC (Lightning)

Bitcoin L2

3

LN → reserve pool → USDC

P2

USDT (TRC-20)

Tron

3

Cross-chain swap via aggregator

P2

### FR-2: Slippage Control

-   Default max slippage: 0.5% (configurable per-call)
-   On-chain `minAmountOut` enforced in `SwapAndAuthorize.sol`
-   Transaction reverts if USDC received < required; no partial payments
-   Client-side pre-check: abort if DEX quote shows > configured slippage before signing

### FR-3: Facilitator Failover

-   Primary: Coinbase CDP facilitator
-   Secondary: Self-hosted qntx/facilitator (Rust)
-   Automatic failover within 2 seconds if primary returns 5xx
-   User-configurable facilitator list

### FR-4: Gas Handling

-   Adapter estimates gas cost in ETH before execution
-   Phase 1: User pays gas in ETH (standard)
-   Phase 4: ERC-4337 Paymaster allows gas payment in input token
-   Gas cost included in quote output

### FR-5: Payment Receipts

Every successful payment emits a `PaymentReceipt` struct:

```
{
  "receiptId": "uuid-v4",
  "timestamp": "ISO-8601",
  "endpoint": "https://api.example.com/v1/resource",
  "inputToken": "WETH",
  "inputTokenAddress": "0x4200...0006",
  "inputAmount": "0.0004214",          // in token units
  "inputAmountUSD": "1.0023",          // USD equivalent at time of swap
  "apiCostUSDC": "1.000",             // amount sent to API provider
  "adapterFeeUSDC": "0.002",          // UPA spread fee
  "swapSlippage": "0.0012",           // actual slippage experienced
  "txHash": "0x...",
  "blockNumber": 22891234,
  "facilitator": "https://api.cdp.coinbase.com/...",
  "xPaymentResponse": "base64-encoded-settlement-receipt"
}
```

---

5

## Technical Architecture

### 5.1 SDK Layer (@upa/x402-client)

TypeScript package. Wraps native fetch. Handles all 402 logic invisibly.

```
// Public API surface
class UPA {
  constructor(config: UPAConfig)

  // Core methods
  fetch(url: string, options?: UPAFetchOptions): Promise<Response>
  quote(url: string, options: QuoteOptions): Promise<PaymentQuote>

  // Event hooks
  on('payment', handler: (receipt: PaymentReceipt) => void): void
  on('swap', handler: (swapEvent: SwapEvent) => void): void
  on('error', handler: (err: UPAError) => void): void
}

interface UPAConfig {
  wallet: WalletClient               // viem WalletClient or ethers Signer
  preferredTokens: TokenConfig[]     // ordered preference list
  maxSlippage?: number               // default 0.005 (0.5%)
  maxFeePercent?: number             // max acceptable adapter fee
  facilitators?: string[]            // custom facilitator URLs
  floatPool?: string                 // USDC float pool address (for cross-chain)
  dexPriority?: DEXType[]            // '1inch' | '0x' | 'uniswap' | 'kyberswap'
}
```

### 5.2 Smart Contract Layer (Base mainnet)

Contract

Size

Upgradeability

Audit Required

`UPA_Router.sol`

~300 LOC

Transparent proxy (UUPS)

Yes — before mainnet

`SwapExecutor.sol`

~200 LOC

Immutable (per DEX version)

Yes

`FeeCollector.sol`

~100 LOC

Owned (admin withdraw)

Yes

`ReservePool.sol`

~150 LOC

Owned + multisig

Yes

`UPA_Paymaster.sol`

~200 LOC

Owned (Phase 4)

Yes (Phase 4)

### 5.3 Backend Services

Service

Function

Stack

Quote API

Aggregates DEX quotes, applies fee, returns user-facing quote

Node.js / Bun, Redis cache (30s TTL)

Lightning Node

Receives BTC LN payments, triggers reserve pool drawdown

LND or Core Lightning, Go service

Bridge Monitor

Watches CCTP cross-chain transfers; triggers reserve replenishment

Node.js, Viem event listeners

Receipt Store

Persists PaymentReceipt objects; queryable by user/agent

PostgreSQL, REST + webhook

Hot Signer

Signs EIP-3009 authorizations post-swap (MPC-protected)

Turnkey or Lit Protocol MPC

### 5.4 API Endpoints (UPA Backend)

POST /v1/quote

Get swap quote for a given x402 endpoint and input token. Returns estimated token cost, fee breakdown, and quote validity window.

POST /v1/pay

Execute a multi-token x402 payment. Performs swap, signs EIP-3009 auth, submits to facilitator, returns PaymentReceipt.

GET /v1/receipt/{receiptId}

Retrieve a payment receipt by ID. Includes on-chain tx hash, finality status, and itemized cost breakdown.

GET /v1/tokens

List all supported input tokens with their contract addresses, chains, and estimated swap cost to USDC.

POST /v1/lightning/invoice

Generate a Lightning Network invoice for a given x402 endpoint. Returns BOLT-11 invoice + expiry. BTC-only.

---

6

## Launch Acceptance Criteria (Phase 1)

Phase 1 is "launched" when all P0 criteria below pass on Base mainnet.

Criteria

Threshold

Measurement

ETH → USDC x402 payment success rate

≥ 99.0%

100 test payments on mainnet

USDT (Base) → USDC x402 payment success rate

≥ 99.5%

100 test payments

Payment-to-resource latency (EVM tokens on Base)

< 6 seconds

p95 over 50 runs

Slippage revert on exceeded tolerance

100% revert

Simulated adversarial test

No user funds at risk on smart contract failure

100% return

Static analysis + unit tests

SDK npm install + integration test

≤ 10 lines integration

Integration test with live x402 API

PaymentReceipt accuracy

All fields populated, amounts match on-chain

Cross-check against tx logs

Security audit completed

No critical/high findings unresolved

Audit report published

---

7

## Milestones & Timeline

#### M0 — Revenue Start (Week 2)

TypeScript SDK with off-chain swap quoting. Manual USDC pre-acquisition path. ETH→USDC on Base. 0.20% fee. First dollar earned.

#### M1 — EVM Adapter Live (Week 8)

SwapAndAuthorize.sol deployed. Permit2 integration. USDT/ETH/WBTC/cbBTC on Base. Audit complete. npm package published.

#### M2 — Cross-Chain (Week 14)

Circle CCTP integration. Solana SPL → Base USDC. USDC float pool live. Stargate bridge for USDT on Ethereum.

#### M3 — Lightning & BTC (Week 20)

LND node running. Lightning invoice → USDC settlement. cbBTC reserve pool. THORChain integration for native BTC on Ethereum.

#### M4 — Account Abstraction (Week 28)

ERC-4337 Paymaster deployed. Safe module available. Gasless multi-token payments. Enterprise SDK (Go, Python) published.

#### M5 — Protocol Proposal (Month 7+)

Submit x402 multi-token extension EIP to x402-foundation. UPA as reference implementation. Position as protocol-layer infrastructure.

---

8

## Success Metrics

### North Star Metric

Monthly USDC volume routed through the adapter (from non-USDC input tokens).

### 90-Day Targets

Volume Routed

$1M+

monthly non-USDC x402 payments

Revenue

$2K+

per day from swap spread

SDK Installs

500+

unique npm installs

Success Rate

99%+

payment completion

Tokens Supported

10+

ERC-20 + BTC + SOL

### 1-Year Targets

Monthly Volume

$50M+

non-USDC routed

Annual Revenue

$1M+

from spread + fees

Integrations

50+

apps/agents using UPA

---

9

## Risks & Mitigations

Risk

Likelihood

Impact

Mitigation

x402 protocol adds native multi-token support

Low (6–12 mo)

High (reduces adapter value)

Position UPA as the reference implementation; contribute the proposal ourselves

DEX aggregator API breaks or changes

Medium

Medium (swap failures)

Multi-DEX failover (1inch → 0x → Uniswap direct)

Smart contract exploit / bug

Low (post-audit)

Critical

Audit before mainnet; bug bounty; upgrade proxy for quick patches

Circle CCTP bridge downtime

Low

Medium (cross-chain flows)

Stargate/Connext as CCTP fallback for cross-chain flows

Low adoption (USDC-native x402 is good enough)

Medium

Medium

Actively target BTC community and Solana-native developers who are currently excluded

Regulatory scrutiny on swap fees

Low

Low-Medium

Fee is disclosed, transparent, similar to any DEX aggregator; not money transmission

---

10

## Open Questions

1.  **Hot signer custody model:** Should the EIP-3009 authorization signer be fully MPC (e.g. Turnkey), or can a simpler HSM-backed key work for Phase 1? Risk vs. implementation complexity tradeoff.
2.  **Float pool sizing for cross-chain:** How large should the Base USDC float pool be to handle Solana → Base demand without running dry? Requires demand forecasting before Phase 2.
3.  **Lightning BTC custody:** The LN node receives sats and must acquire USDC. Is this custodial? Does it require MSB registration in the US?
4.  **DEX aggregator IP risk:** 1inch and 0x APIs have rate limits and ToS. Should we run our own aggregator (integrate pool contracts directly) or rely on their APIs under commercial terms?
5.  **Protocol extension proposal timing:** Submit to x402-foundation early (before Phase 4) to stake ground, or wait until we have volume to demonstrate the market need?

Universal x402 Adapter — PRD v1.0 — August 2025 — For internal review and investor discussion