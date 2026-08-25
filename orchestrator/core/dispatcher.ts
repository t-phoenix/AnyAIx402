import { join } from 'node:path';
import { getAgent } from '../agents/index.ts';
import type { AgentDefinition } from '../agents/types.ts';
import { getGate } from '../config/gates.ts';
import type { OrchestratorConfig } from '../config/types.ts';
import type { AcceptanceCriterion, TaskDefinition } from '../tasks/types.ts';
import { phaseLabel } from '../shared/types.ts';
import type { AgentExecutor, DispatchRequest, DispatchResult } from './executors/index.ts';
import type { RuntimePaths } from './paths.ts';
import { ensureRuntimeDirs, sanitizeId } from './paths.ts';

const GIT_DISCIPLINE = [
  'Stage only files inside your owned paths, using explicit paths. Never `git add -A` and never `git add .`.',
  'Make small logical commits with descriptive messages as you go.',
  'Never switch, create, rebase or force-push branches, and never open a pull request.',
  'If git reports index.lock contention or a non-fast-forward push, wait a few seconds and retry; another agent is working in the same tree.',
];

const GENERAL_RULES = [
  'Other specialist agents are editing this repository at the same time. Touching a file outside your owned paths will collide with their work.',
  'Never hardcode a secret, an API key or a private key. Read every credential from configuration.',
  'Never invent a credential value. If a required key is missing, stop and report the manual gate that is blocking you.',
  'Write tests alongside the implementation; do not defer them.',
  'Do not add code comments that merely narrate what the code does.',
];

function renderCriterion(criterion: AcceptanceCriterion, index: number): string {
  const n = `${index + 1}.`;
  switch (criterion.kind) {
    case 'command':
      return `${n} ${criterion.description}\n     check: \`${criterion.command}\` must exit ${criterion.expectedExitCode ?? 0}`;
    case 'file-exists':
      return `${n} ${criterion.description}\n     check: \`${criterion.path}\` must exist`;
    case 'file-contains':
      return `${n} ${criterion.description}\n     check: \`${criterion.path}\` must match /${criterion.pattern}/i`;
    case 'manual':
      return `${n} ${criterion.description}\n     check: human attestation — do not claim this yourself`;
  }
}

function renderGates(task: TaskDefinition): string {
  if (task.requiredManualGates.length === 0) return 'None.';
  return task.requiredManualGates
    .map((id) => {
      const gate = getGate(id);
      if (!gate) return `- ${id}`;
      return `- ${gate.id}: ${gate.title} (env: ${gate.configKeys.join(', ') || 'n/a'})`;
    })
    .join('\n');
}

export interface BuildPromptOptions {
  /** Extra context appended verbatim, used by the bug auto-fix loop. */
  readonly extraContext?: readonly string[];
  readonly heading?: string;
}

export function buildTaskPrompt(
  task: TaskDefinition,
  agent: AgentDefinition,
  config: OrchestratorConfig,
  options: BuildPromptOptions = {},
): string {
  const sections: string[] = [];

  sections.push(
    `# ${options.heading ?? `AnyX build task ${task.id}`} — ${task.title}`,
    '',
    `You are the **${agent.name}** for AnyX (product name AnyX, repo AnyAIx402), a Universal x402 Multi-Token Payment Adapter.`,
    '',
    '## Your mission',
    agent.mission,
    '',
    '## Read first',
    agent.references.map((ref) => `- ${ref}`).join('\n'),
    '',
    '## Task',
    `- id: ${task.id}`,
    `- phase: ${phaseLabel(task.phase)}`,
    `- complexity: ${task.estimatedComplexity}`,
    `- depends on: ${task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'nothing'}`,
    '',
    task.summary,
    '',
    '## Files you own for this task',
    task.ownedPaths.length > 0
      ? task.ownedPaths.map((path) => `- ${path}`).join('\n')
      : '- (verification only; do not modify source files)',
    '',
    'Everything else in the repository belongs to another agent. Do not create, edit or delete outside the list above.',
    '',
    '## Acceptance criteria',
    task.acceptanceCriteria.map(renderCriterion).join('\n'),
    '',
    '## Verification the orchestrator will run',
    task.verifyCommands.length > 0
      ? task.verifyCommands
          .map(
            (verify) =>
              `- \`${verify.command}\`${verify.cwd ? ` (in ${verify.cwd})` : ''}${verify.optional ? ' [optional]' : ''}`,
          )
          .join('\n')
      : '- (acceptance criteria only)',
    '',
    '## Configuration this task needs',
    task.requiredConfigKeys.length > 0
      ? task.requiredConfigKeys.map((key) => `- ${key}`).join('\n')
      : 'None.',
    '',
    '## Manual gates already cleared for you',
    renderGates(task),
    '',
    '## Domain rules',
    agent.domainRules.map((rule) => `- ${rule}`).join('\n'),
    '',
    '## Definition of done',
    agent.definitionOfDone.map((item) => `- ${item}`).join('\n'),
    '',
    '## Working rules',
    GENERAL_RULES.map((rule) => `- ${rule}`).join('\n'),
    '',
    '## Git discipline',
    GIT_DISCIPLINE.map((rule) => `- ${rule}`).join('\n'),
    '',
    '## Commands you may run',
    agent.allowedCommands.map((command) => `- \`${command}\``).join('\n'),
  );

  if (options.extraContext && options.extraContext.length > 0) {
    sections.push('', '## Additional context', ...options.extraContext);
  }

  sections.push(
    '',
    '## Report back',
    'State what you changed, which acceptance criteria you believe now pass, which are still failing and why, and any manual gate that blocked you.',
    '',
    `Repository root: ${config.repoRoot}`,
  );

  return `${sections.join('\n')}\n`;
}

export interface DispatchOptions {
  readonly extraContext?: readonly string[];
  readonly heading?: string;
  readonly promptFileName?: string;
}

export async function dispatchTask(
  task: TaskDefinition,
  config: OrchestratorConfig,
  paths: RuntimePaths,
  executor: AgentExecutor,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  ensureRuntimeDirs(paths);
  const agent = getAgent(task.agentId);
  const prompt = buildTaskPrompt(task, agent, config, {
    extraContext: options.extraContext,
    heading: options.heading,
  });

  const request: DispatchRequest = {
    taskId: task.id,
    agentId: task.agentId,
    title: task.title,
    prompt,
    ownedPaths: task.ownedPaths,
    promptPath: join(
      paths.promptsDir,
      options.promptFileName ?? `${sanitizeId(task.id)}.prompt.md`,
    ),
  };

  return await executor.execute(request);
}
