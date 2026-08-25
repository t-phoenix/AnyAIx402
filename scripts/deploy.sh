#!/usr/bin/env bash
#
# Deploy AnyX through the orchestrator's deploy pipeline, which enforces the
# preflight gate checks, health polling and automatic rollback.
#
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production --approve
#   ./scripts/deploy.sh production --dry-run
#
# Production refuses to proceed without --approve. That is deliberate: nothing
# should be able to ship to production unattended.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENVIRONMENT="${1:-}"
shift || true

case "$ENVIRONMENT" in
  local | staging | production) ;;
  '' | -h | --help)
    cat <<'USAGE'
Usage: ./scripts/deploy.sh <local|staging|production> [options]

Options:
  --approve          authorize a production deployment
  --dry-run          show the pipeline without running any command
  --skip-migrations  deploy without running database migrations

The pipeline validates every required credential before it starts, polls the
health endpoint after the release, and rolls back automatically if the new
release never becomes healthy.
USAGE
    exit 0
    ;;
  *)
    echo "Unknown environment '$ENVIRONMENT'. Use local, staging or production." >&2
    exit 1
    ;;
esac

exec ./scripts/orchestrate deploy "$ENVIRONMENT" "$@"
