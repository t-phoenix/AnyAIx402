import type { TaskDefinition } from './types.ts';

/** One acceptance criterion per line of the roadmap's launch checklist. */
export const LAUNCH_TASKS: readonly TaskDefinition[] = [
  {
    id: 'launch.1-checklist',
    title: 'Launch checklist verification',
    phase: 'launch',
    agentId: 'orchestrator',
    summary:
      'Verify every item on the roadmap launch checklist before AnyX goes live. Machine-checkable items are run as commands; the rest are attested by a human. This task is the final gate and depends on every other terminal task.',
    dependsOn: [
      '1.8-unit-tests',
      'qa.1-integration-suite',
      '2.2-deploy-scripts',
      'sec.2-preflight-audit',
      'devops.1-deploy-api',
      '5.1-docs-site',
      '5.2-llms-txt',
      '5.3-openapi',
      '6.2-stripe',
      '7.2-agentkit',
      'growth.1-revenue-path',
      'growth.2-distribution',
      '4.1-lightning',
    ],
    ownedPaths: [],
    acceptanceCriteria: [
      { kind: 'command', description: 'All unit tests passing', command: 'bun test' },
      {
        kind: 'command',
        description: 'All contract tests passing',
        command: 'forge test',
        requiresBinary: 'forge',
      },
      { kind: 'manual', description: 'Smart contracts audited, or a formal review completed' },
      {
        kind: 'manual',
        description: 'Contracts deployed to Base Sepolia and exercised end to end',
      },
      { kind: 'manual', description: 'Contracts deployed to Base mainnet' },
      {
        kind: 'command',
        description: 'API deployed to Fly.io and health check passing',
        command: 'curl -fsS https://api.anyx.xyz/health -o /dev/null',
      },
      {
        kind: 'command',
        description: 'SDK published to npm as @anyx/sdk@0.1.0',
        command: 'npm view @anyx/sdk@0.1.0 version',
      },
      {
        kind: 'command',
        description: 'Documentation site live with the quickstart',
        command: 'curl -fsS https://docs.anyx.xyz -o /dev/null',
      },
      {
        kind: 'command',
        description: 'llms.txt reachable',
        command: 'curl -fsS https://anyx.xyz/llms.txt -o /dev/null',
      },
      {
        kind: 'command',
        description: 'OpenAPI spec served',
        command: 'curl -fsS https://api.anyx.xyz/openapi.json -o /dev/null',
      },
      {
        kind: 'command',
        description: 'Swagger UI served',
        command: 'curl -fsS https://api.anyx.xyz/docs -o /dev/null',
      },
      { kind: 'manual', description: 'Fee collection verified with a $1 payment' },
      { kind: 'manual', description: 'Payment receipts cross-checked against on-chain state' },
      {
        kind: 'manual',
        description: 'Rate limiting verified at 150 requests per minute on the free tier',
      },
      { kind: 'manual', description: 'LangChain tool exercised against a live x402 API' },
      { kind: 'manual', description: 'AgentKit integration exercised' },
      { kind: 'manual', description: 'MCP server published and confirmed working' },
    ],
    verifyCommands: [{ command: 'bun test' }],
    requiredConfigKeys: [],
    requiredManualGates: ['npm-publish', 'fly-deploy-token'],
    status: 'pending',
    priority: 100,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#launch-checklist'],
  },
];
