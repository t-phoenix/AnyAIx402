import type { AgentId, Complexity, Phase, TaskStatus } from '../shared/types.ts';

/**
 * Acceptance criteria are machine-checkable wherever the roadmap allows it.
 * `manual` is reserved for things only a human can attest to (an audit sign-off,
 * a real payment observed on-chain).
 */
export type AcceptanceCriterion =
  | {
      readonly kind: 'command';
      readonly description: string;
      readonly command: string;
      readonly expectedExitCode?: number;
      /** Binary whose absence turns a failure into a skip, e.g. `forge`. */
      readonly requiresBinary?: string;
    }
  | {
      readonly kind: 'file-exists';
      readonly description: string;
      readonly path: string;
    }
  | {
      readonly kind: 'file-contains';
      readonly description: string;
      readonly path: string;
      /** Case-insensitive regular expression source. */
      readonly pattern: string;
    }
  | {
      readonly kind: 'manual';
      readonly description: string;
    };

export interface VerifyCommand {
  readonly command: string;
  readonly expectedExitCode?: number;
  readonly cwd?: string;
  /** When this binary is absent the command is skipped with a stated reason. */
  readonly requiresBinary?: string;
  /** A failing optional command downgrades to a warning instead of failing the task. */
  readonly optional?: boolean;
}

export interface TaskDefinition {
  readonly id: string;
  readonly title: string;
  readonly phase: Phase;
  readonly agentId: AgentId;
  /** Task-specific brief injected into the dispatch prompt. */
  readonly summary: string;
  readonly dependsOn: readonly string[];
  readonly ownedPaths: readonly string[];
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly verifyCommands: readonly VerifyCommand[];
  readonly requiredConfigKeys: readonly string[];
  readonly requiredManualGates: readonly string[];
  /** Declared starting status; live status is tracked in .orchestrator/state.json. */
  readonly status: TaskStatus;
  /** Lower runs first when several tasks are ready. */
  readonly priority: number;
  readonly estimatedComplexity: Complexity;
  readonly references?: readonly string[];
}
