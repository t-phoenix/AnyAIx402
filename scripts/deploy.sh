#!/usr/bin/env bash
set -euo pipefail
echo "AnyX deploy helper (dry-run unless FLY_API_TOKEN is set)"
echo "1. npm test"
echo "2. docker build -f apps/api/Dockerfile ."
echo "3. If FLY_API_TOKEN is set: flyctl deploy --app anyx-api"
echo "4. curl https://api.anyx.xyz/health  (or your Fly URL)"
if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "FLY_API_TOKEN missing — stopping at dry-run checklist."
  exit 0
fi
echo "Token present in env — invoke flyctl from CI, not this laptop script, unless you intend a live deploy."
