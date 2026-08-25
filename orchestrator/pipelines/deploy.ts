import { type GateStatus, evaluateAllGates, getGate } from '../config/gates.ts';
import { expandEnv } from '../config/load.ts';
import type { DeployStageConfig, OrchestratorConfig } from '../config/types.ts';
import { appendEvent } from '../core/events.ts';
import { firstWord, hasBinary, runCommand } from '../core/exec.ts';
import type { RuntimePaths } from '../core/paths.ts';
import type { DeployEnvironment } from '../shared/types.ts';

export type DeployStepName =
  | 'preflight'
  | 'approval'
  | 'build'
  | 'deploy'
  | 'migrate'
  | 'health-check'
  | 'rollback';

export interface DeployStepResult {
  readonly step: DeployStepName;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly detail: string;
  readonly command?: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
}

export interface DeployResult {
  readonly environment: DeployEnvironment;
  readonly ok: boolean;
  readonly steps: readonly DeployStepResult[];
  readonly rolledBack: boolean;
  readonly blockedBy: readonly string[];
}

export interface DeployOptions {
  readonly approve?: boolean;
  readonly dryRun?: boolean;
  readonly skipMigrations?: boolean;
  readonly write?: (line: string) => void;
}

function gateBlockers(stage: DeployStageConfig, config: OrchestratorConfig): readonly GateStatus[] {
  const statuses = evaluateAllGates(config.env, config.skipGates);
  return stage.requiredGates
    .map((id) => statuses.find((status) => status.gate.id === id))
    .filter((status): status is GateStatus => status !== undefined)
    .filter((status) => status.state === 'missing');
}

async function runStep(
  step: DeployStepName,
  command: string,
  config: OrchestratorConfig,
  options: DeployOptions,
): Promise<DeployStepResult> {
  if (command.trim() === '') {
    return { step, status: 'skipped', detail: 'no command is configured for this step' };
  }

  const binary = firstWord(command);
  if (!hasBinary(binary)) {
    return {
      step,
      status: 'skipped',
      detail: `${binary} is not installed on this machine`,
      command,
    };
  }

  if (options.dryRun) {
    return { step, status: 'skipped', detail: 'dry run; command not executed', command };
  }

  const result = await runCommand(command, {
    cwd: config.repoRoot,
    env: config.env,
    timeoutMs: config.commandTimeoutMs,
  });

  return {
    step,
    status: result.exitCode === 0 ? 'passed' : 'failed',
    detail:
      result.exitCode === 0
        ? `completed in ${result.durationMs}ms`
        : `exit ${result.exitCode}: ${(result.stderr || result.stdout).slice(-600).trim()}`,
    command,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  };
}

async function pollHealth(
  stage: DeployStageConfig,
  config: OrchestratorConfig,
  options: DeployOptions,
): Promise<DeployStepResult> {
  const url = expandEnv(stage.healthCheckUrl, config.env);
  if (url.trim() === '') {
    return { step: 'health-check', status: 'skipped', detail: 'no health check URL configured' };
  }
  if (options.dryRun) {
    return { step: 'health-check', status: 'skipped', detail: `dry run; would poll ${url}` };
  }

  const started = Date.now();
  for (let attempt = 1; attempt <= stage.healthCheckRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json' },
      });
      if (response.ok) {
        return {
          step: 'health-check',
          status: 'passed',
          detail: `${url} returned ${response.status} on attempt ${attempt}`,
          durationMs: Date.now() - started,
        };
      }
    } catch {
      // Not up yet; a connection error early in a rollout is expected.
    }
    if (attempt < stage.healthCheckRetries) {
      await new Promise((resolve) => setTimeout(resolve, stage.healthCheckDelayMs));
    }
  }

  return {
    step: 'health-check',
    status: 'failed',
    detail: `${url} did not become healthy after ${stage.healthCheckRetries} attempts`,
    durationMs: Date.now() - started,
  };
}

/**
 * Environment-aware deploy. Production requires an explicit approval and, when a
 * health check fails after the deploy command ran, the rollback command runs
 * automatically before the pipeline reports failure.
 */
export async function deploy(
  environment: DeployEnvironment,
  config: OrchestratorConfig,
  paths: RuntimePaths,
  options: DeployOptions = {},
): Promise<DeployResult> {
  const write = options.write ?? (() => {});
  const stage = config.deploy[environment];
  const steps: DeployStepResult[] = [];

  const blockers = gateBlockers(stage, config);
  if (blockers.length > 0) {
    for (const blocker of blockers) {
      write(`  blocked by gate ${blocker.gate.id}: missing ${blocker.missingKeys.join(', ')}`);
    }
    steps.push({
      step: 'preflight',
      status: 'failed',
      detail: `${blockers.length} manual gate(s) unsatisfied: ${blockers.map((b) => b.gate.id).join(', ')}`,
    });
    appendEvent(paths, {
      kind: 'gate.blocked',
      message: `deploy to ${environment} blocked by ${blockers.map((b) => b.gate.id).join(', ')}`,
    });
    return {
      environment,
      ok: false,
      steps,
      rolledBack: false,
      blockedBy: blockers.map((blocker) => blocker.gate.id),
    };
  }
  steps.push({
    step: 'preflight',
    status: 'passed',
    detail:
      stage.requiredGates.length > 0
        ? `all required gates satisfied: ${stage.requiredGates.join(', ')}`
        : 'no gates required for this environment',
  });
  write('  preflight passed');

  const approved = options.approve === true || stage.autoApprove;
  if (!approved) {
    steps.push({
      step: 'approval',
      status: 'failed',
      detail: `${environment} requires explicit approval. Re-run with --approve, or set deploy.${environment}.autoApprove in config/anyx.config.jsonc.`,
    });
    write(`  refusing to deploy to ${environment} without --approve`);
    return { environment, ok: false, steps, rolledBack: false, blockedBy: [] };
  }
  steps.push({
    step: 'approval',
    status: 'passed',
    detail:
      options.approve === true
        ? 'approved on the command line'
        : 'auto-approved for this environment',
  });

  for (const [step, command] of [
    ['build', stage.buildCommand],
    ['deploy', stage.deployCommand],
  ] as const) {
    write(`→ ${step}`);
    const result = await runStep(step, command, config, options);
    steps.push(result);
    write(`  ${result.status}: ${result.detail}`);
    appendEvent(paths, {
      kind: 'deploy.stage',
      message: `${environment} ${step}: ${result.status}`,
      data: { environment, step },
    });
    if (result.status === 'failed') {
      return { environment, ok: false, steps, rolledBack: false, blockedBy: [] };
    }
  }

  if (options.skipMigrations !== true) {
    write('→ migrate');
    const migrate = await runStep('migrate', stage.migrateCommand, config, options);
    steps.push(migrate);
    write(`  ${migrate.status}: ${migrate.detail}`);
    if (migrate.status === 'failed') {
      const rollback = await runStep('rollback', stage.rollbackCommand, config, options);
      steps.push(rollback);
      return {
        environment,
        ok: false,
        steps,
        rolledBack: rollback.status === 'passed',
        blockedBy: [],
      };
    }
  }

  write('→ health check');
  const health = await pollHealth(stage, config, options);
  steps.push(health);
  write(`  ${health.status}: ${health.detail}`);
  appendEvent(paths, {
    kind: 'deploy.stage',
    message: `${environment} health-check: ${health.status}`,
    data: { environment },
  });

  if (health.status === 'failed') {
    write('→ rollback');
    const rollback = await runStep('rollback', stage.rollbackCommand, config, options);
    steps.push(rollback);
    write(`  ${rollback.status}: ${rollback.detail}`);
    return {
      environment,
      ok: false,
      steps,
      rolledBack: rollback.status === 'passed',
      blockedBy: [],
    };
  }

  return { environment, ok: true, steps, rolledBack: false, blockedBy: [] };
}

export function describeGateForOperator(gateId: string): string {
  const gate = getGate(gateId);
  if (!gate) return `- ${gateId}: unknown gate`;
  return [
    `- ${gate.id}: ${gate.title}`,
    `  set ${gate.configKeys.join(', ')}`,
    `  ${gate.signupUrl}`,
  ].join('\n');
}
