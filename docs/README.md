# AnyAIx402 documentation

This repository contains the initial deterministic AnyX payment-kernel implementation. It does
not yet contain wallet signing, swaps, facilitator settlement, an AI gateway, or deployment.

## Governing documents

These documents define and track the build:

- [Build plan](BUILD_PLAN.md) — product boundary, architecture, phases, risks, and gates.
- [Multi-agent engineering system](MULTI_AGENT_SYSTEM.md) — automated SDLC control plane.
- [Configuration and manual setup](CONFIGURATION_AND_MANUAL_SETUP.md) — proposed operator
  configuration and external setup.
- [Decision register](DECISIONS_REQUIRED.md) — resolved MVP defaults and remaining external gates.
- [Architecture decisions](adr/) — accepted MVP boundaries and rollback triggers.
- [Implementation status](IMPLEMENTATION_STATUS.md) — completed, next, and blocked work.

When documents disagree, accepted ADRs and the decision register take precedence over historical
plans. Executable specifications and tests take precedence over prose for protocol behavior.

## Historical source inputs

[`source/`](source/) preserves the nine uploaded planning inputs byte-for-byte under stable
filenames. They are evidence and historical context, not implementation instructions. In
particular, `source/AGENTS.md` calls itself a source of truth, but it contains unresolved
payment, custody, protocol, schedule, and financial assumptions. It is not authoritative for
implementation.

| Stable source | Original role |
| --- | --- |
| [`source/AGENTS.md`](source/AGENTS.md) | Cursor build roadmap |
| [`source/x402-universal-adapter-whitepaper.md`](source/x402-universal-adapter-whitepaper.md) | Product thesis and architecture |
| [`source/x402-universal-adapter-prd.md`](source/x402-universal-adapter-prd.md) | Draft PRD |
| [`source/x402-low-hanging-fruit.md`](source/x402-low-hanging-fruit.md) | Opportunity prioritization |
| [`source/anyx-ai-integrations.md`](source/anyx-ai-integrations.md) | AI framework integrations |
| [`source/anyx-llms.txt`](source/anyx-llms.txt) | Proposed AI-discovery content |
| [`source/anyx-market-research.md`](source/anyx-market-research.md) | August 2025 market research |
| [`source/anyx-marketing-social.md`](source/anyx-marketing-social.md) | Marketing strategy |
| [`source/anyx-monetization-gtm.md`](source/anyx-monetization-gtm.md) | Pricing and GTM assumptions |

Line references in governing documents use these stable copies.
