import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgent } from '../agents/index.ts';
import { countBySeverity, loadBugs, openBugs } from '../bugs/store.ts';
import { evaluateAllGates } from '../config/gates.ts';
import type { OrchestratorConfig } from '../config/types.ts';
import { appendEvent } from '../core/events.ts';
import type { RuntimePaths } from '../core/paths.ts';
import { loadState, statusMap } from '../core/state.ts';
import { PHASES, phaseLabel, type TaskStatus } from '../shared/types.ts';
import { TASK_GRAPH } from '../tasks/index.ts';
import type { DeployResult } from './deploy.ts';
import type { TestRunResult } from './test.ts';

export interface ReportInput {
  readonly config: OrchestratorConfig;
  readonly paths: RuntimePaths;
  readonly test?: TestRunResult;
  readonly deploy?: DeployResult;
  readonly title?: string;
}

function statusCounts(statuses: Readonly<Record<string, TaskStatus>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of TASK_GRAPH) {
    const status = statuses[task.id] ?? task.status;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function progressTable(statuses: Readonly<Record<string, TaskStatus>>): string {
  const rows: string[] = ['| Phase | Done | Total | Progress |', '| --- | ---: | ---: | --- |'];
  for (const phase of PHASES) {
    const tasks = TASK_GRAPH.filter((task) => task.phase === phase);
    if (tasks.length === 0) continue;
    const done = tasks.filter((task) => (statuses[task.id] ?? task.status) === 'done').length;
    const filled = Math.round((done / tasks.length) * 10);
    const bar = `${'#'.repeat(filled)}${'.'.repeat(10 - filled)}`;
    rows.push(`| ${phaseLabel(phase)} | ${done} | ${tasks.length} | \`${bar}\` |`);
  }
  return rows.join('\n');
}

export function buildReport(input: ReportInput): string {
  const { config, paths } = input;
  const state = loadState(paths);
  const statuses = statusMap(state);
  const bugStore = loadBugs(paths);
  const bugs = openBugs(bugStore);
  const severities = countBySeverity(bugStore);
  const gates = evaluateAllGates(config.env, config.skipGates);
  const missingGates = gates.filter((gate) => gate.state === 'missing' && !gate.gate.optional);

  const counts = statusCounts(statuses);
  const lines: string[] = [
    `# ${input.title ?? 'AnyX orchestrator run report'}`,
    '',
    `Generated ${new Date().toISOString()}`,
    '',
    '## Build progress',
    '',
    progressTable(statuses),
    '',
    `Task states: ${
      Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `${count} ${status}`)
        .join(', ') || 'none recorded'
    }`,
    '',
  ];

  if (input.test) {
    lines.push(
      '## Test gates',
      '',
      '| Stage | Status | Detail |',
      '| --- | --- | --- |',
      ...input.test.stages.map(
        (stage) =>
          `| ${stage.stage} | ${stage.status} | ${(stage.reason ?? `exit ${stage.exitCode ?? 0}`).replace(/\|/g, '\\|')} |`,
      ),
      '',
    );
    if (input.test.coveragePercent !== undefined) {
      lines.push(
        `Coverage: ${input.test.coveragePercent}% against a ${config.coverageThreshold}% threshold.`,
        '',
      );
    }
  }

  if (input.deploy) {
    lines.push(
      `## Deploy — ${input.deploy.environment}`,
      '',
      '| Step | Status | Detail |',
      '| --- | --- | --- |',
      ...input.deploy.steps.map(
        (step) => `| ${step.step} | ${step.status} | ${step.detail.replace(/\|/g, '\\|')} |`,
      ),
      '',
    );
    if (input.deploy.rolledBack) lines.push('The deployment was rolled back automatically.', '');
  }

  lines.push(
    '## Open bugs',
    '',
    bugs.length === 0
      ? 'None.'
      : [
          `${bugs.length} open (${severities.critical} critical, ${severities.high} high, ${severities.medium} medium, ${severities.low} low)`,
          '',
          '| Id | Severity | Owner | Attempts | Title |',
          '| --- | --- | --- | ---: | --- |',
          ...bugs
            .slice(0, 25)
            .map(
              (bug) =>
                `| \`${bug.id}\` | ${bug.severity} | ${getAgent(bug.suspectedDomain).name} | ${bug.attempts} | ${bug.title.replace(/\|/g, '\\|')} |`,
            ),
        ].join('\n'),
    '',
    '## Manual gates outstanding',
    '',
    missingGates.length === 0
      ? 'None. Every required credential is present.'
      : missingGates
          .map(
            (status) =>
              `- **${status.gate.title}** — set \`${status.missingKeys.join('`, `')}\` in \`.env.local\`. ${status.gate.signupUrl}`,
          )
          .join('\n'),
    '',
  );

  return `${lines.join('\n')}\n`;
}

export function writeReport(input: ReportInput): string {
  const body = buildReport(input);
  const name = `report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  const path = join(input.paths.reportsDir, name);
  writeFileSync(path, body, 'utf8');
  appendEvent(input.paths, { kind: 'report.written', message: `wrote ${path}` });
  return path;
}
