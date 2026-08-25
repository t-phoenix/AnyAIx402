import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigStatus } from "@anyx/config";
import type { AgentResult, ConfigRequest, RunContext } from "../orchestrator/types.ts";

export async function runSecurity(ctx: RunContext, status: ConfigStatus): Promise<AgentResult> {
  const gitignore = readFileSync(join(ctx.cwd, ".gitignore"), "utf8");
  const secretsCommitted = existsSync(join(ctx.cwd, ".env.local"));
  const configRequests: ConfigRequest[] = [];
  if (!status.config.privateKey) {
    configRequests.push({
      id: `cfg_signer_${Date.now()}`,
      createdAt: new Date().toISOString(),
      agentId: "security",
      title: "Add a dedicated test wallet to enable live payments",
      why: "Live /v1/pay signs EIP-3009 USDC transfers. Use a throwaway key whose wallet holds USDC on Base. Keep ANYX_STUB_PAYMENTS=true until then.",
      envVars: ["PRIVATE_KEY"],
      docs: "README → Connecting APIs & Payments",
    });
  }
  if (!gitignore.includes(".env.local")) {
    return {
      agentId: "security",
      status: "failed",
      summary: ".gitignore must include .env.local",
      artifacts: [],
    };
  }
  return {
    agentId: "security",
    status: "ok",
    summary: secretsCommitted
      ? ".env.local exists locally (gitignored) — do not commit it"
      : "Secret files gitignored; live signer not configured (expected for v0 stub)",
    artifacts: [],
    configRequests,
  };
}
