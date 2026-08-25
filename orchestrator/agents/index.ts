import { anyGlobsOverlap } from '../shared/glob.ts';
import type { AgentId } from '../shared/types.ts';
import { backendAgent } from './backend.agent.ts';
import { contractsAgent } from './contracts.agent.ts';
import { crosschainAgent } from './crosschain.agent.ts';
import { dataAgent } from './data.agent.ts';
import { devopsAgent } from './devops.agent.ts';
import { docsAgent } from './docs.agent.ts';
import { growthAgent } from './growth.agent.ts';
import { integrationsAgent } from './integrations.agent.ts';
import { lightningAgent } from './lightning.agent.ts';
import { orchestratorAgent } from './orchestrator.agent.ts';
import { protocolAgent } from './protocol.agent.ts';
import { qaAgent } from './qa.agent.ts';
import { sdkAgent } from './sdk.agent.ts';
import { securityAgent } from './security.agent.ts';
import { swapRoutingAgent } from './swap-routing.agent.ts';
import type { AgentDefinition } from './types.ts';

/**
 * Adding a specialist is one file plus one entry here. Nothing else in the
 * orchestrator needs to know the roster.
 */
export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  orchestratorAgent,
  protocolAgent,
  swapRoutingAgent,
  contractsAgent,
  backendAgent,
  sdkAgent,
  dataAgent,
  crosschainAgent,
  lightningAgent,
  securityAgent,
  qaAgent,
  devopsAgent,
  docsAgent,
  integrationsAgent,
  growthAgent,
];

const BY_ID = new Map<AgentId, AgentDefinition>(
  AGENT_REGISTRY.map((agent) => [agent.id, agent]),
);

export function getAgent(id: AgentId): AgentDefinition {
  const agent = BY_ID.get(id);
  if (!agent) throw new Error(`Unknown agent id: ${id}`);
  return agent;
}

export function findAgent(id: string): AgentDefinition | undefined {
  return BY_ID.get(id as AgentId);
}

export function agentIds(): readonly AgentId[] {
  return AGENT_REGISTRY.map((agent) => agent.id);
}

/** Agents whose declared ownership globs intersect the given globs. */
export function agentsOwningPaths(paths: readonly string[]): readonly AgentDefinition[] {
  return AGENT_REGISTRY.filter(
    (agent) => agent.id !== 'orchestrator' && anyGlobsOverlap(agent.ownedPaths, paths),
  );
}

export function gatesRequiredByAgents(ids: readonly AgentId[]): readonly string[] {
  const gates = new Set<string>();
  for (const id of ids) {
    for (const gate of getAgent(id).requiredManualGates) gates.add(gate);
  }
  return [...gates].sort();
}

export type { AgentDefinition, AgentSummary } from './types.ts';
