import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { RuntimePaths } from './paths.ts';
import { ensureRuntimeDirs } from './paths.ts';

export type EventKind =
  | 'run.started'
  | 'run.finished'
  | 'task.ready'
  | 'task.dispatched'
  | 'task.status'
  | 'task.verified'
  | 'task.blocked'
  | 'bug.opened'
  | 'bug.triaged'
  | 'bug.fix-attempt'
  | 'bug.resolved'
  | 'bug.escalated'
  | 'gate.blocked'
  | 'test.stage'
  | 'deploy.stage'
  | 'report.written';

export interface OrchestratorEvent {
  readonly ts: string;
  readonly kind: EventKind;
  readonly message: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly bugId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * Append-only JSONL. Every state transition lands here so an interrupted run can
 * be audited and resumed from durable evidence rather than from memory.
 */
export function appendEvent(
  paths: RuntimePaths,
  event: Omit<OrchestratorEvent, 'ts'> & { ts?: string },
): OrchestratorEvent {
  ensureRuntimeDirs(paths);
  const full: OrchestratorEvent = { ts: event.ts ?? new Date().toISOString(), ...event };
  appendFileSync(paths.eventsPath, `${JSON.stringify(full)}\n`, 'utf8');
  return full;
}

export function readEvents(paths: RuntimePaths, limit?: number): readonly OrchestratorEvent[] {
  if (!existsSync(paths.eventsPath)) return [];
  const lines = readFileSync(paths.eventsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const selected = limit === undefined ? lines : lines.slice(-limit);
  const events: OrchestratorEvent[] = [];
  for (const line of selected) {
    try {
      events.push(JSON.parse(line) as OrchestratorEvent);
    } catch {
      // A partially written final line is expected after a hard interrupt.
    }
  }
  return events;
}
