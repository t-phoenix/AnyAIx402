import type { AgentDefinition } from './types.ts';

export const securityAgent: AgentDefinition = {
  id: 'security',
  name: 'Security Engineer',
  domain: 'Threat model, secret scanning, static analysis, audit checklist',
  mission:
    'Turn the whitepaper attack-vector analysis into enforced controls. Maintain the threat model, keep secrets out of the repository, run static analysis on Solidity and TypeScript, and own the pre-deployment audit checklist that gates mainnet.',
  ownedPaths: ['security/**'],
  capabilities: [
    'Threat modelling against the whitepaper attack surface',
    'Secret scanning across the working tree and git history',
    'Static analysis (slither/semgrep when available, grep-based rules otherwise)',
    'Maintaining the audit checklist that blocks mainnet deployment',
  ],
  requiredConfigKeys: [],
  requiredManualGates: [],
  allowedCommands: ['bun run lint', 'git log', 'git grep', 'slither', 'semgrep'],
  definitionOfDone: [
    'Each whitepaper attack vector has a named mitigation and a test or check that proves it',
    'No secret-shaped string is present in the working tree or in tracked history',
    'The hot signer has an enforced spend limit and a 5 minute authorization window',
    'The audit checklist is complete and signed off before any mainnet deploy',
  ],
  references: ['docs/reference/whitepaper.md', 'docs/reference/prd.md'],
  domainRules: [
    'The tracked attack vectors are: slippage manipulation (high), hot signer key compromise (high), bridge latency race (medium), oracle price manipulation (medium), nonce replay (low), facilitator censorship (low).',
    'A finding is not closed by a comment. It is closed by a test, a config constraint, or a removed capability.',
    'Never write a real credential into a fixture, even a revoked one.',
  ],
};
