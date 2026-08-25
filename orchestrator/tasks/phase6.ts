import type { TaskDefinition } from './types.ts';

export const PHASE_6_TASKS: readonly TaskDefinition[] = [
  {
    id: '6.1-api-keys-billing',
    title: 'API key system, usage tracking and rate limits',
    phase: 6,
    agentId: 'backend',
    summary:
      'Implement key generation (prefix anyx_ plus 32 random hex characters, storing only the SHA-256 hash and returning the plaintext exactly once), monthly volume tracking in Redis under anyx:usage:{keyId}:{YYYY-MM} with a 35 day TTL, tiered rate limiting (free 100/min and $100 monthly volume, pro 1000/min unlimited, enterprise custom) returning 429 with Retry-After, partner fee sharing crediting 20% of the AnyX fee when X-Partner-ID is present, and the developer portal routes for register, usage and upgrade.',
    dependsOn: ['1.6-api-server'],
    ownedPaths: [
      'apps/api/src/routes/keys.ts',
      'apps/api/src/routes/portal.ts',
      'apps/api/src/middleware/auth.ts',
    ],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Portal routes exist',
        path: 'apps/api/src/routes/portal.ts',
      },
      {
        kind: 'file-contains',
        description: 'Keys are hashed before storage',
        path: 'apps/api/src/routes/keys.ts',
        pattern: 'sha256|SHA-256|createHash',
      },
      { kind: 'command', description: 'Billing tests pass', command: 'bun test apps/api' },
    ],
    verifyCommands: [{ command: 'bun test apps/api' }, { command: 'bun run typecheck' }],
    requiredConfigKeys: ['DATABASE_URL', 'REDIS_URL'],
    requiredManualGates: ['postgres', 'redis'],
    status: 'pending',
    priority: 60,
    estimatedComplexity: 'large',
    references: ['docs/reference/agent-build-roadmap.md#task-61--api-key-system--billing'],
  },
  {
    id: '6.2-stripe',
    title: 'Stripe Pro plan subscriptions',
    phase: 6,
    agentId: 'backend',
    summary:
      'Integrate Stripe for the $49/month Pro plan. POST /v1/portal/upgrade creates a subscription Checkout Session from STRIPE_PRO_PRICE_ID with the apiKeyId in metadata. POST /webhooks/stripe verifies the signature and handles checkout.session.completed (upgrade to pro), customer.subscription.deleted (downgrade to free) and invoice.payment_failed (warn). GET /v1/portal/billing returns the customer portal URL. Keep all Stripe calls inside apps/api/src/lib/stripe.ts.',
    dependsOn: ['6.1-api-keys-billing'],
    ownedPaths: ['apps/api/src/lib/stripe.ts', 'apps/api/src/routes/webhooks.ts'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Stripe library module exists',
        path: 'apps/api/src/lib/stripe.ts',
      },
      {
        kind: 'file-contains',
        description: 'Webhook signature is verified',
        path: 'apps/api/src/routes/webhooks.ts',
        pattern: 'constructEvent|signature',
      },
      { kind: 'command', description: 'Stripe tests pass', command: 'bun test apps/api' },
    ],
    verifyCommands: [{ command: 'bun test apps/api' }],
    requiredConfigKeys: ['STRIPE_SECRET_KEY', 'STRIPE_PRO_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'],
    requiredManualGates: ['stripe'],
    status: 'pending',
    priority: 61,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#task-62--stripe-integration-pro-plan'],
  },
];
