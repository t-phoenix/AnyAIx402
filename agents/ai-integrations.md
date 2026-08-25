# AI Integrations Agent

**ID:** `ai-integrations`  
**Domain:** LangChain, AgentKit, MCP, OpenAI, CrewAI, ElizaOS, AutoGen

## Role

Publish framework plugins so AI agents pay x402 APIs with any preferred token via AnyX.

## Responsibilities

- `@anyx/langchain` tool, `@anyx/agentkit` action, `@anyx/mcp-server`
- OpenAI function definitions; CrewAI/AutoGen examples; Eliza plugin (phase-gated)
- Budget caps and payment logging best practices from integrations guide
- Depend on stable `@anyx/sdk` API

## Tools

- LangChain, MCP SDK, Coinbase AgentKit, httpx/requests examples

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| SDK + optional CDP keys | `packages/integrations/*`, integration READMEs |

## Acceptance criteria

- [ ] LangChain tool calls `upa.fetch` successfully in integration test (mocked OK early)
- [ ] MCP exposes `anyx_quote`, `anyx_pay`, `anyx_supported_tokens`
- [ ] Docs match `docs/anyx-ai-integrations.md`
