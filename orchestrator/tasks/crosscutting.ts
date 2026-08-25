import type { TaskDefinition } from './types.ts';

/**
 * Cross-cutting work the roadmap implies rather than numbers: CI, the deploy
 * path behind the launch checklist, the whitepaper's security model, the
 * integration/coverage gate, and the GTM plays from the monetization documents.
 */
export const CROSSCUTTING_TASKS: readonly TaskDefinition[] = [
  {
    id: 'ci.1-github-actions',
    title: 'GitHub Actions CI and release workflows',
    phase: 'ci',
    agentId: 'devops',
    summary:
      'Create .github/workflows/ci.yml running lint, typecheck, unit tests and build on every PR with contract tests in a separate Foundry job, deploy-api.yml deploying to Fly.io on push to main with post-deploy migrations and a health check, and publish-sdk.yml publishing @anyx/sdk on a v* tag. Every step degrades gracefully when the corresponding script does not exist yet, and every required secret is referenced by name.',
    dependsOn: ['0.1-monorepo'],
    ownedPaths: ['.github/workflows/**'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'CI workflow exists', path: '.github/workflows/ci.yml' },
      {
        kind: 'file-exists',
        description: 'Deploy workflow exists',
        path: '.github/workflows/deploy-api.yml',
      },
      {
        kind: 'file-exists',
        description: 'SDK publish workflow exists',
        path: '.github/workflows/publish-sdk.yml',
      },
      {
        kind: 'file-contains',
        description: 'Bun is set up in CI',
        path: '.github/workflows/ci.yml',
        pattern: 'oven-sh/setup-bun',
      },
      {
        kind: 'file-contains',
        description: 'Fly deploy is gated on the token secret',
        path: '.github/workflows/deploy-api.yml',
        pattern: 'FLY_API_TOKEN',
      },
    ],
    verifyCommands: [{ command: 'gh workflow list', requiresBinary: 'gh', optional: true }],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 3,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#task-ci1--github-actions'],
  },
  {
    id: 'sec.1-threat-model',
    title: 'Threat model and security controls',
    phase: 2,
    agentId: 'security',
    summary:
      'Turn section 6 of the whitepaper into an enforced threat model in security/threat-model.md: slippage manipulation, hot signer key compromise, bridge latency race, oracle price manipulation, nonce replay and facilitator censorship. Each vector needs a stated mitigation and a test or configuration constraint that proves it. Add secret scanning over the working tree and tracked history, and static analysis wired into the test pipeline.',
    dependsOn: ['1.5-facilitator'],
    ownedPaths: ['security/**'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Threat model document exists',
        path: 'security/threat-model.md',
      },
      {
        kind: 'file-contains',
        description: 'Hot signer compromise addressed',
        path: 'security/threat-model.md',
        pattern: 'hot signer',
      },
      {
        kind: 'file-contains',
        description: 'Slippage manipulation addressed',
        path: 'security/threat-model.md',
        pattern: 'slippage',
      },
      {
        kind: 'file-exists',
        description: 'Audit checklist exists',
        path: 'security/audit-checklist.md',
      },
    ],
    verifyCommands: [
      {
        command:
          'git grep -nIE "(sk_live_|whsec_|-----BEGIN [A-Z ]*PRIVATE KEY)" -- . ":(exclude)docs/reference" ; test $? -eq 1',
      },
    ],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 22,
    estimatedComplexity: 'medium',
    references: ['docs/reference/whitepaper.md#security'],
  },
  {
    id: 'sec.2-preflight-audit',
    title: 'Pre-mainnet security review',
    phase: 2,
    agentId: 'security',
    summary:
      'Complete the audit checklist before any mainnet deployment: contract review or external audit, hot signer spend limits and MPC configuration, rate limit verification, dependency audit, and confirmation that no secret is present in the repository or its history. This task gates the production deploy.',
    dependsOn: ['sec.1-threat-model', '2.2-deploy-scripts'],
    ownedPaths: ['security/audit-checklist.md', 'security/reports/**'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Audit checklist exists',
        path: 'security/audit-checklist.md',
      },
      {
        kind: 'manual',
        description: 'Smart contracts audited or a formal review completed and signed off',
      },
      { kind: 'manual', description: 'Hot signer moved to MPC with a per-session spend limit' },
    ],
    verifyCommands: [],
    requiredConfigKeys: [],
    requiredManualGates: ['hot-signer'],
    status: 'pending',
    priority: 23,
    estimatedComplexity: 'medium',
    references: ['docs/reference/whitepaper.md#security'],
  },
  {
    id: 'qa.1-integration-suite',
    title: 'Integration suite and coverage gate',
    phase: 1,
    agentId: 'qa',
    summary:
      'Build the integration suite that drives quote through settlement against mocked aggregators and a mocked facilitator, plus the rate-limit test that fires 150 requests per minute against the free tier and expects 429s. Enforce the 80% coverage threshold for packages/core in the test pipeline.',
    dependsOn: ['1.8-unit-tests'],
    ownedPaths: ['tests/**'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'Integration suite exists', path: 'tests/integration' },
      {
        kind: 'command',
        description: 'Integration suite passes',
        command: 'bun run test:integration',
      },
      { kind: 'command', description: 'Coverage threshold met', command: 'bun test --coverage' },
    ],
    verifyCommands: [{ command: 'bun run test:integration', optional: true }],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 18,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#launch-checklist'],
  },
  {
    id: 'devops.1-deploy-api',
    title: 'Fly.io deployment with health checks and rollback',
    phase: 'ci',
    agentId: 'devops',
    summary:
      'Containerize apps/api with a multi-stage Bun Dockerfile, add fly.toml for anyx-api and anyx-api-staging, and make the deploy path run migrations after release, poll /health until it passes, and roll back automatically when it does not. Secrets reach Fly through fly secrets, never through an image layer.',
    dependsOn: ['1.6-api-server', 'ci.1-github-actions'],
    ownedPaths: ['apps/api/Dockerfile', 'fly.toml', 'fly.staging.toml'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'API Dockerfile exists', path: 'apps/api/Dockerfile' },
      { kind: 'file-exists', description: 'Fly configuration exists', path: 'fly.toml' },
      {
        kind: 'command',
        description: 'Image builds',
        command: 'docker build -f apps/api/Dockerfile -t anyx-api:ci .',
        requiresBinary: 'docker',
      },
      { kind: 'manual', description: 'Staging deploy completed and /health returned 200' },
    ],
    verifyCommands: [
      {
        command: 'docker build -f apps/api/Dockerfile -t anyx-api:ci .',
        requiresBinary: 'docker',
        optional: true,
      },
    ],
    requiredConfigKeys: ['FLY_API_TOKEN'],
    requiredManualGates: ['fly-deploy-token'],
    status: 'pending',
    priority: 62,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#task-ci1--github-actions'],
  },
  {
    id: 'growth.1-revenue-path',
    title: 'Day-one revenue path',
    phase: 6,
    agentId: 'growth',
    summary:
      'Encode the monetization model and prove it collects. Per-pair spreads from the monetization table (USDT 5 bps, ETH 20 bps, WBTC 25 bps, cbBTC 20 bps, SOL 30 bps, BTC via Lightning 50 bps), the Free/Pro/Enterprise limits enforced by the API rather than only documented, and a $1 test payment whose receipt shows the expected fee. This is the Quote API plus USDT SDK combination the low-hanging-fruit analysis identifies as the fastest path to a first dollar.',
    dependsOn: ['1.7-sdk', '6.1-api-keys-billing'],
    ownedPaths: ['growth/pricing.ts', 'growth/README.md'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Pricing configuration exists',
        path: 'growth/pricing.ts',
      },
      {
        kind: 'file-contains',
        description: 'Per-pair spreads encoded',
        path: 'growth/pricing.ts',
        pattern: 'bps',
      },
      {
        kind: 'manual',
        description:
          'A $1 test payment was routed and the collected fee matched the configured spread',
      },
    ],
    verifyCommands: [{ command: 'bun test growth', optional: true }],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 63,
    estimatedComplexity: 'small',
    references: ['docs/reference/monetization-gtm.md', 'docs/reference/low-hanging-fruit.md'],
  },
  {
    id: 'growth.2-distribution',
    title: 'Distribution and launch package',
    phase: 7,
    agentId: 'growth',
    summary:
      'Draft the distribution artefacts described in the GTM document: the npm listing and README for @anyx/sdk, an awesome-x402 entry, the four technical launch posts, the outreach sequence for the top x402 API providers and agent frameworks, and the Base Ecosystem, x402 Foundation and Circle CCTP grant applications. Draft only — a human posts and submits.',
    dependsOn: ['7.1-langchain-tool', '5.2-llms-txt'],
    ownedPaths: ['growth/launch/**'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'Launch package exists', path: 'growth/launch' },
      { kind: 'manual', description: 'A human reviewed and published the launch artefacts' },
    ],
    verifyCommands: [],
    requiredConfigKeys: [],
    requiredManualGates: ['npm-publish'],
    status: 'pending',
    priority: 72,
    estimatedComplexity: 'small',
    references: ['docs/reference/monetization-gtm.md', 'docs/reference/marketing-social.md'],
  },
];
