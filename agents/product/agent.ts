import { failed, mustExist, ok } from "../lib.ts";
import type { AgentResult, RunContext } from "../orchestrator/types.ts";

const REQUIRED = [
  "docs/PLAN.md",
  "docs/ARCHITECTURE.md",
  "docs/x402-universal-adapter-prd.md",
  "docs/x402-low-hanging-fruit.md",
  "packages/core/src/quote.ts",
  "packages/sdk/src/upa.ts",
];

export async function runProduct(ctx: RunContext): Promise<AgentResult> {
  const missing = mustExist(ctx, REQUIRED);
  if (missing.length) {
    return failed("product", `Missing v0 files: ${missing.join(", ")}`, missing);
  }
  return ok(
    "product",
    `v0 scope locked: Quote API + USDT/ETH SDK + MAS. Goal=${ctx.goal}`,
    REQUIRED,
  );
}
