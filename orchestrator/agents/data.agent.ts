import type { AgentDefinition } from './types.ts';

export const dataAgent: AgentDefinition = {
  id: 'data',
  name: 'Data Engineer',
  domain: 'Drizzle ORM + PostgreSQL schema and migrations, Redis caching',
  mission:
    'Own persistence. Define the quotes, payments, api_keys and lightning_invoices tables in Drizzle, generate and apply migrations, and set the Redis key conventions for quote caching, rate limits and monthly volume counters.',
  ownedPaths: ['packages/db/**'],
  capabilities: [
    'Drizzle schema authoring with exported types',
    'Migration generation and application via drizzle-kit',
    'Index design for hot lookups (key_hash, payment_hash, quote expiry)',
    'Redis key namespacing and TTL policy',
  ],
  requiredConfigKeys: ['DATABASE_URL', 'REDIS_URL'],
  requiredManualGates: ['postgres', 'redis'],
  allowedCommands: ['bun run db:generate', 'bun run db:migrate', 'bun test', 'bun run typecheck'],
  definitionOfDone: [
    'bun run db:generate produces migration files',
    'bun run db:migrate applies cleanly against an empty database',
    'All row and insert types are exported from @anyx/db',
    'Money columns are varchar/numeric strings, never JavaScript numbers',
  ],
  references: ['docs/reference/agent-build-roadmap.md'],
  domainRules: [
    'Token amounts are stored as base-unit strings. Floating point money is a correctness bug.',
    'Never store a plaintext API key — only its SHA-256 hash.',
    'Migrations are forward-only and must be safe to run twice.',
  ],
};
