import type { ConfigStatus } from "@anyx/config";
import { failed, mustExist, ok } from "../lib.ts";
import type { AgentResult, RunContext } from "../orchestrator/types.ts";

export async function runBackend(ctx: RunContext, _status: ConfigStatus): Promise<AgentResult> {
  const missing = mustExist(ctx, ["apps/api/src/app.ts", "apps/api/src/routes/index.ts"]);
  if (missing.length) return failed("backend", `Missing API files: ${missing.join(", ")}`);
  return ok("backend", "Hono API: health, tokens, quote, pay, receipt, setup wizard");
}
