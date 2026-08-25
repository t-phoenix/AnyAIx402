import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findingsFromTestOutput, ingestFinding } from '../bugs/intake.ts';
import { loadBugs, saveBugs } from '../bugs/store.ts';
import type { BugReport } from '../bugs/types.ts';
import type { OrchestratorConfig } from '../config/types.ts';
import { appendEvent } from '../core/events.ts';
import { hasBinary, runCommand } from '../core/exec.ts';
import type { RuntimePaths } from '../core/paths.ts';
import type { CommandResult } from '../shared/types.ts';

export const TEST_STAGES = [
  'lint',
  'typecheck',
  'unit',
  'integration',
  'contracts',
  'coverage',
] as const;
export type TestStage = (typeof TEST_STAGES)[number];

export function isTestStage(value: string): value is TestStage {
  return (TEST_STAGES as readonly string[]).includes(value);
}

export interface StageResult {
  readonly stage: TestStage;
  readonly command: string;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly reason?: string;
  readonly exitCode?: number;
  readonly durationMs: number;
  readonly output: string;
}

export interface TestRunResult {
  readonly ok: boolean;
  readonly stages: readonly StageResult[];
  readonly bugs: readonly BugReport[];
  readonly coveragePercent?: number;
}

/** Binaries a stage cannot run without; absent means skip with a reason, not fail. */
const STAGE_BINARY: Partial<Record<TestStage, string>> = {
  contracts: 'forge',
};

function commandFor(stage: TestStage, config: OrchestratorConfig): string {
  return config.test[stage];
}

/**
 * A stage whose script does not exist yet is a skip. The monorepo is built
 * incrementally, so a missing `test:integration` script must not fail the gate.
 */
function scriptMissingReason(command: string, config: OrchestratorConfig): string | undefined {
  const match = /^bun run (?:--cwd \S+ )?([\w:.-]+)/.exec(command.trim());
  if (!match?.[1]) return undefined;
  const script = match[1];

  const packageJsonPath = join(config.repoRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return 'no package.json at the repository root yet';
  }
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    if (parsed.scripts?.[script] === undefined) {
      return `the root package.json has no "${script}" script yet`;
    }
  } catch {
    return 'the root package.json could not be parsed';
  }
  return undefined;
}

const COVERAGE_PATTERNS: readonly RegExp[] = [
  /All files\s*\|\s*([\d.]+)/i,
  /Lines\s*:\s*([\d.]+)%/i,
  /statements\s*:\s*([\d.]+)%/i,
  /^\s*all files\s+\|\s+([\d.]+)/im,
];

export function parseCoveragePercent(output: string): number | undefined {
  for (const pattern of COVERAGE_PATTERNS) {
    const match = pattern.exec(output);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

async function runStage(stage: TestStage, config: OrchestratorConfig): Promise<StageResult> {
  const command = commandFor(stage, config);
  const started = Date.now();

  const binary = STAGE_BINARY[stage];
  if (binary && !hasBinary(binary)) {
    return {
      stage,
      command,
      status: 'skipped',
      reason: `${binary} is not installed on this machine`,
      durationMs: Date.now() - started,
      output: '',
    };
  }

  const missing = scriptMissingReason(command, config);
  if (missing) {
    return {
      stage,
      command,
      status: 'skipped',
      reason: missing,
      durationMs: Date.now() - started,
      output: '',
    };
  }

  const result: CommandResult = await runCommand(command, {
    cwd: config.repoRoot,
    env: config.env,
    timeoutMs: config.commandTimeoutMs,
  });
  const output = `${result.stdout}\n${result.stderr}`.trim();

  return {
    stage,
    command,
    status: result.exitCode === 0 ? 'passed' : 'failed',
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    output,
    reason: result.timedOut ? `timed out after ${config.commandTimeoutMs}ms` : undefined,
  };
}

const STAGE_SOURCE: Record<TestStage, 'lint' | 'typecheck' | 'test-run'> = {
  lint: 'lint',
  typecheck: 'typecheck',
  unit: 'test-run',
  integration: 'test-run',
  contracts: 'test-run',
  coverage: 'test-run',
};

export interface RunTestsOptions {
  readonly stages?: readonly TestStage[];
  /** Keep going after a failing stage to collect the full picture in one pass. */
  readonly continueOnFailure?: boolean;
  readonly openBugs?: boolean;
  readonly write?: (line: string) => void;
}

/**
 * Staged quality gate. Failures are converted into deduplicated bug reports so
 * the auto-fix loop has something to act on without a second run.
 */
export async function runTests(
  config: OrchestratorConfig,
  paths: RuntimePaths,
  options: RunTestsOptions = {},
): Promise<TestRunResult> {
  const write = options.write ?? (() => {});
  const stages = options.stages ?? TEST_STAGES;
  const results: StageResult[] = [];
  const store = loadBugs(paths);
  const opened: BugReport[] = [];
  let coveragePercent: number | undefined;

  for (const stage of stages) {
    write(`→ ${stage}`);
    const result = await runStage(stage, config);
    results.push(result);

    if (stage === 'coverage' && result.status === 'passed') {
      coveragePercent = parseCoveragePercent(result.output);
    }

    const label =
      result.status === 'skipped'
        ? `SKIPPED: ${result.reason}`
        : `${result.status.toUpperCase()} in ${result.durationMs}ms`;
    write(`  ${label}`);

    appendEvent(paths, {
      kind: 'test.stage',
      message: `${stage}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`,
      data: { stage, exitCode: result.exitCode },
    });

    if (result.status === 'failed' && options.openBugs !== false) {
      const findings =
        STAGE_SOURCE[stage] === 'test-run'
          ? findingsFromTestOutput(result.output, result.command)
          : [
              {
                title: `${stage} failed`,
                source: STAGE_SOURCE[stage],
                output: result.output,
                failingCommand: result.command,
                exitCode: result.exitCode,
              } as const,
            ];

      for (const finding of findings) {
        const { bug, isNew } = ingestFinding(store, finding, config);
        if (isNew) {
          opened.push(bug);
          appendEvent(paths, {
            kind: 'bug.opened',
            bugId: bug.id,
            message: `${bug.severity} — ${bug.title} → ${bug.suspectedDomain}`,
          });
        }
      }
      saveBugs(paths, store);
      write(`  opened ${opened.length} bug(s) so far`);

      if (options.continueOnFailure !== true) break;
    }
  }

  if (coveragePercent !== undefined && coveragePercent < config.coverageThreshold) {
    const finding = {
      title: `coverage ${coveragePercent}% is below the ${config.coverageThreshold}% threshold`,
      source: 'test-run' as const,
      output: `Coverage threshold not met: ${coveragePercent}% < ${config.coverageThreshold}%`,
      failingCommand: config.test.coverage,
    };
    const { bug, isNew } = ingestFinding(store, finding, config);
    if (isNew) opened.push(bug);
    saveBugs(paths, store);
  }

  const failed = results.some((result) => result.status === 'failed');
  const coverageShort = coveragePercent !== undefined && coveragePercent < config.coverageThreshold;

  return { ok: !failed && !coverageShort, stages: results, bugs: opened, coveragePercent };
}

export function summarizeStages(result: TestRunResult): string {
  const passed = result.stages.filter((stage) => stage.status === 'passed').length;
  const failed = result.stages.filter((stage) => stage.status === 'failed').length;
  const skipped = result.stages.filter((stage) => stage.status === 'skipped').length;
  return `${passed} passed, ${failed} failed, ${skipped} skipped`;
}
