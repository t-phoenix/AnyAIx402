  AnyX — Monetization & Go-to-Market

Monetization & Go-to-Market · August 2025

# AnyX:  
_How We Make Money_

Revenue model, pricing tiers, distribution strategy, partnership playbook, and the fastest path from zero to first dollar.

Section 1

## Revenue Model

AnyX earns on every non-USDC payment routed. Revenue is entirely usage-based — no subscription required to start earning. Three overlapping streams:

### Stream 1 — Swap Spread (Primary, Immediate)

When a payer sends ETH/USDT/BTC, AnyX quotes a slightly less favorable exchange rate than the actual DEX execution. The gap is AnyX revenue. This is the same model as any DEX aggregator frontend (1inch earns ~0.10%, Uniswap earns 0.25% on "Universal Router" flows).

Token Pair

DEX Slippage

AnyX Spread

Total Payer Cost vs. Best Rate

Monthly Revenue at $1M Routed

USDT→USDC

0.01%

0.05%

0.06% (better than any CEX)

$500

ETH→USDC

0.05–0.10%

0.20%

0.25–0.30%

$2,000

WBTC→USDC

0.10–0.20%

0.25%

0.35–0.45%

$2,500

cbBTC→USDC

0.08–0.15%

0.20%

0.28–0.35%

$2,000

BTC (Lightning)→USDC

0.20–0.50%

0.50%

0.70–1.00%

$5,000

SOL→USDC (cross-chain)

0.10–0.30%

0.30%

0.40–0.60%

$3,000

### Stream 2 — Pro SaaS Subscriptions

Higher rate limits, priority routing, partner revenue share, and analytics dashboard. Target: developers and teams building on x402 at scale.

### Stream 3 — Partner Revenue Share

AI agent frameworks, x402 API marketplaces, and wallet providers integrate AnyX and earn 20% of the swap spread AnyX generates from their users. AnyX keeps 80%. This creates a B2B2C distribution model where partners have direct financial incentive to distribute AnyX.

**Key advantage:** Revenue is earned the moment the first swap is routed. No enterprise contracts, no 90-day payment terms. The swap executes → fee is collected atomically in the same transaction.

---

Section 2

## Pricing Tiers

#### Free

$0/month

-   100 API calls/minute
-   $100 monthly routed volume
-   USDT, WETH, cbBTC on Base
-   @anyx/sdk access
-   Basic payment receipts
-   Community support

#### Pro

$49/month

-   1,000 API calls/minute
-   Unlimited routed volume
-   All ERC-20 tokens on Base
-   Cross-chain (Ethereum→Base)
-   Priority DEX routing
-   Analytics dashboard
-   Webhook callbacks
-   Email support

#### Enterprise

Custom

-   Unlimited rate limits
-   SLA guarantee (99.9%)
-   Solana + Lightning (Phase 2/3)
-   Custom fee structure
-   Self-hosted option
-   Partner revenue share
-   Dedicated support
-   Custom integrations

#### Partner

Rev Share

-   Embed AnyX in your product
-   20% of swap spread credited monthly
-   White-label option available
-   Co-marketing opportunities
-   Priority API access
-   Technical integration support

**Spread fees apply on all tiers.** The monthly fee only covers rate limits and features — the swap spread is charged per-transaction regardless of plan. Free tier users still generate swap revenue on every payment routed.

---

Section 3

## Fastest Path to Revenue: Week-by-Week

**Day-1 revenue is possible without smart contracts.** The USDT→USDC swap can be executed off-chain via 1inch API, with AnyX collecting the spread before submitting the EIP-3009 authorization. This requires only a funded USDC wallet and a running API server.

Week 1

#### Quote API Live

Public REST endpoint: POST /v1/quote. Returns swap cost in any token for any x402 endpoint. Charge $0.003/call or free with API key. Launch on ProductHunt Dev community.

Week 2

#### USDT SDK on npm

@anyx/sdk 0.1.0 published. USDT→USDC only. Post to: x402 Discord, Twitter/X #x402, LangChain Discord, Base Developer Telegram. First swap spread collected.

Week 3

#### ETH + WBTC Support

Expand token support. Launch "Pay with ETH" Widget (script tag). Target x402 API providers — offer them 15% rev share for embedding widget on their docs pages.

Week 4

#### LangChain + AgentKit Integration

Publish @anyx/langchain and @anyx/agentkit packages. Direct outreach to top 20 AI agent framework repos by GitHub stars. Blog post: "Pay any x402 API from your LLM agent in 5 lines."

Week 5–6

#### Smart Contracts + Mainnet

AnyXRouter.sol deployed to Base mainnet (post-audit). On-chain swap flows replace off-chain prototype. Announce to x402 foundation. Apply for Base Ecosystem Grant.

Week 7–8

#### Pro Tier + Dashboard

Stripe integration. Pro plan at $49/month. Developer analytics dashboard live. Target: any team that used the free tier for 2+ weeks.

Week 10+

#### Lightning Gateway (BTC)

First and only BTC→x402 gateway. Major announcement to Bitcoin community. LND node live. Highest margin product (0.5% spread). Press outreach to CoinDesk, The Defiant, Unchained.

---

Section 4

## Distribution: How We Get Users

**Core insight:** This is a developer tool. Developer tools distribute through GitHub, npm, Discord, and blog posts — not traditional ads. Word of mouth from one influential developer is worth 1,000 impressions.

### Channel 1 — NPM / GitHub (Organic, Immediate)

#### Tactic: Drop-in npm package with zero-friction onboarding

**Goal:** Developers install `@anyx/sdk` in 10 seconds and see a working payment in 5 minutes.

**Actions:** Publish @anyx/sdk, @anyx/langchain, @anyx/mcp-server. Add AnyX to the x402-foundation/x402 README as "Multi-Token Payments". Submit PR to awesome-x402.

**Metrics:** npm weekly downloads, GitHub stars

### Channel 2 — x402 Ecosystem Community (Highest Conversion)

#### Tactic: Become the go-to solution in the community that already has the problem

**Actions:** Join x402 Discord and Telegram. Answer questions about multi-token payments. Post working code demos. DM the top 50 x402 API providers directly.

**Key message:** "Your API can now accept ETH, USDT, and BTC — for free, with one line of middleware."

**Metrics:** Discord mentions, referral traffic from x402.org

### Channel 3 — AI Agent Developer Communities

#### Tactic: Integration-first distribution in each major framework

**Target communities:** LangChain Discord (100K+ members), CrewAI GitHub, AutoGen GitHub, Coinbase AgentKit Discord, ElizaOS Discord

**Approach:** Build and publish the integration first. Then post a demo. Let the working code speak. Offer to present at community office hours.

**Key message:** "Your agents can now pay any x402 API from their ETH or USDC holdings — without pre-swapping."

### Channel 4 — Content Marketing (Compounding)

#### Tactic: Technical blog posts that rank and generate inbound

**Post 1:** "What is x402? The HTTP payment protocol for AI agents" (SEO: "x402 tutorial")

**Post 2:** "Pay any x402 API with ETH — a 5-minute guide with AnyX" (SEO: "x402 ETH payment")

**Post 3:** "Accept crypto payments in your API without changing a line of server code" (SEO: "x402 middleware")

**Post 4:** "Building an AI agent that pays for its own API calls" (SEO: "AI agent crypto payments")

**Distribution:** dev.to, Hashnode, Mirror.xyz, cross-post to X/Twitter

### Channel 5 — Direct Outreach (B2B, Weeks 6+)

#### Tactic: High-touch outreach to target accounts with clear ROI story

**Target accounts:** Top 50 x402 API providers by transaction volume. Top 20 AI agent startups by GitHub stars. Coinbase ecosystem companies. Base-native DeFi protocols.

**Outreach sequence:**

Day 1: Personalized email with specific integration plan for their product.

Day 3: LinkedIn follow-up with working demo video (30 seconds).

Day 7: Twitter/X DM with partner rev share offer.

**Value prop:** "Your product currently requires USDC. Add AnyX and your users can pay with any token. You earn 20% of our swap fee on every payment."

### Channel 6 — Grants + Ecosystem Programs (Non-Dilutive Funding)

#### Immediate applications upon MVP launch

**Base Ecosystem Grants:** Coinbase actively funds Base infrastructure. AnyX improves Base's x402 ecosystem. Apply immediately at base.org/grants.

**x402 Foundation:** Contribute to the protocol. Request co-marketing. Aim to be listed as reference implementation.

**ETHGlobal Hackathons:** Submit AnyX to ETHGlobal bounties (multiple per year). Prize money + visibility.

**Circle CCTP Grants:** Using CCTP is grant-eligible. Apply at developers.circle.com.

---

Section 5

## Self-Serve vs. Sales-Led: The Right Mix

### Answer: Start 100% Self-Serve, Add Sales at $10K MRR

Developer tools that require a sales call fail. The x402 community is entirely self-serve by culture — they find npm packages, read READMEs, and either integrate or don't. **A sales call for a $49/month product is negative ROI.**

Revenue Range

Motion

Focus

$0 → $2K MRR

Fully self-serve

SDK quality, documentation, free tier usage

$2K → $10K MRR

Self-serve + community

Convert free users to Pro; partner revenue share deals

$10K → $50K MRR

Inbound + light sales

Enterprise contracts for high-volume users; Lightning gateway

$50K+ MRR

Sales-led for enterprise

Custom contracts, SLAs, self-hosted licenses for large protocols

**The "Instantly Live" money model:** AnyX does not need a single sales call to start making money. Every developer who installs the SDK and routes a USDT payment generates $0.0005–$0.002 in swap revenue automatically. At 100 active users routing $1K/month each = $100K routed = $200/month revenue from spread alone. No meetings. No invoices.

---

Section 6

## Revenue Projections

Month

Monthly Volume Routed

Blended Spread

Spread Revenue

SaaS Revenue

Total MRR

Month 1

$10K

0.20%

$20

$0

$20

Month 2

$50K

0.20%

$100

$0

$100

Month 3

$200K

0.20%

$400

$100

$500

Month 6

$1M

0.22%

$2,200

$500

$2,700

Month 12

$5M

0.25%

$12,500

$3,000

$15,500

Month 18

$20M

0.28%

$56,000

$10,000

$66,000

Month 24

$80M

0.30%

$240,000

$30,000

$270,000

Projections assume: x402 ecosystem grows 3x/year (conservative vs. current trajectory). AnyX captures 5% of non-USDC flows. Lightning gateway adds high-margin BTC volume from Month 10. All figures in USD.

Break-even (ops costs)

Month 4

~$500/month server costs covered

First $10K MRR

Month 12

Organic growth only

$1M ARR target

Month 20

With Lightning gateway active

Key milestone

$100K/day

Volume routed → $200/day revenue

AnyX Monetization & GTM — August 2025 — Confidential