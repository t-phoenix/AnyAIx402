import type { AgentId } from '../../shared/types.ts';

export interface DispatchRequest {
  readonly taskId: string;
  readonly agentId: AgentId;
  readonly title: string;
  readonly prompt: string;
  readonly ownedPaths: readonly string[];
  readonly promptPath: string;
}

export interface DispatchResult {
  readonly ok: boolean;
  readonly executor: string;
  readonly output: string;
  readonly exitCode?: number;
  readonly durationMs: number;
  /** Set when the executor deliberately did not perform work. */
  readonly skippedReason?: string;
}

/**
 * One interface, three implementations. The orchestrator never knows which agent
 * product is on the other side, and no provider or key is compiled in.
 */
export interface AgentExecutor {
  readonly kind: string;
  describe(): string;
  execute(request: DispatchRequest): Promise<DispatchResult>;
}
