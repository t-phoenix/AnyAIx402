# Configuration reference

> Generated from packages/config/src/registry.ts. Run `bun run packages/config/src/cli.ts template` to regenerate.

Every configuration key AnyX understands is declared once, in the registry inside
`packages/config`. This page, `.env.example`, and the CLI all read that registry, so the three
can never disagree.

## How values are resolved

Sources are consulted in this order, and the first one that supplies a non-empty value wins:

1. `process.env` — real environment variables, including anything your host injects
2. `.env.local` — your machine-local overrides (git-ignored)
3. `.env` — shared, non-secret defaults for the repository
4. `config/environments/<env>.jsonc` — per-environment overlay for the active environment
5. `config/anyx.config.jsonc` (or `.json`) — the grouped operator config file
6. the default declared in the registry

Values that look like unfilled placeholders (empty, `<...>`, `CHANGEME`, `TODO`) are treated as
unset, so a half-filled template never masquerades as configuration.

## CLI

```bash
bun run packages/config/src/cli.ts check --env dev   # validate; non-zero exit when required keys are missing
bun run packages/config/src/cli.ts list              # every key, grouped, with secrets masked
bun run packages/config/src/cli.ts missing            # only what is unset, with how-to-obtain steps
bun run packages/config/src/cli.ts features          # which capabilities are on, and what unlocks the rest
bun run packages/config/src/cli.ts explain FEE_BPS   # everything known about one key
bun run packages/config/src/cli.ts template          # regenerate .env.example
bun run packages/config/src/cli.ts docs              # regenerate this page
```

Secrets are masked everywhere (`sk_live_…3456`). No command prints a secret in full.

## Capabilities

Missing configuration disables capabilities rather than crashing the process. The
`features` command reports the current state of each.

| Capability | What it enables |
| --- | --- |
| `evmQuotes` | Quote and route EVM tokens to USDC through a DEX aggregator |
| `solanaQuotes` | Quote and route SOL / SPL tokens to USDC on Solana via Jupiter |
| `priceOracle` | Authenticated CoinGecko pricing for token valuation and BTC/USD rates |
| `onchainSwap` | Atomic on-chain swap-and-pay through the deployed AnyXRouter contract |
| `floatSettlement` | Settle from a pre-funded USDC float instead of an on-chain swap |
| `persistence` | Persist quotes, payments, receipts, and API keys |
| `quoteCache` | Cache DEX quotes and enforce quote freshness windows |
| `rateLimiting` | Per-API-key rate limiting and monthly volume accounting |
| `adminApi` | Administrative endpoints (key issuance, partner settlement) |
| `localSigner` | Sign EIP-3009 authorizations with a local hot key |
| `mpcSigner` | Sign EIP-3009 authorizations through Turnkey or Lit Protocol MPC |
| `cdpFacilitator` | Authenticated settlement through the Coinbase CDP facilitator |
| `facilitatorFailover` | Automatic failover to a secondary x402 facilitator |
| `crosschainCctp` | Circle CCTP bridging of USDC between supported chains |
| `stargateBridge` | Stargate bridging as a CCTP fallback for USDT and ETH |
| `reserveFloat` | Reserve pool accounting and float replenishment |
| `lightning` | Bitcoin Lightning invoices settling x402 payments |
| `stripeBilling` | Stripe checkout, webhooks, and Pro-tier subscription management |
| `testnetDeploys` | Contract deploys and integration runs against Base Sepolia |
| `contractVerification` | Automatic contract verification on Basescan |
| `apiDeploy` | Automated API deployment to Fly.io from CI |
| `sdkPublish` | Automated npm publishing of @anyx/sdk and integration packages |
| `orchestratorRemoteExecutor` | Dispatch agent tasks to a remote executor endpoint |
| `orchestratorProductionAutoApprove` | Allow the orchestrator to promote to production without a human approval |

## Alternatives

A few requirements are satisfied by any one of several keys:

- **A signer must be configured (local hot key or MPC)** — one of `PRIVATE_KEY`, `TURNKEY_API_PRIVATE_KEY`, `LIT_PROTOCOL_API_KEY`; enforced in dev, staging, production.
  Set SIGNER_MODE=local and PRIVATE_KEY for development (generate a throwaway key with `openssl rand -hex 32`), or SIGNER_MODE=turnkey with the TURNKEY_* keys from https://app.turnkey.com, or SIGNER_MODE=lit with LIT_PROTOCOL_API_KEY from https://developer.litprotocol.com. Without one of these, AnyX cannot sign EIP-3009 authorizations and no payment can settle.
- **At least one DEX aggregator key is needed to quote EVM swaps** — one of `ONEINCH_API_KEY`, `ZEROX_API_KEY`; enforced in staging, production.
  Create a 1inch key at https://portal.1inch.dev or a 0x key at https://dashboard.0x.org. Configure both to get automatic failover between aggregators.
- **Production signing should be MPC-backed, not a local hot key** — one of `TURNKEY_API_PRIVATE_KEY`, `LIT_PROTOCOL_API_KEY`; enforced in production.
  Provision a Turnkey organization (https://app.turnkey.com) or a Lit PKP (https://developer.litprotocol.com), set SIGNER_MODE accordingly, and remove PRIVATE_KEY from the production environment. A single hot key that can authorize USDC transfers is the highest-severity item in the threat model.

## Key index

| Key | Group | Type | Required | Secret | Default |
| --- | --- | --- | --- | --- | --- |
| [`ANYX_ENV`](#anyx_env) | runtime | enum | no | no | `dev` |
| [`LOG_LEVEL`](#log_level) | runtime | enum | no | no | `info` |
| [`RPC_URL_BASE`](#rpc_url_base) | network | url | all | no | `https://mainnet.base.org` |
| [`RPC_URL_ETHEREUM`](#rpc_url_ethereum) | network | url | no | no | `https://eth.llamarpc.com` |
| [`RPC_URL_BASE_SEPOLIA`](#rpc_url_base_sepolia) | network | url | staging, production | no | `https://sepolia.base.org` |
| [`RPC_URL_SOLANA`](#rpc_url_solana) | network | url | no | no | `https://api.mainnet-beta.solana.com` |
| [`CHAIN_ID_DEFAULT`](#chain_id_default) | network | number | no | no | `8453` |
| [`ONEINCH_API_KEY`](#oneinch_api_key) | dex | string | production | yes | — |
| [`ZEROX_API_KEY`](#zerox_api_key) | dex | string | production | yes | — |
| [`JUPITER_API_URL`](#jupiter_api_url) | dex | url | no | no | `https://quote-api.jup.ag/v6` |
| [`COINGECKO_API_KEY`](#coingecko_api_key) | dex | string | no | yes | — |
| [`DEFAULT_SLIPPAGE_BPS`](#default_slippage_bps) | dex | number | no | no | `50` |
| [`DEX_PRIORITY`](#dex_priority) | dex | string | no | no | `1inch,0x` |
| [`QUOTE_TIMEOUT_MS`](#quote_timeout_ms) | dex | number | no | no | `2500` |
| [`FACILITATOR_URL`](#facilitator_url) | x402 | url | all | no | `https://api.cdp.coinbase.com/platform/v2/x402` |
| [`FACILITATOR_FALLBACK_URL`](#facilitator_fallback_url) | x402 | url | production | no | — |
| [`FACILITATOR_TIMEOUT_MS`](#facilitator_timeout_ms) | x402 | number | no | no | `2000` |
| [`X402_MAX_TIMEOUT_SECONDS`](#x402_max_timeout_seconds) | x402 | number | no | no | `300` |
| [`CDP_API_KEY_ID`](#cdp_api_key_id) | x402 | string | no | no | — |
| [`CDP_API_KEY_SECRET`](#cdp_api_key_secret) | x402 | string | no | yes | — |
| [`SIGNER_MODE`](#signer_mode) | signer | enum | no | no | `local` |
| [`PRIVATE_KEY`](#private_key) | signer | hex | no | yes | — |
| [`SIGNER_MAX_USDC_PER_SESSION`](#signer_max_usdc_per_session) | signer | number | no | no | `1000` |
| [`TURNKEY_API_PUBLIC_KEY`](#turnkey_api_public_key) | signer | string | no | no | — |
| [`TURNKEY_API_PRIVATE_KEY`](#turnkey_api_private_key) | signer | string | no | yes | — |
| [`TURNKEY_ORGANIZATION_ID`](#turnkey_organization_id) | signer | string | no | no | — |
| [`TURNKEY_PRIVATE_KEY_ID`](#turnkey_private_key_id) | signer | string | no | no | — |
| [`LIT_PROTOCOL_API_KEY`](#lit_protocol_api_key) | signer | string | no | yes | — |
| [`LIT_PKP_PUBLIC_KEY`](#lit_pkp_public_key) | signer | string | no | no | — |
| [`LIT_NETWORK`](#lit_network) | signer | enum | no | no | `datil-dev` |
| [`FEE_BPS`](#fee_bps) | fees | number | no | no | `20` |
| [`MIN_FEE_USDC`](#min_fee_usdc) | fees | number | no | no | `0.001` |
| [`FEE_BPS_STABLE`](#fee_bps_stable) | fees | number | no | no | `5` |
| [`FEE_BPS_ETH`](#fee_bps_eth) | fees | number | no | no | `20` |
| [`FEE_BPS_BTC`](#fee_bps_btc) | fees | number | no | no | `50` |
| [`FEE_BPS_CROSSCHAIN`](#fee_bps_crosschain) | fees | number | no | no | `30` |
| [`MAX_FEE_BPS`](#max_fee_bps) | fees | number | no | no | `100` |
| [`DATABASE_URL`](#database_url) | storage | string | all | yes | — |
| [`DATABASE_POOL_MAX`](#database_pool_max) | storage | number | no | no | `10` |
| [`REDIS_URL`](#redis_url) | storage | string | all | yes | — |
| [`QUOTE_CACHE_TTL_SECONDS`](#quote_cache_ttl_seconds) | storage | number | no | no | `30` |
| [`PORT`](#port) | api | number | no | no | `3000` |
| [`API_BASE_URL`](#api_base_url) | api | url | no | no | `http://localhost:3000` |
| [`API_SECRET`](#api_secret) | api | string | staging, production | yes | — |
| [`ANYX_API_KEY`](#anyx_api_key) | api | string | no | yes | — |
| [`CORS_ALLOWED_ORIGINS`](#cors_allowed_origins) | api | string | no | no | `*` |
| [`RATE_LIMIT_FREE_RPM`](#rate_limit_free_rpm) | api | number | no | no | `100` |
| [`RATE_LIMIT_PRO_RPM`](#rate_limit_pro_rpm) | api | number | no | no | `1000` |
| [`USDC_BASE`](#usdc_base) | contracts | address | all | no | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| [`PERMIT2_ADDRESS`](#permit2_address) | contracts | address | no | no | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| [`ANYX_ROUTER`](#anyx_router) | contracts | address | no | no | — |
| [`FEE_COLLECTOR`](#fee_collector) | contracts | address | no | no | — |
| [`RESERVE_POOL`](#reserve_pool) | contracts | address | no | no | — |
| [`BASESCAN_API_KEY`](#basescan_api_key) | contracts | string | no | yes | — |
| [`CCTP_ATTESTER_URL`](#cctp_attester_url) | bridge | url | no | no | `https://iris-api.circle.com` |
| [`STARGATE_ROUTER_ADDRESS`](#stargate_router_address) | bridge | address | no | no | — |
| [`FLOAT_POOL_TARGET_USDC`](#float_pool_target_usdc) | bridge | number | no | no | `10000` |
| [`FLOAT_POOL_BALANCE_USDC`](#float_pool_balance_usdc) | bridge | string | no | no | — |
| [`FLOAT_FUNDING_WALLET`](#float_funding_wallet) | bridge | address | no | no | — |
| [`BRIDGE_POLL_INTERVAL_MS`](#bridge_poll_interval_ms) | bridge | number | no | no | `5000` |
| [`BRIDGE_MAX_WAIT_SECONDS`](#bridge_max_wait_seconds) | bridge | number | no | no | `900` |
| [`LND_GRPC_HOST`](#lnd_grpc_host) | lightning | string | no | no | — |
| [`LND_TLS_CERT_PATH`](#lnd_tls_cert_path) | lightning | string | no | no | — |
| [`LND_MACAROON_PATH`](#lnd_macaroon_path) | lightning | string | no | no | — |
| [`LIGHTNING_INVOICE_EXPIRY_SECONDS`](#lightning_invoice_expiry_seconds) | lightning | number | no | no | `300` |
| [`BTC_RATE_BUFFER_BPS`](#btc_rate_buffer_bps) | lightning | number | no | no | `50` |
| [`STRIPE_SECRET_KEY`](#stripe_secret_key) | billing | string | no | yes | — |
| [`STRIPE_PRO_PRICE_ID`](#stripe_pro_price_id) | billing | string | no | no | — |
| [`STRIPE_WEBHOOK_SECRET`](#stripe_webhook_secret) | billing | string | no | yes | — |
| [`STRIPE_PORTAL_RETURN_URL`](#stripe_portal_return_url) | billing | url | no | no | — |
| [`FLY_API_TOKEN`](#fly_api_token) | deploy | string | no | yes | — |
| [`FLY_APP_API`](#fly_app_api) | deploy | string | no | no | `anyx-api` |
| [`FLY_APP_LIGHTNING`](#fly_app_lightning) | deploy | string | no | no | `anyx-lightning` |
| [`HEALTHCHECK_URL`](#healthcheck_url) | deploy | url | no | no | `http://localhost:3000/health` |
| [`NPM_TOKEN`](#npm_token) | deploy | string | no | yes | — |
| [`ORCHESTRATOR_AGENT_CMD`](#orchestrator_agent_cmd) | orchestrator | string | no | no | `cursor-agent` |
| [`ORCHESTRATOR_AGENT_ENDPOINT`](#orchestrator_agent_endpoint) | orchestrator | url | no | no | — |
| [`ORCHESTRATOR_MAX_FIX_ATTEMPTS`](#orchestrator_max_fix_attempts) | orchestrator | number | no | no | `3` |
| [`ORCHESTRATOR_CONCURRENCY`](#orchestrator_concurrency) | orchestrator | number | no | no | `3` |
| [`ORCHESTRATOR_AUTO_APPROVE_PRODUCTION`](#orchestrator_auto_approve_production) | orchestrator | boolean | no | no | `false` |
| [`ORCHESTRATOR_STATE_DIR`](#orchestrator_state_dir) | orchestrator | string | no | no | `.anyx/orchestrator` |

## Runtime

Which environment profile AnyX validates against and how loudly it logs.

### ANYX_ENV

Which environment profile to validate against. Controls which keys are treated as required.

- Config file path: `runtime.env`
- Type: enum (`dev` | `staging` | `production`)
- Required in: no
- Secret: no
- Default: `dev`
- Example: `dev`

**How to obtain.** Choose one of dev, staging, or production. No third party involved.

### LOG_LEVEL

Minimum severity written to stdout by the API, orchestrator, and scripts.

- Config file path: `runtime.logLevel`
- Type: enum (`debug` | `info` | `warn` | `error`)
- Required in: no
- Secret: no
- Default: `info`
- Example: `info`

**How to obtain.** Choose one of debug, info, warn, or error. No third party involved.

## Network / RPC

JSON-RPC endpoints for every chain AnyX reads from or settles on.

### RPC_URL_BASE

Base mainnet JSON-RPC endpoint. Every settlement read and write goes through it.

- Config file path: `network.rpcUrlBase`
- Type: url
- Required in: all
- Secret: no
- Default: `https://mainnet.base.org`
- Example: `https://mainnet.base.org`
- Disabled without it: `evmQuotes`, `onchainSwap`, `floatSettlement`
- Provider docs: https://docs.base.org/network-information

**How to obtain.** The public endpoint https://mainnet.base.org works for development but is rate limited. For staging and production create a project at https://dashboard.alchemy.com (or https://www.quicknode.com), add a Base Mainnet app, and copy its HTTPS URL.

### RPC_URL_ETHEREUM

Ethereum mainnet JSON-RPC endpoint, used for WBTC/USDT-on-Ethereum routing and CCTP.

- Config file path: `network.rpcUrlEthereum`
- Type: url
- Required in: no
- Secret: no
- Default: `https://eth.llamarpc.com`
- Example: `https://eth.llamarpc.com`
- Disabled without it: `crosschainCctp`

**How to obtain.** Use the public https://eth.llamarpc.com endpoint for development, or create an Ethereum Mainnet app at https://dashboard.alchemy.com and copy its HTTPS URL.

### RPC_URL_BASE_SEPOLIA

Base Sepolia testnet endpoint used for contract deploys and staging integration runs.

- Config file path: `network.rpcUrlBaseSepolia`
- Type: url
- Required in: staging, production
- Secret: no
- Default: `https://sepolia.base.org`
- Example: `https://sepolia.base.org`
- Disabled without it: `testnetDeploys`
- Provider docs: https://docs.base.org/network-information

**How to obtain.** The public endpoint https://sepolia.base.org is sufficient. Fund the deployer with testnet ETH from https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet.

### RPC_URL_SOLANA

Solana JSON-RPC endpoint for Jupiter swap routing and CCTP burns on Solana.

- Config file path: `network.rpcUrlSolana`
- Type: url
- Required in: no
- Secret: no
- Default: `https://api.mainnet-beta.solana.com`
- Example: `https://api.mainnet-beta.solana.com`
- Disabled without it: `solanaQuotes`

**How to obtain.** The public endpoint https://api.mainnet-beta.solana.com works for low volume. For production create a Solana endpoint at https://www.helius.dev or https://triton.one and copy its HTTPS URL.

### CHAIN_ID_DEFAULT

Chain that x402 settlement targets by default. 8453 is Base mainnet.

- Config file path: `network.defaultChainId`
- Type: number
- Required in: no
- Secret: no
- Default: `8453`
- Example: `8453`

**How to obtain.** Use 8453 for Base mainnet or 84532 for Base Sepolia. No third party involved.

## DEX aggregators and pricing

Quote sources for the swap engine, plus slippage and routing preferences.

### ONEINCH_API_KEY

1inch Developer Portal key. Primary quote and swap-calldata source for EVM chains.

- Config file path: `dex.oneInchApiKey`
- Type: string
- Required in: production
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-1inch-portal-key>`
- Disabled without it: `evmQuotes`
- Provider docs: https://portal.1inch.dev/documentation

**How to obtain.** 1. Sign in at https://portal.1inch.dev. 2. Create an application. 3. Enable the Swap API (and Fusion if you want intent-based routing). 4. Copy the API key from the application's Credentials tab. Free tier covers development; production volume needs a paid plan.

### ZEROX_API_KEY

0x Swap API key. Fallback quote source when 1inch is unavailable or returns no route.

- Config file path: `dex.zeroExApiKey`
- Type: string
- Required in: production
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-0x-dashboard-key>`
- Disabled without it: `evmQuotes`
- Provider docs: https://0x.org/docs/api

**How to obtain.** 1. Create an account at https://dashboard.0x.org. 2. Create a project. 3. Copy the API key. 4. Send it as the `0x-api-key` header. The free tier is rate limited per month.

### JUPITER_API_URL

Jupiter aggregator base URL used for SOL and SPL token routing on Solana.

- Config file path: `dex.jupiterApiUrl`
- Type: url
- Required in: no
- Secret: no
- Default: `https://quote-api.jup.ag/v6`
- Example: `https://quote-api.jup.ag/v6`
- Disabled without it: `solanaQuotes`
- Provider docs: https://station.jup.ag/docs/apis/swap-api

**How to obtain.** The public endpoint requires no key. For higher rate limits request a hosted endpoint at https://station.jup.ag/docs/apis/self-hosted and put its URL here.

### COINGECKO_API_KEY

CoinGecko Demo or Pro key for USD pricing and the BTC/USD rate used to size Lightning invoices.

- Config file path: `dex.coingeckoApiKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-coingecko-demo-key>`
- Disabled without it: `priceOracle`
- Provider docs: https://docs.coingecko.com/reference/introduction

**How to obtain.** Optional. Without a key AnyX uses the public CoinGecko endpoint, which is heavily rate limited. For a key: 1. Create an account at https://www.coingecko.com/en/developers/dashboard. 2. Generate a Demo (free) or Pro key. 3. Paste it here.

### DEFAULT_SLIPPAGE_BPS

Default slippage tolerance in basis points when a caller does not specify one. 50 = 0.5%.

- Config file path: `dex.defaultSlippageBps`
- Type: number
- Required in: no
- Secret: no
- Default: `50`
- Example: `50`

**How to obtain.** A policy decision, not a credential. 50 bps matches the PRD default.

### DEX_PRIORITY

Comma-separated aggregator preference order. The first healthy source that returns a route wins.

- Config file path: `dex.priority`
- Type: string
- Required in: no
- Secret: no
- Default: `1inch,0x`
- Example: `1inch,0x`

**How to obtain.** A policy decision. Valid entries: 1inch, 0x, jupiter.

### QUOTE_TIMEOUT_MS

Per-aggregator quote timeout. Exceeding it drops that source from the current comparison.

- Config file path: `dex.quoteTimeoutMs`
- Type: number
- Required in: no
- Secret: no
- Default: `2500`
- Example: `2500`

**How to obtain.** A tuning decision, not a credential.

## x402 facilitators

Primary and fallback facilitators that verify and settle EIP-3009 authorizations.

### FACILITATOR_URL

Primary x402 facilitator that verifies signatures and submits transferWithAuthorization.

- Config file path: `x402.facilitatorUrl`
- Type: url
- Required in: all
- Secret: no
- Default: `https://api.cdp.coinbase.com/platform/v2/x402`
- Example: `https://api.cdp.coinbase.com/platform/v2/x402`
- Provider docs: https://docs.cdp.coinbase.com/x402/docs/welcome

**How to obtain.** The Coinbase CDP facilitator URL above is the default. To self-host, deploy a facilitator (for example qntx/facilitator) and point this at your instance.

### FACILITATOR_FALLBACK_URL

Secondary facilitator used when the primary is unhealthy or refuses to settle.

- Config file path: `x402.facilitatorFallbackUrl`
- Type: url
- Required in: production
- Secret: no
- Default: none
- Example: `https://facilitator.your-domain.example/x402`
- Disabled without it: `facilitatorFailover`

**How to obtain.** Deploy a second facilitator you control (qntx/facilitator, x402-sovereign, or OpenFacilitator) and paste its base URL. Without it, a facilitator outage or censorship event stops settlement.

### FACILITATOR_TIMEOUT_MS

Health-check and request timeout before failing over to the fallback facilitator.

- Config file path: `x402.facilitatorTimeoutMs`
- Type: number
- Required in: no
- Secret: no
- Default: `2000`
- Example: `2000`

**How to obtain.** A tuning decision. The PRD requires failover within 2 seconds.

### X402_MAX_TIMEOUT_SECONDS

Upper bound AnyX honours for an authorization validity window, matching x402 maxTimeoutSeconds.

- Config file path: `x402.maxTimeoutSeconds`
- Type: number
- Required in: no
- Secret: no
- Default: `300`
- Example: `300`

**How to obtain.** A policy decision. 300 seconds matches typical x402 server challenges.

### CDP_API_KEY_ID

Coinbase Developer Platform API key id, required for authenticated CDP facilitator calls.

- Config file path: `x402.cdpApiKeyId`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-cdp-api-key-id>`
- Disabled without it: `cdpFacilitator`
- Provider docs: https://docs.cdp.coinbase.com/get-started/authentication

**How to obtain.** 1. Sign in at https://portal.cdp.coinbase.com. 2. Open API Keys and create a Secret API key. 3. Copy the key id here and the private key into CDP_API_KEY_SECRET.

### CDP_API_KEY_SECRET

Coinbase Developer Platform API private key paired with CDP_API_KEY_ID.

- Config file path: `x402.cdpApiKeySecret`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-cdp-api-private-key>`
- Disabled without it: `cdpFacilitator`
- Provider docs: https://docs.cdp.coinbase.com/get-started/authentication

**How to obtain.** Shown exactly once when you create the Secret API key at https://portal.cdp.coinbase.com. Store it in your secret manager; if lost, rotate the key.

## Signer / key management

How EIP-3009 authorizations are signed: a local hot key, or Turnkey / Lit MPC.

### SIGNER_MODE

Which signing backend produces EIP-3009 authorizations. Production should not use `local`.

- Config file path: `signer.mode`
- Type: enum (`local` | `turnkey` | `lit`)
- Required in: no
- Secret: no
- Default: `local`
- Example: `local`

**How to obtain.** Choose local for development. Choose turnkey or lit for production and fill in the matching credentials below.

### PRIVATE_KEY

Hot signer private key used when SIGNER_MODE=local. Holds the USDC float and signs authorizations.

- Config file path: `signer.privateKey`
- Type: hex
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `0x<64-hex-characters>`
- Disabled without it: `localSigner`

**How to obtain.** Generate a fresh key that is used for nothing else: `openssl rand -hex 32` and prefix with 0x, or `cast wallet new`. Never reuse a personal wallet key, never commit it, and cap its balance. Use SIGNER_MODE=turnkey or lit in production instead.

### SIGNER_MAX_USDC_PER_SESSION

Cumulative USDC a single signer session may authorize. Caps blast radius of a signer compromise.

- Config file path: `signer.maxUsdcPerSession`
- Type: number
- Required in: no
- Secret: no
- Default: `1000`
- Example: `1000`

**How to obtain.** A risk decision. Set it to the largest loss you are willing to absorb from one session.

### TURNKEY_API_PUBLIC_KEY

Turnkey API public key identifying the MPC API user that signs authorizations.

- Config file path: `signer.turnkeyApiPublicKey`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-turnkey-api-public-key>`
- Disabled without it: `mpcSigner`
- Provider docs: https://docs.turnkey.com/getting-started/quickstart

**How to obtain.** 1. Create an organization at https://app.turnkey.com. 2. Create an API user. 3. Generate an API key pair; copy the public half here and the private half into TURNKEY_API_PRIVATE_KEY.

### TURNKEY_API_PRIVATE_KEY

Turnkey API private key. Authenticates AnyX to Turnkey; it is not the signing key itself.

- Config file path: `signer.turnkeyApiPrivateKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-turnkey-api-private-key>`
- Disabled without it: `mpcSigner`
- Provider docs: https://docs.turnkey.com/getting-started/quickstart

**How to obtain.** Generated alongside TURNKEY_API_PUBLIC_KEY at https://app.turnkey.com and shown once. Store it in your secret manager.

### TURNKEY_ORGANIZATION_ID

Turnkey organization that owns the signing wallet.

- Config file path: `signer.turnkeyOrganizationId`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-turnkey-organization-id>`
- Disabled without it: `mpcSigner`

**How to obtain.** Shown in the Turnkey dashboard at https://app.turnkey.com under Organization settings.

### TURNKEY_PRIVATE_KEY_ID

Identifier of the Turnkey-held key that signs EIP-3009 authorizations.

- Config file path: `signer.turnkeyPrivateKeyId`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-turnkey-private-key-id>`
- Disabled without it: `mpcSigner`

**How to obtain.** Create a wallet or private key in the Turnkey dashboard (https://app.turnkey.com) and copy its id. Attach a policy that only permits EIP-712 TransferWithAuthorization signing.

### LIT_PROTOCOL_API_KEY

Lit Protocol API key, used when SIGNER_MODE=lit for threshold signing.

- Config file path: `signer.litApiKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-lit-protocol-api-key>`
- Disabled without it: `mpcSigner`
- Provider docs: https://developer.litprotocol.com/sdk/installation

**How to obtain.** 1. Register at https://developer.litprotocol.com. 2. Create a project and copy its API key. 3. Mint a PKP and record its public key in LIT_PKP_PUBLIC_KEY.

### LIT_PKP_PUBLIC_KEY

Public key of the Lit PKP whose threshold shares produce the signature.

- Config file path: `signer.litPkpPublicKey`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-lit-pkp-public-key>`
- Disabled without it: `mpcSigner`

**How to obtain.** Returned when you mint a PKP with the Lit SDK; also listed in the Lit developer dashboard.

### LIT_NETWORK

Lit Protocol network to connect to. Use `datil` for production.

- Config file path: `signer.litNetwork`
- Type: enum (`datil-dev` | `datil-test` | `datil`)
- Required in: no
- Secret: no
- Default: `datil-dev`
- Example: `datil-dev`

**How to obtain.** Choose the network named in the Lit docs for your stage: datil-dev, datil-test, or datil.

## Fees and spreads

The revenue model: base spread, per-asset-class spreads, and floors.

### FEE_BPS

Default AnyX spread in basis points applied on top of the required USDC. 20 = 0.20%.

- Config file path: `fees.feeBps`
- Type: number
- Required in: no
- Secret: no
- Default: `20`
- Example: `20`

**How to obtain.** A pricing decision. The whitepaper models a 0.20% blended spread.

### MIN_FEE_USDC

Fee floor in USDC, so micro-payments still cover their own routing cost.

- Config file path: `fees.minFeeUsdc`
- Type: number
- Required in: no
- Secret: no
- Default: `0.001`
- Example: `0.001`

**How to obtain.** A pricing decision, not a credential.

### FEE_BPS_STABLE

Spread for stablecoin pairs such as USDT to USDC, where AMM slippage is near zero.

- Config file path: `fees.feeBpsStable`
- Type: number
- Required in: no
- Secret: no
- Default: `5`
- Example: `5`

**How to obtain.** A pricing decision. 5 bps matches the published USDT to USDC rate.

### FEE_BPS_ETH

Spread for ETH and WETH routed to USDC.

- Config file path: `fees.feeBpsEth`
- Type: number
- Required in: no
- Secret: no
- Default: `20`
- Example: `20`

**How to obtain.** A pricing decision, not a credential.

### FEE_BPS_BTC

Spread for BTC-denominated inflows (Lightning, cbBTC, WBTC), which carry more rate risk.

- Config file path: `fees.feeBpsBtc`
- Type: number
- Required in: no
- Secret: no
- Default: `50`
- Example: `50`

**How to obtain.** A pricing decision, not a credential.

### FEE_BPS_CROSSCHAIN

Spread for payments that require a bridge hop or float advance before settlement.

- Config file path: `fees.feeBpsCrosschain`
- Type: number
- Required in: no
- Secret: no
- Default: `30`
- Example: `30`

**How to obtain.** A pricing decision, not a credential.

### MAX_FEE_BPS

Hard ceiling enforced by the API and the router contract. Rejects any misconfigured spread.

- Config file path: `fees.maxFeeBps`
- Type: number
- Required in: no
- Secret: no
- Default: `100`
- Example: `100`

**How to obtain.** A policy decision. The router contract caps this at 100 bps (1%).

## Storage

PostgreSQL for receipts and quotes, Redis for quote caching and rate limits.

### DATABASE_URL

PostgreSQL connection string for quotes, payments, receipts, API keys, and invoices.

- Config file path: `storage.databaseUrl`
- Type: string
- Required in: all
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `postgresql://<user>:<password>@<host>:5432/anyx`
- Disabled without it: `persistence`, `adminApi`

**How to obtain.** Local with Docker: `docker compose up -d postgres` then use postgresql://anyx:anyx@localhost:5432/anyx. Without Docker: create a free database at https://neon.tech or https://supabase.com and copy the connection string (append ?sslmode=require for hosted providers).

### DATABASE_POOL_MAX

Maximum PostgreSQL connections per API instance.

- Config file path: `storage.databasePoolMax`
- Type: number
- Required in: no
- Secret: no
- Default: `10`
- Example: `10`

**How to obtain.** A tuning decision. Keep the total across instances under your provider's limit.

### REDIS_URL

Redis connection string for quote caching, rate limiting, and nonce tracking.

- Config file path: `storage.redisUrl`
- Type: string
- Required in: all
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `redis://<host>:6379`
- Disabled without it: `quoteCache`, `rateLimiting`

**How to obtain.** Local with Docker: `docker compose up -d redis` then use redis://localhost:6379. Without Docker: create a free database at https://upstash.com and copy the rediss:// URL.

### QUOTE_CACHE_TTL_SECONDS

How long a DEX quote stays valid. Also the expiry written onto issued quotes.

- Config file path: `storage.quoteCacheTtlSeconds`
- Type: number
- Required in: no
- Secret: no
- Default: `30`
- Example: `30`

**How to obtain.** A policy decision. The PRD specifies a 30 second quote validity window.

## API server

Ports, CORS, admin authentication, and per-tier rate limits for the Hono API.

### PORT

Port the Hono API server binds to.

- Config file path: `api.port`
- Type: number
- Required in: no
- Secret: no
- Default: `3000`
- Example: `3000`

**How to obtain.** Any free local port. No third party involved.

### API_BASE_URL

Public base URL of this API deployment. Used in receipts, docs links, and SDK defaults.

- Config file path: `api.baseUrl`
- Type: url
- Required in: no
- Secret: no
- Default: `http://localhost:3000`
- Example: `http://localhost:3000`

**How to obtain.** Your own deployment URL. Locally, http://localhost:3000.

### API_SECRET

Bearer secret guarding admin endpoints: key issuance, partner settlement, float operations.

- Config file path: `api.secret`
- Type: string
- Required in: staging, production
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<generate-a-32-byte-random-string>`
- Disabled without it: `adminApi`

**How to obtain.** Generate your own: `openssl rand -hex 32`. Store it in your secret manager and rotate it if it is ever printed to a log.

### ANYX_API_KEY

AnyX API key used by the SDK, integration packages, and end-to-end tests when calling a hosted API.

- Config file path: `api.anyxApiKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-anyx-api-key>`

**How to obtain.** Self-hosted: issue one through the admin endpoint POST /v1/keys using API_SECRET. Hosted: register through the developer portal of the deployment you are calling.

### CORS_ALLOWED_ORIGINS

Comma-separated allowed origins. Narrow this before exposing the API publicly.

- Config file path: `api.corsAllowedOrigins`
- Type: string
- Required in: no
- Secret: no
- Default: `*`
- Example: `https://app.example.com,https://docs.example.com`

**How to obtain.** A policy decision. Use * only in development.

### RATE_LIMIT_FREE_RPM

Requests per minute allowed on the free tier.

- Config file path: `api.rateLimitFreeRpm`
- Type: number
- Required in: no
- Secret: no
- Default: `100`
- Example: `100`

**How to obtain.** A policy decision, not a credential.

### RATE_LIMIT_PRO_RPM

Requests per minute allowed on the Pro tier.

- Config file path: `api.rateLimitProRpm`
- Type: number
- Required in: no
- Secret: no
- Default: `1000`
- Example: `1000`

**How to obtain.** A policy decision, not a credential.

## Contract addresses

Deployed AnyX contracts plus the fixed third-party addresses they depend on.

### USDC_BASE

Native USDC on Base. The settlement asset and the EIP-3009 verifying contract.

- Config file path: `contracts.usdcBase`
- Type: address
- Required in: all
- Secret: no
- Default: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Example: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

**How to obtain.** Already set to the canonical Circle-issued USDC on Base. Verify against https://developers.circle.com/stablecoins/usdc-contract-addresses before changing it.

### PERMIT2_ADDRESS

Uniswap Permit2, used for gasless input-token approvals into the router.

- Config file path: `contracts.permit2`
- Type: address
- Required in: no
- Secret: no
- Default: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- Example: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

**How to obtain.** Permit2 is deployed at the same address on every supported chain. Leave the default.

### ANYX_ROUTER

Deployed AnyXRouter address. Unset until contracts are deployed for this environment.

- Config file path: `contracts.anyxRouter`
- Type: address
- Required in: no
- Secret: no
- Default: none
- Example: `0x<40-hex-characters>`
- Disabled without it: `onchainSwap`

**How to obtain.** Produced by the contract deployment: `forge script script/Deploy.s.sol --rpc-url $RPC_URL_BASE_SEPOLIA --broadcast --verify`. Copy the address from deployments/<network>.json. Until it is set, AnyX settles from the pre-funded USDC float instead of swapping on-chain.

### FEE_COLLECTOR

Address that receives the AnyX spread. Should be a multisig in production.

- Config file path: `contracts.feeCollector`
- Type: address
- Required in: no
- Secret: no
- Default: none
- Example: `0x<40-hex-characters>`

**How to obtain.** Either the FeeCollector contract emitted by the deploy script, or a Safe you create at https://app.safe.global. Revenue accrues here, so prefer a multisig over an EOA.

### RESERVE_POOL

ReservePool contract holding the USDC float that fronts cross-chain and Lightning payments.

- Config file path: `contracts.reservePool`
- Type: address
- Required in: no
- Secret: no
- Default: none
- Example: `0x<40-hex-characters>`
- Disabled without it: `reserveFloat`, `floatSettlement`

**How to obtain.** Deployed by the contract deploy script in Phase 3. After deployment, fund it with USDC from the float funding wallet.

### BASESCAN_API_KEY

Basescan key used by Foundry to verify deployed contract source.

- Config file path: `contracts.basescanApiKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-basescan-api-key>`
- Disabled without it: `contractVerification`

**How to obtain.** 1. Create an account at https://basescan.org/register. 2. Open API Keys. 3. Add a key and copy it. Free tier is sufficient for verification.

## Cross-chain bridge and float

Circle CCTP, Stargate, and the USDC float pool that fronts cross-chain payments.

### CCTP_ATTESTER_URL

Circle Iris attestation service polled between a CCTP burn and the destination mint.

- Config file path: `bridge.cctpAttesterUrl`
- Type: url
- Required in: no
- Secret: no
- Default: `https://iris-api.circle.com`
- Example: `https://iris-api.circle.com`
- Disabled without it: `crosschainCctp`
- Provider docs: https://developers.circle.com/stablecoins/docs/cctp-getting-started

**How to obtain.** Public and keyless. Use https://iris-api.circle.com for mainnet and https://iris-api-sandbox.circle.com for testnets.

### STARGATE_ROUTER_ADDRESS

Stargate router used as the CCTP fallback for USDT and ETH bridging.

- Config file path: `bridge.stargateRouter`
- Type: address
- Required in: no
- Secret: no
- Default: none
- Example: `0x<40-hex-characters>`
- Disabled without it: `stargateBridge`

**How to obtain.** Look up the router for your source chain in the Stargate deployment list at https://stargateprotocol.gitbook.io/stargate/developers/contract-addresses/mainnet and paste the address.

### FLOAT_POOL_TARGET_USDC

Target USDC float on Base. Drives replenishment alerts and float utilisation limits.

- Config file path: `bridge.floatPoolTargetUsdc`
- Type: number
- Required in: no
- Secret: no
- Default: `10000`
- Example: `10000`

**How to obtain.** A capital decision. The strategy note suggests a 10,000 to 50,000 USDC float for the Lightning and cross-chain paths.

### FLOAT_POOL_BALANCE_USDC

Declared USDC float available on Base, in atomic units (6 decimals). Settlement refuses to front a payment larger than this. Distinct from FLOAT_POOL_TARGET_USDC, which is the level you are aiming for rather than the balance you actually hold.

- Config file path: `bridge.floatPoolBalanceUsdc`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `10000000000`
- Disabled without it: `floatSettlement`

**How to obtain.** A stand-in for reading the deployed ReservePool balance on-chain, for self-hosted and development setups. Set it to the USDC atomic balance the pool actually holds (10,000 USDC is 10000000000). Leave it unset to disable float-backed settlement entirely rather than have it assume an unlimited pool.

### FLOAT_FUNDING_WALLET

Treasury address that funds and withdraws the reserve float. Only this address may top the pool up.

- Config file path: `bridge.floatFundingWallet`
- Type: address
- Required in: no
- Secret: no
- Default: none
- Example: `0x<40-hex-characters>`
- Disabled without it: `reserveFloat`

**How to obtain.** Create a Safe multisig at https://app.safe.global on Base, fund it with USDC, and paste its address. This is a human step: no code path can create the float for you.

### BRIDGE_POLL_INTERVAL_MS

How often the bridge monitor polls Circle Iris for an attestation.

- Config file path: `bridge.pollIntervalMs`
- Type: number
- Required in: no
- Secret: no
- Default: `5000`
- Example: `5000`

**How to obtain.** A tuning decision, not a credential.

### BRIDGE_MAX_WAIT_SECONDS

Give up on a bridge leg after this long and fall back to the float or refund the payer.

- Config file path: `bridge.maxWaitSeconds`
- Type: number
- Required in: no
- Secret: no
- Default: `900`
- Example: `900`

**How to obtain.** A policy decision. CCTP typically settles in 2 to 10 minutes.

## Lightning Network

LND connection details for the Bitcoin Lightning payment path.

### LND_GRPC_HOST

host:port of the LND gRPC interface that issues and watches Lightning invoices.

- Config file path: `lightning.lndGrpcHost`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-lnd-host>:10009`
- Disabled without it: `lightning`

**How to obtain.** Run your own LND node (https://github.com/lightningnetwork/lnd) on a VPS, or use a hosted node such as Voltage (https://voltage.cloud). Copy the gRPC host and port; port 10009 is the LND default.

### LND_TLS_CERT_PATH

Filesystem path to the LND TLS certificate used to establish the gRPC channel.

- Config file path: `lightning.lndTlsCertPath`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `/secrets/lnd/tls.cert`
- Disabled without it: `lightning`

**How to obtain.** Copy tls.cert from your LND data directory (~/.lnd/tls.cert) onto the API host and point this at it. Mount it as a read-only secret; do not commit it.

### LND_MACAROON_PATH

Filesystem path to the LND macaroon that grants invoice permissions.

- Config file path: `lightning.lndMacaroonPath`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `/secrets/lnd/invoice.macaroon`
- Disabled without it: `lightning`

**How to obtain.** Bake a least-privilege macaroon with `lncli bakemacaroon invoices:read invoices:write` rather than reusing admin.macaroon, copy it to the API host, and point this at it. The macaroon file is a credential: mount it read-only and keep it out of git.

### LIGHTNING_INVOICE_EXPIRY_SECONDS

Lightning invoice expiry. Keep it at or below the x402 challenge maxTimeoutSeconds.

- Config file path: `lightning.invoiceExpirySeconds`
- Type: number
- Required in: no
- Secret: no
- Default: `300`
- Example: `300`

**How to obtain.** A policy decision. 300 seconds matches the x402 default challenge window.

### BTC_RATE_BUFFER_BPS

Conservative buffer added to the BTC/USD rate so invoice sizing survives rate movement.

- Config file path: `lightning.btcRateBufferBps`
- Type: number
- Required in: no
- Secret: no
- Default: `50`
- Example: `50`

**How to obtain.** A risk decision. 50 bps (0.5%) matches the roadmap's suggested buffer.

## Billing (Stripe)

Stripe subscription billing for the Pro tier of the hosted API.

### STRIPE_SECRET_KEY

Stripe secret key used to create Checkout sessions and customer portal links.

- Config file path: `billing.stripeSecretKey`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-stripe-secret-key>`
- Disabled without it: `stripeBilling`
- Provider docs: https://docs.stripe.com/keys

**How to obtain.** 1. Create an account at https://dashboard.stripe.com/register. 2. Open Developers then API keys. 3. Copy the secret key. Use a test-mode key outside production and never the publishable key.

### STRIPE_PRO_PRICE_ID

Stripe Price id for the Pro subscription that Checkout sessions reference.

- Config file path: `billing.stripeProPriceId`
- Type: string
- Required in: no
- Secret: no
- Default: none
- Example: `<your-stripe-price-id>`
- Disabled without it: `stripeBilling`
- Provider docs: https://docs.stripe.com/products-prices/how-products-and-prices-work

**How to obtain.** 1. In the Stripe dashboard create a Product for the AnyX Pro plan. 2. Add a recurring monthly price. 3. Copy the price id from the price detail page.

### STRIPE_WEBHOOK_SECRET

Signing secret used to verify Stripe webhook payloads before acting on them.

- Config file path: `billing.stripeWebhookSecret`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-stripe-webhook-signing-secret>`
- Disabled without it: `stripeBilling`
- Provider docs: https://docs.stripe.com/webhooks

**How to obtain.** 1. In the Stripe dashboard add a webhook endpoint pointing at https://<your-api-host>/webhooks/stripe. 2. Subscribe to checkout.session.completed, customer.subscription.deleted, and invoice.payment_failed. 3. Copy the signing secret. Locally, `stripe listen --forward-to localhost:3000/webhooks/stripe` prints one.

### STRIPE_PORTAL_RETURN_URL

Where Stripe returns the user after they manage their subscription.

- Config file path: `billing.stripePortalReturnUrl`
- Type: url
- Required in: no
- Secret: no
- Default: none
- Example: `http://localhost:3000/portal`

**How to obtain.** Any URL you control, typically the developer portal page of your dashboard.

## Deployment and release

Fly.io deploy targets, health checks, and npm publishing.

### FLY_API_TOKEN

Fly.io deploy token used by CI to ship the API and Lightning services.

- Config file path: `deploy.flyApiToken`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-fly-deploy-token>`
- Disabled without it: `apiDeploy`
- Provider docs: https://fly.io/docs/launch/deploy

**How to obtain.** 1. Install flyctl from https://fly.io/docs/flyctl/install. 2. Run `fly tokens create deploy` (scoped to one app) and copy the token. 3. Store it as the GitHub Actions secret FLY_API_TOKEN. Never place it in .env files that ship with the repo.

### FLY_APP_API

Fly.io app name for the REST API.

- Config file path: `deploy.flyAppApi`
- Type: string
- Required in: no
- Secret: no
- Default: `anyx-api`
- Example: `anyx-api`

**How to obtain.** Created by `fly launch`; app names are globally unique, so pick a name you own.

### FLY_APP_LIGHTNING

Fly.io app name for the Lightning service.

- Config file path: `deploy.flyAppLightning`
- Type: string
- Required in: no
- Secret: no
- Default: `anyx-lightning`
- Example: `anyx-lightning`

**How to obtain.** Created by `fly launch` in apps/lightning. Only needed once the Lightning path is enabled.

### HEALTHCHECK_URL

URL polled after deploy to confirm the release is serving traffic.

- Config file path: `deploy.healthcheckUrl`
- Type: url
- Required in: no
- Secret: no
- Default: `http://localhost:3000/health`
- Example: `http://localhost:3000/health`

**How to obtain.** The /health route of the deployment you are releasing.

### NPM_TOKEN

npm automation token used to publish @anyx/sdk and the integration packages.

- Config file path: `deploy.npmToken`
- Type: string
- Required in: no
- Secret: yes — never logged, masked in all output
- Default: none
- Example: `<your-npm-automation-token>`
- Disabled without it: `sdkPublish`
- Provider docs: https://docs.npmjs.com/creating-and-viewing-access-tokens

**How to obtain.** 1. Sign in at https://www.npmjs.com. 2. Open Access Tokens and create a Granular Access or Automation token scoped to the @anyx org. 3. Store it as the GitHub Actions secret NPM_TOKEN.

## Multi-agent orchestrator

How the build orchestrator dispatches specialist agents and gates production.

### ORCHESTRATOR_AGENT_CMD

Executable the orchestrator invokes to run one specialist agent task locally.

- Config file path: `orchestrator.agentCommand`
- Type: string
- Required in: no
- Secret: no
- Default: `cursor-agent`
- Example: `cursor-agent`

**How to obtain.** The command of whatever agent runner you use. It must accept a prompt on stdin and exit non-zero on failure.

### ORCHESTRATOR_AGENT_ENDPOINT

HTTP endpoint for a remote agent executor. When unset, tasks run through the local command.

- Config file path: `orchestrator.agentEndpoint`
- Type: url
- Required in: no
- Secret: no
- Default: none
- Example: `https://agents.your-domain.example/dispatch`
- Disabled without it: `orchestratorRemoteExecutor`

**How to obtain.** The dispatch URL of your own agent-runner service. Leave unset to run agents locally.

### ORCHESTRATOR_MAX_FIX_ATTEMPTS

Auto-fix attempts per failing task before the orchestrator escalates to a human.

- Config file path: `orchestrator.maxFixAttempts`
- Type: number
- Required in: no
- Secret: no
- Default: `3`
- Example: `3`

**How to obtain.** A policy decision, not a credential.

### ORCHESTRATOR_CONCURRENCY

How many specialist agents may run at once against the same working tree.

- Config file path: `orchestrator.concurrency`
- Type: number
- Required in: no
- Secret: no
- Default: `3`
- Example: `3`

**How to obtain.** A tuning decision. Keep it low enough that agents own disjoint file scopes and avoid git contention.

### ORCHESTRATOR_AUTO_APPROVE_PRODUCTION

When false (the default), a human must approve every production promotion. Only the operator should change this.

- Config file path: `orchestrator.autoApproveProduction`
- Type: boolean
- Required in: no
- Secret: no
- Default: `false`
- Example: `false`
- Disabled without it: `orchestratorProductionAutoApprove`

**How to obtain.** A governance decision. Leave it false until contracts are audited and the float is funded.

### ORCHESTRATOR_STATE_DIR

Directory holding orchestrator run state, task logs, and bug reports.

- Config file path: `orchestrator.stateDir`
- Type: string
- Required in: no
- Secret: no
- Default: `.anyx/orchestrator`
- Example: `.anyx/orchestrator`

**How to obtain.** Any writable path. Keep it out of version control.
