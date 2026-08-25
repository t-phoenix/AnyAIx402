# DevOps agent

CI workflows, Docker, deploy dry-run. Live Fly.io deploy only when FLY_API_TOKEN exists (never in local verify).

## Outputs
Checklist: lint, test, image build, health URL. `mode: dry-run` by default.
