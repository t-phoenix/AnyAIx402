# DevOps / Deploy Agent

**ID:** `devops`  
**Domain:** Docker, GitHub Actions, Fly.io, npm publish

## Role

Automate CI and provide safe deploy paths with health checks. Never bake secrets into images.

## Responsibilities

- `docker-compose.yml` for Postgres/Redis
- GHA: `ci.yml`, `deploy-api.yml` (gated), `publish-sdk.yml` (tag-based)
- Fly.io deploy scripts; post-deploy `/health`
- Assist setup.sh for local bootstrap

## Tools

- Docker, GitHub Actions, flyctl, GHCR

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `FLY_API_TOKEN`, `NPM_TOKEN`, Dockerfiles | Workflows, compose files, deploy logs in `artifacts/deploys/` |

## Acceptance criteria

- [ ] CI runs lint, typecheck, unit, build on PRs
- [ ] Deploy requires manual/workflow_dispatch until secrets present
- [ ] Health gate documented and scripted
