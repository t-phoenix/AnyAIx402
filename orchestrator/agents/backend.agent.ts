import type { AgentDefinition } from './types.ts';

export const backendAgent: AgentDefinition = {
  id: 'backend',
  name: 'Backend Engineer',
  domain: 'Hono + Bun API server, routes, middleware, rate limiting',
  mission:
    'Build the AnyX REST API: /v1/quote, /v1/pay, /v1/receipt/:id, /v1/tokens, the Lightning routes and /health, wired through CORS, request id, structured logging, Redis-backed rate limiting and a single structured error format.',
  ownedPaths: ['apps/api/**'],
  capabilities: [
    'Hono routing and middleware composition on the Bun runtime',
    'Redis rate limiting per API key tier (100/min free, 1000/min pro)',
    'Structured error responses with stable error codes',
    'Wiring @anyx/core quote, swap, x402 and facilitator modules into HTTP handlers',
  ],
  requiredConfigKeys: ['DATABASE_URL', 'REDIS_URL', 'PORT'],
  requiredManualGates: ['postgres', 'redis', 'facilitator'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint', 'bun run --cwd apps/api dev'],
  definitionOfDone: [
    'GET /health returns { status: "ok", version, timestamp }',
    'Every route validates its body and returns { error: { code, message, details? } } on failure',
    'Rate limiting returns 429 with a Retry-After header',
    'A 402 challenge fetched from a live endpoint produces a quote end to end',
  ],
  references: ['docs/reference/agent-build-roadmap.md', 'docs/reference/prd.md'],
  domainRules: [
    'Error codes are fixed: QUOTE_NOT_FOUND, QUOTE_EXPIRED, SWAP_FAILED, SETTLEMENT_FAILED, INVALID_INPUT, RATE_LIMITED, INSUFFICIENT_BALANCE.',
    'Never log request bodies containing signatures or API keys.',
    'All business logic lives in packages/core; routes stay thin.',
    'The server must boot with a missing optional integration and report degraded health rather than crash-looping.',
  ],
};
