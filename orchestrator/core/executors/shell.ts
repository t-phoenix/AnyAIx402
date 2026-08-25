import { writeFileSync } from 'node:fs';
import type { ShellExecutorConfig } from '../../config/types.ts';
import { runCommand } from '../exec.ts';
import type { AgentExecutor, DispatchRequest, DispatchResult } from './types.ts';

export interface ShellExecutorContext {
  readonly repoRoot: string;
  readonly env: Readonly<Record<string, string>>;
}

/**
 * Hands the prompt to an external CLI coding agent. The command template comes
 * from config, so swapping agent products is a config change, not a code change.
 */
export class ShellExecutor implements AgentExecutor {
  readonly kind = 'shell';

  constructor(
    private readonly config: ShellExecutorConfig,
    private readonly context: ShellExecutorContext,
  ) {}

  describe(): string {
    return `shell (${this.config.commandTemplate})`;
  }

  async execute(request: DispatchRequest): Promise<DispatchResult> {
    writeFileSync(request.promptPath, request.prompt, 'utf8');

    const command = this.config.commandTemplate
      .replaceAll('{{promptFile}}', request.promptPath)
      .replaceAll('{{taskId}}', request.taskId)
      .replaceAll('{{agentId}}', request.agentId)
      .replaceAll('{{repoRoot}}', this.context.repoRoot);

    const result = await runCommand(command, {
      cwd: this.config.cwd ?? this.context.repoRoot,
      env: {
        ...this.context.env,
        ANYX_TASK_ID: request.taskId,
        ANYX_AGENT_ID: request.agentId,
        ANYX_PROMPT_FILE: request.promptPath,
      },
      timeoutMs: this.config.timeoutMs,
      input: request.prompt,
    });

    return {
      ok: result.exitCode === 0,
      executor: this.kind,
      output: `${result.stdout}\n${result.stderr}`.trim(),
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      skippedReason: result.timedOut ? `timed out after ${this.config.timeoutMs}ms` : undefined,
    };
  }
}
