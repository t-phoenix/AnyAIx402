# AnyX / AnyAIx402 — Instructions for Cursor & Cloud Agents

> Read `docs/MULTI_AGENT_PLAN.md` and this file before starting work.
> Source docs live in `docs/`. Agent role specs live in `agents/` (mirrored in `.cursor/agents/`).

## Project identity

- **Name:** AnyX (repo: AnyAIx402)
- **Tagline:** Pay with any token. Settle on x402.
- **Stack:** Bun, Hono, Turborepo, viem, Drizzle, Foundry, Redis, Fly.io (see `docs/agents.md`)

## How to run the multi-agent loop

1. **Orchestrator** selects the next phase task (start at Phase 0 until monorepo exists).
2. Write `artifacts/tasks/TASK-<id>.md` with owner agent ID, AC, and secrets needed.
3. If secrets missing → write `artifacts/tasks/BLOCKED-<id>.md` and stop for human `.env.local` fill.
4. Specialist **implements** only within their domain; import shared types from core/db.
5. **QA** runs tests (`bun test`, `forge test` when applicable) and CI.
6. On failure → QA opens `artifacts/bugs/BUG-*.md` → owner **fixes** → **retest**.
7. Max **5** fix iterations, then escalate to human.
8. **Deploy** only if gates pass (CI green, no P0 bugs, health OK, secrets present). Prefer `workflow_dispatch` until production secrets exist.

Helper script (guidance + status scan):

```bash
./scripts/orchestrate.sh status
./scripts/orchestrate.sh next
```

## Hard rules

1. Do **not** invent requirements that contradict `docs/`.
2. Prefer `@anyx/*` package naming over legacy `@upa/*` PRD aliases.
3. Never commit `.env.local`, private keys, macaroons, or Stripe live keys.
4. Use **viem**, not ethers.
5. Write tests with implementation.
6. Phase 1 MVP may use pre-funded USDC float (roadmap note) before full on-chain router.

## Specialist quick map

| Need | Agent ID |
|------|----------|
| Pipeline / prioritization | `orchestrator` |
| 402 parse / facilitator | `x402-protocol` |
| Quotes / 1inch / 0x / fees | `payments-dex` |
| Solidity | `contracts` |
| CCTP / bridges | `bridge-cctp` |
| Lightning | `lightning` |
| Wallets / signing | `wallet` |
| Hono API | `api-backend` |
| npm SDK | `sdk-dx` |
| Schema | `db` |
| LangChain/MCP/etc. | `ai-integrations` |
| Scope / PRD | `product` |
| Threats / secrets | `security` |
| Tests / bugs | `qa` |
| CI / Fly | `devops` |
| Stripe / keys | `monetization` |
| Content drafts | `marketing` |
| Competitive intel | `research` |

## Human config surface

1. Copy `.env.example` → `.env.local`
2. Optionally track progress in `config/secrets.example.yaml`
3. See `docs/MULTI_AGENT_PLAN.md` §5 for phase-ordered checklist
