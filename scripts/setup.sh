#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example — open it (or /setup) and add keys."
fi
if [[ ! -f config/user.config.yaml ]]; then
  cp config/user.config.example.yaml config/user.config.yaml
  echo "Created config/user.config.yaml"
fi
npm install
if command -v docker >/dev/null 2>&1; then
  docker compose up -d || echo "Docker compose skipped (not available or failed)."
else
  echo "Docker not installed — API still runs with in-memory storage."
fi
npx tsx scripts/check-config.ts
echo "Next: npm test && npm run dev:api"
