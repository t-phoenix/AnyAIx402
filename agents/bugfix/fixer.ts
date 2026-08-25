import type { AgentResult, BugReport, RunContext } from "../orchestrator/types.ts";

/**
 * v0 fixer cannot patch arbitrary source. It records a structured handoff
 * so a human or a later LLM-backed pass can apply a minimal diff, then QA retests.
 */
export async function runBugFixer(_ctx: RunContext, bugs: BugReport[]): Promise<AgentResult> {
  if (!bugs.length) {
    return { agentId: "bug-fixer", status: "skipped", summary: "No bugs", artifacts: [] };
  }
  return {
    agentId: "bug-fixer",
    status: "ok",
    summary: `Acknowledged ${bugs.length} bug(s). Re-test follows. Manual patch if still red.`,
    artifacts: bugs.map((b) => b.id),
  };
}
