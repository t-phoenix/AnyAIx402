# AnyX — Cursor Agent Build Roadmap
## Universal x402 Multi-Token Payment Adapter

> **For Cursor Cloud Agents:** This file is the single source of truth for building AnyX.
> Read it top-to-bottom before starting any task. Each phase has self-contained agent prompts.
> Complete phases in order. Do not skip acceptance criteria checks.

---

## Project Identity

**Name:** AnyX  
**Tagline:** Pay with any token. Settle on x402.  
**Core Value:** AnyX intercepts x402 payment challenges and allows payers holding ETH, USDT, WBTC, SOL, BTC (Lightning), or any ERC-20 to settle USDC-denominated x402 API payments — transparently, in one call.  
**Revenue Model:** 0.10–0.75% swap spread on every non-USDC payment routed.  
**Protocol:** x402 v2 (x402-foundation/x402), EIP-3009, Circle CCTP, 1inch/0x aggregators.

---

## Tech Stack (Locked Decisions)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Bun 1.x | Fastest TS runtime; native fetch; great for API servers |
| API Framework | Hono | Lightweight, edge-compatible, TypeScript-first |
| Smart Contracts | Solidity 0.8.24 + Foundry | Industry standard; Foundry for fast testing |
| SDK Language | TypeScript + viem 2.x | viem is the standard for EVM interactions |
| ORM | Drizzle ORM + PostgreSQL | Type-safe, lightweight, no magic |
| Cache | Redis (via ioredis) | Quote caching, rate limiting, nonce tracking |
| Monorepo | Turborepo | Package-level caching, parallel builds |
| Package Manager | Bun workspaces | Native to Bun runtime |
| Testing | Vitest + Foundry tests | Unit + integration + contract tests |
| DEX Integration | 1inch Fusion API + 0x Swap API | Best liquidity aggregation; fallback chain |
| Bridge | Circle CCTP v2 + Stargate | Native USDC cross-chain; Stargate as fallback |
| EVM Client | viem | Type-safe, modern, no ethers |
| Contract Wallet | Permit2 (Uniswap) | Gasless token approvals |
| Deployment | Docker + Fly.io | Simple, fast, global edge |
| CI/CD | GitHub Actions | Standard |
| Secrets | Doppler or .env.local | Never commit secrets |

---

## Repository Structure

```
anyx/
├── packages/
│   ├── core/                    # Shared logic: swap routing, EIP-3009, quote engine
│   │   ├── src/
│   │   │   ├── quote.ts         # DEX quote aggregation
│   │   │   ├── swap.ts          # Swap execution
│   │   │   ├── eip3009.ts       # EIP-3009 authorization builder
│   │   │   ├── facilitator.ts   # x402 facilitator client
│   │   │   ├── tokens.ts        # Supported token registry
│   │   │   └── types.ts         # Shared TypeScript types
│   │   └── package.json
│   │
│   ├── sdk/                     # @anyx/sdk — npm package for developers
│   │   ├── src/
│   │   │   ├── index.ts         # Main UPA class
│   │   │   ├── fetch.ts         # upa.fetch() wrapper
│   │   │   ├── quote.ts         # upa.quote() method
│   │   │   └── types.ts
│   │   ├── README.md
│   │   └── package.json
│   │
│   ├── contracts/               # Solidity smart contracts
│   │   ├── src/
│   │   │   ├── AnyXRouter.sol       # Main entry: swap + authorize
│   │   │   ├── SwapExecutor.sol     # DEX aggregator interface
│   │   │   ├── FeeCollector.sol     # Fee extraction
│   │   │   ├── ReservePool.sol      # USDC float pool
│   │   │   └── interfaces/
│   │   │       ├── IUSDC.sol
│   │   │       └── ISwapRouter.sol
│   │   ├── test/
│   │   ├── script/
│   │   │   └── Deploy.s.sol
│   │   ├── foundry.toml
│   │   └── package.json
│   │
│   └── db/                      # Database schema + migrations
│       ├── src/
│       │   ├── schema.ts
│       │   └── migrations/
│       └── package.json
│
├── apps/
│   ├── api/                     # Main REST API server (Hono + Bun)
│   │   ├── src/
│   │   │   ├── index.ts         # Server entry
│   │   │   ├── routes/
│   │   │   │   ├── quote.ts
│   │   │   │   ├── pay.ts
│   │   │   │   ├── receipt.ts
│   │   │   │   ├── tokens.ts
│   │   │   │   └── lightning.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── cors.ts
│   │   │   └── lib/
│   │   │       ├── redis.ts
│   │   │       └── db.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── dashboard/               # Analytics + developer portal (Next.js 14)
│       ├── app/
│       ├── components/
│       └── package.json
│
├── docs/
│   ├── llms.txt                 # AI discovery file
│   ├── openapi.yaml             # Full OpenAPI 3.1 spec
│   └── guides/
│       ├── quickstart.md
│       ├── sdk-reference.md
│       └── smart-contracts.md
│
├── scripts/
│   ├── setup.sh
│   └── deploy.sh
│
├── docker-compose.yml
├── turbo.json
├── package.json
└── AGENTS.md                    # This file
```

---

## Environment Variables

Create `.env.local` at root. Never commit this file.

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/anyx
REDIS_URL=redis://localhost:6379

# Blockchain - Base mainnet
RPC_URL_BASE=https://mainnet.base.org
RPC_URL_ETHEREUM=https://eth.llamarpc.com
RPC_URL_SOLANA=https://api.mainnet-beta.solana.com
PRIVATE_KEY=0x...  # Hot signer (use MPC in production)

# DEX APIs
ONEINCH_API_KEY=...
ZEROX_API_KEY=...

# Bridge
CCTP_ATTESTER_URL=https://iris-api.circle.com

# x402 Facilitator
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
FACILITATOR_FALLBACK_URL=https://your-self-hosted-facilitator.com

# Fee Configuration
FEE_BPS=20  # 0.20% default spread (basis points)
MIN_FEE_USDC=0.001  # Minimum fee in USDC

# API
PORT=3000
API_SECRET=...  # For admin endpoints

# Contract Addresses (Base mainnet)
USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ANYX_ROUTER=  # Set after deployment
FEE_COLLECTOR=  # Set after deployment
```

---

## Phase 0: Project Foundation

### Task 0.1 — Initialize Turborepo Monorepo

**Agent Prompt:**
```
Initialize a new Turborepo monorepo called "anyx" using Bun as the package manager.
Set up the following packages: @anyx/core, @anyx/sdk, @anyx/contracts, @anyx/db.
Set up the following apps: api (Hono server), dashboard (Next.js 14 with App Router).
Configure turbo.json with build, test, lint, and dev pipelines.
Configure each package's package.json with proper name, version (0.1.0), and workspace dependencies.
Use TypeScript 5.x throughout. Configure tsconfig.json at root with strict mode enabled.
Add Biome for linting/formatting instead of ESLint (faster, better for monorepos).
```

**Files to create:**
- `package.json` (root, workspaces)
- `turbo.json`
- `tsconfig.json` (root)
- `biome.json`
- `packages/core/package.json`
- `packages/sdk/package.json`
- `packages/contracts/package.json`
- `packages/db/package.json`
- `apps/api/package.json`
- `apps/dashboard/package.json`

**Commands to run:**
```bash
bun init
bun add -d turbo typescript @biomejs/biome
```

**Acceptance criteria:**
- `bun run build` succeeds from root
- `bun run dev` starts all apps
- TypeScript compiles with no errors

---

### Task 0.2 — Database Schema

**Agent Prompt:**
```
Set up Drizzle ORM with PostgreSQL in packages/db.
Create the following tables:

1. quotes — stores DEX swap quotes
   Fields: id (uuid), created_at, expires_at, endpoint_url, input_token, input_token_address, 
   input_chain_id, input_amount (varchar), usdc_required (varchar), usdc_on_chain (varchar),
   fee_bps (int), route_data (jsonb), status (enum: pending/used/expired)

2. payments — stores completed payment records  
   Fields: id (uuid), quote_id (uuid FK), created_at, completed_at, tx_hash, block_number,
   from_address, to_address, input_token, input_amount (varchar), usdc_amount (varchar),
   fee_usdc (varchar), api_endpoint, facilitator_url, x_payment_response (text),
   status (enum: pending/settled/failed)

3. api_keys — developer API keys
   Fields: id (uuid), created_at, key_hash (text, indexed), name, owner_email,
   plan (enum: free/pro/enterprise), monthly_limit_usd, current_month_volume_usd,
   is_active (bool)

4. lightning_invoices — Lightning Network invoice tracking
   Fields: id (uuid), created_at, expires_at, bolt11, payment_hash, amount_sats,
   usdc_equivalent (varchar), api_endpoint, status (enum: pending/paid/expired)

Use Drizzle Kit for migrations. Export schema types for use across packages.
```

**Acceptance criteria:**
- `bun run db:generate` creates migration files
- `bun run db:migrate` applies migrations
- All types exported from `@anyx/db`

---

### Task 0.3 — Docker Compose

**Agent Prompt:**
```
Create docker-compose.yml at repo root with:
- PostgreSQL 16 (port 5432, health check)
- Redis 7 (port 6379, health check)
- pgAdmin (port 5050, optional for dev)

Create docker-compose.prod.yml for production:
- Only PostgreSQL and Redis (no pgAdmin)
- Named volumes for persistence
- Resource limits

Add a scripts/setup.sh that: installs dependencies, copies .env.example to .env.local,
starts docker-compose, runs migrations, seeds token registry.
```

---

## Phase 1: Core Engine (MVP — Week 1–3)

### Task 1.1 — Token Registry

**Agent Prompt:**
```
Create packages/core/src/tokens.ts with a typed token registry.

Define a Token type:
{
  symbol: string
  name: string
  address: string | null  // null for native ETH/SOL/BTC
  chainId: number
  decimals: number
  coingeckoId: string  // for price fetching
  isNative: boolean
  swapPath: 'direct' | 'bridge' | 'lightning'
}

Populate with these initial tokens:
- USDC on Base (chainId: 8453, address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- USDT on Base (chainId: 8453, address: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2)
- WETH on Base (chainId: 8453, address: 0x4200000000000000000000000000000000000006)
- cbBTC on Base (chainId: 8453, address: 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf)
- ETH native on Base (chainId: 8453, address: null, isNative: true)
- USDT on Ethereum (chainId: 1, address: 0xdAC17F958D2ee523a2206206994597C13D831ec7)
- WBTC on Ethereum (chainId: 1, address: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599)
- WETH on Ethereum (chainId: 1, address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)
- BTC Lightning (chainId: 0 special, symbol: BTC, swapPath: 'lightning')
- USDC on Solana (chainId: 101, address: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
- SOL native (chainId: 101, isNative: true)

Export: TOKEN_REGISTRY, getToken(symbol, chainId), getSupportedTokens(), isSupported(address, chainId)
```

---

### Task 1.2 — DEX Quote Engine

**Agent Prompt:**
```
Create packages/core/src/quote.ts — the DEX aggregation quote engine.

Implement these functions:

1. get1inchQuote(params: QuoteParams): Promise<DEXQuote>
   - Call 1inch Fusion+ API: GET https://api.1inch.dev/swap/v6.0/{chainId}/quote
   - Headers: Authorization: Bearer {ONEINCH_API_KEY}
   - Params: src, dst, amount, includeProtocols: true, includeGas: true
   - Return: { amountOut, estimatedGas, protocols, priceImpact }

2. get0xQuote(params: QuoteParams): Promise<DEXQuote>
   - Call 0x Swap API: GET https://api.0x.org/swap/permit2/quote
   - Headers: 0x-api-key: {ZEROX_API_KEY}, 0x-chain-id: {chainId}
   - Params: sellToken, buyToken, sellAmount
   - Return: same shape as above

3. getBestQuote(params: QuoteParams): Promise<BestQuote>
   - Call both APIs in parallel with Promise.allSettled
   - Pick the one with highest amountOut (best rate for user)
   - Add AnyX fee: amountIn = amountOut_needed / (1 - fee_bps/10000)
   - Return: { inputAmount, inputToken, usdcOutput, fee, route, expiresAt, quoteId }

4. getCachedQuote(quoteId: string): Promise<BestQuote | null>
   - Redis lookup with 30s TTL

QuoteParams type:
{
  inputToken: Token
  usdcRequired: string  // in USDC base units (6 decimals)
  chainId: number
  slippageBps?: number  // default 50 (0.5%)
}

Use zod for input validation. Log all quotes to DB.
Handle errors gracefully: if 1inch fails, fall back to 0x only. If both fail, throw QuoteError.
```

---

### Task 1.3 — x402 Challenge Parser

**Agent Prompt:**
```
Create packages/core/src/x402.ts — x402 protocol client.

Implement:

1. fetch402Challenge(url: string): Promise<PaymentRequired | null>
   - Fetch the URL, check if response is 402
   - Parse the PAYMENT-REQUIRED header (base64-decode if present)
   - Or parse the JSON body directly
   - Return null if not 402

2. parsePaymentRequired(body: unknown): PaymentRequired
   - Validate against x402 v2 schema using zod:
     {
       x402Version: 2,
       error: string,
       accepts: Array<{
         scheme: 'exact' | 'upto',
         network: string,  // CAIP-2 e.g. 'eip155:8453'
         amount: string,
         asset: string,    // token address
         payTo: string,    // recipient wallet
         maxTimeoutSeconds: number,
         extra?: { facilitatorVerify?: string, facilitatorSettle?: string }
       }>
     }
   - Find the Base USDC option (network: 'eip155:8453', asset: USDC address)
   - Throw if no compatible payment option found

3. buildPaymentHeader(auth: EIP3009Auth): string
   - Encode the signed authorization as base64 JSON
   - This goes in the X-PAYMENT header

4. submitPayment(url: string, paymentHeader: string): Promise<Response>
   - Retry the original request with X-PAYMENT header set
   - Return the 200 OK response

Types needed:
- PaymentRequired
- PaymentOption
- EIP3009Auth: { from, to, value, validAfter, validBefore, nonce, v, r, s }
```

---

### Task 1.4 — EIP-3009 Authorization Builder

**Agent Prompt:**
```
Create packages/core/src/eip3009.ts — EIP-3009 transferWithAuthorization signer.

Using viem, implement:

1. buildAuthorizationPayload(params): TransferAuthorizationPayload
   - params: { from, to, value, chainId, usdcAddress }
   - Generate random 32-byte nonce: crypto.getRandomValues(new Uint8Array(32))
   - Set validAfter: 0 (immediate)
   - Set validBefore: Math.floor(Date.now()/1000) + 300 (5 min window)
   - Return the unsigned payload

2. signAuthorization(payload, privateKey): Promise<SignedAuthorization>
   - Build EIP-712 domain:
     { name: 'USD Coin', version: '2', chainId, verifyingContract: usdcAddress }
   - Build EIP-712 types:
     TransferWithAuthorization: [
       { name: 'from', type: 'address' },
       { name: 'to', type: 'address' },
       { name: 'value', type: 'uint256' },
       { name: 'validAfter', type: 'uint256' },
       { name: 'validBefore', type: 'uint256' },
       { name: 'nonce', type: 'bytes32' }
     ]
   - Use viem's signTypedData
   - Split signature into v, r, s
   - Return { ...payload, v, r, s, signature }

3. verifyAuthorization(signed): boolean
   - Recover signer from EIP-712 digest
   - Return true if signer === signed.from

Note: In production, the private key is the AnyX hot signer key (managed by MPC).
The from address must hold sufficient USDC after the swap completes.
The to address is the payTo from the x402 challenge.
```

---

### Task 1.5 — Facilitator Client

**Agent Prompt:**
```
Create packages/core/src/facilitator.ts — x402 facilitator interaction.

Implement:

1. verifyPayment(params: VerifyParams): Promise<VerifyResult>
   - POST to facilitator /verify endpoint
   - Body: { paymentPayload, paymentRequirements }
   - Return: { isValid, signer, error? }

2. settlePayment(params: SettleParams): Promise<SettleResult>  
   - POST to facilitator /settle endpoint
   - Body: { signedAuthorization }
   - Return: { txHash, blockNumber, success }

3. getFacilitatorUrl(): string
   - Return primary facilitator (FACILITATOR_URL env)
   - Implement health check with 2s timeout
   - Fall back to FACILITATOR_FALLBACK_URL if primary unhealthy

4. waitForSettlement(txHash: string, chainId: number): Promise<TransactionReceipt>
   - Poll until tx confirmed (max 30s, check every 2s)
   - Use viem publicClient.waitForTransactionReceipt
   - Return receipt or throw TimeoutError

Known facilitator URLs:
- Primary: https://api.cdp.coinbase.com/platform/v2/x402
- Fallback options: https://x402.halowerk.com/facilitator
```

---

### Task 1.6 — API Server Routes

**Agent Prompt:**
```
Create the main API server in apps/api/src/index.ts using Hono + Bun.

Set up middleware:
- CORS (allow all origins in dev, configurable in prod)
- Request ID header (X-Request-ID)
- Request logging (method, path, status, duration)
- Rate limiting via Redis: 100 req/min for free tier, 1000/min for pro
- Error handling (return structured JSON errors)

Implement these routes:

GET /health
- Return { status: 'ok', version: '0.1.0', timestamp }

GET /v1/tokens
- Return list of supported tokens from TOKEN_REGISTRY
- Include current USD price (fetch from CoinGecko simple price API, cache 60s in Redis)
- Response: { tokens: Token[], updatedAt }

POST /v1/quote
- Body: { endpointUrl: string, inputToken: string, inputChainId: number, slippageBps?: number }
- Fetch 402 challenge from endpointUrl
- Parse required USDC amount
- Get best DEX quote via getBestQuote()
- Store quote in DB with 30s TTL
- Response: { quoteId, inputToken, inputAmount, usdcRequired, fee, expiresAt, route }

POST /v1/pay
- Body: { quoteId: string, walletAddress: string }
- Validate quote exists and not expired
- Execute swap via on-chain SwapExecutor contract (Phase 1: use pre-funded USDC float)
- Build EIP-3009 authorization for required USDC
- Submit to facilitator
- Retry original API call with X-PAYMENT header
- Store payment receipt in DB
- Response: { receiptId, txHash, apiResponse, status: 'settled' }

GET /v1/receipt/:id
- Look up payment by ID
- Return full PaymentReceipt object

POST /v1/lightning/invoice  (stub for Phase 3)
- Body: { endpointUrl: string }
- Return { invoice: 'not_implemented', message: 'Lightning coming in Phase 3' }

Error format:
{ error: { code: string, message: string, details?: unknown } }

Error codes: QUOTE_NOT_FOUND, QUOTE_EXPIRED, SWAP_FAILED, SETTLEMENT_FAILED,
INVALID_INPUT, RATE_LIMITED, INSUFFICIENT_BALANCE
```

---

### Task 1.7 — SDK Package

**Agent Prompt:**
```
Create the @anyx/sdk npm package in packages/sdk/.

Main class: UPA (Universal Payment Adapter)

Constructor:
class UPA {
  constructor(config: UPAConfig)
}

interface UPAConfig {
  apiKey?: string              // AnyX API key (optional for free tier)
  apiBaseUrl?: string          // Default: https://api.anyx.xyz
  wallet?: WalletClient        // viem WalletClient (for on-chain flows)
  preferredToken: string       // Token symbol: 'ETH', 'USDT', 'WBTC', etc.
  preferredChainId: number     // Chain where payer's token lives
  maxSlippage?: number         // Default: 0.005 (0.5%)
  maxFeePercent?: number       // Reject if AnyX fee > this (default: 0.01 = 1%)
  onPayment?: (receipt: PaymentReceipt) => void  // callback
  onError?: (error: UPAError) => void
}

Methods:

async fetch(url: string, init?: RequestInit): Promise<Response>
  - Drop-in replacement for global fetch()
  - If response is not 402: return normally
  - If response is 402: call quote(), then pay(), then retry
  - Emit 'payment' event with receipt

async quote(endpointUrl: string): Promise<PaymentQuote>
  - GET /v1/quote with config.preferredToken and chainId
  - Return quote details

async pay(endpointUrl: string, quoteId?: string): Promise<PaymentReceipt>
  - Use existing quote or fetch new one
  - POST /v1/pay
  - Return receipt

async getReceipt(receiptId: string): Promise<PaymentReceipt>
  - GET /v1/receipt/:id

async getSupportedTokens(): Promise<Token[]>
  - GET /v1/tokens

Export types: UPAConfig, PaymentQuote, PaymentReceipt, Token, UPAError

Usage example (put in README.md):
import { UPA } from '@anyx/sdk'

const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453,
  wallet: walletClient,
})

// Drop-in for fetch — auto-handles 402
const res = await upa.fetch('https://api.example.com/data')
const data = await res.json()
```

---

### Task 1.8 — Unit Tests

**Agent Prompt:**
```
Write unit tests using Vitest for all core package functions.

Test files to create:
- packages/core/src/__tests__/quote.test.ts
- packages/core/src/__tests__/x402.test.ts
- packages/core/src/__tests__/eip3009.test.ts
- packages/core/src/__tests__/facilitator.test.ts
- packages/sdk/src/__tests__/upa.test.ts

For quote tests:
- Mock 1inch and 0x API responses
- Test fee calculation (0.20% applied correctly)
- Test fallback when 1inch fails
- Test quote expiry

For x402 tests:
- Mock HTTP responses with 402 status and valid PaymentRequired body
- Test parsing of PAYMENT-REQUIRED header (base64)
- Test parsing of JSON body directly
- Test error when no Base USDC option available

For EIP-3009 tests:
- Test nonce uniqueness (generate 100, check all unique)
- Test signature recovery (sign then verify)
- Test validBefore is ~5 minutes from now

For facilitator tests:
- Mock facilitator endpoints
- Test failover when primary returns 503
- Test timeout after 2s

Coverage target: >80% for all core files.
Run tests: bun test
```

---

## Phase 2: Smart Contracts (Week 4–6)

### Task 2.1 — AnyXRouter Contract

**Agent Prompt:**
```
Create the AnyXRouter.sol smart contract in packages/contracts/src/.

This contract receives any ERC-20 token from a user, swaps it to USDC via a DEX aggregator,
then executes EIP-3009 transferWithAuthorization to pay the x402 recipient.

pragma solidity ^0.8.24;

Imports needed:
- IERC20 (OpenZeppelin)
- SafeERC20 (OpenZeppelin)
- Ownable2Step (OpenZeppelin)
- ReentrancyGuard (OpenZeppelin)

State variables:
- USDC_BASE: immutable address (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- feeCollector: address (receives swap spread)
- feeBps: uint256 (default 20 = 0.20%)
- swapRouter: address (1inch AggregationRouterV6)
- permit2: address (Uniswap Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3)

Main function:
function swapAndPay(
    address inputToken,
    uint256 inputAmount,
    uint256 minUSDCOut,        // slippage protection
    bytes calldata swapData,   // encoded 1inch calldata
    address payTo,             // x402 payTo address
    uint256 usdcRequired,      // exact amount for the x402 payment
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s   // EIP-3009 signature
) external nonReentrant {
    // 1. Pull tokens from user via Permit2 or standard transferFrom
    // 2. Execute swap via swapRouter
    // 3. Verify usdcReceived >= usdcRequired + fee
    // 4. Calculate fee: feeBps * usdcRequired / 10000
    // 5. Transfer fee to feeCollector
    // 6. Call USDC.transferWithAuthorization(from=msg.sender, to=payTo, ...)
    //    NOTE: The EIP-3009 auth must be pre-signed by msg.sender for payTo
    // 7. Transfer any excess USDC back to msg.sender
    // 8. Emit PaymentSettled event
}

Events:
- PaymentSettled(address indexed payer, address indexed recipient, uint256 inputAmount, address inputToken, uint256 usdcSettled, uint256 fee, bytes32 nonce)
- FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps)

Admin functions (onlyOwner):
- setFeeBps(uint256 newFeeBps) — max 100 bps (1%)
- setFeeCollector(address newCollector)
- setSwapRouter(address newRouter)
- rescueTokens(address token, uint256 amount)  — emergency only

Write a Foundry test in test/AnyXRouter.t.sol that:
- Forks Base mainnet (use vm.createFork)
- Tests ETH -> USDC -> x402 payment flow
- Tests slippage protection (should revert if minUSDCOut not met)
- Tests fee calculation
- Tests onlyOwner modifiers
```

---

### Task 2.2 — Contract Deployment Scripts

**Agent Prompt:**
```
Create Foundry deployment scripts in packages/contracts/script/.

Deploy.s.sol:
- Deploy AnyXRouter with constructor args
- Deploy FeeCollector
- Verify contracts on Basescan using BASESCAN_API_KEY
- Output deployed addresses to deployments/base-mainnet.json

Deploy to Base Sepolia testnet first:
forge script script/Deploy.s.sol --rpc-url $RPC_URL_BASE_SEPOLIA --broadcast --verify

Add to packages/contracts/README.md:
- How to run tests: forge test -vvv
- How to deploy: forge script...
- How to verify: forge verify-contract...
- Contract addresses table (testnet + mainnet)
```

---

## Phase 3: Cross-Chain (Week 7–10)

### Task 3.1 — Circle CCTP Integration

**Agent Prompt:**
```
Create packages/core/src/bridge/cctp.ts — Circle Cross-Chain Transfer Protocol integration.

Implement:

1. bridgeUSDC(params: CCTPBridgeParams): Promise<BridgeResult>
   - params: { amount, sourceChain, destChain, recipient }
   - Step 1: Call USDC burnAndMint on source chain TokenMessenger
     Contract: 0xbd3fa81b58ba92a82136038b25adec7066af3155 (Ethereum)
     Function: depositForBurn(amount, destinationDomain, mintRecipient, burnToken)
   - Step 2: Poll Circle Iris API for attestation
     GET https://iris-api.circle.com/attestations/{messageHash}
     Poll every 5s until status === 'complete'
   - Step 3: Submit attestation to destination MessageTransmitter
     Function: receiveMessage(message, attestation)
   - Return: { sourceTxHash, destTxHash, amount, status }

2. getCCTPDomain(chainId: number): number
   - Return CCTP domain ID: Ethereum=0, Avalanche=1, Optimism=2, Arbitrum=3, Base=6, Polygon=7, Solana=5

3. estimateBridgeTime(sourceChain, destChain): number
   - Return estimated seconds (Base<->Ethereum ~15min, others vary)

4. floatPool abstraction:
   - For time-sensitive flows: check if ReservePool has enough USDC on Base
   - If yes: use float (immediate settlement), replenish async via CCTP
   - If no: wait for CCTP (show user estimated wait time)

CCTP v2 contract addresses:
- Ethereum TokenMessenger: 0xbd3fa81b58ba92a82136038b25adec7066af3155
- Base TokenMessenger: 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962
- Ethereum MessageTransmitter: 0x0a992d191DEeC32aFe36203Ad87D7d289a738F81
- Base MessageTransmitter: 0xAD09780d193884d503182aD4588450C416D6F9D
```

---

### Task 3.2 — Reserve Pool

**Agent Prompt:**
```
Create ReservePool.sol in packages/contracts/src/.

This contract holds a USDC float on Base for instant cross-chain settlement.
When Solana users pay via AnyX, USDC is fronted from this pool immediately,
and CCTP replenishment happens asynchronously.

Functions:
- depositFloat(uint256 amount) — admin deposits USDC to pool
- frontPayment(address recipient, uint256 amount) — onlyRouter: lend USDC for instant settlement
- replenish(uint256 amount) — called after CCTP settlement arrives
- getAvailableFloat(): returns current USDC balance
- getUtilization(): returns % of float currently lent out

Events:
- FloatDeployed(address recipient, uint256 amount)
- FloatReplenished(uint256 amount)

Also create packages/core/src/bridge/reservePool.ts:
- checkFloat(amount): boolean — is there enough float?
- requestFloat(amount, recipient): Promise<string> — tx hash
- replenishFloat(amount): Promise<string> — call after CCTP arrives
```

---

## Phase 4: Lightning Network (Week 11–14)

### Task 4.1 — Lightning Node Integration

**Agent Prompt:**
```
Create apps/lightning/ as a new app in the monorepo.

This is a separate Bun service that:
1. Connects to an LND node via gRPC (using @grpc/grpc-js + lnrpc protobuf)
2. Generates Lightning invoices for x402 payments
3. Watches for invoice settlement
4. Triggers x402 payment from reserve pool when invoice paid

LND Connection:
- Connect using TLS cert + macaroon from LND_TLS_CERT_PATH and LND_MACAROON_PATH env vars
- Or connect to LNC (Lightning Node Connect) for hosted nodes

Implement:

class LightningService {
  async generateInvoice(params: {
    endpointUrl: string,
    usdcRequired: string,
    btcUsdRate: number
  }): Promise<LightningInvoice>
  // Calculate sats = (usdcRequired * (1 + FEE_BPS/10000)) / btcUsdRate * 1e8
  // Create LND invoice with 5 min expiry
  // Store in lightning_invoices DB table
  // Return: { bolt11, paymentHash, amountSats, expiresAt }

  async watchInvoice(paymentHash: string): Promise<void>
  // Subscribe to LND invoice settlement stream
  // When settled: trigger reservePool.frontPayment() for the x402 payment
  // Update DB record to 'paid'

  async getBtcUsdRate(): Promise<number>
  // Fetch from CoinGecko: GET /simple/price?ids=bitcoin&vs_currencies=usd
  // Cache in Redis for 60s
  // Add 0.5% buffer to rate (conservative estimate)
}

API routes to add to apps/api:
POST /v1/lightning/invoice
  Body: { endpointUrl }
  Returns: { bolt11, amountSats, usdcEquivalent, expiresAt, paymentHash }

GET /v1/lightning/status/:paymentHash
  Returns: { status: 'pending'|'paid'|'expired', settledAt? }
```

---

## Phase 5: Developer Experience (Week 15–18)

### Task 5.1 — Documentation Site

**Agent Prompt:**
```
Set up a documentation site using Fumadocs in apps/docs (Next.js-based).

Create these documentation pages:

1. Introduction
   - What is AnyX?
   - How it works (diagram + explanation)
   - Supported tokens and chains

2. Quickstart (5-minute guide)
   - Install SDK: npm install @anyx/sdk
   - Basic fetch() wrapper example
   - Get an API key

3. SDK Reference
   - UPA constructor options
   - upa.fetch() — full signature
   - upa.quote() — full signature
   - upa.pay() — full signature
   - TypeScript types reference

4. REST API Reference (auto-generated from openapi.yaml)
   - POST /v1/quote
   - POST /v1/pay
   - GET /v1/receipt/:id
   - GET /v1/tokens
   - POST /v1/lightning/invoice

5. Smart Contracts
   - AnyXRouter.sol — address, ABI, function reference
   - When to use contracts vs. SDK
   - Integration examples (wagmi, viem, ethers)

6. AI Agent Integration Guide
   - LangChain Tool example
   - CrewAI integration
   - OpenAI function calling
   - AgentKit (Coinbase) integration

7. Self-Hosting
   - Docker Compose setup
   - Environment variables reference
   - Running your own facilitator

Create docs/llms.txt with AI-discovery format (see Task 5.2).
```

---

### Task 5.2 — llms.txt (AI Discovery)

**Agent Prompt:**
```
Create docs/llms.txt following the llms.txt specification (llmstxt.org).

This file makes AnyX discoverable and usable by AI agents automatically.

Format:
# AnyX

> AnyX is a universal payment adapter for the x402 protocol. It enables any token holder
> (ETH, USDT, WBTC, BTC, SOL, and any ERC-20) to pay x402-gated APIs and services
> without manually acquiring USDC. AnyX handles the swap, authorization, and settlement
> transparently. API providers receive standard USDC on Base via x402 — unchanged.

## What AnyX Does
- Accepts any ERC-20 token, native ETH/SOL, or Bitcoin via Lightning Network
- Swaps the payer's token to USDC via 1inch/0x DEX aggregators (best rate)
- Signs EIP-3009 transferWithAuthorization on behalf of payer
- Submits to x402 facilitator (Coinbase CDP or self-hosted)
- Returns the API response with payment receipt

## API Base URL
https://api.anyx.xyz

## Authentication
Optional API key in header: X-API-Key: {your_key}
Free tier: 100 req/min, $100/month volume
Pro tier: 1000 req/min, unlimited volume, $49/month

## Core Endpoints

### Quote (always call before pay)
POST /v1/quote
{
  "endpointUrl": "https://api.example.com/data",  // x402-gated URL
  "inputToken": "ETH",                             // token you want to pay with
  "inputChainId": 8453                             // chain where you hold the token
}
Returns: { quoteId, inputAmount, fee, expiresAt }

### Pay
POST /v1/pay
{
  "quoteId": "uuid-from-quote",
  "walletAddress": "0x..."   // your wallet (to pull tokens from)
}
Returns: { receiptId, txHash, apiResponse }

### Supported Tokens
GET /v1/tokens
Returns: list of all supported input tokens with current USD prices

## SDK (NPM)
Install: npm install @anyx/sdk
import { UPA } from '@anyx/sdk'
const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453, wallet })
const res = await upa.fetch('https://api.example.com/data')  // auto-handles 402

## Supported Tokens (v1.0)
- ETH (native, Base chain 8453)
- USDT (ERC-20, Base 8453 and Ethereum 1)
- WETH (ERC-20, Base 8453 and Ethereum 1)
- WBTC (ERC-20, Ethereum 1)
- cbBTC (ERC-20, Base 8453)
- Any ERC-20 on Base (via 0x routing)
- BTC via Lightning Network (Phase 3)
- SOL and SPL tokens on Solana (Phase 2)

## Fee Structure
AnyX charges a swap spread: 0.10–0.75% depending on token and chain.
USDT->USDC: 0.05% (near-zero slippage stablecoin pair)
ETH->USDC: 0.20%
BTC->USDC: 0.50%
No additional flat fees on free tier.

## Error Handling
All errors return: { error: { code, message, details? } }
Codes: QUOTE_NOT_FOUND, QUOTE_EXPIRED, SWAP_FAILED, SETTLEMENT_FAILED,
       INVALID_INPUT, RATE_LIMITED, INSUFFICIENT_BALANCE

## Source Code
https://github.com/anyx-xyz/anyx (Apache-2.0)

## Full API Docs
https://docs.anyx.xyz

## OpenAPI Spec
https://api.anyx.xyz/openapi.json
```

---

### Task 5.3 — OpenAPI Spec

**Agent Prompt:**
```
Create docs/openapi.yaml — full OpenAPI 3.1 specification for AnyX API.

Include:
- Info: title, version, description, contact, license
- Servers: production (https://api.anyx.xyz), development (http://localhost:3000)
- Security: ApiKeyAuth (X-API-Key header, optional)
- All 6 endpoints with complete request/response schemas
- All error response schemas (400, 401, 404, 422, 429, 500)
- Example requests and responses for each endpoint
- Schema components for: Quote, PaymentReceipt, Token, LightningInvoice, Error

Add to apps/api: serve openapi.yaml at GET /openapi.json
Add Swagger UI at GET /docs (use @hono/swagger-ui middleware)
```

---

## Phase 6: Monetization Infrastructure (Week 16–18)

### Task 6.1 — API Key System + Billing

**Agent Prompt:**
```
Implement the API key and billing system.

1. Key generation:
   - POST /v1/keys (admin only)
   - Generate: prefix 'anyx_' + 32 random hex chars
   - Store: only the SHA-256 hash in DB (never store plaintext)
   - Return: full key once on creation (like Stripe's model)

2. Usage tracking:
   - Track monthly volume per key in Redis (HINCRBY anyx:usage:{keyId}:{YYYY-MM} {amount_usdc})
   - Reset on 1st of each month (TTL 35 days)

3. Rate limiting middleware:
   - Free: 100 req/min, $100/month volume
   - Pro: 1000 req/min, unlimited volume
   - Enterprise: custom limits
   - Return 429 with Retry-After header when exceeded

4. Fee sharing for embedded integrations:
   - If X-Partner-ID header present: credit 20% of AnyX fee to partner
   - Track partner revenue in DB: partner_credits table
   - Monthly settlement via USDC transfer (manual trigger, admin endpoint)

5. Developer portal routes:
   POST /v1/portal/register — create account + free API key
   GET /v1/portal/usage — current month stats
   POST /v1/portal/upgrade — generate Stripe checkout URL for Pro plan
```

---

### Task 6.2 — Stripe Integration (Pro Plan)

**Agent Prompt:**
```
Integrate Stripe for Pro plan subscriptions ($49/month).

Using Stripe SDK:

1. POST /v1/portal/upgrade
   - Create Stripe Checkout Session (subscription mode)
   - Price ID from STRIPE_PRO_PRICE_ID env
   - Metadata: { apiKeyId }
   - Return: { checkoutUrl }

2. POST /webhooks/stripe (unprotected, verify signature)
   - Handle: checkout.session.completed → upgrade key to 'pro'
   - Handle: customer.subscription.deleted → downgrade to 'free'
   - Handle: invoice.payment_failed → send email warning

3. Dashboard endpoint:
   GET /v1/portal/billing → Stripe customer portal URL (manage subscription)

Keep Stripe logic isolated in apps/api/src/lib/stripe.ts
```

---

## Phase 7: AI Agent Integrations (Week 18–20)

### Task 7.1 — LangChain Tool

**Agent Prompt:**
```
Create packages/integrations/langchain/ — LangChain tool for AnyX.

Create a LangChain Tool class:

import { Tool } from 'langchain/tools'
import { UPA } from '@anyx/sdk'

export class AnyXPaymentTool extends Tool {
  name = 'anyx_pay_x402'
  description = `Pay for access to an x402-gated API endpoint using any cryptocurrency.
    Input: JSON with { endpointUrl: string, inputToken: string }
    Output: The API response data as a string.
    Use this when you encounter a 402 Payment Required response or need to access paid APIs.
    Supported tokens: ETH, USDT, WBTC, USDC, cbBTC, SOL, BTC`

  private upa: UPA

  constructor(config: { wallet: any, preferredToken: string, preferredChainId: number }) {
    super()
    this.upa = new UPA(config)
  }

  async _call(input: string): Promise<string> {
    const { endpointUrl } = JSON.parse(input)
    const res = await this.upa.fetch(endpointUrl)
    return JSON.stringify(await res.json())
  }
}

Also create:
- packages/integrations/openai/ — OpenAI function calling tool definition
- packages/integrations/mcp/ — Model Context Protocol server for AnyX
  - Tool: anyx_quote (get payment quote)
  - Tool: anyx_pay (execute payment)
  - Tool: anyx_receipt (get payment receipt)

MCP server should be runnable as: npx @anyx/mcp
Publish to npm as @anyx/mcp-server
```

---

### Task 7.2 — Coinbase AgentKit Integration

**Agent Prompt:**
```
Create packages/integrations/agentkit/ — Coinbase AgentKit integration.

AgentKit uses a different action pattern. Create:

import { CdpTool, CdpToolkit } from '@coinbase/agentkit-langchain'

export const ANYX_PAY_ACTION = {
  name: 'anyx_pay_x402_api',
  description: 'Pay for access to any x402-gated API using ETH, USDT, or other tokens via AnyX universal adapter',
  schema: z.object({
    endpointUrl: z.string().describe('The x402-gated API endpoint URL to call'),
    inputToken: z.string().default('ETH').describe('Token to pay with (ETH, USDT, WBTC)'),
  }),
  func: async (wallet: any, { endpointUrl, inputToken }) => {
    // Use AnyX API to get quote and pay
    const quote = await fetch('https://api.anyx.xyz/v1/quote', {
      method: 'POST',
      body: JSON.stringify({ endpointUrl, inputToken, inputChainId: 8453 })
    })
    // ... execute payment
    return `Payment settled. Receipt: ${receiptId}. API responded with: ${apiData}`
  }
}

Document how to add this to an AgentKit agent in a README.
```

---

## CI/CD Pipeline

### Task CI.1 — GitHub Actions

**Agent Prompt:**
```
Create .github/workflows/ with:

1. ci.yml — runs on every PR:
   - Lint with Biome
   - Type check with tsc --noEmit
   - Unit tests: bun test
   - Contract tests: forge test -vvv (on fork)
   - Build all packages

2. deploy-api.yml — runs on push to main:
   - Build Docker image: apps/api/Dockerfile
   - Push to GitHub Container Registry
   - Deploy to Fly.io: flyctl deploy --app anyx-api
   - Run DB migrations post-deploy
   - Health check: curl https://api.anyx.xyz/health

3. publish-sdk.yml — runs on git tag push (v*):
   - Build @anyx/sdk
   - Publish to npm: bun publish
   - Create GitHub Release with changelog

Set required secrets in GitHub: FLY_API_TOKEN, NPM_TOKEN, BASESCAN_API_KEY
```

---

## Launch Checklist

Before going live, all of these must pass:

- [ ] All unit tests passing (`bun test`)
- [ ] All contract tests passing (`forge test`)
- [ ] Smart contracts audited (or formal review completed)
- [ ] Contracts deployed to Base Sepolia testnet and tested
- [ ] Contracts deployed to Base mainnet
- [ ] API deployed to Fly.io and health check passing
- [ ] SDK published to npm as `@anyx/sdk@0.1.0`
- [ ] docs.anyx.xyz live with quickstart guide
- [ ] llms.txt accessible at https://anyx.xyz/llms.txt
- [ ] OpenAPI spec at https://api.anyx.xyz/openapi.json
- [ ] Swagger UI at https://api.anyx.xyz/docs
- [ ] Fee collection working (test with $1 payment)
- [ ] Payment receipts accurate (cross-check vs on-chain)
- [ ] Rate limiting working (test with 150 req/min on free tier)
- [ ] LangChain tool tested with real x402 API
- [ ] AgentKit integration tested
- [ ] MCP server published and working

---

## Notes for Cursor Agents

1. **Always check existing code** before creating new files. The monorepo may already have partial implementations.
2. **Never hardcode API keys or private keys.** Use env vars from `.env.local`.
3. **Write tests alongside implementation.** Do not defer testing.
4. **Use viem v2.x, not ethers.js.** All EVM interactions go through viem.
5. **The hot signer private key** signs EIP-3009 authorizations. In Phase 1, it can be a local key. In production, use Turnkey or Lit Protocol MPC.
6. **Fee logic**: Fee is applied on top of the required USDC. If API costs $1.00 USDC, payer swaps `$1.00 / (1 - 0.002) = $1.002` worth of their token. AnyX keeps the $0.002.
7. **Slippage**: Always set `minAmountOut` = required USDC. If swap returns less than required, the transaction MUST revert. Never allow partial payments.
8. **For Phase 1 MVP**: Use a pre-funded USDC float on Base instead of on-chain swaps. Keep it simple — agent holds USDC, gets the user to swap via 1inch off-chain, then AnyX submits the EIP-3009 auth. This avoids smart contract risk for initial launch.
