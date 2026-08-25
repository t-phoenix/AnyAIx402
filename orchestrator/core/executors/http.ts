import { writeFileSync } from 'node:fs';
import { expandEnv } from '../../config/load.ts';
import type { HttpExecutorConfig } from '../../config/types.ts';
import type { AgentExecutor, DispatchRequest, DispatchResult } from './types.ts';

export interface HttpExecutorContext {
  readonly env: Readonly<Record<string, string>>;
}

/**
 * POSTs the prompt to an agent endpoint. Header values may reference `${VAR}`,
 * which is resolved from the loaded environment at call time, so credentials
 * live in the environment rather than in any committed file.
 */
export class HttpExecutor implements AgentExecutor {
  readonly kind = 'http';

  constructor(
    private readonly config: HttpExecutorConfig,
    private readonly context: HttpExecutorContext,
  ) {}

  describe(): string {
    return `http (${this.config.method} ${this.config.url})`;
  }

  async execute(request: DispatchRequest): Promise<DispatchResult> {
    const started = Date.now();
    writeFileSync(request.promptPath, request.prompt, 'utf8');

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const [key, value] of Object.entries(this.config.headers)) {
      headers[key] = expandEnv(value, this.context.env);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(expandEnv(this.config.url, this.context.env), {
        method: this.config.method,
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          taskId: request.taskId,
          agentId: request.agentId,
          title: request.title,
          ownedPaths: request.ownedPaths,
          prompt: request.prompt,
        }),
      });

      const text = await response.text();
      return {
        ok: response.ok,
        executor: this.kind,
        output: text,
        exitCode: response.ok ? 0 : response.status,
        durationMs: Date.now() - started,
        skippedReason: response.ok ? undefined : `agent endpoint returned ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        executor: this.kind,
        output: (error as Error).message,
        durationMs: Date.now() - started,
        skippedReason: `agent endpoint unreachable: ${(error as Error).message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
