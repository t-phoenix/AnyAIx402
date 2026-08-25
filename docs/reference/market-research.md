  AnyX — Market Research Report

Market Research · August 2025

# AnyX Market Research:  
_The Multi-Token x402 Opportunity_

Competitive landscape, demand signals, market sizing, and strategic positioning for AnyX — the universal multi-token x402 payment adapter.

Executive Summary

## The Verdict: Zero Competitors, Clear Demand

**No universal multi-token x402 adapter exists.** Every x402 endpoint across the ecosystem — 2,000+ transactions, 22,000+ sellers, 94,000+ buyers — accepts exclusively USDC on Base. Any token holder using ETH, BTC, USDT, or SOL must manually acquire USDC before accessing the ecosystem. AnyX is the first product to solve this gap.

x402 Monthly Volume

$24M

All USDC. All Base. Aug 2025.

Active Buyers

94K

Unique wallets paying x402

Multi-Token Adapters

0

Confirmed after full ecosystem scan

Addressable Market

~$1T

Non-USDC crypto assets needing x402 access

AI Agent Frameworks

12+

With crypto wallet support, all USDC-only

Time to First Revenue

2 wks

SDK + Quote API only, no contracts

---

Section 1

## The x402 Ecosystem Today

### Protocol Adoption (August 2025)

x402 has achieved meaningful traction since its launch, with the following confirmed metrics from the x402.org protocol dashboard and AgentCash scan of live endpoints:

Metric

Value

Source

Monthly transaction volume

$24.24M USD

x402.org, Aug 2025

Monthly transactions

75.41M

x402.org, Aug 2025

Active buyers (30 days)

94,000

x402.org

Active sellers (30 days)

22,000

x402.org

Protocol version

x402 v2

x402-foundation/x402

Primary settlement chain

Base (eip155:8453)

100% of scanned APIs

Settlement token

USDC (0x8335...913)

100% of scanned APIs

Solana support

<5% of endpoints

AgentCash catalog scan

### Token Distribution (Confirmed by API Scan)

Token

% of x402 Endpoints

Notes

USDC (Base)

95%+

Universal. The only option at most APIs.

USDC (Solana)

~5%

Growing but separate facilitator flow

ETH

0%

Not supported anywhere as payment input

USDT

0%

Not supported despite being largest stablecoin

BTC

0%

Completely excluded

Any other ERC-20

0%

No adapter exists

### Largest x402 API Platforms by Volume

Platform

Transactions

Unique Wallets

Volume

Category

x402helper.xyz

996

147

$28.92

API aggregator

Intel API (hugen.tokyo)

339

41

$26.87

Crypto intelligence

The Stall (IntuiTek)

313

86

$13.18

Multi-tool

OnchainExpat

166

32

$44.45

On-chain data

Solana x402 API

135

3

$10.13

Solana data

Apify x402

11

6

$16.00

Web scraping

Note: These are early-stage numbers. x402.org's aggregate of $24M/month is from a broader set including higher-volume B2B APIs not visible in AgentCash catalog.

---

Section 2

## Competitive Landscape

No direct competitor to AnyX exists. The closest adjacent products are categorized below.

### Category 1: x402 Native (USDC-Only)

#### Coinbase AgentKit Biggest Player

**What it is:** Official Coinbase SDK for AI agents. Manages CDP wallets. Native x402 support on Base and Solana.

**Token support:** USDC only. No multi-token capability.

**Wallet model:** Custodial CDP wallet (not self-custody)

**x402 model:** Direct EIP-3009 signing; no swap layer

Not a competitor — AgentKit is the demand source. AI agents built on AgentKit would use AnyX to pay from non-USDC holdings. **Integration opportunity, not competition.**

#### PayanAgent Marketplace Marketplace

**What it is:** Open marketplace where AI agents hire each other, paid in USDC via x402 on Base.

**Token support:** USDC only

Not a competitor — AnyX could integrate as a payment module for PayanAgent, enabling agents with non-USDC to participate.

#### x402helper.xyz Aggregator

**What it is:** API aggregator with x402 micropayments. 996 transactions, most active x402 endpoint.

**Token support:** USDC only. Does offer USDC→ERC-20 swap as a service (paying to swap), not the reverse.

Not a competitor — They route API calls; AnyX routes payment tokens. Could partner: integrate AnyX for non-USDC payers.

### Category 2: Multi-Token Payment Processors (Not x402)

#### Request Network Adjacent

**What it is:** Payer-token agnostic B2B payment rails. Payer sends any token; recipient receives their preferred currency. Protocol handles swap/bridge.

**Gap vs. AnyX:** Not x402 protocol. Different HTTP flow. No machine-native payment headers. Not designed for API-per-call micropayments.

Indirect competition — proves the market concept. AnyX is the x402-specific version of this idea.

#### BTCPay Server / Bitcart Traditional Crypto Payments

**What it is:** Self-hosted multi-token merchant payment processors. Support BTC, ETH, USDT, and 50+ coins.

**Gap vs. AnyX:** Session/checkout-based (not HTTP 402). Not machine-to-machine. Not micropayment-native. High per-transaction overhead.

Not relevant — Different use case entirely.

#### Lightning Network (L402 / LSAT) BTC Native Alternative

**What it is:** HTTP 402-style micropayments using Lightning Network invoices. L402 is the Bitcoin-native version of x402's concept.

**Gap vs. AnyX:** L402 and x402 are separate protocols. L402 is BTC-only. x402 is the dominant/growing standard (75M+ monthly transactions vs. L402's minimal adoption).

Integration opportunity — AnyX Phase 3 Lightning support bridges L402 users into x402 ecosystem.

### Category 3: DEX Aggregators (Infrastructure, Not Products)

1inch, 0x, KyberSwap, Jupiter (Solana) are DEX aggregators — the infrastructure AnyX uses, not products competing with AnyX. They solve "best swap price" not "pay x402 with any token."

### Competitive Matrix

Product

x402 Native

Multi-Token

Machine Payments

Swap Layer

BTC

**AnyX**

Yes

Yes

Yes

Yes

Phase 3

Coinbase AgentKit

Yes

No

Yes

No

No

Request Network

No

Yes

No

Yes

No

L402 / LSAT

No

No

Yes

No

Yes

PayanAgent

Yes

No

Yes

No

No

BTCPay Server

No

Yes

No

No

Yes

---

Section 3

## AI Agent Payment Market

### AI Agent Frameworks: Crypto Wallet Status

Framework

Crypto Wallet

Tokens

x402 Support

AnyX Integration

**Coinbase AgentKit**

Yes (CDP MPC)

USDC only

Native

High priority

**ElizaOS**

Yes (plugin)

Limited

Via plugin

High priority

**LangChain**

Via integrations

Depends on integration

No native

Tool/plugin

**CrewAI**

No native

N/A

No

Custom tool

**AutoGen (Microsoft)**

No native

N/A

No

Custom function

**Franklin (BlockRunAI)**

Yes (USDC wallet)

USDC on Base/Solana

Yes

Drop-in UPA

**Daydreams AI**

Yes (Commerce SDK)

x402 + A2A

Yes

SDK integration

**OpenAI Agents SDK**

No native

N/A

No

Function calling

### Market Size Estimates

**Data caveat:** The AI agent payment market is nascent. Numbers below are derived from x402 ecosystem data and industry reports. Treat as directional, not definitive.

Metric

Current (Aug 2025)

12-Month Projection

Source/Method

x402 daily transaction volume

~$800K/day

$5M–$10M/day

$24M/mo ÷ 30 days

Active AI agent wallets

~100–500 confirmed

10,000–50,000

Unique wallet counts on top platforms

Non-USDC crypto value held by AI agents

Unknown, likely <$1M

$100M–$1B+

Agent treasury fragmentation trend

Developer demand for multi-token x402

Unquantified

High (by lack of solution)

Zero competitor = unmet demand

AnyX addressable volume (5% of x402)

$40K/month

$250K–$1M/month

Conservative capture estimate

### Demand Signals

-   **Structural demand:** AI agents are deployed with diverse treasuries (ETH, protocol tokens, DAO allocations). Requiring USDC specifically creates operational overhead.
-   **Workaround evidence:** Developers pre-bridge assets manually before using x402. This is a known pain point in the community.
-   **BTC exclusion:** The Bitcoin community ($1.8T market cap) has zero path to x402 today. Any solution here unlocks a completely new user segment.
-   **Enterprise adoption ceiling:** Enterprises with treasury in USDT (Tron/Ethereum), wBTC, or stETH cannot use x402 services without CEX round-trips.
-   **Franklin AI agent:** Most popular autonomous agent using x402 (548 GitHub stars). Already uses USDC. AnyX would expand its payment flexibility instantly.

---

Section 4

## Market Sizing (TAM / SAM / SOM)

Market

Size

Rationale

**TAM** — All crypto API micropayments

$500M–$2B/year by 2027

x402 + L402 + MPP combined; AI agent economy projection

**SAM** — x402 non-USDC payer segment

$50M–$200M/year by 2027

20–40% of x402 volume from payers who'd prefer non-USDC

**SOM** — AnyX capture (Year 1)

$1M–$10M routed

5–10% of SAM; early adopter SDK + BTC gateway

**AnyX Revenue (Year 1)**

$2K–$20K

0.20% spread on $1M–$10M volume

**AnyX Revenue (Year 2)**

$50K–$500K

Scale with x402 growth + BTC gateway premium

**Revenue asymmetry opportunity:** BTC Lightning payments (Phase 3) carry 0.5–0.75% margin vs. 0.05% for USDT→USDC. A single large BTC payer routing $100K/month generates more revenue than 50 USDT payers at the same volume. The BTC gateway is disproportionately profitable.

---

Section 5

## Strategic Positioning

### Why Now

1.  **x402 is at inflection:** 75M transactions/month and growing. The protocol is proving product-market fit — now is the time to capture the expanding perimeter.
2.  **DEX infrastructure is mature:** 1inch, 0x, KyberSwap all have production-grade APIs. Building on them is a 2-week project, not a 2-year one.
3.  **Circle CCTP v2:** Native USDC cross-chain without wrapped tokens — launched late 2024. Makes cross-chain flows viable for the first time.
4.  **AI agent proliferation:** LangChain, CrewAI, AutoGen, AgentKit all gaining adoption simultaneously. Each new agent framework integration creates a distribution channel.
5.  **No one else is building this:** First-mover advantage in a growing protocol ecosystem compounds. Being the reference implementation means being the standard.

### Positioning Statement

**AnyX is the payment router for the agentic economy.** Where Stripe abstracts credit card rails, AnyX abstracts token rails — any crypto asset becomes instantly usable for any x402 payment. We are infrastructure, not an app.

### Target Customer Segments (Prioritized)

#

Segment

Size

Pain Level

AnyX Fit

Go-to-Market

1

AI agent framework developers (LangChain, CrewAI)

10K+ devs

High

SDK plugin

GitHub, Discord, direct

2

DeFi protocol developers (holding ETH/WBTC treasuries)

5K+ devs

High

SDK + contracts

Developer forums, hackathons

3

Bitcoin community (Lightning users)

100K+ users

Critical (excluded)

LN gateway

Bitcoin Twitter, podcasts

4

Enterprise teams building agent infrastructure

500+ teams

Medium

Enterprise SDK

Sales outreach, LinkedIn

5

x402 API providers (want more payers)

22K sellers

Medium

Server middleware

x402 ecosystem community

AnyX Market Research Report — August 2025 — Internal Document