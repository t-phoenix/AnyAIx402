/**
 * Vocabulary shared by every orchestrator subsystem.
 *
 * Kept dependency-free on purpose: the orchestrator must be able to bootstrap a
 * repository in which `bun install` has never been run.
 */

export const AGENT_IDS = [
  'orchestrator',
  'protocol',
  'swap-routing',
  'contracts',
  'backend',
  'sdk',
  'data',
  'crosschain',
  'lightning',
  'security',
  'qa',
  'devops',
  'docs',
  'integrations',
  'growth',
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

/** Roadmap phases 0-7, plus the two cross-cutting buckets. */
export const PHASES = [0, 1, 2, 3, 4, 5, 6, 7, 'ci', 'launch'] as const;
export type Phase = (typeof PHASES)[number];

export function isPhase(value: unknown): value is Phase {
  return (PHASES as readonly unknown[]).includes(value);
}

export function phaseLabel(phase: Phase): string {
  return typeof phase === 'number' ? `Phase ${phase}` : phase === 'ci' ? 'CI/CD' : 'Launch';
}

/** Deliberately not a time estimate. The roadmap's week ranges are not reproducible. */
export type Complexity = 'small' | 'medium' | 'large';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type TaskStatus =
  | 'pending'
  | 'blocked'
  | 'ready'
  | 'running'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'needs-human';

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['done', 'skipped'];

export type DeployEnvironment = 'local' | 'staging' | 'production';

export interface CommandResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  /** Set when the command could not be attempted at all (missing binary, etc). */
  readonly skippedReason?: string;
}

export interface Outcome {
  readonly ok: boolean;
  readonly summary: string;
  readonly details?: readonly string[];
}

export function ok(summary: string, details?: readonly string[]): Outcome {
  return { ok: true, summary, details };
}

export function fail(summary: string, details?: readonly string[]): Outcome {
  return { ok: false, summary, details };
}
