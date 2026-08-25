# AnyAIx402 / AnyX — Documentation Index

Canonical product and strategy documents for **AnyX** (also referred to as AnyAIx402 / x402 Universal Adapter).

**Tagline:** Pay with any token. Settle on x402.

**Core value:** Intercept x402 payment challenges and let payers holding ETH, USDT, WBTC, SOL, BTC (Lightning), or any ERC-20 settle USDC-denominated x402 API payments — transparently, in one call.

---

## Master plan

| Document | Description |
|----------|-------------|
| [MULTI_AGENT_PLAN.md](./MULTI_AGENT_PLAN.md) | Master multi-agent build plan: product summary, agent roster, orchestrator pipeline, automation loops, config checklist, phased roadmap |

---

## Source documents

| File | Description |
|------|-------------|
| [agents.md](./agents.md) | Cursor agent build roadmap — locked tech stack, monorepo layout, phased engineering tasks (Phase 0–7), CI/CD, launch checklist |
| [x402-universal-adapter-whitepaper.md](./x402-universal-adapter-whitepaper.md) | Technical whitepaper & thesis — problem, x402 primer, architecture, security model, fee model, ecosystem map |
| [x402-universal-adapter-prd.md](./x402-universal-adapter-prd.md) | Product Requirements Document — goals, personas, user stories, FRs, architecture, acceptance criteria, risks |
| [llms.txt](./llms.txt) | AI-discovery file (llms.txt format) — API surface, SDK usage, fees, errors for LLM/agent consumption |
| [anyx-ai-integrations.md](./anyx-ai-integrations.md) | AI agent integration guide — LangChain, AgentKit, MCP, OpenAI, CrewAI, ElizaOS, AutoGen |
| [anyx-market-research.md](./anyx-market-research.md) | Market research — competitive landscape, demand signals, TAM/SAM/SOM, positioning |
| [anyx-monetization-gtm.md](./anyx-monetization-gtm.md) | Monetization & GTM — swap spread, pricing tiers, distribution channels, revenue projections |
| [anyx-marketing-social.md](./anyx-marketing-social.md) | Marketing & social strategy — brand voice, X/Twitter, community, content calendar, press |
| [x402-low-hanging-fruit.md](./x402-low-hanging-fruit.md) | Immediate revenue plays — Quote API, USDT SDK, ETH widget, Lightning gateway, ranked by effort |

---

## Related repo scaffolding

| Path | Purpose |
|------|---------|
| [`../agents/`](../agents/) | Specialist + orchestrator agent specs |
| [`../.cursor/agents/`](../.cursor/agents/) | Cursor-facing agent stubs (mirrors `agents/`) |
| [`../AGENTS.md`](../AGENTS.md) | How Cursor/cloud agents should run the build loop |
| [`../.env.example`](../.env.example) | Human-filled secrets & API config template |
| [`../config/secrets.example.yaml`](../config/secrets.example.yaml) | Structured secrets checklist (no real values) |

---

*Documents preserved from project uploads (August 2025). Do not invent requirements that contradict these sources.*
