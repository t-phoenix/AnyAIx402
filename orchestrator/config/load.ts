import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { DeployEnvironment } from '../shared/types.ts';
import {
  CONFIG_FILE_CANDIDATES,
  DEFAULT_BUGS_CONFIG,
  DEFAULT_BUILD_COMMANDS,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_COVERAGE_THRESHOLD,
  DEFAULT_DEPLOY,
  DEFAULT_EXECUTOR,
  DEFAULT_RUNTIME_DIRNAME,
  DEFAULT_TEST_COMMANDS,
  DOTENV_CANDIDATES,
} from './defaults.ts';
import type {
  ConfigSource,
  DeployStageConfig,
  ExecutorConfig,
  ExecutorKind,
  OrchestratorConfig,
  OrchestratorConfigFile,
} from './types.ts';

export class ConfigError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ConfigError';
    this.hint = hint;
  }
}

export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const withoutExport = line.startsWith('export ') ? line.slice('export '.length) : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    out[key] = value;
  }
  return out;
}

/** Tolerates `//` and block comments plus trailing commas so `.jsonc` parses. */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    const next = text[i + 1] ?? '';

    if (inLine) {
      if (ch === '\n') {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLine = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      i += 1;
      continue;
    }
    out += ch;
  }

  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Resolves `${VAR}` references against the merged environment. */
export function expandEnv(value: string, env: Readonly<Record<string, string>>): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (whole, name: string) => {
    const found = env[name];
    return found === undefined ? whole : found;
  });
}

export interface ConfigLayers {
  readonly repoRoot: string;
  readonly processEnv: Readonly<Record<string, string | undefined>>;
  /** Highest-precedence dotenv layer (`.env.local`). */
  readonly dotenvLocal?: Readonly<Record<string, string>>;
  /** Lower-precedence dotenv layer (`.env`). */
  readonly dotenv?: Readonly<Record<string, string>>;
  readonly configFile?: OrchestratorConfigFile;
  readonly sources?: readonly ConfigSource[];
}

function coerceInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function pickExecutorKind(value: string | undefined, fallback: ExecutorKind): ExecutorKind {
  if (value === 'dry-run' || value === 'shell' || value === 'http') return value;
  return fallback;
}

function mergeDeployStage(
  base: DeployStageConfig,
  override: Partial<DeployStageConfig> | undefined,
): DeployStageConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
    requiredGates: override.requiredGates ?? base.requiredGates,
  };
}

/**
 * Pure merge of every configuration layer.
 *
 * Precedence, strongest first: process env, `.env.local`, `.env`,
 * `config/anyx.config.json(c)`, built-in defaults.
 */
export function resolveConfig(layers: ConfigLayers): OrchestratorConfig {
  const fromProcess: Record<string, string> = {};
  for (const [key, value] of Object.entries(layers.processEnv)) {
    if (value !== undefined) fromProcess[key] = value;
  }

  const file = layers.configFile?.orchestrator ?? layers.configFile ?? {};

  const env: Record<string, string> = {
    ...(file.env ?? {}),
    ...(layers.dotenv ?? {}),
    ...(layers.dotenvLocal ?? {}),
    ...fromProcess,
  };

  const executorFile = file.executor ?? {};
  const shellCommand = env.ANYX_EXECUTOR_COMMAND ?? env.ORCHESTRATOR_AGENT_CMD ?? file.agentCommand;
  const httpEndpoint =
    env.ANYX_EXECUTOR_URL ?? env.ORCHESTRATOR_AGENT_ENDPOINT ?? file.agentEndpoint;

  const executor: ExecutorConfig = {
    kind: pickExecutorKind(env.ANYX_EXECUTOR, executorFile.kind ?? DEFAULT_EXECUTOR.kind),
    shell: shellCommand
      ? {
          commandTemplate: shellCommand,
          timeoutMs: coerceInt(
            env.ANYX_EXECUTOR_TIMEOUT_MS,
            executorFile.shell?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
          ),
          cwd: executorFile.shell?.cwd,
        }
      : executorFile.shell,
    http: httpEndpoint
      ? {
          url: httpEndpoint,
          method: executorFile.http?.method ?? 'POST',
          headers: executorFile.http?.headers ?? {},
          timeoutMs: coerceInt(
            env.ANYX_EXECUTOR_TIMEOUT_MS,
            executorFile.http?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
          ),
        }
      : executorFile.http,
  };

  const deploy = {} as Record<DeployEnvironment, DeployStageConfig>;
  for (const envName of ['local', 'staging', 'production'] as const) {
    deploy[envName] = mergeDeployStage(DEFAULT_DEPLOY[envName], file.deploy?.[envName]);
  }
  const autoApproveProduction = coerceBool(
    env.ANYX_DEPLOY_PRODUCTION_AUTO_APPROVE ?? env.ORCHESTRATOR_AUTO_APPROVE_PRODUCTION,
    file.autoApproveProduction ?? deploy.production.autoApprove,
  );
  if (autoApproveProduction) {
    deploy.production = { ...deploy.production, autoApprove: true };
  }

  const skipFromEnv = (env.ANYX_SKIP_GATES ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const runtimeDirValue = env.ANYX_RUNTIME_DIR ?? env.ORCHESTRATOR_STATE_DIR ?? file.stateDir;

  return {
    repoRoot: layers.repoRoot,
    runtimeDir: runtimeDirValue
      ? isAbsolute(runtimeDirValue)
        ? runtimeDirValue
        : join(layers.repoRoot, runtimeDirValue)
      : join(layers.repoRoot, DEFAULT_RUNTIME_DIRNAME),
    concurrency: Math.max(
      1,
      coerceInt(
        env.ANYX_CONCURRENCY ?? env.ORCHESTRATOR_CONCURRENCY,
        file.concurrency ?? DEFAULT_CONCURRENCY,
      ),
    ),
    commandTimeoutMs: coerceInt(
      env.ANYX_COMMAND_TIMEOUT_MS,
      file.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    ),
    coverageThreshold: coerceInt(
      env.ANYX_COVERAGE_THRESHOLD,
      file.coverageThreshold ?? DEFAULT_COVERAGE_THRESHOLD,
    ),
    executor,
    test: { ...DEFAULT_TEST_COMMANDS, ...(file.test ?? {}) },
    build: { ...DEFAULT_BUILD_COMMANDS, ...(file.build ?? {}) },
    deploy,
    bugs: {
      ...DEFAULT_BUGS_CONFIG,
      ...(file.bugs ?? {}),
      maxFixAttempts: Math.max(
        1,
        coerceInt(
          env.ANYX_MAX_FIX_ATTEMPTS ?? env.ORCHESTRATOR_MAX_FIX_ATTEMPTS,
          file.bugs?.maxFixAttempts ?? file.maxFixAttempts ?? DEFAULT_BUGS_CONFIG.maxFixAttempts,
        ),
      ),
      createGithubIssues: coerceBool(
        env.ANYX_CREATE_GITHUB_ISSUES,
        file.bugs?.createGithubIssues ?? DEFAULT_BUGS_CONFIG.createGithubIssues,
      ),
      triageOverrides: file.bugs?.triageOverrides ?? DEFAULT_BUGS_CONFIG.triageOverrides,
      githubRepo: file.bugs?.githubRepo ?? env.ANYX_GITHUB_REPO ?? env.GITHUB_REPOSITORY,
    },
    skipGates: [...(file.skipGates ?? []), ...skipFromEnv],
    env,
    sources: layers.sources ?? [],
  };
}

export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(startDir);
    dir = parent;
  }
}

function readIfPresent(path: string): string | undefined {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  } catch {
    return undefined;
  }
}

export interface LoadConfigOptions {
  readonly repoRoot?: string;
  readonly processEnv?: Readonly<Record<string, string | undefined>>;
}

export function loadConfig(options: LoadConfigOptions = {}): OrchestratorConfig {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const processEnv = options.processEnv ?? process.env;
  const sources: ConfigSource[] = [
    { kind: 'process-env', present: true, keys: Object.keys(processEnv).length },
  ];

  const dotenvLayers: Record<string, Record<string, string>> = {};
  for (const candidate of DOTENV_CANDIDATES) {
    const path = join(repoRoot, candidate);
    const text = readIfPresent(path);
    const parsed = text === undefined ? {} : parseDotenv(text);
    dotenvLayers[candidate] = parsed;
    sources.push({
      kind: 'dotenv',
      path: candidate,
      present: text !== undefined,
      keys: Object.keys(parsed).length,
    });
  }

  let configFile: OrchestratorConfigFile | undefined;
  let configFilePath: string | undefined;
  for (const candidate of CONFIG_FILE_CANDIDATES) {
    const path = join(repoRoot, candidate);
    const text = readIfPresent(path);
    if (text === undefined) continue;
    try {
      configFile = JSON.parse(stripJsonComments(text)) as OrchestratorConfigFile;
      configFilePath = candidate;
    } catch (error) {
      throw new ConfigError(
        `Could not parse ${candidate}: ${(error as Error).message}`,
        `Fix the JSON syntax in ${candidate}, or delete the file to fall back to built-in defaults.`,
      );
    }
    break;
  }
  sources.push({
    kind: 'config-file',
    path: configFilePath ?? CONFIG_FILE_CANDIDATES[0],
    present: configFile !== undefined,
    keys: configFile ? Object.keys(configFile).length : 0,
  });
  sources.push({ kind: 'defaults', present: true, keys: 0 });

  return resolveConfig({
    repoRoot,
    processEnv,
    dotenvLocal: dotenvLayers['.env.local'],
    dotenv: dotenvLayers['.env'],
    configFile,
    sources,
  });
}

export function requireEnv(config: OrchestratorConfig, key: string, howToObtain: string): string {
  const value = config.env[key];
  if (value === undefined || value.trim() === '') {
    throw new ConfigError(`Missing required configuration key ${key}.`, howToObtain);
  }
  return value;
}
