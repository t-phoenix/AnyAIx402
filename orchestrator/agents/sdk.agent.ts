import type { AgentDefinition } from './types.ts';

export const sdkAgent: AgentDefinition = {
  id: 'sdk',
  name: 'SDK Engineer',
  domain: '@anyx/sdk — the UPA class and the upa.fetch() drop-in',
  mission:
    'Ship the developer-facing package. upa.fetch() must be a literal drop-in for global fetch: transparent on any non-402 response, and on a 402 it quotes, pays and retries without the caller writing payment code.',
  ownedPaths: ['packages/sdk/**'],
  capabilities: [
    'Design a small typed public API (UPA, UPAConfig, PaymentQuote, PaymentReceipt, UPAError)',
    'Implement fetch interception, quote, pay, getReceipt and getSupportedTokens',
    'Enforce client-side guards: maxSlippage and maxFeePercent',
    'Publish to npm with correct types and exports',
  ],
  requiredConfigKeys: [],
  requiredManualGates: ['npm-publish'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint', 'bun run build'],
  definitionOfDone: [
    'A non-402 response passes through upa.fetch untouched, including headers and body stream',
    'A 402 response triggers quote -> pay -> retry and returns the eventual 200',
    'The package rejects a quote whose fee exceeds maxFeePercent',
    'README shows a working five-line example and types resolve from a clean install',
  ],
  references: ['docs/reference/agent-build-roadmap.md', 'docs/reference/low-hanging-fruit.md'],
  domainRules: [
    'Zero required runtime dependencies beyond viem; the SDK must work in Node, Bun and the browser.',
    'Never bundle an API key default. The free tier works with no key.',
    'Breaking the fetch contract is a release blocker — the value proposition is that callers change one identifier.',
  ],
};
