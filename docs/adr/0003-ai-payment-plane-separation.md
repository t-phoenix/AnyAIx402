# ADR 0003: Separate AI gateway and x402 payment planes

- Status: Proposed
- Date: 2026-08-25
- Decision owners: product owner, lead architect, AI platform owner, security
- Related: [D1](../DECISIONS_REQUIRED.md#d1-product-identity),
  [D12](../DECISIONS_REQUIRED.md#d12-ai-gateway-providers)

## Context

The source documents define a payment adapter. Their AI scope consists of integrations that let
LangChain, AgentKit, MCP, OpenAI Agents SDK, CrewAI, ElizaOS, and AutoGen invoke that adapter
([AI integrations lines 12–18,22–205](../source/anyx-ai-integrations.md#L12-L205)).
They do not specify model inference, provider routing, token accounting, streaming, prompt
retention, safety policy, or AI gateway SLOs. The repository name AnyAIx402 nevertheless creates
a plausible inference-gateway interpretation.

Combining inference and payments in one service would mix sensitive prompts with wallet and
settlement data, couple failure domains, and allow nondeterministic components near value
movement.

## Proposed decision

Use separate planes if AI inference enters scope:

- **Payment plane:** x402 protocol, quote/routing, wallet execution, policy, receipts, settlement
  observation, and reconciliation.
- **AI gateway plane:** provider authentication, deterministic model routing, request/stream
  proxying, inference usage accounting, provider health, and inference SLOs.
- A versioned internal contract lets the AI gateway request deterministic payment enforcement.
- Datastores, credentials, deployments, logs, retention, budgets, and incident policies are
  separate.
- LLMs never decide payment amount arithmetic, authorization, ledger entries, settlement state,
  identity, release policy, or routing enforcement.

If an AI gateway MVP is approved, support OpenAI direct and one OpenAI-compatible provider.
Anthropic is an abstraction-validation candidate after the first vertical slice.

Build-time engineering agents described in `MULTI_AGENT_SYSTEM.md` are also separate from both
runtime planes and have no payment or inference production credentials.

## Consequences

- Product naming and customer experience require an explicit portfolio decision.
- Separate deployment cost is accepted in exchange for smaller trust and privacy boundaries.
- Payment can ship without waiting for inference scope.
- AI gateway failure cannot mutate payment truth; payment denial cannot be bypassed by model
  output.
- Cross-plane correlation uses opaque IDs and minimum metadata, not prompt or paid-content copies.

## Acceptance evidence

- Product owner selects payment-only or separate-planes scope.
- Versioned enforcement contract and failure-mode tests.
- Independent data-flow/privacy diagrams and threat models.
- Demonstration that AI provider outage cannot cause an unauthorized payment or ledger change.
- Demonstration that payment denial cannot be overridden by model output.

This ADR remains proposed until product and architecture owners approve it.
