#!/usr/bin/env bash
#
# Idempotent bootstrap for an AnyX working copy.
#
# Safe to run repeatedly. Anything optional that is unavailable is reported as
# a SKIP with the reason and a way forward, never as a hard failure — you should
# be able to get a working checkout without Docker, without Foundry, and without
# a single third-party account.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_ROOT="$PWD"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'
  GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; RESET=''
fi

step() { printf '\n%s==>%s %s%s%s\n' "$BOLD" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()   { printf '  %sOK%s   %s\n' "$GREEN" "$RESET" "$1"; }
skip() { printf '  %sSKIP%s %s\n' "$YELLOW" "$RESET" "$1"; }
warn() { printf '  %s!!%s   %s\n' "$YELLOW" "$RESET" "$1"; }
fail() { printf '  %sXX%s   %s\n' "$RED" "$RESET" "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

step "Runtime"

if have bun; then
  ok "bun $(bun --version)"
else
  warn "bun is not installed; installing it now"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if have bun; then
    ok "bun $(bun --version) installed"
    warn "add this to your shell profile: export PATH=\"\$HOME/.bun/bin:\$PATH\""
  else
    fail "bun could not be installed. Install it manually: https://bun.sh"
    exit 1
  fi
fi

have node && ok "node $(node --version)" || skip "node is not installed (bun covers most of it)"
have git  && ok "git $(git --version | awk '{print $3}')" || fail "git is not installed"

step "Configuration"

if [ -f .env.local ]; then
  ok ".env.local already exists; leaving it alone"
elif [ -f .env.example ]; then
  cp .env.example .env.local
  ok "created .env.local from .env.example"
  warn "it holds no credentials yet; run 'bun run config:missing' to see what to fill in"
else
  skip ".env.example does not exist yet, so .env.local was not created"
fi

if [ -f config/anyx.config.jsonc ] || [ -f config/anyx.config.json ]; then
  ok "config/anyx.config.jsonc already exists; leaving it alone"
elif [ -f config/anyx.config.example.jsonc ]; then
  cp config/anyx.config.example.jsonc config/anyx.config.jsonc
  ok "created config/anyx.config.jsonc from the example"
else
  skip "config/anyx.config.example.jsonc does not exist yet"
fi

step "Dependencies"

if [ -f package.json ]; then
  bun install
  ok "dependencies installed"
else
  skip "no package.json at the repository root yet"
fi

step "Services"

if have docker && docker info >/dev/null 2>&1; then
  if [ -f docker-compose.yml ]; then
    docker compose up -d postgres redis
    ok "postgres and redis are starting"

    printf '  waiting for postgres'
    for _ in $(seq 1 30); do
      if docker compose exec -T postgres pg_isready -U anyx >/dev/null 2>&1; then
        printf '\n'; ok "postgres is accepting connections"; break
      fi
      printf '.'; sleep 1
    done
  else
    skip "docker-compose.yml does not exist yet"
  fi
else
  skip "docker is unavailable"
  printf '       %sUse hosted services instead and put the URLs in .env.local:%s\n' "$DIM" "$RESET"
  printf '       %s  DATABASE_URL  free Postgres at https://neon.tech%s\n' "$DIM" "$RESET"
  printf '       %s  REDIS_URL     free Redis at https://upstash.com%s\n' "$DIM" "$RESET"
  printf '       %sAnyX also runs with neither, in a degraded mode it reports at /health.%s\n' "$DIM" "$RESET"
fi

step "Database migrations"

if ! grep -q '"db:migrate"' package.json 2>/dev/null; then
  skip "no db:migrate script yet"
elif ! grep -qE '^\s*DATABASE_URL=.+' .env.local 2>/dev/null; then
  skip "DATABASE_URL is not set in .env.local"
else
  if bun run db:migrate; then
    ok "migrations applied"
  else
    warn "migrations failed; check that DATABASE_URL points at a reachable database"
  fi
fi

step "Solidity toolchain"

if have forge; then
  ok "foundry $(forge --version | head -1)"
else
  skip "foundry is not installed (only needed for Phase 2 contracts)"
  printf '       %sInstall with: curl -L https://foundry.paradigm.xyz | bash && foundryup%s\n' "$DIM" "$RESET"
fi

step "Health check"

if [ -f orchestrator/cli.ts ]; then
  bun run orchestrator/cli.ts doctor || true
else
  skip "the orchestrator is not present in this checkout"
fi

printf '\n%sSetup complete.%s\n\n' "$BOLD" "$RESET"
printf '  Next:\n'
printf '    %sbun run config:missing%s      what to fill into .env.local, and how to get each value\n' "$BOLD" "$RESET"
printf '    %s./scripts/orchestrate gates%s  the same list, framed as build-blocking gates\n' "$BOLD" "$RESET"
printf '    %s./scripts/orchestrate plan%s   the build graph and what is ready to run\n' "$BOLD" "$RESET"
printf '    %sbun run dev%s                  start the API and dashboard\n\n' "$BOLD" "$RESET"
