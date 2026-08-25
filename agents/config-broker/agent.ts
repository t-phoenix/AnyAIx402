import type { ConfigStatus } from "@anyx/config";
import { formatMissingReport } from "@anyx/config";
import type { AgentResult, RunContext } from "../orchestrator/types.ts";

export async function runConfigBroker(
  _ctx: RunContext,
  status: ConfigStatus,
): Promise<AgentResult> {
  return {
    agentId: "config-broker",
    status: "ok",
    summary: formatMissingReport(status).split("\n")[5] ?? "config evaluated",
    artifacts: ["npm run check-config", "http://localhost:3000/setup"],
    configRequests: status.missing.slice(0, 8).map((item, i) => ({
      id: `cfg_${item.group}_${i}`,
      createdAt: new Date().toISOString(),
      agentId: "config-broker",
      title: item.label,
      why: item.hint,
      envVars: [item.env],
      docs: "README Connecting APIs & Payments",
    })),
  };
}
