import { execSync } from "node:child_process";
import type { AgentResult, BugReport, RunContext } from "../orchestrator/types.ts";

export async function runQa(ctx: RunContext): Promise<AgentResult> {
  if (ctx.nested) {
    return {
      agentId: "qa",
      status: "skipped",
      summary: "Inside Vitest — skipped nested test spawn",
      artifacts: [],
    };
  }
  try {
    const output = execSync(
      "npx vitest run packages/core packages/sdk packages/config apps/api",
      { cwd: ctx.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { agentId: "qa", status: "ok", summary: "vitest passed", artifacts: [output.slice(-500)] };
  } catch (err) {
    const logs = err instanceof Error ? err.message : String(err);
    const bug: BugReport = {
      id: `bug_qa_${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: "Automated tests failed",
      severity: "high",
      source: "qa",
      logs: logs.slice(0, 4000),
      expected: "vitest exit 0",
      actual: "non-zero exit",
    };
    return {
      agentId: "qa",
      status: "failed",
      summary: "vitest failed",
      artifacts: [],
      bugs: [bug],
    };
  }
}
