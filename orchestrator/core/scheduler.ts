import { anyGlobsOverlap } from '../shared/glob.ts';
import type { Phase, TaskStatus } from '../shared/types.ts';
import { evaluateReadiness, type TaskReadiness } from '../tasks/graph.ts';
import type { TaskDefinition } from '../tasks/types.ts';

export interface InFlightTask {
  readonly taskId: string;
  readonly ownedPaths: readonly string[];
}

export interface SchedulerInput {
  readonly tasks: readonly TaskDefinition[];
  readonly statuses: Readonly<Record<string, TaskStatus>>;
  readonly satisfiedGates: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly concurrency: number;
  readonly inFlight?: readonly InFlightTask[];
  readonly ignoreGates?: boolean;
  readonly phase?: Phase;
  readonly onlyTaskIds?: readonly string[];
}

export type DeferReason =
  | 'concurrency-limit'
  | 'path-collision'
  | 'unmet-dependencies'
  | 'missing-gates'
  | 'missing-config'
  | 'not-in-filter'
  | 'already-complete'
  | 'needs-human';

export interface DeferredTask {
  readonly task: TaskDefinition;
  readonly reason: DeferReason;
  readonly detail: readonly string[];
}

export interface Selection {
  readonly selected: readonly TaskDefinition[];
  readonly deferred: readonly DeferredTask[];
  readonly readiness: readonly TaskReadiness[];
}

function matchesFilter(task: TaskDefinition, input: SchedulerInput): boolean {
  if (input.onlyTaskIds && input.onlyTaskIds.length > 0) {
    return input.onlyTaskIds.includes(task.id);
  }
  if (input.phase !== undefined) return task.phase === input.phase;
  return true;
}

/**
 * Chooses what to run next.
 *
 * Two agents must never hold the same owned path at the same time, so a task
 * whose ownership globs intersect an in-flight or already-selected task waits
 * for the next cycle even when it is otherwise ready. This is the same
 * collision-avoidance discipline the human-facing agents operate under.
 */
export function selectRunnableTasks(input: SchedulerInput): Selection {
  const readiness = evaluateReadiness({
    tasks: input.tasks,
    statuses: input.statuses,
    satisfiedGates: input.satisfiedGates,
    env: input.env,
    ignoreGates: input.ignoreGates,
  });

  const selected: TaskDefinition[] = [];
  const deferred: DeferredTask[] = [];
  const claimed: string[][] = (input.inFlight ?? []).map((entry) => [...entry.ownedPaths]);
  const capacity = Math.max(0, input.concurrency - (input.inFlight?.length ?? 0));

  const ordered = [...readiness].sort(
    (a, b) => a.task.priority - b.task.priority || a.task.id.localeCompare(b.task.id),
  );

  for (const entry of ordered) {
    const { task } = entry;

    if (!matchesFilter(task, input)) {
      deferred.push({ task, reason: 'not-in-filter', detail: [] });
      continue;
    }
    if (entry.status === 'done' || entry.status === 'skipped') {
      deferred.push({ task, reason: 'already-complete', detail: [entry.status] });
      continue;
    }
    if (entry.status === 'needs-human') {
      deferred.push({ task, reason: 'needs-human', detail: ['escalated; clear it with `bugs` or state edit'] });
      continue;
    }
    if (entry.unmetDependencies.length > 0) {
      deferred.push({ task, reason: 'unmet-dependencies', detail: entry.unmetDependencies });
      continue;
    }
    if (entry.missingGates.length > 0) {
      deferred.push({ task, reason: 'missing-gates', detail: entry.missingGates });
      continue;
    }
    if (entry.missingConfigKeys.length > 0) {
      deferred.push({ task, reason: 'missing-config', detail: entry.missingConfigKeys });
      continue;
    }
    if (selected.length >= capacity) {
      deferred.push({ task, reason: 'concurrency-limit', detail: [`limit ${input.concurrency}`] });
      continue;
    }

    const collision = claimed.find((paths) => anyGlobsOverlap(paths, task.ownedPaths));
    if (collision && task.ownedPaths.length > 0) {
      deferred.push({ task, reason: 'path-collision', detail: collision });
      continue;
    }

    selected.push(task);
    claimed.push([...task.ownedPaths]);
  }

  return { selected, deferred, readiness };
}

export function describeDeferReason(reason: DeferReason): string {
  switch (reason) {
    case 'concurrency-limit':
      return 'waiting for a free slot';
    case 'path-collision':
      return 'another running task owns an overlapping path';
    case 'unmet-dependencies':
      return 'dependencies not finished';
    case 'missing-gates':
      return 'manual gate not satisfied';
    case 'missing-config':
      return 'configuration key missing';
    case 'not-in-filter':
      return 'excluded by the phase or task filter';
    case 'already-complete':
      return 'already complete';
    case 'needs-human':
      return 'escalated to a human';
  }
}
