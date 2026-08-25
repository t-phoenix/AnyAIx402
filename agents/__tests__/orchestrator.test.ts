import { describe, expect, it } from "vitest";
import { runOrchestrator } from "../orchestrator/loop.ts";

describe("orchestrator loop", () => {
  it("completes verify-v0 without hanging on missing keys", async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      goal: "verify-v0",
      nested: true,
      now: new Date("2025-08-25T12:00:00Z"),
    });
    expect(report.runId).toBeTruthy();
    expect(report.configRequests.length).toBeGreaterThan(0);
    const ids = report.results.map((r) => r.agentId);
    expect(ids).toContain("config-broker");
    expect(ids).toContain("x402");
    expect(ids).toContain("qa");
    expect(ids).toContain("devops");
    expect(report.results.find((r) => r.agentId === "qa")?.status).toBe("skipped");
    expect(report.results.every((r) => r.status !== "failed")).toBe(true);
    expect(report.ok).toBe(true);
  });
});
