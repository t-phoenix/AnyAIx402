import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentResult, RunContext } from "./orchestrator/types.ts";

export function mustExist(ctx: RunContext, rel: string[]): string[] {
  return rel.filter((file) => !existsSync(join(ctx.cwd, file)));
}

export function ok(
  agentId: AgentResult["agentId"],
  summary: string,
  artifacts: string[] = [],
): AgentResult {
  return { agentId, status: "ok", summary, artifacts };
}

export function failed(
  agentId: AgentResult["agentId"],
  summary: string,
  artifacts: string[] = [],
): AgentResult {
  return { agentId, status: "failed", summary, artifacts };
}
