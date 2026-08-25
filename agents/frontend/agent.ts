import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigStatus } from "@anyx/config";
import { failed, mustExist, ok } from "../lib.ts";
import type { AgentResult, RunContext } from "../orchestrator/types.ts";

export async function runFrontend(ctx: RunContext, _status: ConfigStatus): Promise<AgentResult> {
  const file = "apps/api/src/setup-html.ts";
  const missing = mustExist(ctx, [file, "apps/dashboard/index.html"]);
  if (missing.length) return failed("frontend", `Missing UI: ${missing.join(", ")}`);
  const html = readFileSync(join(ctx.cwd, file), "utf8");
  if (!html.includes("Connecting APIs")) {
    return failed("frontend", "Setup wizard copy missing");
  }
  return ok("frontend", "Config wizard + dashboard portal present");
}
