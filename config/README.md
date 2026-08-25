# Connect your accounts

Everything AnyX needs from a human is listed here. Nothing in this repository
requires a credential to *run* — the API reports a degraded mode, the
orchestrator defaults to dry-run, and every disabled capability says so out
loud. This guide is about turning those capabilities on.

## The two files you edit

| File | What goes in it | Committed? |
| --- | --- | --- |
| `.env.local` | Secrets: API keys, private keys, connection strings | No, git-ignored |
| `config/anyx.config.jsonc` | Non-secret settings: fees, slippage, timeouts, deploy targets | No, git-ignored |

Start by copying the templates:

```bash
cp .env.example .env.local
cp config/anyx.config.example.jsonc config/anyx.config.jsonc
```

Precedence, strongest first: `process env` → `.env.local` → `.env` →
`config/anyx.config.jsonc` → built-in defaults. Anything in a file can be
overridden by an environment variable, which is how CI and production should
supply secrets.

## Find out what you actually need

You do not have to read this whole page. Ask the tooling:

```bash
bun run config:missing         # unset keys, with how to obtain each one
bun run config:features        # which capabilities are on, and what unlocks the rest
bun run orchestrate gates      # the same thing, framed as build-blocking gates
bun run orchestrate gates --verify   # prove the credentials you have actually work
```

`config:missing` prints the signup URL and the exact steps for every key it
reports, so it is usually faster than this document.

## What you need, in order

### Tier 1 — run it locally

Nothing. `bun install && bun run dev` works with no accounts at all. Quotes and
settlement are unavailable, and the health endpoint tells you why.

### Tier 2 — real quotes

| What | Where | Key | Cost | Unlocks |
| --- | --- | --- | --- | --- |
| 1inch API key | [portal.1inch.dev](https://portal.1inch.dev/) | `ONEINCH_API_KEY` | Free tier | EVM swap quotes |
| 0x API key | [dashboard.0x.org](https://dashboard.0x.org/) | `ZEROX_API_KEY` | Free tier | Second quote source and failover |
| Postgres | [neon.tech](https://neon.tech/) or `docker compose up -d postgres` | `DATABASE_URL` | Free tier | Quotes, payments, receipts |
| Redis | [upstash.com](https://upstash.com/) or `docker compose up -d redis` | `REDIS_URL` | Free tier | Quote cache, rate limiting |

At least one DEX key is required; both are strongly recommended, since the
whole point of `getBestQuote` is comparing two routes and surviving one
provider's outage.

### Tier 3 — settle a real payment

| What | Where | Key | Notes |
| --- | --- | --- | --- |
| Base RPC | [dashboard.alchemy.com](https://dashboard.alchemy.com/) | `RPC_URL_BASE` | Public endpoint rate-limits under load |
| Ethereum RPC | same | `RPC_URL_ETHEREUM` | For the Ethereum-side flows |
| Coinbase CDP | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/) | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | The facilitator that submits on-chain |
| Fallback facilitator | self-hosted or third-party | `FACILITATOR_FALLBACK_URL` | A single facilitator is a censorship point |
| Signing key | see below | `PRIVATE_KEY` or Turnkey/Lit keys | Signs EIP-3009 on the payer's behalf |

**About the signing key.** This is the most dangerous credential in the system.
The whitepaper rates hot-signer compromise as a HIGH severity attack vector,
and it is the one place where a mistake costs real money.

- Development: `openssl rand -hex 32`, prefix with `0x`, fund it with a few
  dollars of Base ETH. A throwaway key, never a personal wallet.
- Staging and production: use MPC. Set `signer.mode` to `turnkey` or `lit` and
  provision a key with a per-session spend limit
  (`SIGNER_MAX_USDC_PER_SESSION`). Do not ship a raw key to production.

### Tier 4 — optional capabilities

Each of these is self-contained. Skip any you do not need; the feature simply
stays off.

| Capability | Where | Keys |
| --- | --- | --- |
| Solana / cross-chain | [helius.dev](https://www.helius.dev/) | `RPC_URL_SOLANA` |
| USDC float pool | your own wallet, ideally a Safe multisig | `FLOAT_FUNDING_WALLET` |
| Bitcoin via Lightning | [voltage.cloud](https://voltage.cloud/) | `LND_GRPC_HOST`, `LND_TLS_CERT_PATH`, `LND_MACAROON_PATH` |
| Pro plan billing | [dashboard.stripe.com](https://dashboard.stripe.com/) | `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` |
| Contract verification | [basescan.org/myapikey](https://basescan.org/myapikey) | `BASESCAN_API_KEY` |
| API deployment | [fly.io](https://fly.io/) | `FLY_API_TOKEN` |
| Publishing the SDK | [npmjs.com](https://www.npmjs.com/) | `NPM_TOKEN` |

The float pool and the Lightning gateway are the two that need actual capital
rather than just an account. The low-hanging-fruit analysis sizes a production
Lightning float at $10K–$50K; start far smaller, on testnet.

### Tier 5 — let the agents write code

The orchestrator ships in dry-run: it renders a full prompt per task and stops.
To let it dispatch work for real, point it at a coding agent:

```jsonc
// config/anyx.config.jsonc
"orchestrator": {
  // A local CLI agent, invoked once per task.
  // Placeholders: {{promptFile}} {{taskId}} {{agentId}} {{repoRoot}}
  "agentCommand": "your-agent --prompt-file {{promptFile}}",

  // ...or an HTTP service that accepts the prompt as a POST body.
  "agentEndpoint": ""
}
```

No provider is compiled in and no key is stored in the orchestrator. It only
knows how to hand a prompt to a command or a URL.

## Per-environment configuration

`config/environments/` holds overlays showing what changes between
environments. Merge the one you want into `config/anyx.config.jsonc`, or point
at it with `ANYX_ENV`.

| Environment | Signer | Production deploys | Typically |
| --- | --- | --- | --- |
| `local.jsonc` | local key | n/a | Docker or hosted free tiers |
| `staging.jsonc` | MPC | auto-approved | Base Sepolia, test-mode Stripe |
| `production.jsonc` | MPC, required | needs explicit `--approve` | Base mainnet, live Stripe |

`bun run config:check --env production` will refuse a configuration that would
be unsafe in production, such as a raw `PRIVATE_KEY` where MPC is expected.

## GitHub Actions secrets

CI degrades gracefully when a secret is absent — the relevant job skips rather
than fails — so add these only when you want that job to run.

| Secret | Used by |
| --- | --- |
| `FLY_API_TOKEN` | `deploy-api.yml` |
| `NPM_TOKEN` | `publish-sdk.yml` |
| `BASESCAN_API_KEY` | contract verification |
| `DATABASE_URL`, `REDIS_URL` | integration tests |
| `ONEINCH_API_KEY`, `ZEROX_API_KEY` | live quote tests |

Add them under Settings → Secrets and variables → Actions.

## Safety rules

1. Never commit `.env.local` or `config/anyx.config.jsonc`. Both are
   git-ignored; keep it that way.
2. Never paste a real key into `config/anyx.config.example.jsonc` or
   `.env.example`. Those are templates and they are committed.
3. Every value marked `secret` is masked in all CLI output. If you ever see a
   credential printed in full, that is a bug worth reporting.
4. Use separate credentials per environment. A staging key that can move
   mainnet funds defeats the point of having a staging environment.
