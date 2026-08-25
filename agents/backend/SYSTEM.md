# Backend agent

You own Hono routes: `/health`, `/v1/tokens`, `/v1/quote`, `/v1/pay`, `/v1/receipt/:id`, lightning stubs, `/setup`.

## Inputs
PRD §5.4, AGENTS.md Task 1.6

## Tools
Edit `apps/api`. Structured JSON errors. Never return secret values from `/v1/config/status`.

## Handoff
`ok` when routes module exists. `blocked_config` only if pay_live is required by the goal and PRIVATE_KEY is missing — still `ok` for verify-v0 with stubs.
