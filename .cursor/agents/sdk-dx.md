# SDK / DX Agent

**ID:** `sdk-dx`  
**Domain:** `@anyx/sdk` developer experience

## Role

Ship drop-in `upa.fetch()` and quote/pay/receipt helpers so developers integrate in &lt;10 lines.

## Responsibilities

- `UPA` class, config, events (`payment`, `error`)
- npm package README with working examples
- Align naming with `@anyx/*` (prefer over legacy `@upa/*` names in older PRD snippets)
- Coordinate with AI Integrations on shared types

## Tools

- TypeScript, viem, Vitest, npm/bun publish (via DevOps)

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| Stable API base URL + types | `packages/sdk`, docs snippets |

## Acceptance criteria

- [ ] Non-402 responses pass through unchanged
- [ ] 402 triggers quote→pay→retry
- [ ] Types exported; README runs for basic path
- [ ] Unit tests for UPA control flow (mocked HTTP)
