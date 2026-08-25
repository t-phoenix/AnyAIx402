import type { Phase, TaskStatus } from '../shared/types.ts';
import { TERMINAL_TASK_STATUSES } from '../shared/types.ts';
import type { TaskDefinition } from './types.ts';

export interface GraphValidation {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly cycles: readonly (readonly string[])[];
}

export interface TopologicalResult {
  /** Task ids in dependency order. Excludes any task caught in a cycle. */
  readonly order: readonly string[];
  readonly cycles: readonly (readonly string[])[];
}

/**
 * Kahn's algorithm. Anything still holding an in-edge once the queue drains is
 * part of a cycle, which we then enumerate with a depth-first walk so the error
 * message can name the actual loop.
 */
export function topologicalOrder(tasks: readonly TaskDefinition[]): TopologicalResult {
  const ids = new Set(tasks.map((task) => task.id));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    const deps = task.dependsOn.filter((dep) => ids.has(dep));
    indegree.set(task.id, deps.length);
    for (const dep of deps) {
      const list = dependents.get(dep) ?? [];
      list.push(task.id);
      dependents.set(dep, list);
    }
  }

  const queue = tasks
    .filter((task) => (indegree.get(task.id) ?? 0) === 0)
    .map((task) => task.id)
    .sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }

  return {
    order,
    cycles: order.length === tasks.length ? [] : findCycles(tasks),
  };
}

export function findCycles(tasks: readonly TaskDefinition[]): readonly (readonly string[])[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start);
      const key = [...cycle].sort().join('>');
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push([...cycle, id]);
      }
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dep)) visit(dep);
    }
    stack.pop();
    state.set(id, 'done');
  };

  for (const task of tasks) visit(task.id);
  return cycles;
}

export function validateGraph(
  tasks: readonly TaskDefinition[],
  knownGateIds: readonly string[] = [],
): GraphValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  for (const task of tasks) {
    if (ids.has(task.id)) errors.push(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
  }

  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) errors.push(`Task ${task.id} depends on unknown task ${dep}`);
      if (dep === task.id) errors.push(`Task ${task.id} depends on itself`);
    }
    if (knownGateIds.length > 0) {
      for (const gate of task.requiredManualGates) {
        if (!knownGateIds.includes(gate)) {
          errors.push(`Task ${task.id} requires unknown manual gate ${gate}`);
        }
      }
    }
    if (task.acceptanceCriteria.length === 0) {
      warnings.push(`Task ${task.id} has no acceptance criteria`);
    }
  }

  const { cycles } = topologicalOrder(tasks);
  for (const cycle of cycles) {
    errors.push(`Dependency cycle: ${cycle.join(' -> ')}`);
  }

  return { errors, warnings, cycles };
}

export interface ReadinessInput {
  readonly tasks: readonly TaskDefinition[];
  readonly statuses: Readonly<Record<string, TaskStatus>>;
  /** Gate ids that are satisfied or explicitly waived. */
  readonly satisfiedGates: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  /** Skips the gate and config checks; dependencies are still respected. */
  readonly ignoreGates?: boolean;
}

export interface TaskReadiness {
  readonly task: TaskDefinition;
  readonly status: TaskStatus;
  readonly ready: boolean;
  readonly unmetDependencies: readonly string[];
  readonly missingGates: readonly string[];
  readonly missingConfigKeys: readonly string[];
}

export function statusOf(
  task: TaskDefinition,
  statuses: Readonly<Record<string, TaskStatus>>,
): TaskStatus {
  return statuses[task.id] ?? task.status;
}

export function isComplete(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

export function evaluateReadiness(input: ReadinessInput): readonly TaskReadiness[] {
  const satisfied = new Set(input.satisfiedGates);

  return input.tasks.map((task) => {
    const status = statusOf(task, input.statuses);
    const unmetDependencies = task.dependsOn.filter(
      (dep) => !isComplete(input.statuses[dep] ?? 'pending'),
    );
    const missingGates = input.ignoreGates
      ? []
      : task.requiredManualGates.filter((gate) => !satisfied.has(gate));
    const missingConfigKeys = input.ignoreGates
      ? []
      : task.requiredConfigKeys.filter((key) => {
          const value = input.env[key];
          return value === undefined || value.trim() === '';
        });

    const ready =
      !isComplete(status) &&
      status !== 'running' &&
      status !== 'needs-human' &&
      unmetDependencies.length === 0 &&
      missingGates.length === 0 &&
      missingConfigKeys.length === 0;

    return { task, status, ready, unmetDependencies, missingGates, missingConfigKeys };
  });
}

export function readyTasks(input: ReadinessInput): readonly TaskDefinition[] {
  return evaluateReadiness(input)
    .filter((entry) => entry.ready)
    .map((entry) => entry.task)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function tasksInPhase(
  tasks: readonly TaskDefinition[],
  phase: Phase,
): readonly TaskDefinition[] {
  return tasks.filter((task) => task.phase === phase);
}

/** All tasks that transitively depend on the given task. */
export function downstreamOf(
  tasks: readonly TaskDefinition[],
  taskId: string,
): readonly string[] {
  const result = new Set<string>();
  let frontier = [taskId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const task of tasks) {
      if (result.has(task.id) || task.id === taskId) continue;
      if (task.dependsOn.some((dep) => frontier.includes(dep))) {
        result.add(task.id);
        next.push(task.id);
      }
    }
    frontier = next;
  }
  return [...result].sort();
}
