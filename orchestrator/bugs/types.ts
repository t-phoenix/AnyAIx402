import type { AgentId, Severity } from '../shared/types.ts';

export type BugSource =
  | 'verify-command'
  | 'acceptance-criterion'
  | 'test-run'
  | 'typecheck'
  | 'lint'
  | 'github-actions'
  | 'runtime-report'
  | 'manual';

export type BugStatus = 'open' | 'triaged' | 'fixing' | 'resolved' | 'needs-human' | 'wont-fix';

/** Whatever an intake adapter could observe, before normalization. */
export interface RawFinding {
  readonly title: string;
  readonly source: BugSource;
  readonly output: string;
  readonly failingCommand?: string;
  readonly exitCode?: number;
  readonly taskId?: string;
  readonly files?: readonly string[];
  readonly severityHint?: Severity;
  readonly agentHint?: AgentId;
  readonly reference?: string;
}

export interface BugEvent {
  readonly at: string;
  readonly kind:
    | 'opened'
    | 'seen-again'
    | 'triaged'
    | 'fix-dispatched'
    | 'verified'
    | 'resolved'
    | 'escalated'
    | 'note';
  readonly message: string;
}

export interface BugReport {
  readonly id: string;
  title: string;
  readonly source: BugSource;
  severity: Severity;
  /** Stable hash of the normalized signature; identical failures collapse into one bug. */
  readonly fingerprint: string;
  status: BugStatus;
  failingCommand?: string;
  errorExcerpt: string;
  suspectedFiles: string[];
  suspectedDomain: AgentId;
  triageRationale: string;
  taskId?: string;
  reference?: string;
  occurrences: number;
  attempts: number;
  readonly createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  resolutionNote?: string;
  escalationPath?: string;
  history: BugEvent[];
}

export interface BugStoreFile {
  version: number;
  updatedAt: string;
  bugs: BugReport[];
}
