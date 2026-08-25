import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgent } from '../agents/index.ts';
import type { OrchestratorConfig } from '../config/types.ts';
import { dispatchTask } from '../core/dispatcher.ts';
import { appendEvent } from '../core/events.ts';
import { runCommand } from '../core/exec.ts';
import type { AgentExecutor } from '../core/executors/index.ts';
import type { RuntimePaths } from '../core/paths.ts';
import { sanitizeId } from '../core/paths.ts';
import { getTask } from '../tasks/index.ts';
import type { TaskDefinition } from '../tasks/types.ts';
import { recordEvent, saveBugs } from './store.ts';
import type { BugReport, BugStoreFile } from './types.ts';

/**
 * A bug becomes a task so the fix travels through exactly the same dispatch,
 * verification and logging path as planned work.
 */
export function bugFixTask(bug: BugReport): TaskDefinition {
  const origin = bug.taskId ? getTask(bug.taskId) : undefined;
  const agent = getAgent(bug.suspectedDomain);
  const command = bug.failingCommand;

  return {
    id: `fix/${bug.id}`,
    title: `Fix: ${bug.title}`,
    phase: origin?.phase ?? 'ci',
    agentId: bug.suspectedDomain,
    summary: [
      'A verification failure was captured and triaged to your domain.',
      '',
      `Severity: ${bug.severity}. Seen ${bug.occurrences} time(s). Fix attempt ${bug.attempts + 1}.`,
      `Triage rationale: ${bug.triageRationale}`,
      command ? `\nFailing command:\n\`${command}\`` : '',
      '',
      'Captured output:',
      '```',
      bug.errorExcerpt,
      '```',
      '',
      bug.suspectedFiles.length > 0
        ? `Files named in the failure:\n${bug.suspectedFiles.map((file) => `- ${file}`).join('\n')}`
        : 'No source files were named in the failure output; locate the cause yourself.',
      '',
      'Find the root cause and fix it. Do not silence the check, loosen a threshold, delete the failing test, or mark it skipped. If the check itself is wrong, say so explicitly in your report rather than changing it quietly.',
    ].join('\n'),
    dependsOn: [],
    ownedPaths: origin?.ownedPaths ?? agent.ownedPaths,
    acceptanceCriteria: [],
    verifyCommands: command ? [{ command }] : (origin?.verifyCommands ?? []),
    requiredConfigKeys: origin?.requiredConfigKeys ?? [],
    requiredManualGates: origin?.requiredManualGates ?? [],
    status: 'ready',
    priority: bug.severity === 'critical' ? 0 : bug.severity === 'high' ? 1 : 5,
    estimatedComplexity: 'small',
  };
}

function backoffMs(attempt: number, config: OrchestratorConfig): number {
  const raw = config.bugs.backoffBaseMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, config.bugs.backoffMaxMs);
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Re-runs the exact command that produced the bug. */
async function revalidate(
  bug: BugReport,
  config: OrchestratorConfig,
): Promise<{ ok: boolean; output: string; reason?: string }> {
  if (!bug.failingCommand) {
    return {
      ok: false,
      output: '',
      reason: 'no failing command was recorded, so the fix cannot be verified automatically',
    };
  }
  const result = await runCommand(bug.failingCommand, {
    cwd: config.repoRoot,
    env: config.env,
    timeoutMs: config.commandTimeoutMs,
  });
  return { ok: result.exitCode === 0, output: `${result.stdout}\n${result.stderr}`.trim() };
}

export interface FixAttemptResult {
  readonly bugId: string;
  readonly resolved: boolean;
  readonly escalated: boolean;
  readonly attempts: number;
  readonly detail: string;
}

export interface FixLoopOptions {
  readonly dryRun?: boolean;
  readonly write?: (line: string) => void;
}

/**
 * Dispatch, re-verify, repeat. Every attempt is bounded and backed off, and the
 * loop always terminates in either a resolution or a human-readable escalation.
 */
export async function attemptFix(
  bug: BugReport,
  store: BugStoreFile,
  config: OrchestratorConfig,
  paths: RuntimePaths,
  executor: AgentExecutor,
  options: FixLoopOptions = {},
): Promise<FixAttemptResult> {
  const write = options.write ?? (() => {});
  const maxAttempts = config.bugs.maxFixAttempts;

  while (bug.attempts < maxAttempts) {
    bug.attempts += 1;
    bug.lastAttemptAt = new Date().toISOString();
    bug.status = 'fixing';

    const delay = backoffMs(bug.attempts, config);
    if (bug.attempts > 1) {
      write(`  waiting ${delay}ms before attempt ${bug.attempts}`);
      await sleep(delay);
    }

    const task = bugFixTask(bug);
    recordEvent(
      bug,
      'fix-dispatched',
      `attempt ${bug.attempts}/${maxAttempts} to ${bug.suspectedDomain}`,
    );
    appendEvent(paths, {
      kind: 'bug.fix-attempt',
      bugId: bug.id,
      taskId: bug.taskId,
      message: `attempt ${bug.attempts}/${maxAttempts} dispatched to ${bug.suspectedDomain}`,
    });

    const dispatch = await dispatchTask(task, config, paths, executor, {
      heading: `AnyX bug fix ${bug.id}`,
      promptFileName: `${sanitizeId(bug.id)}.attempt-${bug.attempts}.prompt.md`,
    });
    write(
      `  dispatched via ${dispatch.executor}${dispatch.skippedReason ? ` (${dispatch.skippedReason})` : ''}`,
    );
    saveBugs(paths, store);

    if (dispatch.skippedReason !== undefined) {
      bug.status = 'triaged';
      recordEvent(bug, 'note', `no fix applied: ${dispatch.skippedReason}`);
      saveBugs(paths, store);
      return {
        bugId: bug.id,
        resolved: false,
        escalated: false,
        attempts: bug.attempts,
        detail: dispatch.skippedReason,
      };
    }

    const check = await revalidate(bug, config);
    if (check.ok) {
      bug.status = 'resolved';
      bug.resolutionNote = `verified by re-running \`${bug.failingCommand}\` after attempt ${bug.attempts}`;
      recordEvent(bug, 'verified', bug.resolutionNote);
      appendEvent(paths, { kind: 'bug.resolved', bugId: bug.id, message: bug.resolutionNote });
      saveBugs(paths, store);
      return {
        bugId: bug.id,
        resolved: true,
        escalated: false,
        attempts: bug.attempts,
        detail: bug.resolutionNote,
      };
    }

    if (check.reason) {
      recordEvent(bug, 'note', check.reason);
      break;
    }
    bug.errorExcerpt = check.output.slice(-2000);
    recordEvent(bug, 'note', `attempt ${bug.attempts} did not clear the failure`);
    saveBugs(paths, store);
  }

  return escalate(bug, store, config, paths);
}

export function escalationReport(bug: BugReport, config: OrchestratorConfig): string {
  const agent = getAgent(bug.suspectedDomain);
  return [
    `# Escalation: ${bug.title}`,
    '',
    `- bug id: ${bug.id}`,
    `- fingerprint: ${bug.fingerprint}`,
    `- severity: ${bug.severity}`,
    `- source: ${bug.source}`,
    `- occurrences: ${bug.occurrences}`,
    `- automated fix attempts: ${bug.attempts} of ${config.bugs.maxFixAttempts}`,
    `- routed to: ${agent.name} (${bug.suspectedDomain})`,
    `- triage rationale: ${bug.triageRationale}`,
    bug.taskId ? `- originating task: ${bug.taskId}` : '',
    bug.reference ? `- reference: ${bug.reference}` : '',
    '',
    '## Reproduce',
    '',
    '```bash',
    `cd ${config.repoRoot}`,
    bug.failingCommand ?? '# no command was captured for this failure',
    '```',
    '',
    '## Latest output',
    '',
    '```',
    bug.errorExcerpt,
    '```',
    '',
    '## Files implicated',
    '',
    bug.suspectedFiles.length > 0
      ? bug.suspectedFiles.map((file) => `- ${file}`).join('\n')
      : '_None named in the output._',
    '',
    '## Why automation stopped',
    '',
    `The auto-fix loop exhausted its ${config.bugs.maxFixAttempts} attempts without the verification command passing. A human needs to decide whether the implementation, the expectation, or the environment is wrong.`,
    '',
    '## History',
    '',
    bug.history.map((event) => `- ${event.at} — **${event.kind}** — ${event.message}`).join('\n'),
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function escalate(
  bug: BugReport,
  store: BugStoreFile,
  config: OrchestratorConfig,
  paths: RuntimePaths,
): FixAttemptResult {
  bug.status = 'needs-human';
  const report = escalationReport(bug, config);
  const path = join(paths.escalationsDir, `${sanitizeId(bug.id)}.md`);
  writeFileSync(path, report, 'utf8');
  bug.escalationPath = path;

  recordEvent(bug, 'escalated', `wrote reproduction report to ${path}`);
  appendEvent(paths, {
    kind: 'bug.escalated',
    bugId: bug.id,
    message: `escalated after ${bug.attempts} attempts; report at ${path}`,
  });

  if (config.bugs.draftGithubIssues) {
    writeFileSync(
      join(paths.escalationsDir, `${sanitizeId(bug.id)}.issue.md`),
      githubIssueBody(bug, config),
      'utf8',
    );
  }

  saveBugs(paths, store);
  return {
    bugId: bug.id,
    resolved: false,
    escalated: true,
    attempts: bug.attempts,
    detail: `needs human review; see ${path}`,
  };
}

/** Written to disk only. Issue creation stays opt-in and is never implicit. */
export function githubIssueBody(bug: BugReport, config: OrchestratorConfig): string {
  return [
    `**Severity:** ${bug.severity}`,
    `**Domain:** ${bug.suspectedDomain}`,
    `**Fingerprint:** \`${bug.fingerprint}\``,
    `**Automated fix attempts:** ${bug.attempts}/${config.bugs.maxFixAttempts}`,
    '',
    bug.failingCommand ? `Reproduce:\n\n\`\`\`bash\n${bug.failingCommand}\n\`\`\`\n` : '',
    '```',
    bug.errorExcerpt,
    '```',
    '',
    '_Opened by the AnyX orchestrator after its auto-fix loop was exhausted._',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
