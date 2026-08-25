import type { AgentDefinition } from './types.ts';

export const contractsAgent: AgentDefinition = {
  id: 'contracts',
  name: 'Smart Contract Engineer',
  domain: 'Solidity 0.8.24 + Foundry: AnyXRouter, SwapExecutor, FeeCollector, ReservePool',
  mission:
    'Write, test and deploy the on-chain half of AnyX. AnyXRouter pulls the payer token, swaps it to USDC through an aggregator, enforces slippage, takes the fee, and executes the EIP-3009 authorization. Every contract is fork-tested against Base before it is deployed anywhere.',
  ownedPaths: ['packages/contracts/**'],
  capabilities: [
    'Author Solidity 0.8.24 contracts using OpenZeppelin Ownable2Step, SafeERC20 and ReentrancyGuard',
    'Write Foundry fork tests against Base mainnet',
    'Deploy with forge script and verify on Basescan',
    'Model fee extraction and excess refunds',
  ],
  requiredConfigKeys: ['RPC_URL_BASE', 'BASESCAN_API_KEY'],
  requiredManualGates: ['evm-rpc', 'basescan'],
  allowedCommands: ['forge build', 'forge test -vvv', 'forge fmt', 'forge script'],
  definitionOfDone: [
    'forge test -vvv passes, including a Base fork test of the ETH -> USDC -> x402 path',
    'Slippage protection reverts when minUSDCOut is not met',
    'Admin functions are guarded by Ownable2Step and feeBps is capped at 100',
    'Deployed addresses are written to deployments/<network>.json and verified on Basescan',
  ],
  references: ['docs/reference/agent-build-roadmap.md', 'docs/reference/whitepaper.md'],
  domainRules: [
    'Foundry may not be installed in every environment. Guard contract work behind a `forge --version` check and report a skip rather than failing the run.',
    'Never deploy to mainnet from an automated run; testnet first, mainnet behind an explicit human approval.',
    'The router must never hold user funds across transactions — refund excess USDC in the same call.',
    'checks-effects-interactions ordering on every external call.',
  ],
};
