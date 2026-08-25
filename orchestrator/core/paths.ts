import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OrchestratorConfig } from '../config/types.ts';

export interface RuntimePaths {
  readonly root: string;
  readonly statePath: string;
  readonly eventsPath: string;
  readonly bugsPath: string;
  readonly logsDir: string;
  readonly inboxDir: string;
  readonly escalationsDir: string;
  readonly reportsDir: string;
  readonly promptsDir: string;
}

export function runtimePaths(config: OrchestratorConfig): RuntimePaths {
  const root = config.runtimeDir;
  return {
    root,
    statePath: join(root, 'state.json'),
    eventsPath: join(root, 'events.jsonl'),
    bugsPath: join(root, 'bugs.json'),
    logsDir: join(root, 'logs'),
    inboxDir: join(root, 'inbox'),
    escalationsDir: join(root, 'escalations'),
    reportsDir: join(root, 'reports'),
    promptsDir: join(root, 'prompts'),
  };
}

/**
 * The runtime directory is created on demand and self-ignores: the repository's
 * .gitignore is owned by another agent, so `.orchestrator/.gitignore` containing
 * `*` keeps every artefact out of git without touching a file we do not own.
 */
export function ensureRuntimeDirs(paths: RuntimePaths): void {
  for (const dir of [
    paths.root,
    paths.logsDir,
    paths.inboxDir,
    paths.escalationsDir,
    paths.reportsDir,
    paths.promptsDir,
  ]) {
    mkdirSync(dir, { recursive: true });
  }

  const ignorePath = join(paths.root, '.gitignore');
  if (!existsSync(ignorePath)) {
    writeFileSync(ignorePath, '*\n', 'utf8');
  }
}

export function taskLogDir(paths: RuntimePaths, taskId: string): string {
  const dir = join(paths.logsDir, sanitizeId(taskId));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_');
}
