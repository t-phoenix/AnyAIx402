import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { RuntimePaths } from '../core/paths.ts';
import { ensureRuntimeDirs } from '../core/paths.ts';
import { SEVERITY_ORDER, type Severity } from '../shared/types.ts';
import type { BugEvent, BugReport, BugStatus, BugStoreFile } from './types.ts';

export const BUG_STORE_VERSION = 1;

export function emptyStore(): BugStoreFile {
  return { version: BUG_STORE_VERSION, updatedAt: new Date().toISOString(), bugs: [] };
}

export function loadBugs(paths: RuntimePaths): BugStoreFile {
  if (!existsSync(paths.bugsPath)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(paths.bugsPath, 'utf8')) as Partial<BugStoreFile>;
    return {
      version: parsed.version ?? BUG_STORE_VERSION,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      bugs: parsed.bugs ?? [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveBugs(paths: RuntimePaths, store: BugStoreFile): void {
  ensureRuntimeDirs(paths);
  store.updatedAt = new Date().toISOString();
  const tmp = `${paths.bugsPath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  renameSync(tmp, paths.bugsPath);
}

export function findByFingerprint(store: BugStoreFile, fingerprint: string): BugReport | undefined {
  return store.bugs.find((bug) => bug.fingerprint === fingerprint);
}

export function findBug(store: BugStoreFile, id: string): BugReport | undefined {
  return store.bugs.find((bug) => bug.id === id || bug.fingerprint.startsWith(id));
}

export function recordEvent(bug: BugReport, kind: BugEvent['kind'], message: string): void {
  bug.history.push({ at: new Date().toISOString(), kind, message });
  bug.updatedAt = new Date().toISOString();
}

export function setStatus(bug: BugReport, status: BugStatus, message: string): void {
  bug.status = status;
  recordEvent(bug, status === 'resolved' ? 'resolved' : 'note', message);
}

/** Anything still worth acting on, worst first. */
export function openBugs(store: BugStoreFile): readonly BugReport[] {
  return store.bugs
    .filter((bug) => bug.status !== 'resolved' && bug.status !== 'wont-fix')
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.occurrences - a.occurrences ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export function fixableBugs(store: BugStoreFile, maxAttempts: number): readonly BugReport[] {
  return openBugs(store).filter(
    (bug) => bug.status !== 'needs-human' && bug.attempts < maxAttempts,
  );
}

export function countBySeverity(store: BugStoreFile): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const bug of openBugs(store)) counts[bug.severity] += 1;
  return counts;
}
