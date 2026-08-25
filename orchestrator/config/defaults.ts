import type { DeployEnvironment } from '../shared/types.ts';
import type {
  BugsConfig,
  BuildCommands,
  DeployStageConfig,
  ExecutorConfig,
  TestStageCommands,
} from './types.ts';

export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
export const DEFAULT_COVERAGE_THRESHOLD = 80;

/**
 * Defaults track the roadmap's script names. They are overridable because the
 * monorepo packages are authored by other agents and may rename scripts.
 */
export const DEFAULT_TEST_COMMANDS: TestStageCommands = {
  lint: 'bun run lint',
  typecheck: 'bun run typecheck',
  unit: 'bun test',
  integration: 'bun run test:integration',
  contracts: 'forge test -vvv',
  coverage: 'bun test --coverage',
};

export const DEFAULT_BUILD_COMMANDS: BuildCommands = {
  build: 'bun run build',
  migrate: 'bun run db:migrate',
};

export const DEFAULT_EXECUTOR: ExecutorConfig = {
  kind: 'dry-run',
};

export const DEFAULT_BUGS_CONFIG: BugsConfig = {
  maxFixAttempts: 3,
  backoffBaseMs: 2000,
  backoffMaxMs: 60_000,
  triageOverrides: [],
  draftGithubIssues: true,
  createGithubIssues: false,
};

const localStage: DeployStageConfig = {
  buildCommand: 'bun run build',
  deployCommand: 'bun run --cwd apps/api start',
  migrateCommand: 'bun run db:migrate',
  healthCheckUrl: 'http://localhost:3000/health',
  healthCheckRetries: 10,
  healthCheckDelayMs: 3000,
  rollbackCommand: '',
  requiredGates: ['postgres', 'redis'],
  autoApprove: true,
};

const stagingStage: DeployStageConfig = {
  buildCommand: 'bun run build',
  deployCommand: 'flyctl deploy --app anyx-api-staging --remote-only',
  migrateCommand: 'bun run db:migrate',
  healthCheckUrl: 'https://anyx-api-staging.fly.dev/health',
  healthCheckRetries: 20,
  healthCheckDelayMs: 5000,
  rollbackCommand: 'flyctl releases rollback --app anyx-api-staging --yes',
  requiredGates: ['postgres', 'redis', 'fly-deploy-token'],
  autoApprove: true,
};

const productionStage: DeployStageConfig = {
  buildCommand: 'bun run build',
  deployCommand: 'flyctl deploy --app anyx-api --remote-only',
  migrateCommand: 'bun run db:migrate',
  healthCheckUrl: 'https://api.anyx.xyz/health',
  healthCheckRetries: 30,
  healthCheckDelayMs: 5000,
  rollbackCommand: 'flyctl releases rollback --app anyx-api --yes',
  requiredGates: [
    'postgres',
    'redis',
    'fly-deploy-token',
    'evm-rpc',
    'facilitator',
    'hot-signer',
  ],
  autoApprove: false,
};

export const DEFAULT_DEPLOY: Record<DeployEnvironment, DeployStageConfig> = {
  local: localStage,
  staging: stagingStage,
  production: productionStage,
};

export const DEFAULT_RUNTIME_DIRNAME = '.orchestrator';

/** Config-file locations probed in order. Owned by another agent; read-only here. */
export const CONFIG_FILE_CANDIDATES = [
  'config/anyx.config.json',
  'config/anyx.config.jsonc',
  'anyx.config.json',
  'anyx.config.jsonc',
] as const;

export const DOTENV_CANDIDATES = ['.env.local', '.env'] as const;
