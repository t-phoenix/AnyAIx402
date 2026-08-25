import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { TaskStatus } from '../shared/types.ts';
import type { RuntimePaths } from './paths.ts';
import { ensureRuntimeDirs } from './paths.ts';

export const STATE_VERSION = 1;

export interface TaskState {
  status: TaskStatus;
  attempts: number;
  dispatches: number;
  firstStartedAt?: string;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
  /** Bug ids opened against this task. */
  bugIds: string[];
}

export type RunMode = 'run' | 'dry-run' | 'resume' | 'fix';

export interface RunRecord {
  id: string;
  mode: RunMode;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'interrupted' | 'failed';
  taskIds: string[];
  completedTaskIds: string[];
  failedTaskIds: string[];
  notes?: string;
}

export interface OrchestratorState {
  version: number;
  updatedAt: string;
  tasks: Record<string, TaskState>;
  runs: RunRecord[];
  currentRunId?: string;
}

export function emptyState(): OrchestratorState {
  return { version: STATE_VERSION, updatedAt: new Date().toISOString(), tasks: {}, runs: [] };
}

export function loadState(paths: RuntimePaths): OrchestratorState {
  if (!existsSync(paths.statePath)) return emptyState();
  try {
    const parsed = JSON.parse(readFileSync(paths.statePath, 'utf8')) as Partial<OrchestratorState>;
    return {
      version: parsed.version ?? STATE_VERSION,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      tasks: parsed.tasks ?? {},
      runs: parsed.runs ?? [],
      currentRunId: parsed.currentRunId,
    };
  } catch {
    return emptyState();
  }
}

/** Written via a temp file and rename so an interrupt cannot truncate state. */
export function saveState(paths: RuntimePaths, state: OrchestratorState): void {
  ensureRuntimeDirs(paths);
  state.updatedAt = new Date().toISOString();
  const tmp = `${paths.statePath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, paths.statePath);
}

export function taskState(state: OrchestratorState, taskId: string): TaskState {
  const existing = state.tasks[taskId];
  if (existing) return existing;
  const created: TaskState = { status: 'pending', attempts: 0, dispatches: 0, bugIds: [] };
  state.tasks[taskId] = created;
  return created;
}

export function statusMap(state: OrchestratorState): Record<string, TaskStatus> {
  const map: Record<string, TaskStatus> = {};
  for (const [id, entry] of Object.entries(state.tasks)) map[id] = entry.status;
  return map;
}

export function setTaskStatus(
  state: OrchestratorState,
  taskId: string,
  status: TaskStatus,
  patch: Partial<Omit<TaskState, 'status'>> = {},
): TaskState {
  const entry = taskState(state, taskId);
  entry.status = status;
  Object.assign(entry, patch);
  if (status === 'running') {
    entry.lastStartedAt = new Date().toISOString();
    entry.firstStartedAt ??= entry.lastStartedAt;
  }
  if (status === 'done' || status === 'failed' || status === 'skipped') {
    entry.lastFinishedAt = new Date().toISOString();
  }
  return entry;
}

export function startRun(state: OrchestratorState, mode: RunMode, taskIds: readonly string[]): RunRecord {
  const record: RunRecord = {
    id: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    mode,
    startedAt: new Date().toISOString(),
    status: 'running',
    taskIds: [...taskIds],
    completedTaskIds: [],
    failedTaskIds: [],
  };
  state.runs.push(record);
  state.currentRunId = record.id;
  return record;
}

export function finishRun(
  state: OrchestratorState,
  runId: string,
  status: RunRecord['status'],
  notes?: string,
): void {
  const record = state.runs.find((run) => run.id === runId);
  if (!record) return;
  record.status = status;
  record.finishedAt = new Date().toISOString();
  if (notes !== undefined) record.notes = notes;
  if (state.currentRunId === runId) state.currentRunId = undefined;
}

export function currentRun(state: OrchestratorState): RunRecord | undefined {
  return state.runs.find((run) => run.id === state.currentRunId);
}

/** Any run left in `running` was interrupted; `resume` picks these up. */
export function interruptedRuns(state: OrchestratorState): readonly RunRecord[] {
  return state.runs.filter((run) => run.status === 'running');
}
