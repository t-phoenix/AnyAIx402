import type { AgentId, DeployEnvironment, Severity } from '../shared/types.ts';

export type ExecutorKind = 'dry-run' | 'shell' | 'http';

export interface ShellExecutorConfig {
  /**
   * Command template invoked once per dispatched task. Supported placeholders:
   * `{{promptFile}}`, `{{taskId}}`, `{{agentId}}`, `{{repoRoot}}`.
   * The prompt is also delivered on stdin.
   */
  readonly commandTemplate: string;
  readonly timeoutMs: number;
  readonly cwd?: string;
}

export interface HttpExecutorConfig {
  readonly url: string;
  readonly method: 'POST' | 'PUT';
  /** Header values may reference env vars as `${VAR_NAME}`; never store secrets here. */
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

export interface ExecutorConfig {
  readonly kind: ExecutorKind;
  readonly shell?: ShellExecutorConfig;
  readonly http?: HttpExecutorConfig;
}

export interface TestStageCommands {
  readonly lint: string;
  readonly typecheck: string;
  readonly unit: string;
  readonly integration: string;
  readonly contracts: string;
  readonly coverage: string;
}

export interface BuildCommands {
  readonly build: string;
  readonly migrate: string;
}

export interface DeployStageConfig {
  readonly buildCommand: string;
  readonly deployCommand: string;
  readonly migrateCommand: string;
  readonly healthCheckUrl: string;
  readonly healthCheckRetries: number;
  readonly healthCheckDelayMs: number;
  readonly rollbackCommand: string;
  readonly requiredGates: readonly string[];
  readonly autoApprove: boolean;
}

export interface TriageOverride {
  /** Case-insensitive regular expression matched against the bug title + excerpt. */
  readonly pattern: string;
  readonly agentId?: AgentId;
  readonly severity?: Severity;
}

export interface BugsConfig {
  readonly maxFixAttempts: number;
  readonly backoffBaseMs: number;
  readonly backoffMaxMs: number;
  readonly triageOverrides: readonly TriageOverride[];
  /** Drafts are always written to disk; creation is opt-in and never implicit. */
  readonly draftGithubIssues: boolean;
  readonly createGithubIssues: boolean;
  readonly githubRepo?: string;
}

export interface OrchestratorConfig {
  readonly repoRoot: string;
  readonly runtimeDir: string;
  readonly concurrency: number;
  readonly commandTimeoutMs: number;
  readonly coverageThreshold: number;
  readonly executor: ExecutorConfig;
  readonly test: TestStageCommands;
  readonly build: BuildCommands;
  readonly deploy: Readonly<Record<DeployEnvironment, DeployStageConfig>>;
  readonly bugs: BugsConfig;
  /** Gate ids the operator has explicitly waived for this environment. */
  readonly skipGates: readonly string[];
  /** Fully resolved environment: process env layered over the dotenv files. */
  readonly env: Readonly<Record<string, string>>;
  /** Ordered provenance of every layer that contributed, most significant first. */
  readonly sources: readonly ConfigSource[];
}

export interface ConfigSource {
  readonly kind: 'process-env' | 'dotenv' | 'config-file' | 'defaults';
  readonly path?: string;
  readonly present: boolean;
  readonly keys: number;
}

/** Deep-partial shape accepted from `config/anyx.config.json`. */
export interface OrchestratorConfigFile {
  readonly concurrency?: number;
  readonly commandTimeoutMs?: number;
  readonly coverageThreshold?: number;
  readonly executor?: Partial<ExecutorConfig>;
  readonly test?: Partial<TestStageCommands>;
  readonly build?: Partial<BuildCommands>;
  readonly deploy?: Partial<Record<DeployEnvironment, Partial<DeployStageConfig>>>;
  readonly bugs?: Partial<BugsConfig>;
  readonly skipGates?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly orchestrator?: OrchestratorConfigFile;
}
