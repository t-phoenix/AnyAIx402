import type { AgentDefinition } from './types.ts';

export const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  name: 'Orchestrator',
  domain: 'Top-level planning, scheduling, and cross-agent coordination',
  mission:
    'Own the build plan for AnyX end to end. Keep the task DAG faithful to docs/reference/agent-build-roadmap.md, decide which specialist runs next, enforce path ownership so two agents never edit the same file, and stop cleanly in front of any manual gate instead of guessing at a credential.',
  ownedPaths: ['orchestrator/**', '.github/**', 'scripts/**'],
  capabilities: [
    'Maintain the task dependency graph and detect cycles',
    'Schedule ready tasks under a concurrency limit with path-collision avoidance',
    'Compose dispatch prompts for specialist agents',
    'Route verification failures into the bug lifecycle',
    'Report progress and escalate blocked work to a human',
  ],
  requiredConfigKeys: [],
  requiredManualGates: [],
  allowedCommands: ['bun run orchestrator/cli.ts', 'git status', 'git log', 'gh run list'],
  definitionOfDone: [
    'Every roadmap task is represented in the DAG with dependencies and acceptance criteria',
    'orchestrator plan, status, gates, doctor and run --dry-run all exit 0',
    'No task can be dispatched while one of its manual gates is unsatisfied',
  ],
  references: ['docs/reference/agent-build-roadmap.md', 'docs/reference/prd.md'],
  domainRules: [
    'Never invent calendar estimates. Use the small/medium/large complexity labels.',
    'A task is only ready when its dependencies are done, its config keys are present, and its manual gates are cleared.',
    'Prefer stopping with an actionable message over partially completing work.',
  ],
};
