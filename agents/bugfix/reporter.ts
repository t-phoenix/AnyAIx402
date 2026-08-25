import type { AgentResult, RunContext } from "../orchestrator/types.ts";

export async function runBugReporter(
  ctx: RunContext,
  qa: AgentResult,
): Promise<AgentResult> {
  const bugs = qa.bugs ?? [];
  return {
    agentId: "bug-reporter",
    status: bugs.length ? "ok" : "skipped",
    summary: bugs.length ? `Filed ${bugs.length} bug(s) from QA` : "No bugs to file",
    artifacts: bugs.map((b) => `.anyx/bugs/${b.id}.json`),
    bugs,
  };
}
