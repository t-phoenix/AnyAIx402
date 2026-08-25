import type { TaskDefinition } from './types.ts';

export const PHASE_7_TASKS: readonly TaskDefinition[] = [
  {
    id: '7.1-langchain-tool',
    title: 'LangChain tool, OpenAI functions and MCP server',
    phase: 7,
    agentId: 'integrations',
    summary:
      'Create packages/integrations/langchain exporting AnyXPaymentTool (name anyx_pay_x402) wrapping the UPA client, packages/integrations/openai with the function-calling schema, and packages/integrations/mcp exposing anyx_quote, anyx_pay and anyx_receipt over MCP, runnable with npx and publishable as @anyx/mcp-server.',
    dependsOn: ['1.7-sdk'],
    ownedPaths: ['packages/integrations/langchain/**', 'packages/integrations/openai/**', 'packages/integrations/mcp/**'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'LangChain tool exists', path: 'packages/integrations/langchain/src/index.ts' },
      { kind: 'file-exists', description: 'MCP server exists', path: 'packages/integrations/mcp/src/index.ts' },
      { kind: 'file-contains', description: 'Tool name matches the documented identifier', path: 'packages/integrations/langchain/src/index.ts', pattern: 'anyx_pay_x402' },
      { kind: 'command', description: 'Integration tests pass', command: 'bun test packages/integrations' },
    ],
    verifyCommands: [{ command: 'bun test packages/integrations' }, { command: 'bun run typecheck' }],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 70,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#task-71--langchain-tool', 'docs/reference/ai-integrations.md'],
  },
  {
    id: '7.2-agentkit',
    title: 'Coinbase AgentKit integration',
    phase: 7,
    agentId: 'integrations',
    summary:
      'Create packages/integrations/agentkit exporting the ANYX_PAY_ACTION definition (name anyx_pay_x402_api) with a zod schema for endpointUrl and inputToken, wired to the AnyX quote and pay flow, plus a README showing how to register it with an AgentKit agent.',
    dependsOn: ['7.1-langchain-tool'],
    ownedPaths: ['packages/integrations/agentkit/**'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'AgentKit action exists', path: 'packages/integrations/agentkit/src/index.ts' },
      { kind: 'file-exists', description: 'AgentKit README exists', path: 'packages/integrations/agentkit/README.md' },
      { kind: 'file-contains', description: 'Action identifier matches the docs', path: 'packages/integrations/agentkit/src/index.ts', pattern: 'anyx_pay_x402_api' },
    ],
    verifyCommands: [{ command: 'bun test packages/integrations' }],
    requiredConfigKeys: [],
    requiredManualGates: [],
    status: 'pending',
    priority: 71,
    estimatedComplexity: 'small',
    references: ['docs/reference/agent-build-roadmap.md#task-72--coinbase-agentkit-integration'],
  },
];
