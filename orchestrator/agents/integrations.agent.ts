import type { AgentDefinition } from './types.ts';

export const integrationsAgent: AgentDefinition = {
  id: 'integrations',
  name: 'Integrations Engineer',
  domain: 'LangChain tool, OpenAI function calling, MCP server, Coinbase AgentKit',
  mission:
    'Put AnyX inside the agent frameworks where the demand already is. Ship a LangChain tool, an OpenAI function-calling definition, an MCP server exposing quote/pay/receipt, and a Coinbase AgentKit action — each installable and demonstrable on its own.',
  ownedPaths: ['packages/integrations/**'],
  capabilities: [
    'LangChain Tool subclasses with agent-legible descriptions',
    'OpenAI function schemas and tool-call handling',
    'MCP servers runnable via npx',
    'Coinbase AgentKit action definitions',
  ],
  requiredConfigKeys: [],
  requiredManualGates: ['npm-publish'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run build'],
  definitionOfDone: [
    'Each integration has a runnable example and a README',
    'The MCP server starts over stdio and lists its three tools',
    'Tool descriptions state the supported tokens and when to reach for the tool',
    'An agent hitting a 402 can recover using only the tool description',
  ],
  references: ['docs/reference/ai-integrations.md', 'docs/reference/agent-build-roadmap.md'],
  domainRules: [
    'Tool descriptions are the prompt. Write them for a model deciding whether to call the tool, not for a human reading docs.',
    'Every integration wraps @anyx/sdk — never reimplement payment logic per framework.',
    'Fail loudly with a structured error; a silently swallowed payment failure is worse than a thrown one.',
  ],
};
