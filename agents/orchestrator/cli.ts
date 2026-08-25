#!/usr/bin/env npx tsx
import { runOrchestrator } from "./loop.ts";

function arg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const goal = arg("--goal", "verify-v0");
const report = await runOrchestrator({
  cwd: process.cwd(),
  goal,
  nested: Boolean(process.env.VITEST),
  now: new Date(),
});

console.log(`AnyX agent run ${report.runId}  ok=${report.ok}`);
console.log(`goal: ${report.goal}`);
for (const result of report.results) {
  console.log(`  [${result.status}] ${result.agentId} — ${result.summary}`);
}
if (report.configRequests.length) {
  console.log("\nConfig needed (fill .env.local or open /setup):");
  for (const req of report.configRequests) {
    console.log(`  • ${req.title}: ${req.envVars.join(", ")}`);
    console.log(`    ${req.why}`);
  }
}
if (report.bugs.length) {
  console.log("\nBugs:");
  for (const bug of report.bugs) {
    console.log(`  • ${bug.title} (${bug.severity})`);
  }
}
console.log(`\nDeploy: ${report.deploy.mode}`);
for (const note of report.deploy.notes) console.log(`  ${note}`);

if (!report.ok) process.exit(1);
