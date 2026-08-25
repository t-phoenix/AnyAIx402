import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { CommandResult } from '../shared/types.ts';

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly input?: string;
  /** Cap on captured output per stream; prevents a runaway log filling memory. */
  readonly maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_MAX_OUTPUT = 512 * 1024;

export async function runCommand(
  command: string,
  options: RunOptions = {},
): Promise<CommandResult> {
  const started = Date.now();
  const maxBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;

  return await new Promise<CommandResult>((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const append = (current: string, chunk: Buffer): string =>
      current.length >= maxBytes ? current : current + chunk.toString('utf8');

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const finish = (exitCode: number): void => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode,
        stdout: stdout.slice(0, maxBytes),
        stderr: stderr.slice(0, maxBytes),
        durationMs: Date.now() - started,
        timedOut,
      });
    };

    child.on('error', (error: Error) => {
      stderr += `\n${error.message}`;
      finish(127);
    });
    child.on('close', (code) => finish(code ?? (timedOut ? 124 : 1)));

    if (options.input !== undefined) {
      child.stdin?.write(options.input);
    }
    child.stdin?.end();
  });
}

export function skipped(command: string, reason: string): CommandResult {
  return {
    command,
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 0,
    timedOut: false,
    skippedReason: reason,
  };
}

const binaryCache = new Map<string, boolean>();

/** PATH lookup without shelling out, so a missing binary is cheap to detect. */
export function hasBinary(name: string): boolean {
  const cached = binaryCache.get(name);
  if (cached !== undefined) return cached;

  const pathValue = process.env.PATH ?? '';
  const found = pathValue
    .split(delimiter)
    .filter((dir) => dir !== '')
    .some((dir) => existsSync(join(dir, name)));

  binaryCache.set(name, found);
  return found;
}

export function firstWord(command: string): string {
  return command.trim().split(/\s+/)[0] ?? command;
}
