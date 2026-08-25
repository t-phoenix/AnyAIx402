import { attemptFix } from '../bugs/fixLoop.ts';
import { findingsFromVerification, ingestFinding } from '../bugs/intake.ts';
import { loadBugs, saveBugs } from '../bugs/store.ts';
import { evaluateAllGates } from '../config/gates.ts';
import type { OrchestratorConfig } from '../config/types.ts';
import type { Phase, TaskStatus } from '../shared/types.ts';
import { TASK_GRAPH } from '../tasks/index.ts';
import type { TaskDefinition } from '../tasks/types.ts';
import { dispatchTask } from './dispatcher.ts';
import { appendEvent } from './events.ts';
import type { AgentExecutor } from './executors/index.ts';
import type { RuntimePaths } from './paths.ts';
import { selectRunnableTasks } from './scheduler.ts';
import {
  finishRun,
  loadState,
  type OrchestratorState,
  saveState,
  setTaskStatus,
  startRun,
  statusMap,
  taskState,
} from './state.ts';
import { verificationSummary, verifyTask } from './verifier.ts';

export interface RunOptions {
  readonly phase?: Phase;
  readonly onlyTaskIds?: readonly string[];
  readonly concurrency?: number;
  readonly dryRun?: boolean;
  readonly ignoreGates?: boolean;
  /** Hand a failing task straight to the auto-fix loop within the same run. */
  readonly autoFix?: boolean;
  /** Safety valve so a misconfigured executor cannot spin forever. */
  readonly maxCycles?: number;
  readonly write?: (line: string) => void;
}

export interface TaskOutcome {
  readonly taskId: string;
  readonly status: 'done' | 'failed' | 'skipped' | 'needs-human';
  readonly detail: string;
}

export interface RunResult {
  readonly runId: string;
  readonly ok: boolean;
  readonly outcomes: readonly TaskOutcome[];
  readonly stalled: readonly string[];
  readonly cycles: number;
}

function satisfiedGateIds(config: OrchestratorConfig): readonly string[] {
  return evaluateAllGates(config.env, config.skipGates)
    .filter((status) => status.state !== 'missing' || status.gate.optional)
    .map((status) => status.gate.id);
}

async function runOneTask(
  task: TaskDefinition,
  state: OrchestratorState,
  config: OrchestratorConfig,
  paths: RuntimePaths,
  executor: AgentExecutor,
  options: RunOptions,
): Promise<TaskOutcome> {
  const write = options.write ?? (() => {});
  const entry = taskState(state, task.id);
  const priorStatus = entry.status;

  setTaskStatus(state, task.id, 'running');
  entry.dispatches += 1;
  saveState(paths, state);
  appendEvent(paths, {
    kind: 'task.dispatched',
    taskId: task.id,
    message: `${task.title} → ${task.agentId}`,
  });
  write(`→ ${task.id} — ${task.title} (${task.agentId})`);

  const dispatch = await dispatchTask(task, config, paths, executor);
  write(`  executor ${dispatch.executor}: ${dispatch.skippedReason ?? 'completed'}`);

  if (dispatch.skippedReason !== undefined) {
    // A skip means no work happened, so the task keeps the status it came in
    // with. Recording it as complete would make the next run walk straight past
    // work that was never done.
    setTaskStatus(state, task.id, priorStatus, { lastError: dispatch.skippedReason });
    entry.dispatches -= 1;
    saveState(paths, state);
    appendEvent(paths, {
      kind: 'task.status',
      taskId: task.id,
      message: `skipped: ${dispatch.skippedReason}`,
    });
    return { taskId: task.id, status: 'skipped', detail: dispatch.skippedReason };
  }

  setTaskStatus(state, task.id, 'verifying');
  entry.attempts += 1;
  saveState(paths, state);

  const verification = await verifyTask(task, config, paths);
  entry.lastVerifiedAt = new Date().toISOString();
  const summary = verificationSummary(verification);
  write(`  ${summary}`);
  appendEvent(paths, {
    kind: 'task.verified',
    taskId: task.id,
    message: summary,
    data: { ok: verification.ok },
  });

  if (verification.ok) {
    setTaskStatus(state, task.id, 'done');
    saveState(paths, state);
    return { taskId: task.id, status: 'done', detail: summary };
  }

  const store = loadBugs(paths);
  const openedIds: string[] = [];
  for (const finding of findingsFromVerification(verification, task.title)) {
    const { bug, isNew } = ingestFinding(store, finding, config);
    if (!entry.bugIds.includes(bug.id)) entry.bugIds.push(bug.id);
    openedIds.push(bug.id);
    if (isNew) {
      appendEvent(paths, {
        kind: 'bug.opened',
        bugId: bug.id,
        taskId: task.id,
        message: `${bug.severity} — ${bug.title} → ${bug.suspectedDomain}`,
      });
    }
  }
  saveBugs(paths, store);
  write(`  opened ${openedIds.length} bug(s): ${openedIds.join(', ') || 'none'}`);

  if (options.autoFix === true && openedIds.length > 0) {
    let allResolved = true;
    for (const bugId of openedIds) {
      const bug = store.bugs.find((candidate) => candidate.id === bugId);
      if (!bug || bug.status === 'resolved') continue;
      write(`  auto-fixing ${bugId}`);
      const outcome = await attemptFix(bug, store, config, paths, executor, { write });
      if (!outcome.resolved) allResolved = false;
    }
    if (allResolved) {
      const recheck = await verifyTask(task, config, paths);
      if (recheck.ok) {
        setTaskStatus(state, task.id, 'done');
        saveState(paths, state);
        return {
          taskId: task.id,
          status: 'done',
          detail: `fixed and re-verified: ${verificationSummary(recheck)}`,
        };
      }
    }
  }

  const escalated = store.bugs.some(
    (bug) => openedIds.includes(bug.id) && bug.status === 'needs-human',
  );
  const status = escalated ? 'needs-human' : 'failed';
  setTaskStatus(state, task.id, status, { lastError: summary });
  saveState(paths, state);

  return { taskId: task.id, status, detail: summary };
}

/**
 * Repeatedly schedules whatever is ready until nothing can make progress.
 *
 * A cycle that selects nothing while work remains is a stall, reported with the
 * reason each remaining task is blocked rather than looping silently.
 */
export async function run(
  config: OrchestratorConfig,
  paths: RuntimePaths,
  executor: AgentExecutor,
  options: RunOptions = {},
): Promise<RunResult> {
  const write = options.write ?? (() => {});
  const state = loadState(paths);
  const concurrency = options.concurrency ?? config.concurrency;
  const maxCycles = options.maxCycles ?? TASK_GRAPH.length + 5;
  const satisfied = satisfiedGateIds(config);

  /**
   * Tasks already attempted in this run. A skip leaves the durable status
   * untouched, so without this overlay the scheduler would hand back the same
   * task every cycle; with it, a dry run still walks the graph in dependency
   * order while `state.json` stays honest about what has actually been built.
   */
  const attempted: Record<string, TaskStatus> = {};
  const effectiveStatuses = (): Record<string, TaskStatus> => ({
    ...statusMap(state),
    ...attempted,
  });

  const firstPass = selectRunnableTasks({
    tasks: TASK_GRAPH,
    statuses: effectiveStatuses(),
    satisfiedGates: satisfied,
    env: config.env,
    concurrency,
    ignoreGates: options.ignoreGates,
    phase: options.phase,
    onlyTaskIds: options.onlyTaskIds,
  });

  const record = startRun(
    state,
    options.dryRun === true ? 'dry-run' : 'run',
    firstPass.selected.map((task) => task.id),
  );
  saveState(paths, state);
  appendEvent(paths, {
    kind: 'run.started',
    runId: record.id,
    message: `${record.mode} with concurrency ${concurrency}`,
  });

  const outcomes: TaskOutcome[] = [];
  let cycles = 0;

  for (;;) {
    cycles += 1;
    if (cycles > maxCycles) {
      write(`stopping after ${maxCycles} cycles to avoid an unbounded loop`);
      break;
    }

    const selection = selectRunnableTasks({
      tasks: TASK_GRAPH,
      statuses: effectiveStatuses(),
      satisfiedGates: satisfied,
      env: config.env,
      concurrency,
      ignoreGates: options.ignoreGates,
      phase: options.phase,
      onlyTaskIds: options.onlyTaskIds,
    });

    if (selection.selected.length === 0) break;

    let progressed = false;
    for (const task of selection.selected) {
      const outcome = await runOneTask(task, state, config, paths, executor, options);
      outcomes.push(outcome);
      attempted[task.id] = outcome.status === 'skipped' ? 'done' : outcome.status;
      if (!record.taskIds.includes(task.id)) record.taskIds.push(task.id);
      if (outcome.status === 'done') {
        record.completedTaskIds.push(task.id);
        progressed = true;
      } else if (outcome.status === 'failed' || outcome.status === 'needs-human') {
        record.failedTaskIds.push(task.id);
      } else if (outcome.status === 'skipped') {
        progressed = true;
      }
      saveState(paths, state);
    }

    if (!progressed) break;
  }

  const finalStatuses = statusMap(state);
  const stalled = TASK_GRAPH.filter((task) => {
    const status = finalStatuses[task.id] ?? task.status;
    return status !== 'done' && status !== 'skipped';
  }).map((task) => task.id);

  const ok = outcomes.every((outcome) => outcome.status === 'done' || outcome.status === 'skipped');
  finishRun(state, record.id, ok ? 'completed' : 'failed');
  saveState(paths, state);
  appendEvent(paths, {
    kind: 'run.finished',
    runId: record.id,
    message: `${outcomes.length} task(s) attempted; ${record.completedTaskIds.length} completed`,
  });

  return { runId: record.id, ok, outcomes, stalled, cycles };
}
