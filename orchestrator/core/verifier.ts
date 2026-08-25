import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OrchestratorConfig } from '../config/types.ts';
import type { AcceptanceCriterion, TaskDefinition, VerifyCommand } from '../tasks/types.ts';
import type { CommandResult } from '../shared/types.ts';
import { firstWord, hasBinary, runCommand, skipped } from './exec.ts';
import type { RuntimePaths } from './paths.ts';
import { sanitizeId, taskLogDir } from './paths.ts';

export type CheckKind = 'verify-command' | 'acceptance-command' | 'file-exists' | 'file-contains' | 'manual';

export interface CheckResult {
  readonly label: string;
  readonly kind: CheckKind;
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly optional: boolean;
  readonly reason?: string;
  readonly command?: string;
  readonly exitCode?: number;
  readonly excerpt?: string;
}

export interface VerificationResult {
  readonly taskId: string;
  readonly ok: boolean;
  readonly checks: readonly CheckResult[];
  readonly failures: readonly CheckResult[];
  readonly skippedChecks: readonly CheckResult[];
  readonly manualChecks: readonly CheckResult[];
  readonly logDir: string;
  readonly durationMs: number;
}

function excerptOf(result: CommandResult, lines = 30): string {
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  if (combined === '') return '';
  const all = combined.split('\n');
  return all.slice(-lines).join('\n');
}

async function runCheckCommand(
  command: string,
  config: OrchestratorConfig,
  options: { cwd?: string; requiresBinary?: string; expectedExitCode?: number },
): Promise<{ result: CommandResult; ok: boolean; skippedReason?: string }> {
  const binary = options.requiresBinary ?? '';
  if (binary !== '' && !hasBinary(binary)) {
    const reason = `${binary} is not installed on this machine`;
    return { result: skipped(command, reason), ok: true, skippedReason: reason };
  }

  const cwd = options.cwd ? join(config.repoRoot, options.cwd) : config.repoRoot;
  if (!existsSync(cwd)) {
    const reason = `working directory ${options.cwd} does not exist yet`;
    return { result: skipped(command, reason), ok: false, skippedReason: reason };
  }

  const result = await runCommand(command, {
    cwd,
    env: config.env,
    timeoutMs: config.commandTimeoutMs,
  });
  return { result, ok: result.exitCode === (options.expectedExitCode ?? 0) };
}

function checkFileExists(config: OrchestratorConfig, path: string): boolean {
  return existsSync(join(config.repoRoot, path));
}

function checkFileContains(config: OrchestratorConfig, path: string, pattern: string): boolean {
  const full = join(config.repoRoot, path);
  if (!existsSync(full)) return false;
  try {
    return new RegExp(pattern, 'i').test(readFileSync(full, 'utf8'));
  } catch {
    return false;
  }
}

async function evaluateCriterion(
  criterion: AcceptanceCriterion,
  config: OrchestratorConfig,
  logs: string[],
): Promise<CheckResult> {
  if (criterion.kind === 'file-exists') {
    const ok = checkFileExists(config, criterion.path);
    return {
      label: criterion.description,
      kind: 'file-exists',
      ok,
      skipped: false,
      optional: false,
      reason: ok ? undefined : `${criterion.path} does not exist`,
    };
  }

  if (criterion.kind === 'file-contains') {
    const ok = checkFileContains(config, criterion.path, criterion.pattern);
    return {
      label: criterion.description,
      kind: 'file-contains',
      ok,
      skipped: false,
      optional: false,
      reason: ok ? undefined : `${criterion.path} does not match /${criterion.pattern}/i`,
    };
  }

  if (criterion.kind === 'manual') {
    return {
      label: criterion.description,
      kind: 'manual',
      ok: false,
      skipped: true,
      optional: false,
      reason: 'requires human attestation',
    };
  }

  const { result, ok, skippedReason } = await runCheckCommand(criterion.command, config, {
    requiresBinary: criterion.requiresBinary ?? inferBinary(criterion.command),
    expectedExitCode: criterion.expectedExitCode,
  });
  logs.push(formatLog(criterion.description, result));

  return {
    label: criterion.description,
    kind: 'acceptance-command',
    ok,
    skipped: skippedReason !== undefined,
    optional: false,
    reason: skippedReason,
    command: criterion.command,
    exitCode: result.exitCode,
    excerpt: excerptOf(result),
  };
}

async function evaluateVerifyCommand(
  verify: VerifyCommand,
  config: OrchestratorConfig,
  logs: string[],
): Promise<CheckResult> {
  const { result, ok, skippedReason } = await runCheckCommand(verify.command, config, {
    cwd: verify.cwd,
    requiresBinary: verify.requiresBinary ?? inferBinary(verify.command),
    expectedExitCode: verify.expectedExitCode,
  });
  logs.push(formatLog(verify.command, result));

  return {
    label: verify.command,
    kind: 'verify-command',
    ok,
    skipped: skippedReason !== undefined,
    optional: verify.optional === true,
    reason: skippedReason,
    command: verify.command,
    exitCode: result.exitCode,
    excerpt: excerptOf(result),
  };
}

/** Commands whose absence should be reported as a skip rather than a failure. */
const OPTIONAL_BINARIES = new Set(['forge', 'docker', 'flyctl', 'gh', 'psql', 'redis-cli', 'slither', 'semgrep', 'npm']);

function inferBinary(command: string): string | undefined {
  const head = firstWord(command);
  return OPTIONAL_BINARIES.has(head) ? head : undefined;
}

function formatLog(label: string, result: CommandResult): string {
  const header = `$ ${result.command}`;
  const meta = result.skippedReason
    ? `SKIPPED: ${result.skippedReason}`
    : `exit=${result.exitCode} duration=${result.durationMs}ms${result.timedOut ? ' TIMED OUT' : ''}`;
  return [`### ${label}`, header, meta, result.stdout, result.stderr].filter(Boolean).join('\n');
}

export async function verifyTask(
  task: TaskDefinition,
  config: OrchestratorConfig,
  paths: RuntimePaths,
): Promise<VerificationResult> {
  const started = Date.now();
  const logDir = taskLogDir(paths, task.id);
  const logs: string[] = [`# Verification of ${task.id} — ${task.title}`, new Date().toISOString()];
  const checks: CheckResult[] = [];

  for (const criterion of task.acceptanceCriteria) {
    checks.push(await evaluateCriterion(criterion, config, logs));
  }
  for (const verify of task.verifyCommands) {
    checks.push(await evaluateVerifyCommand(verify, config, logs));
  }

  const failures = checks.filter((check) => !check.ok && !check.skipped && !check.optional);
  const skippedChecks = checks.filter((check) => check.skipped && check.kind !== 'manual');
  const manualChecks = checks.filter((check) => check.kind === 'manual');

  writeFileSync(join(logDir, 'verify.log'), `${logs.join('\n\n')}\n`, 'utf8');
  writeFileSync(
    join(logDir, 'verify.json'),
    `${JSON.stringify({ taskId: task.id, checks, at: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );

  return {
    taskId: task.id,
    ok: failures.length === 0,
    checks,
    failures,
    skippedChecks,
    manualChecks,
    logDir,
    durationMs: Date.now() - started,
  };
}

export function verificationSummary(result: VerificationResult): string {
  const passed = result.checks.filter((check) => check.ok && !check.skipped).length;
  const parts = [`${passed}/${result.checks.length} checks passed`];
  if (result.failures.length > 0) parts.push(`${result.failures.length} failed`);
  if (result.skippedChecks.length > 0) parts.push(`${result.skippedChecks.length} skipped`);
  if (result.manualChecks.length > 0) parts.push(`${result.manualChecks.length} need human attestation`);
  return parts.join(', ');
}

export function verificationLogPath(paths: RuntimePaths, taskId: string): string {
  return join(paths.logsDir, sanitizeId(taskId), 'verify.log');
}
