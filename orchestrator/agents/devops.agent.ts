import type { AgentDefinition } from './types.ts';

export const devopsAgent: AgentDefinition = {
  id: 'devops',
  name: 'DevOps Engineer',
  domain: 'Docker, CI, Fly.io deployment, migrations, health checks, rollback',
  mission:
    'Make AnyX deployable and recoverable. Own the container images, the compose stack for local Postgres and Redis, the Fly.io deployment path with post-deploy migrations and a health-check gate, and an automatic rollback when that gate fails.',
  ownedPaths: ['docker-compose.yml', 'docker-compose.prod.yml', 'apps/api/Dockerfile', 'fly.toml'],
  capabilities: [
    'Multi-stage Docker builds on the Bun base image',
    'Compose services with health checks and named volumes',
    'Fly.io app configuration, secrets and releases',
    'Post-deploy migration and health verification with rollback on failure',
  ],
  requiredConfigKeys: ['FLY_API_TOKEN'],
  requiredManualGates: ['fly-deploy-token', 'postgres', 'redis'],
  allowedCommands: ['docker compose', 'docker build', 'flyctl', 'bun run build'],
  definitionOfDone: [
    'docker compose up -d brings up healthy Postgres and Redis',
    'The API image builds and the container answers /health',
    'A deploy runs migrations and only completes after the health check passes',
    'A failed health check triggers the rollback command automatically',
  ],
  references: ['docs/reference/agent-build-roadmap.md'],
  domainRules: [
    'Docker is not installed in every environment. Detect it and report a skip with the hosted-Postgres alternative rather than failing.',
    'Secrets reach production through the platform secret store, never through an image layer or a committed file.',
    'Every deploy must be rollback-able with one command.',
  ],
};
