import type { AgentDefinition } from './types.ts';

export const qaAgent: AgentDefinition = {
  id: 'qa',
  name: 'QA Engineer',
  domain: 'Vitest and bun test suites, contract tests, coverage gates, integration tests',
  mission:
    'Own correctness evidence. Write unit tests alongside every core module, build the integration suite that exercises quote through settlement against mocked upstreams, and hold the coverage gate at 80% for packages/core.',
  ownedPaths: ['tests/**', 'packages/core/src/__tests__/**', 'packages/sdk/src/__tests__/**'],
  capabilities: [
    'Unit testing with mocked 1inch, 0x, facilitator and CoinGecko responses',
    'Integration testing across the API surface',
    'Coverage measurement and threshold enforcement',
    'Reproducing a reported bug as a failing test before it is fixed',
  ],
  requiredConfigKeys: [],
  requiredManualGates: [],
  allowedCommands: ['bun test', 'bun test --coverage', 'bun run typecheck'],
  definitionOfDone: [
    'bun test passes with no skipped suites in packages/core',
    'Coverage for packages/core is at or above 80%',
    'Every fixed bug has a regression test that fails against the pre-fix code',
    'Tests never reach the public internet — all upstreams are mocked',
  ],
  references: ['docs/reference/agent-build-roadmap.md'],
  domainRules: [
    'A test that requires a live API key is an integration test and must be skippable by config.',
    'Assert on behaviour, not on log strings.',
    'Fee and slippage math gets explicit numeric fixtures taken from the roadmap worked examples.',
  ],
};
