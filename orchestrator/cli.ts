#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_REGISTRY, findAgent, getAgent } from './agents/index.ts';
import {
  attemptFix,
  escalate,
  findingsFromGithubActions,
  findingsFromInbox,
  ingestFinding,
  loadBugs,
  openBugs,
  saveBugs,
} from './bugs/index.ts';
import {
  flagBool,
  flagList,
  flagNumber,
  flagString,
  type ParsedArgs,
  parseArgs,
} from './cli/args.ts';
import {
  bullet,
  color,
  heading,
  keyValue,
  mark,
  maskSecret,
  progressBar,
  status,
  table,
  write,
} from './cli/ui.ts';
import { evaluateAllGates, type GateStatus, MANUAL_GATES } from './config/gates.ts';
import { ConfigError, expandEnv, loadConfig } from './config/load.ts';
import type { OrchestratorConfig } from './config/types.ts';
import { readEvents } from './core/events.ts';
import { hasBinary, runCommand } from './core/exec.ts';
import { createExecutor } from './core/executors/index.ts';
import { ensureRuntimeDirs, type RuntimePaths, runtimePaths } from './core/paths.ts';
import { run as runTasks } from './core/runner.ts';
import { describeDeferReason, selectRunnableTasks } from './core/scheduler.ts';
import { interruptedRuns, loadState, statusMap } from './core/state.ts';
import { deploy } from './pipelines/deploy.ts';
import { writeReport } from './pipelines/report.ts';
import {
  isTestStage,
  runTests,
  summarizeStages,
  TEST_STAGES,
  type TestStage,
} from './pipelines/test.ts';
import {
  type DeployEnvironment,
  isPhase,
  PHASES,
  type Phase,
  phaseLabel,
  type TaskStatus,
} from './shared/types.ts';
import { TASK_GRAPH, tasksBlockedByGate, validateTaskGraph } from './tasks/index.ts';

interface Context {
  readonly config: OrchestratorConfig;
  readonly paths: RuntimePaths;
  readonly args: ParsedArgs;
}

function parsePhaseFlag(args: ParsedArgs): Phase | undefined {
  const raw = flagString(args, 'phase');
  if (raw === undefined) return undefined;
  const asNumber = Number.parseInt(raw, 10);
  const candidate: unknown =
    Number.isFinite(asNumber) && `${asNumber}` === raw.trim() ? asNumber : raw;
  if (!isPhase(candidate)) {
    throw new Error(`Unknown phase "${raw}". Valid phases: ${PHASES.join(', ')}.`);
  }
  return candidate;
}

const STATUS_TONE: Record<TaskStatus, Parameters<typeof mark>[0]> = {
  pending: 'muted',
  blocked: 'warn',
  ready: 'info',
  running: 'info',
  verifying: 'info',
  done: 'ok',
  failed: 'error',
  skipped: 'muted',
  'needs-human': 'warn',
};

function gateTone(state: GateStatus): Parameters<typeof mark>[0] {
  if (state.state === 'satisfied') return 'ok';
  if (state.state === 'waived') return 'muted';
  return state.gate.optional ? 'warn' : 'error';
}

function commandPlan({ config, paths, args }: Context): number {
  const validation = validateTaskGraph();
  const state = loadState(paths);
  const statuses = statusMap(state);
  const satisfied = evaluateAllGates(config.env, config.skipGates)
    .filter((gate) => gate.state !== 'missing' || gate.gate.optional)
    .map((gate) => gate.gate.id);

  heading('Task graph');
  keyValue('tasks', `${TASK_GRAPH.length}`);
  keyValue('agents', `${AGENT_REGISTRY.length}`);
  keyValue(
    'cycles',
    validation.cycles.length === 0
      ? color.green('none')
      : color.red(JSON.stringify(validation.cycles)),
  );
  for (const error of validation.errors) status('error', error);
  for (const warning of validation.warnings) status('warn', warning);

  heading('Progress by phase');
  for (const phase of PHASES) {
    const tasks = TASK_GRAPH.filter((task) => task.phase === phase);
    if (tasks.length === 0) continue;
    const done = tasks.filter((task) => (statuses[task.id] ?? task.status) === 'done').length;
    write(
      `  ${progressBar(done, tasks.length)} ${phaseLabel(phase).padEnd(10)} ${done}/${tasks.length}`,
    );
  }

  const selection = selectRunnableTasks({
    tasks: TASK_GRAPH,
    statuses,
    satisfiedGates: satisfied,
    env: config.env,
    concurrency: flagNumber(args, 'concurrency') ?? config.concurrency,
    ignoreGates: flagBool(args, 'ignore-gates'),
    phase: parsePhaseFlag(args),
  });

  heading('Ready to run now');
  table(
    ['Task', 'Agent', 'Phase', 'Complexity', 'Title'],
    selection.selected.map((task) => [
      task.id,
      task.agentId,
      phaseLabel(task.phase),
      task.estimatedComplexity,
      task.title,
    ]),
  );

  const blocked = selection.deferred.filter(
    (entry) => entry.reason !== 'already-complete' && entry.reason !== 'not-in-filter',
  );
  heading(`Blocked (${blocked.length})`);
  table(
    ['Task', 'Reason', 'Detail'],
    blocked
      .slice(0, 30)
      .map((entry) => [
        entry.task.id,
        describeDeferReason(entry.reason),
        entry.detail.slice(0, 3).join(', '),
      ]),
  );
  if (blocked.length > 30) write(color.dim(`  … and ${blocked.length - 30} more`));

  return validation.errors.length > 0 ? 1 : 0;
}

async function commandRun(ctx: Context): Promise<number> {
  const { config, paths, args } = ctx;
  const dryRun = flagBool(args, 'dry-run');
  const selection = createExecutor(config, {
    forceDryRun: dryRun,
    write,
    verbose: flagBool(args, 'verbose'),
  });

  heading('Run');
  keyValue('executor', selection.executor.describe());
  if (selection.fallbackReason)
    status('warn', `falling back to dry run: ${selection.fallbackReason}`);
  keyValue('concurrency', `${flagNumber(args, 'concurrency') ?? config.concurrency}`);
  keyValue('auto-fix', flagBool(args, 'auto-fix') ? 'enabled' : 'disabled');
  write();

  const onlyTask = flagString(args, 'task');
  const result = await runTasks(config, paths, selection.executor, {
    phase: parsePhaseFlag(args),
    onlyTaskIds: onlyTask ? [onlyTask] : undefined,
    concurrency: flagNumber(args, 'concurrency'),
    dryRun,
    ignoreGates: flagBool(args, 'ignore-gates'),
    autoFix: flagBool(args, 'auto-fix'),
    write: (line) => write(line),
  });

  heading('Outcome');
  table(
    ['Task', 'Status', 'Detail'],
    result.outcomes.map((outcome) => [outcome.taskId, outcome.status, outcome.detail]),
  );
  if (result.outcomes.length === 0) {
    status('info', 'nothing was ready to run. `plan` explains what each task is waiting for.');
  }
  keyValue('run id', result.runId);
  keyValue('remaining', `${result.stalled.length} task(s) not yet done`);

  return result.ok ? 0 : 1;
}

function commandStatus({ config, paths }: Context): number {
  const state = loadState(paths);
  const statuses = statusMap(state);
  const store = loadBugs(paths);
  const bugs = openBugs(store);

  heading('Orchestrator status');
  keyValue('repo', config.repoRoot);
  keyValue('runtime dir', paths.root);
  keyValue(
    'state',
    existsSync(paths.statePath) ? paths.statePath : color.dim('no state recorded yet'),
  );
  keyValue('executor', config.executor.kind);

  const counts: Record<string, number> = {};
  for (const task of TASK_GRAPH) {
    const value = statuses[task.id] ?? task.status;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  const done = counts.done ?? 0;

  heading('Tasks');
  write(`  ${progressBar(done, TASK_GRAPH.length)} ${done}/${TASK_GRAPH.length} complete`);
  for (const [value, count] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) {
    status(STATUS_TONE[value as TaskStatus] ?? 'muted', `${count} ${value}`);
  }

  const active = TASK_GRAPH.filter((task) => {
    const value = statuses[task.id] ?? task.status;
    return (
      value === 'running' || value === 'verifying' || value === 'failed' || value === 'needs-human'
    );
  });
  if (active.length > 0) {
    heading('Needs attention');
    table(
      ['Task', 'Status', 'Last error'],
      active.map((task) => [
        task.id,
        statuses[task.id] ?? task.status,
        (state.tasks[task.id]?.lastError ?? '').slice(0, 60),
      ]),
    );
  }

  heading('Bugs');
  if (bugs.length === 0) status('ok', 'no open bugs');
  else {
    table(
      ['Id', 'Severity', 'Owner', 'Tries', 'Title'],
      bugs
        .slice(0, 10)
        .map((bug) => [
          bug.id,
          bug.severity,
          bug.suspectedDomain,
          `${bug.attempts}`,
          bug.title.slice(0, 50),
        ]),
    );
  }

  const runs = state.runs.slice(-5).reverse();
  if (runs.length > 0) {
    heading('Recent runs');
    table(
      ['Run', 'Mode', 'Status', 'Done', 'Failed'],
      runs.map((entry) => [
        entry.id.replace('run-', ''),
        entry.mode,
        entry.status,
        `${entry.completedTaskIds.length}`,
        `${entry.failedTaskIds.length}`,
      ]),
    );
  }

  const events = readEvents(paths, 5);
  if (events.length > 0) {
    heading('Latest events');
    for (const event of events) bullet(`${color.dim(event.ts)} ${event.kind} — ${event.message}`);
  }

  return 0;
}

function commandAgents({ args }: Context): number {
  const wanted = args.subcommand;
  if (wanted) {
    const agent = findAgent(wanted);
    if (!agent) {
      status('error', `Unknown agent "${wanted}". Run \`agents\` to list them.`);
      return 1;
    }
    heading(`${agent.name} (${agent.id})`);
    keyValue('domain', agent.domain);
    write();
    write(`  ${agent.mission}`);
    heading('Owned paths');
    for (const path of agent.ownedPaths) bullet(path);
    heading('Capabilities');
    for (const capability of agent.capabilities) bullet(capability);
    heading('Definition of done');
    for (const item of agent.definitionOfDone) bullet(item);
    heading('Tasks');
    table(
      ['Task', 'Phase', 'Title'],
      TASK_GRAPH.filter((task) => task.agentId === agent.id).map((task) => [
        task.id,
        phaseLabel(task.phase),
        task.title,
      ]),
    );
    return 0;
  }

  heading('Specialist agents');
  table(
    ['Id', 'Name', 'Tasks', 'Gates', 'Domain'],
    AGENT_REGISTRY.map((agent) => [
      agent.id,
      agent.name,
      `${TASK_GRAPH.filter((task) => task.agentId === agent.id).length}`,
      `${agent.requiredManualGates.length}`,
      agent.domain,
    ]),
  );
  write();
  write(color.dim('  `agents <id>` prints one agent in full.'));
  return 0;
}

async function commandGates(ctx: Context): Promise<number> {
  const { config, args } = ctx;
  const states = evaluateAllGates(config.env, config.skipGates);
  const verify = flagBool(args, 'verify');

  heading('Manual gates');
  write(
    color.dim(
      '  Each gate is something only a person can do: create an account, fund a wallet, provision a node.',
    ),
  );
  write();

  for (const state of states) {
    const label = state.gate.optional
      ? `${state.gate.title} ${color.dim('(optional)')}`
      : state.gate.title;
    write(`  ${mark(gateTone(state))} ${color.bold(state.gate.id.padEnd(20))} ${label}`);

    if (state.state === 'satisfied' || state.state === 'waived') {
      if (state.missingOptionalKeys.length > 0) {
        write(color.dim(`       optional keys not set: ${state.missingOptionalKeys.join(', ')}`));
      }
      continue;
    }

    write(color.dim(`       why: ${state.gate.why}`));
    write(`       missing: ${color.yellow(state.missingKeys.join(', '))}`);
    const blocked = [...new Set([...state.gate.blocks, ...tasksBlockedByGate(state.gate.id)])];
    if (blocked.length > 0) {
      write(color.dim(`       blocks: ${blocked.join(', ')}`));
    }
    write(color.dim(`       signup: ${state.gate.signupUrl}`));
    for (const step of state.gate.howToObtain) write(color.dim(`         - ${step}`));
    write();
  }

  const blocking = states.filter((state) => state.state === 'missing' && !state.gate.optional);

  if (verify) {
    heading('Credential verification');
    for (const state of states) {
      if (state.state !== 'satisfied' || !state.gate.verifyCommand) continue;
      const command = expandEnv(state.gate.verifyCommand, config.env);
      const binary = command.trim().split(/\s+/)[0] ?? '';
      if (binary !== '' && !hasBinary(binary)) {
        status('muted', `${state.gate.id}: skipped, ${binary} is not installed`);
        continue;
      }
      const result = await runCommand(command, {
        cwd: config.repoRoot,
        env: config.env,
        timeoutMs: 20_000,
      });
      status(
        result.exitCode === 0 ? 'ok' : 'error',
        `${state.gate.id}: ${result.exitCode === 0 ? 'credential works' : `check failed (exit ${result.exitCode})`}`,
      );
    }
  }

  heading('Summary');
  keyValue(
    'satisfied',
    `${states.filter((state) => state.state === 'satisfied').length}/${states.length}`,
  );
  keyValue(
    'blocking',
    blocking.length === 0
      ? color.green('none')
      : color.red(blocking.map((s) => s.gate.id).join(', ')),
  );
  if (blocking.length > 0) {
    write();
    write(
      color.dim('  Fill these in .env.local (or config/anyx.config.jsonc) and re-run `gates`.'),
    );
  }

  return blocking.length > 0 ? 1 : 0;
}

async function commandDoctor(ctx: Context): Promise<number> {
  const { config, paths } = ctx;
  let problems = 0;

  heading('Toolchain');
  for (const [binary, need] of [
    ['bun', 'required'],
    ['node', 'required'],
    ['git', 'required'],
    ['docker', 'optional — local Postgres and Redis'],
    ['forge', 'optional — Solidity tests and deploys'],
    ['flyctl', 'optional — deployments'],
    ['gh', 'optional — CI failure intake'],
  ] as const) {
    const present = hasBinary(binary);
    const required = need === 'required';
    if (!present && required) problems += 1;
    status(
      present ? 'ok' : required ? 'error' : 'muted',
      `${binary.padEnd(8)} ${present ? 'found' : `not installed (${need})`}`,
    );
  }

  heading('Repository');
  for (const [path, label] of [
    ['package.json', 'monorepo root'],
    ['turbo.json', 'turborepo pipelines'],
    ['packages/core', 'core engine'],
    ['packages/sdk', 'SDK package'],
    ['apps/api', 'API server'],
    ['config', 'configuration surface'],
    ['.env.local', 'local credentials'],
  ] as const) {
    const present = existsSync(join(config.repoRoot, path));
    status(
      present ? 'ok' : 'muted',
      `${path.padEnd(16)} ${present ? 'present' : `absent (${label})`}`,
    );
  }

  heading('Configuration sources');
  for (const source of config.sources) {
    status(
      source.present ? 'ok' : 'muted',
      `${(source.path ?? source.kind).padEnd(28)} ${source.present ? `${source.keys} key(s)` : 'not present'}`,
    );
  }

  heading('Task graph');
  const validation = validateTaskGraph();
  if (validation.errors.length === 0)
    status('ok', `${TASK_GRAPH.length} tasks, no structural errors`);
  for (const error of validation.errors) {
    problems += 1;
    status('error', error);
  }
  for (const warning of validation.warnings) status('warn', warning);

  heading('Manual gates');
  const gateStates = evaluateAllGates(config.env, config.skipGates);
  const blocking = gateStates.filter((state) => state.state === 'missing' && !state.gate.optional);
  status(
    blocking.length === 0 ? 'ok' : 'warn',
    blocking.length === 0
      ? 'every required credential is present'
      : `${blocking.length} required gate(s) unsatisfied: ${blocking.map((state) => state.gate.id).join(', ')}`,
  );

  heading('Services');
  // A key present but empty is unset, not configured. `.env.example` ships every
  // credential with an empty value, so treating '' as configured would report a
  // freshly bootstrapped checkout as already having a database.
  const configured = (key: string): string | undefined => {
    const value = config.env[key];
    return value === undefined || value.trim() === '' ? undefined : value;
  };

  const databaseUrl = configured('DATABASE_URL');
  const redisUrl = configured('REDIS_URL');
  if (databaseUrl === undefined)
    status('muted', 'DATABASE_URL not set; the API will run in degraded mode');
  else if (!hasBinary('psql'))
    status('muted', 'DATABASE_URL set but psql is unavailable to test it');
  else {
    const result = await runCommand(`psql "${databaseUrl}" -c "select 1"`, {
      env: config.env,
      timeoutMs: 10_000,
    });
    status(
      result.exitCode === 0 ? 'ok' : 'error',
      `postgres ${result.exitCode === 0 ? 'reachable' : 'unreachable'}`,
    );
  }
  if (redisUrl === undefined) status('muted', 'REDIS_URL not set; caching falls back to memory');
  else if (!hasBinary('redis-cli'))
    status('muted', 'REDIS_URL set but redis-cli is unavailable to test it');
  else {
    const result = await runCommand(`redis-cli -u "${redisUrl}" ping`, {
      env: config.env,
      timeoutMs: 10_000,
    });
    status(
      result.stdout.includes('PONG') ? 'ok' : 'error',
      `redis ${result.stdout.includes('PONG') ? 'reachable' : 'unreachable'}`,
    );
  }

  heading('Runtime');
  ensureRuntimeDirs(paths);
  status('ok', `runtime directory ready at ${paths.root}`);
  const interrupted = interruptedRuns(loadState(paths));
  if (interrupted.length > 0) {
    status('warn', `${interrupted.length} interrupted run(s); \`resume\` will pick them up`);
  }

  write();
  if (problems === 0) status('ok', 'no blocking problems found');
  else status('error', `${problems} blocking problem(s) found`);
  return problems > 0 ? 1 : 0;
}

async function commandBugs(ctx: Context): Promise<number> {
  const { config, paths, args } = ctx;
  const action = args.subcommand ?? 'list';
  const store = loadBugs(paths);

  if (action === 'list') {
    const all = flagBool(args, 'all');
    const bugs = all ? store.bugs : openBugs(store);
    heading(all ? 'All bugs' : 'Open bugs');
    table(
      ['Id', 'Sev', 'Status', 'Owner', 'Seen', 'Tries', 'Title'],
      bugs.map((bug) => [
        bug.id,
        bug.severity,
        bug.status,
        bug.suspectedDomain,
        `${bug.occurrences}`,
        `${bug.attempts}`,
        bug.title.slice(0, 48),
      ]),
    );
    if (bugs.length === 0) status('ok', 'nothing open');
    return 0;
  }

  if (action === 'show') {
    const id = args.positionals[0];
    const bug = store.bugs.find(
      (candidate) => candidate.id === id || candidate.fingerprint.startsWith(id ?? ''),
    );
    if (!bug) {
      status('error', `No bug matching "${id ?? ''}".`);
      return 1;
    }
    heading(bug.title);
    keyValue('id', bug.id);
    keyValue('fingerprint', bug.fingerprint);
    keyValue('severity', bug.severity);
    keyValue('status', bug.status);
    keyValue('owner', `${getAgent(bug.suspectedDomain).name} (${bug.suspectedDomain})`);
    keyValue('source', bug.source);
    keyValue('occurrences', `${bug.occurrences}`);
    keyValue('fix attempts', `${bug.attempts}/${config.bugs.maxFixAttempts}`);
    if (bug.failingCommand) keyValue('command', bug.failingCommand);
    if (bug.escalationPath) keyValue('escalation', bug.escalationPath);
    heading('Triage');
    write(`  ${bug.triageRationale}`);
    heading('Output');
    write(
      bug.errorExcerpt
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    );
    if (bug.suspectedFiles.length > 0) {
      heading('Files');
      for (const file of bug.suspectedFiles) bullet(file);
    }
    heading('History');
    for (const event of bug.history)
      bullet(`${color.dim(event.at)} ${event.kind} — ${event.message}`);
    return 0;
  }

  if (action === 'triage') {
    heading('Bug intake');
    const before = store.bugs.length;

    const inbox = findingsFromInbox(paths);
    for (const finding of inbox) ingestFinding(store, finding, config);
    status(inbox.length > 0 ? 'info' : 'muted', `inbox: ${inbox.length} report(s)`);

    if (flagBool(args, 'ci')) {
      const ci = await findingsFromGithubActions(config);
      if (ci.skippedReason) status('muted', `github actions: skipped — ${ci.skippedReason}`);
      else {
        for (const finding of ci.findings) ingestFinding(store, finding, config);
        status('info', `github actions: ${ci.findings.length} failing run(s)`);
      }
    } else {
      status('muted', 'github actions: not requested (pass --ci to include)');
    }

    saveBugs(paths, store);
    status('ok', `${store.bugs.length - before} new, ${openBugs(store).length} open in total`);

    heading('Routing');
    table(
      ['Id', 'Sev', 'Owner', 'Rationale'],
      openBugs(store).map((bug) => [
        bug.id,
        bug.severity,
        bug.suspectedDomain,
        bug.triageRationale.slice(0, 60),
      ]),
    );
    return 0;
  }

  if (action === 'fix') {
    const dryRun = flagBool(args, 'dry-run');
    const selection = createExecutor(config, { forceDryRun: dryRun, write });
    if (selection.fallbackReason)
      status('warn', `falling back to dry run: ${selection.fallbackReason}`);

    const only = args.positionals[0];
    const candidates = openBugs(store).filter(
      (bug) => (only === undefined || bug.id === only) && bug.status !== 'needs-human',
    );
    if (candidates.length === 0) {
      status('ok', 'no bugs are eligible for an automated fix');
      return 0;
    }

    heading(`Auto-fixing ${candidates.length} bug(s)`);
    let unresolved = 0;
    for (const bug of candidates) {
      write(`${mark('info')} ${bug.id} — ${bug.title}`);
      const outcome = await attemptFix(bug, store, config, paths, selection.executor, { write });
      status(outcome.resolved ? 'ok' : outcome.escalated ? 'error' : 'warn', outcome.detail);
      if (!outcome.resolved) unresolved += 1;
    }
    return unresolved > 0 ? 1 : 0;
  }

  if (action === 'escalate') {
    const id = args.positionals[0];
    const bug = store.bugs.find((candidate) => candidate.id === id);
    if (!bug) {
      status('error', `No bug with id "${id ?? ''}".`);
      return 1;
    }
    const outcome = escalate(bug, store, config, paths);
    status('warn', outcome.detail);
    return 0;
  }

  status('error', `Unknown bugs subcommand "${action}". Try list, show, triage, fix, escalate.`);
  return 1;
}

async function commandTest(ctx: Context): Promise<number> {
  const { config, paths, args } = ctx;
  const requested = flagList(args, 'stage');
  const invalid = requested.filter((stage) => !isTestStage(stage));
  if (invalid.length > 0) {
    status('error', `Unknown stage(s): ${invalid.join(', ')}. Valid: ${TEST_STAGES.join(', ')}.`);
    return 1;
  }

  heading('Test gates');
  const result = await runTests(config, paths, {
    stages: requested.length > 0 ? (requested as readonly TestStage[]) : undefined,
    continueOnFailure: flagBool(args, 'continue'),
    openBugs: !flagBool(args, 'no-bugs'),
    write: (line) => write(line),
  });

  heading('Summary');
  table(
    ['Stage', 'Status', 'Detail'],
    result.stages.map((stage) => [
      stage.stage,
      stage.status,
      stage.reason ?? `exit ${stage.exitCode ?? 0} in ${stage.durationMs}ms`,
    ]),
  );
  keyValue('result', summarizeStages(result));
  if (result.coveragePercent !== undefined) {
    keyValue('coverage', `${result.coveragePercent}% (threshold ${config.coverageThreshold}%)`);
  }
  if (result.bugs.length > 0) {
    keyValue('bugs opened', result.bugs.map((bug) => bug.id).join(', '));
    write(color.dim('  Run `bugs fix` to attempt automated repair.'));
  }

  return result.ok ? 0 : 1;
}

async function commandDeploy(ctx: Context): Promise<number> {
  const { config, paths, args } = ctx;
  const target = args.subcommand ?? 'local';
  if (target !== 'local' && target !== 'staging' && target !== 'production') {
    status('error', `Unknown environment "${target}". Use local, staging or production.`);
    return 1;
  }
  const environment = target as DeployEnvironment;

  heading(`Deploy → ${environment}`);
  const stage = config.deploy[environment];
  keyValue('build', stage.buildCommand);
  keyValue('deploy', stage.deployCommand);
  keyValue('health check', stage.healthCheckUrl);
  keyValue('required gates', stage.requiredGates.join(', ') || 'none');
  write();

  const result = await deploy(environment, config, paths, {
    approve: flagBool(args, 'approve'),
    dryRun: flagBool(args, 'dry-run'),
    skipMigrations: flagBool(args, 'skip-migrations'),
    write: (line) => write(line),
  });

  heading('Steps');
  table(
    ['Step', 'Status', 'Detail'],
    result.steps.map((step) => [step.step, step.status, step.detail]),
  );
  if (result.blockedBy.length > 0) {
    write();
    status(
      'error',
      `Blocked by manual gate(s): ${result.blockedBy.join(', ')}. Run \`gates\` for instructions.`,
    );
  }
  if (result.rolledBack) status('warn', 'the release was rolled back automatically');

  return result.ok ? 0 : 1;
}

function commandReport(ctx: Context): number {
  const path = writeReport({ config: ctx.config, paths: ctx.paths });
  status('ok', `report written to ${path}`);
  return 0;
}

async function commandResume(ctx: Context): Promise<number> {
  const state = loadState(ctx.paths);
  const interrupted = interruptedRuns(state);
  heading('Resume');
  if (interrupted.length === 0) {
    status('ok', 'no interrupted runs; starting a fresh cycle');
  } else {
    for (const entry of interrupted) {
      bullet(
        `${entry.id} (${entry.mode}) started ${entry.startedAt}, ${entry.completedTaskIds.length} completed`,
      );
    }
  }
  return await commandRun(ctx);
}

function commandConfigDump({ config }: Context): number {
  heading('Resolved configuration');
  keyValue('repo root', config.repoRoot);
  keyValue('runtime dir', config.runtimeDir);
  keyValue('concurrency', `${config.concurrency}`);
  keyValue('command timeout', `${config.commandTimeoutMs}ms`);
  keyValue('coverage threshold', `${config.coverageThreshold}%`);
  keyValue('executor', config.executor.kind);
  keyValue('max fix attempts', `${config.bugs.maxFixAttempts}`);

  heading('Test commands');
  for (const [stage, command] of Object.entries(config.test)) keyValue(stage, command);

  heading('Deploy targets');
  for (const [name, stage] of Object.entries(config.deploy)) {
    keyValue(
      name,
      `${stage.deployCommand} ${stage.autoApprove ? '' : color.yellow('(needs --approve)')}`,
    );
  }

  heading('Environment keys visible to the orchestrator');
  const interesting = MANUAL_GATES.flatMap((gate) => [
    ...gate.configKeys,
    ...(gate.optionalConfigKeys ?? []),
  ]);
  table(
    ['Key', 'Value'],
    [...new Set(interesting)].sort().map((key) => {
      const value = config.env[key];
      return [key, value === undefined || value === '' ? color.dim('(unset)') : maskSecret(value)];
    }),
  );
  return 0;
}

function commandHelp(): number {
  write();
  write(
    color.bold('  AnyX orchestrator') +
      color.dim(' — multi-agent build, test, fix and deploy automation'),
  );
  write();
  write(color.bold('  Usage'));
  write('    bun run orchestrator/cli.ts <command> [options]');
  write('    ./scripts/orchestrate <command> [options]');
  write();
  write(color.bold('  Commands'));
  const commands: readonly (readonly [string, string])[] = [
    ['plan', 'show the task graph, progress, and what is ready or blocked'],
    ['run', 'dispatch ready tasks to their specialist agents and verify them'],
    ['resume', 'continue an interrupted run'],
    ['status', 'current task states, open bugs and recent activity'],
    ['agents [id]', 'list the specialist agents, or print one in full'],
    ['gates [--verify]', 'checklist of every credential a human must supply'],
    ['doctor', 'environment, configuration and service health check'],
    ['bugs <sub>', 'list | show <id> | triage [--ci] | fix [id] | escalate <id>'],
    ['test [--stage ..]', 'staged quality gates; failures become bug reports'],
    ['deploy <env>', 'local | staging | production (production needs --approve)'],
    ['report', 'write a markdown run report'],
    ['config', 'print the resolved configuration with secrets masked'],
  ];
  for (const [name, description] of commands) {
    write(`    ${color.cyan(name.padEnd(20))} ${description}`);
  }
  write();
  write(color.bold('  Common options'));
  for (const [name, description] of [
    ['--dry-run', 'print what would happen; never dispatch or deploy'],
    ['--phase <n>', 'restrict to one phase (0-7, ci, launch)'],
    ['--task <id>', 'restrict to a single task'],
    ['--concurrency <n>', 'how many agents may work at once'],
    ['--auto-fix', 'send failures straight into the auto-fix loop'],
    ['--ignore-gates', 'plan as if every credential were present'],
    ['--approve', 'authorize a production deployment'],
  ] as const) {
    write(`    ${color.cyan(name.padEnd(20))} ${description}`);
  }
  write();
  write(
    color.dim(
      '  The default executor is dry-run, so nothing is dispatched until you configure one.',
    ),
  );
  write(color.dim('  Start with: doctor, then gates, then plan.'));
  write();
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help' || flagBool(args, 'help') || flagBool(args, 'h'))
    return commandHelp();

  let config: OrchestratorConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      status('error', error.message);
      write(color.dim(`  ${error.hint}`));
      return 1;
    }
    throw error;
  }

  const paths = runtimePaths(config);
  const ctx: Context = { config, paths, args };

  switch (args.command) {
    case 'plan':
      return commandPlan(ctx);
    case 'run':
      return await commandRun(ctx);
    case 'resume':
      return await commandResume(ctx);
    case 'status':
      return commandStatus(ctx);
    case 'agents':
      return commandAgents(ctx);
    case 'gates':
      return await commandGates(ctx);
    case 'doctor':
      return await commandDoctor(ctx);
    case 'bugs':
      return await commandBugs(ctx);
    case 'test':
      return await commandTest(ctx);
    case 'deploy':
      return await commandDeploy(ctx);
    case 'report':
      return commandReport(ctx);
    case 'config':
      return commandConfigDump(ctx);
    default:
      status('error', `Unknown command "${args.command}".`);
      commandHelp();
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    status('error', error instanceof Error ? error.message : String(error));
    if (process.env.ANYX_DEBUG === '1' && error instanceof Error)
      write(color.dim(error.stack ?? ''));
    process.exitCode = 1;
  });
