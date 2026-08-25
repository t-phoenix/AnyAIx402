import type { TaskDefinition } from './types.ts';

export const PHASE_3_TASKS: readonly TaskDefinition[] = [
  {
    id: '3.1-cctp',
    title: 'Circle CCTP v2 bridge integration',
    phase: 3,
    agentId: 'crosschain',
    summary:
      'Create packages/core/src/bridge/cctp.ts implementing bridgeUSDC (depositForBurn on the source TokenMessenger, poll the Circle Iris attestation API every 5 seconds until complete, then receiveMessage on the destination MessageTransmitter), getCCTPDomain covering Ethereum 0, Avalanche 1, Optimism 2, Arbitrum 3, Solana 5, Base 6 and Polygon 7, estimateBridgeTime, and the float-pool abstraction that fronts from the Base reserve when the pool has capacity and otherwise waits for CCTP. Add a Stargate fallback path.',
    dependsOn: ['1.6-api-server'],
    ownedPaths: ['packages/core/src/bridge/**'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'CCTP module exists',
        path: 'packages/core/src/bridge/cctp.ts',
      },
      {
        kind: 'file-contains',
        description: 'Burn call implemented',
        path: 'packages/core/src/bridge/cctp.ts',
        pattern: 'depositForBurn',
      },
      {
        kind: 'file-contains',
        description: 'Attestation polling implemented',
        path: 'packages/core/src/bridge/cctp.ts',
        pattern: 'attestation',
      },
      { kind: 'command', description: 'Bridge tests pass', command: 'bun test packages/core' },
    ],
    verifyCommands: [{ command: 'bun test packages/core' }, { command: 'bun run typecheck' }],
    requiredConfigKeys: ['RPC_URL_BASE', 'RPC_URL_SOLANA', 'CCTP_ATTESTER_URL'],
    requiredManualGates: ['evm-rpc', 'solana-rpc'],
    status: 'pending',
    priority: 30,
    estimatedComplexity: 'large',
    references: ['docs/reference/agent-build-roadmap.md#task-31--circle-cctp-integration'],
  },
  {
    id: '3.2-reserve-pool',
    title: 'ReservePool contract and float client',
    phase: 3,
    agentId: 'crosschain',
    summary:
      'Write ReservePool.sol holding the Base USDC float with depositFloat, frontPayment restricted to the router, replenish, getAvailableFloat and getUtilization, emitting FloatDeployed and FloatReplenished. Add packages/core/src/bridge/reservePool.ts with checkFloat, requestFloat and replenishFloat, and refuse to front above the configured utilization ceiling.',
    dependsOn: ['3.1-cctp', '2.1-anyx-router'],
    ownedPaths: [
      'packages/contracts/src/ReservePool.sol',
      'packages/core/src/bridge/reservePool.ts',
    ],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'ReservePool contract exists',
        path: 'packages/contracts/src/ReservePool.sol',
      },
      {
        kind: 'file-exists',
        description: 'Float client exists',
        path: 'packages/core/src/bridge/reservePool.ts',
      },
      {
        kind: 'file-contains',
        description: 'Utilization reporting implemented',
        path: 'packages/contracts/src/ReservePool.sol',
        pattern: 'getUtilization',
      },
      {
        kind: 'command',
        description: 'Contract tests pass',
        command: 'forge test -vvv',
        requiresBinary: 'forge',
      },
    ],
    verifyCommands: [
      { command: 'forge test -vvv', cwd: 'packages/contracts', requiresBinary: 'forge' },
      { command: 'bun test packages/core' },
    ],
    requiredConfigKeys: ['RESERVE_POOL_FUNDING_ADDRESS'],
    requiredManualGates: ['reserve-float', 'evm-rpc'],
    status: 'pending',
    priority: 31,
    estimatedComplexity: 'large',
    references: ['docs/reference/agent-build-roadmap.md#task-32--reserve-pool'],
  },
];
