import type { OrchestratorConfig } from '../../config/types.ts';
import { DryRunExecutor } from './dryRun.ts';
import { HttpExecutor } from './http.ts';
import { ShellExecutor } from './shell.ts';
import type { AgentExecutor } from './types.ts';

export interface ExecutorSelection {
  readonly executor: AgentExecutor;
  /** Why the dry-run fallback was chosen, when it was not asked for. */
  readonly fallbackReason?: string;
}

export interface CreateExecutorOptions {
  /** CLI `--dry-run` always wins over configuration. */
  readonly forceDryRun?: boolean;
  readonly verbose?: boolean;
  readonly write?: (line: string) => void;
}

export function createExecutor(
  config: OrchestratorConfig,
  options: CreateExecutorOptions = {},
): ExecutorSelection {
  const dryRun = (): AgentExecutor =>
    new DryRunExecutor({ verbose: options.verbose, write: options.write });

  if (options.forceDryRun) {
    return { executor: dryRun(), fallbackReason: '--dry-run requested' };
  }

  if (config.executor.kind === 'shell') {
    const shell = config.executor.shell;
    if (!shell || shell.commandTemplate.trim() === '') {
      return {
        executor: dryRun(),
        fallbackReason:
          'executor.kind is "shell" but no command template is configured. Set ANYX_EXECUTOR_COMMAND or orchestrator.executor.shell.commandTemplate.',
      };
    }
    return {
      executor: new ShellExecutor(shell, { repoRoot: config.repoRoot, env: config.env }),
    };
  }

  if (config.executor.kind === 'http') {
    const http = config.executor.http;
    if (!http || http.url.trim() === '') {
      return {
        executor: dryRun(),
        fallbackReason:
          'executor.kind is "http" but no endpoint is configured. Set ANYX_EXECUTOR_URL or orchestrator.executor.http.url.',
      };
    }
    return { executor: new HttpExecutor(http, { env: config.env }) };
  }

  return { executor: dryRun() };
}

export { DryRunExecutor } from './dryRun.ts';
export { HttpExecutor } from './http.ts';
export { ShellExecutor } from './shell.ts';
export type { AgentExecutor, DispatchRequest, DispatchResult } from './types.ts';
