import type { ConfigStatus } from "@anyx/config";
import { mustExist, ok, failed } from "../lib.ts";
import type { AgentResult, ConfigRequest, RunContext } from "../orchestrator/types.ts";

export async function runX402(ctx: RunContext, status: ConfigStatus): Promise<AgentResult> {
  const missing = mustExist(ctx, [
    "packages/core/src/x402.ts",
    "packages/core/src/eip3009.ts",
    "packages/core/src/facilitator.ts",
    "packages/core/src/fees.ts",
  ]);
  if (missing.length) return failed("x402", `Missing protocol files: ${missing.join(", ")}`);

  const configRequests: ConfigRequest[] = [];
  if (!status.capabilities.quote_live) {
    configRequests.push({
      id: `cfg_dex_${Date.now()}`,
      createdAt: new Date().toISOString(),
      agentId: "x402",
      title: "Add a DEX API key for live quotes",
      why: "Without 1inch or 0x, AnyX still quotes using demo rates. Live ETH/USDT amounts need a DEX key.",
      envVars: ["ONEINCH_API_KEY", "ZEROX_API_KEY"],
      docs: "See README Connecting APIs & Payments, or http://localhost:3000/setup",
    });
  }
  return {
    agentId: "x402",
    status: "ok",
    summary: "x402 parser, fee math, EIP-3009, facilitator client present",
    artifacts: [],
    configRequests,
  };
}
