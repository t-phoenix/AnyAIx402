import type { AgentId } from '../shared/types.ts';

export interface AgentDefinition {
  readonly id: AgentId;
  readonly name: string;
  readonly domain: string;
  /** One paragraph the agent is dispatched with, verbatim. */
  readonly mission: string;
  /** Glob patterns this agent may create, edit or delete. Enforced by the scheduler. */
  readonly ownedPaths: readonly string[];
  readonly capabilities: readonly string[];
  /** Env var names the agent's work cannot be completed without. */
  readonly requiredConfigKeys: readonly string[];
  /** Manual gate ids that must be cleared before dispatching this agent. */
  readonly requiredManualGates: readonly string[];
  /** Shell commands the agent is permitted to run. Advisory for humans, enforced for ShellExecutor. */
  readonly allowedCommands: readonly string[];
  readonly definitionOfDone: readonly string[];
  /** Source documents the agent must read before starting. */
  readonly references: readonly string[];
  /** Domain-specific rules injected into the dispatch prompt. */
  readonly domainRules: readonly string[];
}

export interface AgentSummary {
  readonly id: AgentId;
  readonly name: string;
  readonly domain: string;
  readonly taskCount: number;
  readonly ownedPaths: readonly string[];
}
