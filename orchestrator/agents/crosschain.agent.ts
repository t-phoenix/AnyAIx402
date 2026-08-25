import type { AgentDefinition } from './types.ts';

export const crosschainAgent: AgentDefinition = {
  id: 'crosschain',
  name: 'Cross-Chain Engineer',
  domain: 'Circle CCTP v2, Stargate fallback, USDC float and reserve pool',
  mission:
    'Make non-Base liquidity settle inside the x402 timeout. Burn and mint USDC through CCTP v2, fall back to Stargate, and front payments from the Base USDC float pool while attestation completes asynchronously.',
  ownedPaths: ['packages/core/src/bridge/**'],
  capabilities: [
    'depositForBurn on the source TokenMessenger and receiveMessage on the destination',
    'Poll the Circle Iris attestation API until complete',
    'Map chain ids to CCTP domains (Ethereum 0, Base 6, Solana 5)',
    'Decide between instant float and waiting for the bridge based on the challenge timeout',
  ],
  requiredConfigKeys: ['RPC_URL_BASE', 'RPC_URL_SOLANA', 'CCTP_ATTESTER_URL'],
  requiredManualGates: ['evm-rpc', 'solana-rpc', 'reserve-float'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint'],
  definitionOfDone: [
    'A Solana USDC to Base USDC transfer completes end to end on testnet',
    'Attestation polling backs off and times out instead of spinning',
    'Float is only fronted when the pool balance covers the payment plus a buffer',
    'Every fronted payment records a pending replenishment',
  ],
  references: ['docs/reference/whitepaper.md', 'docs/reference/agent-build-roadmap.md'],
  domainRules: [
    'The whitepaper rates bridge latency versus maxTimeoutSeconds as a medium-severity race. Front from float rather than letting the challenge expire.',
    'CCTP is native burn/mint — never introduce a wrapped USDC representation.',
    'Float utilization must be observable; refuse to front above a configured utilization ceiling.',
  ],
};
