import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentResult, RunContext } from "../orchestrator/types.ts";

export async function runDevops(ctx: RunContext, testsOk: boolean): Promise<AgentResult> {
  const ci = existsSync(join(ctx.cwd, ".github/workflows/ci.yml"));
  const deploy = existsSync(join(ctx.cwd, ".github/workflows/deploy.yml"));
  const docker = existsSync(join(ctx.cwd, "apps/api/Dockerfile"));
  const notes = [
    testsOk ? "tests green (or skipped in nested run)" : "tests not green — do not deploy",
    ci ? "ci.yml present" : "MISSING ci.yml",
    deploy ? "deploy.yml present (secret-gated)" : "MISSING deploy.yml",
    docker ? "API Dockerfile present" : "MISSING Dockerfile",
    "Live deploy requires GitHub secret FLY_API_TOKEN; until then deploy is dry-run only",
  ];
  const ok = ci && deploy && docker;
  return {
    agentId: "devops",
    status: ok ? "ok" : "failed",
    summary: testsOk ? "Deploy checklist ready (dry-run)" : "Deploy blocked until tests pass",
    artifacts: notes,
  };
}
