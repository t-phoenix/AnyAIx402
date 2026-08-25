import { listGateIds } from '../config/gates.ts';
import type { AgentId, Phase } from '../shared/types.ts';
import { CROSSCUTTING_TASKS } from './crosscutting.ts';
import { validateGraph } from './graph.ts';
import { LAUNCH_TASKS } from './launch.ts';
import { PHASE_0_TASKS } from './phase0.ts';
import { PHASE_1_TASKS } from './phase1.ts';
import { PHASE_2_TASKS } from './phase2.ts';
import { PHASE_3_TASKS } from './phase3.ts';
import { PHASE_4_TASKS } from './phase4.ts';
import { PHASE_5_TASKS } from './phase5.ts';
import { PHASE_6_TASKS } from './phase6.ts';
import { PHASE_7_TASKS } from './phase7.ts';
import type { TaskDefinition } from './types.ts';

export const TASK_GRAPH: readonly TaskDefinition[] = [
  ...PHASE_0_TASKS,
  ...PHASE_1_TASKS,
  ...PHASE_2_TASKS,
  ...PHASE_3_TASKS,
  ...PHASE_4_TASKS,
  ...PHASE_5_TASKS,
  ...PHASE_6_TASKS,
  ...PHASE_7_TASKS,
  ...CROSSCUTTING_TASKS,
  ...LAUNCH_TASKS,
];

const BY_ID = new Map(TASK_GRAPH.map((task) => [task.id, task]));

export function getTask(id: string): TaskDefinition | undefined {
  return BY_ID.get(id);
}

export function requireTask(id: string): TaskDefinition {
  const task = BY_ID.get(id);
  if (!task) throw new Error(`Unknown task id: ${id}`);
  return task;
}

export function tasksForAgent(agentId: AgentId): readonly TaskDefinition[] {
  return TASK_GRAPH.filter((task) => task.agentId === agentId);
}

export function tasksForPhase(phase: Phase): readonly TaskDefinition[] {
  return TASK_GRAPH.filter((task) => task.phase === phase);
}

export function taskIds(): readonly string[] {
  return TASK_GRAPH.map((task) => task.id);
}

/** Tasks blocked by a gate: declared on the gate, plus anything requiring it. */
export function tasksBlockedByGate(gateId: string): readonly string[] {
  return TASK_GRAPH.filter((task) => task.requiredManualGates.includes(gateId)).map(
    (task) => task.id,
  );
}

export function validateTaskGraph(): ReturnType<typeof validateGraph> {
  return validateGraph(TASK_GRAPH, listGateIds());
}

export * from './graph.ts';
export type { AcceptanceCriterion, TaskDefinition, VerifyCommand } from './types.ts';
