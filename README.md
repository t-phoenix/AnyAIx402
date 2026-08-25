# AnyAIx402 / AnyX

**Pay with any token. Settle on x402.**

Universal multi-token payment adapter for the [x402](https://x402.org) protocol. Payers holding ETH, USDT, WBTC, SOL, BTC (Lightning), or any ERC-20 can settle USDC-denominated x402 API payments in one call. API providers remain unchanged.

This repository currently contains the **multi-agent foundation**: product docs, agent specs, orchestrator workflow, and human config templates. Application monorepo packages are built next (Phase 0+).

## Quick links

| Path | Purpose |
|------|---------|
| [`docs/MULTI_AGENT_PLAN.md`](./docs/MULTI_AGENT_PLAN.md) | Master multi-agent build plan |
| [`docs/README.md`](./docs/README.md) | Documentation index |
| [`AGENTS.md`](./AGENTS.md) | How Cursor/cloud agents run the loop |
| [`agents/`](./agents/) | Specialist + orchestrator specs |
| [`.env.example`](./.env.example) | Secrets template (copy → `.env.local`) |
| [`config/secrets.example.yaml`](./config/secrets.example.yaml) | Phase-ordered credentials checklist |
| [`scripts/orchestrate.sh`](./scripts/orchestrate.sh) | Status / next-task helper |

## Human setup (required before paid API / chain work)

```bash
cp .env.example .env.local
# Fill Phase 0–1 values (DB, Redis, RPC, DEX keys, facilitator, PRIVATE_KEY for dev)
./scripts/orchestrate.sh status
./scripts/orchestrate.sh next
```

## Tech stack (locked)

Bun · Hono · Turborepo · TypeScript · viem · Drizzle · PostgreSQL · Redis · Foundry · 1inch/0x · Circle CCTP · Docker · Fly.io · GitHub Actions

## License

Apache-2.0 (intended for packages; confirm at publish time)
