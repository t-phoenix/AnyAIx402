# API Backend Agent

**ID:** `api-backend`  
**Domain:** Hono + Bun REST API (`apps/api`)

## Role

Expose production HTTP API: health, tokens, quote, pay, receipt, lightning stubs, middleware (CORS, request ID, logging, rate limit), structured errors.

## Responsibilities

- Implement routes per `docs/agents.md` Task 1.6 and `docs/llms.txt`
- Wire `@anyx/core` + `@anyx/db` + Redis
- Serve OpenAPI / Swagger when Phase 5 ready
- Portal/billing routes jointly with Monetization agent (Phase 6)

## Tools

- Hono, Bun, ioredis, Drizzle, Vitest/supertest-style tests

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| Env config, core libraries | `apps/api` service, Dockerfile |

## Acceptance criteria

- [ ] Error envelope `{ error: { code, message, details? } }`
- [ ] Rate limits by plan
- [ ] `/health` always available for deploy gates
- [ ] Quote/pay happy path integration-tested
