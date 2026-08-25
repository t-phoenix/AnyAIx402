# AnyAIx402 (AnyX)

**Pay any x402-gated API with any token — ETH, USDT, WBTC, SOL, or BTC via Lightning.**
AnyX intercepts the HTTP 402 payment challenge, routes the payer's token through a DEX
aggregator to USDC, signs an EIP-3009 authorization, and settles through a standard x402
facilitator — transparently, with zero changes required on the API provider's side.

## Start here

- [`docs/MULTI_AGENT_SYSTEM_PLAN.md`](docs/MULTI_AGENT_SYSTEM_PLAN.md) — how this software is
  built, tested, fixed, and deployed by a coordinated fleet of specialized agents.
- [`docs/AGENTS.md`](docs/AGENTS.md) — the product build roadmap (phases, tasks, acceptance
  criteria) that the agents execute.
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) + [`.env.example`](.env.example) — every
  credential the project uses, whether it's required yet, and where to get it.
- [`docs/x402-universal-adapter-prd.md`](docs/x402-universal-adapter-prd.md) — product
  requirements.
- [`docs/x402-universal-adapter-whitepaper.md`](docs/x402-universal-adapter-whitepaper.md) —
  technical thesis and architecture.
- [`docs/anyx-llms.txt`](docs/anyx-llms.txt) — the AI-agent discovery file
  ([llmstxt.org](https://llmstxt.org) format) for the live API.
- [`docs/anyx-ai-integrations.md`](docs/anyx-ai-integrations.md),
  [`docs/anyx-market-research.md`](docs/anyx-market-research.md),
  [`docs/anyx-monetization-gtm.md`](docs/anyx-monetization-gtm.md),
  [`docs/anyx-marketing-social.md`](docs/anyx-marketing-social.md),
  [`docs/x402-low-hanging-fruit.md`](docs/x402-low-hanging-fruit.md) — supporting research,
  integration guides, and go-to-market strategy.

## Quickstart (once Phase 0/1 scaffold lands)

```bash
cp .env.example .env.local   # fill in what you have — see docs/CONFIGURATION.md
docker compose up -d         # Postgres + Redis
bun install
bun run db:migrate
bun run dev
```

## Status

Repository scaffolding and Phase 0/1 implementation are in progress. See open PRs and
`docs/MULTI_AGENT_SYSTEM_PLAN.md` §8 for what's landing next.
