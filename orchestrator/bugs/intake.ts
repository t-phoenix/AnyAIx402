import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { OrchestratorConfig } from '../config/types.ts';
import { hasBinary, runCommand } from '../core/exec.ts';
import type { RuntimePaths } from '../core/paths.ts';
import { ensureRuntimeDirs } from '../core/paths.ts';
import type { VerificationResult } from '../core/verifier.ts';
import { bugIdFor, excerptOf, extractSuspectedFiles, fingerprintOf } from './fingerprint.ts';
import { findByFingerprint, recordEvent } from './store.ts';
import { triage } from './triage.ts';
import type { BugReport, BugStoreFile, RawFinding } from './types.ts';

export interface IntakeOutcome {
  readonly bug: BugReport;
  readonly isNew: boolean;
}

/**
 * Normalizes a finding into the store, collapsing it into an existing bug when
 * the fingerprint matches so a flaky check does not create a hundred entries.
 */
export function ingestFinding(
  store: BugStoreFile,
  finding: RawFinding,
  config: OrchestratorConfig,
): IntakeOutcome {
  const fingerprint = fingerprintOf(finding);
  const suspectedFiles = extractSuspectedFiles(finding.output, finding.files ?? []);
  const existing = findByFingerprint(store, fingerprint);

  if (existing) {
    existing.occurrences += 1;
    existing.errorExcerpt = excerptOf(finding.output);
    if (finding.taskId && existing.taskId === undefined) existing.taskId = finding.taskId;
    for (const file of suspectedFiles) {
      if (!existing.suspectedFiles.includes(file)) existing.suspectedFiles.push(file);
    }
    if (existing.status === 'resolved') {
      existing.status = 'open';
      recordEvent(existing, 'seen-again', 'regressed after being marked resolved');
    } else {
      recordEvent(existing, 'seen-again', `observed again (${existing.occurrences} total)`);
    }
    return { bug: existing, isNew: false };
  }

  const classification = triage(finding, suspectedFiles, config.bugs.triageOverrides);
  const now = new Date().toISOString();
  const bug: BugReport = {
    id: bugIdFor(fingerprint),
    title: finding.title,
    source: finding.source,
    severity: classification.severity,
    fingerprint,
    status: 'triaged',
    failingCommand: finding.failingCommand,
    errorExcerpt: excerptOf(finding.output),
    suspectedFiles,
    suspectedDomain: classification.agentId,
    triageRationale: classification.rationale,
    taskId: finding.taskId,
    reference: finding.reference,
    occurrences: 1,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    history: [
      { at: now, kind: 'opened', message: `opened from ${finding.source}` },
      { at: now, kind: 'triaged', message: classification.rationale },
    ],
  };

  store.bugs.push(bug);
  return { bug, isNew: true };
}

/** Every non-optional failed check becomes its own finding. */
export function findingsFromVerification(
  result: VerificationResult,
  taskTitle: string,
): readonly RawFinding[] {
  return result.failures.map((check) => ({
    title: `${taskTitle}: ${check.label}`,
    source: check.kind === 'verify-command' ? 'verify-command' : 'acceptance-criterion',
    output: check.excerpt ?? check.reason ?? 'check failed with no captured output',
    failingCommand: check.command,
    exitCode: check.exitCode,
    taskId: result.taskId,
  }));
}

export function findingFromCommand(
  label: string,
  source: RawFinding['source'],
  command: string,
  output: string,
  exitCode: number,
): RawFinding {
  return { title: label, source, output, failingCommand: command, exitCode };
}

interface InboxPayload {
  readonly title?: string;
  readonly message?: string;
  readonly error?: string;
  readonly stack?: string;
  readonly command?: string;
  readonly source?: RawFinding['source'];
  readonly files?: readonly string[];
  readonly taskId?: string;
}

/**
 * Runtime errors are dropped into `.orchestrator/inbox/` as JSON by any process
 * that wants to report one. Consumed files are moved aside so a restart does not
 * re-ingest them.
 */
export function findingsFromInbox(paths: RuntimePaths): readonly RawFinding[] {
  ensureRuntimeDirs(paths);
  if (!existsSync(paths.inboxDir)) return [];

  const findings: RawFinding[] = [];
  for (const entry of readdirSync(paths.inboxDir)) {
    if (!entry.endsWith('.json')) continue;
    const full = join(paths.inboxDir, entry);
    try {
      const payload = JSON.parse(readFileSync(full, 'utf8')) as InboxPayload;
      const output = [payload.message, payload.error, payload.stack]
        .filter((part): part is string => typeof part === 'string' && part !== '')
        .join('\n');
      findings.push({
        title: payload.title ?? `runtime report: ${entry}`,
        source: payload.source ?? 'runtime-report',
        output: output === '' ? readFileSync(full, 'utf8') : output,
        failingCommand: payload.command,
        files: payload.files,
        taskId: payload.taskId,
        reference: entry,
      });
      renameSync(full, `${full}.ingested`);
    } catch {
      renameSync(full, `${full}.invalid`);
    }
  }
  return findings;
}

export interface CiIntakeResult {
  readonly findings: readonly RawFinding[];
  readonly skippedReason?: string;
}

/**
 * Reads failed GitHub Actions runs through the `gh` CLI. Absent or unauthenticated
 * `gh` is a skip with a stated reason, never a failure.
 */
export async function findingsFromGithubActions(
  config: OrchestratorConfig,
  limit = 5,
): Promise<CiIntakeResult> {
  if (!hasBinary('gh')) {
    return {
      findings: [],
      skippedReason: 'the gh CLI is not installed, so CI logs cannot be read',
    };
  }

  const list = await runCommand(
    `gh run list --status failure --limit ${limit} --json databaseId,name,headBranch,conclusion,url`,
    { cwd: config.repoRoot, env: config.env, timeoutMs: 60_000 },
  );
  if (list.exitCode !== 0) {
    return {
      findings: [],
      skippedReason: `gh could not list workflow runs (exit ${list.exitCode}). Authenticate with \`gh auth login\`.`,
    };
  }

  let runs: { databaseId: number; name: string; headBranch: string; url: string }[];
  try {
    runs = JSON.parse(list.stdout || '[]') as typeof runs;
  } catch {
    return { findings: [], skippedReason: 'gh returned output that was not valid JSON' };
  }

  const findings: RawFinding[] = [];
  for (const run of runs) {
    const log = await runCommand(`gh run view ${run.databaseId} --log-failed`, {
      cwd: config.repoRoot,
      env: config.env,
      timeoutMs: 120_000,
    });
    findings.push({
      title: `CI failure: ${run.name} on ${run.headBranch}`,
      source: 'github-actions',
      output: log.stdout || log.stderr || 'no log output captured',
      reference: run.url,
    });
  }

  return { findings };
}

const VITEST_FAILURE = /(?:FAIL|✕|×)\s+(\S+)/g;
const BUN_TEST_FAILURE = /\(fail\)\s+(.+)/g;

/** Pulls individual failing test names out of a Vitest or bun test transcript. */
export function findingsFromTestOutput(output: string, command: string): readonly RawFinding[] {
  const names = new Set<string>();
  for (const match of output.matchAll(VITEST_FAILURE)) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of output.matchAll(BUN_TEST_FAILURE)) {
    if (match[1]) names.add(match[1].trim());
  }

  if (names.size === 0) {
    return [{ title: 'test suite failed', source: 'test-run', output, failingCommand: command }];
  }

  return [...names].slice(0, 25).map((name) => ({
    title: `failing test: ${name}`,
    source: 'test-run' as const,
    output: relevantSection(output, name),
    failingCommand: command,
    files: /[\w./-]+\.(test|spec)\.[jt]sx?/.test(name) ? [name] : undefined,
  }));
}

/** The window of a transcript around a named test, so each bug gets its own context. */
function relevantSection(output: string, needle: string, radius = 25): string {
  const lines = output.split('\n');
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) return output.slice(0, 4000);
  return lines.slice(Math.max(0, index - 2), index + radius).join('\n');
}
