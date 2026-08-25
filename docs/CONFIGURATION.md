# Configuration Guide

This is the practical, step-by-step companion to
[`MULTI_AGENT_SYSTEM_PLAN.md`](./MULTI_AGENT_SYSTEM_PLAN.md) §6. It lists **every** environment
variable AnyX uses, whether it's required right now, and exactly where to get it. Copy
`.env.example` (repo root) to `.env.local` and fill in what you have — anything you leave blank
degrades gracefully (mocked responses in dev/tests, a clear `CONFIG_MISSING` error in
production) rather than crashing the app.

For Cloud Agent runs, set these once in **Cursor Dashboard → Cloud Agents → Secrets** instead
of `.env.local` — they're injected automatically into every future agent VM for this repo.

## Tier 0 — Nothing to configure (works out of the box)

`docker-compose up` gives you Postgres + Redis with sane local defaults
(`DATABASE_URL`, `REDIS_URL` in `.env.example` already point at them). No account needed.

## Tier 1 — Needed to see a *real* quote/swap (Phase 1)

| Variable | What it's for | How to get it | Time to obtain |
|---|---|---|---|
| `RPC_URL_BASE` | Read Base chain state, submit txs | Free tier at [Alchemy](https://alchemy.com) or [QuickNode](https://quicknode.com), or use the public `https://mainnet.base.org` for read-only dev | 2 min |
| `RPC_URL_ETHEREUM` | Ethereum-side quotes (Phase 2 tokens) | Same as above | 2 min |
| `ONEINCH_API_KEY` | Best-price swap quotes | [portal.1inch.dev](https://portal.1inch.dev) → create app → copy key | 5 min |
| `ZEROX_API_KEY` | Fallback swap quotes | [dashboard.0x.org](https://dashboard.0x.org) | 5 min |
| `PRIVATE_KEY` | Hot signer for EIP-3009 authorizations | Generate a **new, dedicated** wallet (`cast wallet new` or any wallet generator) — never reuse a personal key. Fund with testnet ETH/USDC first. | 5 min |
| `FACILITATOR_URL` | Settles the x402 payment on-chain | Coinbase CDP: [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) | 10 min |

Without these, `/v1/quote` and `/v1/pay` run against mocked DEX/facilitator responses in tests
and return `CONFIG_MISSING` in a real server — safe, no crash, clearly labeled.

## Tier 2 — Needed for smart-contract deployment (Phase 2)

| Variable | What it's for | How to get it |
|---|---|---|
| `BASESCAN_API_KEY` | Verify deployed contracts | [basescan.org/apis](https://basescan.org/apis) |
| `RPC_URL_BASE_SEPOLIA` | Testnet deploy target | Same RPC providers as above, testnet endpoint |

Mainnet contract deployment is **never automatic** — it runs only via a manually triggered
GitHub Actions workflow (`contracts-mainnet.yml`) that a human must click "Run" on.

## Tier 3 — Needed for cross-chain (Phase 3)

| Variable | What it's for | How to get it |
|---|---|---|
| `RPC_URL_SOLANA` | Solana-side swaps (Jupiter) | Public endpoint for dev, or a paid RPC (Helius/Triton) for production |
| `CCTP_ATTESTER_URL` | Circle CCTP attestation polling | Default public URL already in `.env.example`; no account needed unless you hit rate limits, then register at [developers.circle.com](https://developers.circle.com) |

## Tier 4 — Needed for Lightning/BTC (Phase 4)

| Variable | What it's for | How to get it |
|---|---|---|
| `LND_TLS_CERT_PATH`, `LND_MACAROON_PATH` | Connect to your Lightning node | Run your own LND node, or use a hosted node provider (e.g. [Voltage](https://voltage.cloud)); export the TLS cert + macaroon it gives you |

## Tier 5 — Needed for billing (Phase 6)

| Variable | What it's for | How to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Create checkout sessions | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys (use a **test** key first) |
| `STRIPE_PRO_PRICE_ID` | The $49/mo Pro plan price object | Create a Product + Price in the Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Verify incoming webhook signatures | Stripe dashboard → Webhooks → your endpoint → "Signing secret" |

## Tier 6 — Needed to deploy/release

| Variable | What it's for | How to get it |
|---|---|---|
| `FLY_API_TOKEN` | Deploy `apps/api` / `apps/dashboard` | `flyctl auth login && flyctl auth token` |
| `NPM_TOKEN` | Publish `@anyx/sdk` to npm | npmjs.com → Access Tokens → Automation token |

## Checking what's missing

Run:

```bash
bun run scripts/setup.sh
```

This prints every variable relevant to the phases already scaffolded in the repo, whether it's
set, and a direct link to obtain it if it isn't — so you always know exactly what, if anything,
is blocking on you.

## Security notes

- `.env.local` is git-ignored. Never commit real keys.
- `PRIVATE_KEY` should be a dedicated hot-signer wallet with a small, monitored balance — not a
  treasury key. Phase 4+ of the roadmap (`docs/AGENTS.md`) moves this to MPC (Turnkey/Lit
  Protocol); the raw env var is a Phase 1 convenience only.
- Stripe and facilitator keys should start in **test mode**; the Orchestrator will call this out
  explicitly before ever recommending a switch to live mode.
