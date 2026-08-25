import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigStatus, loadConfig } from "@anyx/config";
import { runAiIntegrations } from "../ai-integrations/agent.ts";
import { runBackend } from "../backend/agent.ts";
import { runBugFixer } from "../bugfix/fixer.ts";
import { runBugReporter } from "../bugfix/reporter.ts";
import { runConfigBroker } from "../config-broker/agent.ts";
import { runDevops } from "../devops/agent.ts";
import { runFrontend } from "../frontend/agent.ts";
import { runProduct } from "../product/agent.ts";
import { runQa } from "../qa/agent.ts";
import { runSecurity } from "../security/agent.ts";
import { runX402 } from "../x402/agent.ts";
import { maybePlanWithLlm } from "./llm.ts";
import type { AgentResult, BugReport, ConfigRequest, RunContext, RunReport } from "./types.ts";

const MAX_FIX_ROUNDS = 2;

export async function runOrchestrator(ctx: RunContext): Promise<RunReport> {
  const startedAt = ctx.now.toISOString();
  const runId = `run_${ctx.now.getTime()}`;
  const config = loadConfig({ cwd: ctx.cwd });
  const status = getConfigStatus(config);

  const results: AgentResult[] = [];
  const bugs: BugReport[] = [];
  const configRequests: ConfigRequest[] = [];

  const llmPlan = await maybePlanWithLlm(config, ctx.goal);
  if (llmPlan) {
    results.push({
      agentId: "orchestrator",
      status: "ok",
      summary: `LLM plan: ${llmPlan.slice(0, 200)}`,
      artifacts: [],
    });
  }

  const specialists = [
    runConfigBroker,
    runProduct,
    runX402,
    runBackend,
    runFrontend,
    runAiIntegrations,
    runSecurity,
  ];

  for (const fn of specialists) {
    const result = await fn(ctx, status);
    results.push(result);
    bugs.push(...(result.bugs ?? []));
    configRequests.push(...(result.configRequests ?? []));
  }

  let qa = await runQa(ctx);
  results.push(qa);
  bugs.push(...(qa.bugs ?? []));

  let round = 0;
  while (qa.status === "failed" && round < MAX_FIX_ROUNDS) {
    round += 1;
    const filed = await runBugReporter(ctx, qa);
    results.push(filed);
    bugs.push(...(filed.bugs ?? []));
    const fixed = await runBugFixer(ctx, filed.bugs ?? []);
    results.push(fixed);
    qa = await runQa(ctx);
    results.push({ ...qa, summary: `retest round ${round}: ${qa.summary}` });
    bugs.push(...(qa.bugs ?? []));
  }

  const deploy = await runDevops(ctx, qa.status === "ok" || qa.status === "skipped");
  results.push(deploy);

  const report: RunReport = {
    runId,
    goal: ctx.goal,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    bugs,
    configRequests,
    deploy: {
      mode: "dry-run",
      notes: deploy.artifacts,
    },
    ok: qa.status !== "failed" && results.every((r) => r.status !== "failed"),
  };

  persist(ctx.cwd, report, configRequests, bugs);
  return report;
}

function persist(
  cwd: string,
  report: RunReport,
  configRequests: ConfigRequest[],
  bugs: BugReport[],
) {
  const runs = join(cwd, ".anyx/runs");
  const reqDir = join(cwd, ".anyx/config-requests");
  const bugDir = join(cwd, ".anyx/bugs");
  mkdirSync(runs, { recursive: true });
  mkdirSync(reqDir, { recursive: true });
  mkdirSync(bugDir, { recursive: true });
  writeFileSync(join(runs, `${report.runId}.json`), JSON.stringify(report, null, 2));
  for (const req of configRequests) {
    writeFileSync(join(reqDir, `${req.id}.json`), JSON.stringify(req, null, 2));
  }
  for (const bug of bugs) {
    writeFileSync(join(bugDir, `${bug.id}.json`), JSON.stringify(bug, null, 2));
  }
}
