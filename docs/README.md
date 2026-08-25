# AnyAIx402 documentation

This repository is in architecture and product-definition status. No application, payment
service, smart contract, AI gateway, or deployment described here exists yet.

## Governing documents

These documents define the proposed build:

- [Build plan](BUILD_PLAN.md) — product boundary, architecture, phases, risks, and gates.
- [Multi-agent engineering system](MULTI_AGENT_SYSTEM.md) — automated SDLC control plane.
- [Configuration and manual setup](CONFIGURATION_AND_MANUAL_SETUP.md) — proposed operator
  configuration and external setup.
- [Decisions required](DECISIONS_REQUIRED.md) — unresolved decisions and blocking impact.
- [Architecture decisions](adr/) — proposed ADRs. A proposed ADR is not an approved decision.

When documents disagree, `DECISIONS_REQUIRED.md` identifies the conflict. After approval, an
accepted ADR takes precedence over this build plan. Executable specifications and tests will
eventually take precedence over prose for protocol behavior.

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
