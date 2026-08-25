import type { TaskDefinition } from './types.ts';

export const PHASE_2_TASKS: readonly TaskDefinition[] = [
  {
    id: '2.1-anyx-router',
    title: 'AnyXRouter, SwapExecutor and FeeCollector contracts',
    phase: 2,
    agentId: 'contracts',
    summary:
      'Write AnyXRouter.sol in Solidity 0.8.24 with swapAndPay: pull the input token via Permit2 or transferFrom, swap through the aggregator router, require usdcReceived >= usdcRequired plus fee, send the fee to the collector, execute USDC.transferWithAuthorization, refund excess to the payer and emit PaymentSettled. Guard with ReentrancyGuard and Ownable2Step, cap feeBps at 100, and add SwapExecutor.sol and FeeCollector.sol plus the IUSDC and ISwapRouter interfaces. Fork-test Base mainnet covering the ETH to USDC to x402 path, slippage reverts, fee math and owner-only modifiers.',
    dependsOn: ['1.4-eip3009'],
    ownedPaths: ['packages/contracts/src/**', 'packages/contracts/test/**', 'packages/contracts/foundry.toml'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'Router contract exists', path: 'packages/contracts/src/AnyXRouter.sol' },
      { kind: 'file-exists', description: 'Swap executor exists', path: 'packages/contracts/src/SwapExecutor.sol' },
      { kind: 'file-exists', description: 'Fee collector exists', path: 'packages/contracts/src/FeeCollector.sol' },
      { kind: 'file-contains', description: 'Reentrancy protection applied', path: 'packages/contracts/src/AnyXRouter.sol', pattern: 'nonReentrant' },
      { kind: 'file-exists', description: 'Fork test exists', path: 'packages/contracts/test/AnyXRouter.t.sol' },
      { kind: 'command', description: 'Foundry tests pass', command: 'forge test -vvv', requiresBinary: 'forge' },
    ],
    verifyCommands: [
      { command: 'forge build', cwd: 'packages/contracts', requiresBinary: 'forge' },
      { command: 'forge test -vvv', cwd: 'packages/contracts', requiresBinary: 'forge' },
    ],
    requiredConfigKeys: ['RPC_URL_BASE'],
    requiredManualGates: ['evm-rpc'],
    status: 'pending',
    priority: 20,
    estimatedComplexity: 'large',
    references: ['docs/reference/agent-build-roadmap.md#task-21--anyxrouter-contract'],
  },
  {
    id: '2.2-deploy-scripts',
    title: 'Contract deployment and verification scripts',
    phase: 2,
    agentId: 'contracts',
    summary:
      'Write packages/contracts/script/Deploy.s.sol deploying AnyXRouter and FeeCollector with their constructor arguments, verifying on Basescan with BASESCAN_API_KEY and writing the resulting addresses to deployments/<network>.json. Deploy to Base Sepolia first. Document test, deploy and verify commands plus the address table in packages/contracts/README.md.',
    dependsOn: ['2.1-anyx-router', 'sec.1-threat-model'],
    ownedPaths: ['packages/contracts/script/**', 'packages/contracts/deployments/**', 'packages/contracts/README.md'],
    acceptanceCriteria: [
      { kind: 'file-exists', description: 'Deploy script exists', path: 'packages/contracts/script/Deploy.s.sol' },
      { kind: 'file-exists', description: 'Contracts README documents addresses', path: 'packages/contracts/README.md' },
      { kind: 'command', description: 'Deploy script compiles', command: 'forge build', requiresBinary: 'forge' },
      { kind: 'manual', description: 'Testnet deployment executed and addresses recorded by a human with a funded deployer key' },
    ],
    verifyCommands: [{ command: 'forge build', cwd: 'packages/contracts', requiresBinary: 'forge' }],
    requiredConfigKeys: ['BASESCAN_API_KEY', 'RPC_URL_BASE'],
    requiredManualGates: ['basescan', 'evm-rpc'],
    status: 'pending',
    priority: 21,
    estimatedComplexity: 'medium',
    references: ['docs/reference/agent-build-roadmap.md#task-22--contract-deployment-scripts'],
  },
];
