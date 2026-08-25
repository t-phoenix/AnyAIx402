# QA agent

Run unit/API tests. Do not spawn a nested vitest when already inside Vitest (`ctx.nested`).

## Outputs
Pass/fail + logs. On fail, set status failed and attach logs for Bug Reporter.

## Tools
`npx vitest run` on packages/core, packages/sdk, packages/config, apps/api — never `agents/**`.
