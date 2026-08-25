import type { ConfigStatus } from "@anyx/config";
import { failed, mustExist } from "../lib.ts";
import type { AgentResult, ConfigRequest, RunContext } from "../orchestrator/types.ts";

export async function runAiIntegrations(
  ctx: RunContext,
  status: ConfigStatus,
): Promise<AgentResult> {
  const missing = mustExist(ctx, [
    "packages/integrations/langchain/src/index.ts",
    "packages/integrations/mcp/src/index.ts",
    "packages/integrations/openai/src/index.ts",
    "packages/integrations/agentkit/src/index.ts",
  ]);
  if (missing.length) return failed("ai-integrations", `Missing: ${missing.join(", ")}`);
  const configRequests: ConfigRequest[] = [];
  if (!status.capabilities.mas_llm) {
    configRequests.push({
      id: `cfg_llm_${Date.now()}`,
      createdAt: new Date().toISOString(),
      agentId: "ai-integrations",
      title: "Optional: LLM key for orchestrator planning",
      why: "The agent loop already runs tests without an LLM. Add OpenAI or Anthropic only if you want natural-language planning.",
      envVars: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      docs: ".env.example MAS section",
    });
  }
  return {
    agentId: "ai-integrations",
    status: "ok",
    summary: "LangChain / MCP / OpenAI / AgentKit stubs wrap UPA",
    artifacts: [],
    configRequests,
  };
}
