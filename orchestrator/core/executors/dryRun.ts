import { writeFileSync } from 'node:fs';
import type { AgentExecutor, DispatchRequest, DispatchResult } from './types.ts';

export interface DryRunOptions {
  /** Print the whole prompt rather than a one-line summary. */
  readonly verbose?: boolean;
  readonly write?: (line: string) => void;
}

/**
 * The default executor. It renders the prompt an agent would receive and writes
 * it to disk, but changes nothing — so the whole system is runnable on a machine
 * with no agent credentials configured at all.
 */
export class DryRunExecutor implements AgentExecutor {
  readonly kind = 'dry-run';

  private readonly verbose: boolean;
  private readonly write: (line: string) => void;

  constructor(options: DryRunOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.write = options.write ?? ((line) => process.stdout.write(`${line}\n`));
  }

  describe(): string {
    return 'dry-run (prints the dispatch prompt; no agent is invoked and no files change)';
  }

  async execute(request: DispatchRequest): Promise<DispatchResult> {
    const started = Date.now();
    writeFileSync(request.promptPath, request.prompt, 'utf8');

    this.write(`\n--- dispatch ${request.taskId} -> ${request.agentId} ---`);
    this.write(`title:  ${request.title}`);
    this.write(`owns:   ${request.ownedPaths.join(', ') || '(no files)'}`);
    this.write(`prompt: ${request.promptPath} (${request.prompt.length} chars)`);
    if (this.verbose) this.write(`\n${request.prompt}`);

    return {
      ok: true,
      executor: this.kind,
      output: request.prompt,
      durationMs: Date.now() - started,
      skippedReason: 'dry-run executor: prompt rendered, no agent invoked',
    };
  }
}
