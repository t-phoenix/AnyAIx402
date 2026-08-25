#!/usr/bin/env bash
# AnyX local setup (docs/AGENTS.md Task 0.3).
#
# 1. Installs workspace dependencies (bun install).
# 2. Copies .env.example -> .env.local if it doesn't exist yet.
# 3. Starts docker-compose (Postgres + Redis).
# 4. Runs database migrations.
# 5. Prints a config checklist: which env vars are set vs. missing, grouped by the tiers in
#    docs/CONFIGURATION.md, with what's blocked and where to get each missing value.
#
# This script never exits non-zero just because *optional* keys are missing — only on a
# genuinely broken local setup (e.g. Docker unavailable). Re-run it any time to see an updated
# checklist: `bash scripts/setup.sh` or `bun run setup`.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

info()  { printf '%b\n' "${BOLD}==>${RESET} $1"; }
ok()    { printf '  %b✓%b %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '  %b!%b %s\n' "$YELLOW" "$RESET" "$1"; }
fail()  { printf '  %b✗%b %s\n' "$RED" "$RESET" "$1"; }

EXIT_CODE=0

# ── 1. Install dependencies ────────────────────────────────────────────────────────────────────
info "Installing workspace dependencies"
if command -v bun >/dev/null 2>&1; then
  bun install && ok "bun install complete" || { fail "bun install failed"; EXIT_CODE=1; }
else
  fail "bun is not installed. Install it: curl -fsSL https://bun.sh/install | bash"
  EXIT_CODE=1
fi

# ── 2. .env.local ───────────────────────────────────────────────────────────────────────────────
info "Checking .env.local"
if [ -f .env.local ]; then
  ok ".env.local already exists — leaving it untouched"
else
  cp .env.example .env.local
  ok "Created .env.local from .env.example — fill in what you have (see docs/CONFIGURATION.md)"
fi

# ── 3. docker-compose (Postgres + Redis) ───────────────────────────────────────────────────────
info "Starting local infra (Postgres + Redis) via docker compose"
DOCKER_OK=0
COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

if [ -n "$COMPOSE_CMD" ]; then
  if $COMPOSE_CMD up -d postgres redis; then
    ok "$COMPOSE_CMD up -d postgres redis"
    DOCKER_OK=1
  else
    fail "$COMPOSE_CMD up failed — see output above"
    EXIT_CODE=1
  fi
else
  fail "Neither 'docker compose' nor 'docker-compose' found. See https://docs.docker.com/get-docker/"
  EXIT_CODE=1
fi

# ── 4. Run migrations ──────────────────────────────────────────────────────────────────────────
info "Running database migrations"
if [ "$DOCKER_OK" -eq 1 ] && command -v bun >/dev/null 2>&1; then
  # Give Postgres a moment to accept connections after `docker compose up -d`.
  for _ in $(seq 1 10); do
    $COMPOSE_CMD exec -T postgres pg_isready -U anyx -d anyx >/dev/null 2>&1 && break
    sleep 1
  done
  if bun run db:generate && bun run db:migrate; then
    ok "Migrations applied"
  else
    warn "Migrations did not complete — Postgres may still be starting up. Re-run: bun run db:migrate"
  fi
else
  warn "Skipping migrations (Docker/bun not ready — see above)"
fi

# Note: AnyX's token registry (packages/core/src/tokens.ts) is a static, versioned TypeScript
# module, not a database table — there is nothing to "seed" for it. The `quotes`, `payments`,
# `api_keys`, and `lightning_invoices` tables populate themselves as the API is used.

# ── 5. Config checklist ────────────────────────────────────────────────────────────────────────
info "Configuration checklist (see docs/CONFIGURATION.md for full details)"

ENV_FILE=".env.local"
get_val() {
  # Reads VAR=value from .env.local, ignoring comments/blank lines. Empty if unset/blank.
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//'
}
check() {
  local var="$1" label="$2" where="$3"
  local val
  val="$(get_val "$var")"
  if [ -n "$val" ]; then
    ok "$var is set — $label"
  else
    warn "$var not set — $label. Get it: $where"
  fi
}

printf '\n%b Tier 0 — local infra (no account needed)%b\n' "$DIM" "$RESET"
[ "$DOCKER_OK" -eq 1 ] && ok "Postgres + Redis running via docker-compose" || fail "Postgres + Redis not confirmed running"

printf '\n%b Tier 1 — real quotes/swaps (Phase 1)%b\n' "$DIM" "$RESET"
check RPC_URL_BASE       "read Base chain state"        "https://alchemy.com or https://quicknode.com"
check ONEINCH_API_KEY    "1inch swap quotes"            "https://portal.1inch.dev"
check ZEROX_API_KEY      "0x fallback quotes"            "https://dashboard.0x.org"
check PRIVATE_KEY        "hot signer for EIP-3009"       "generate a dedicated wallet — never reuse a personal key"
check FACILITATOR_URL    "x402 settlement"               "https://portal.cdp.coinbase.com"

printf '\n%b Tier 2 — smart contract deployment (Phase 2)%b\n' "$DIM" "$RESET"
check BASESCAN_API_KEY      "contract verification" "https://basescan.org/apis"
check RPC_URL_BASE_SEPOLIA  "testnet deploy target" "same RPC providers as Tier 1, testnet endpoint"

printf '\n%b Tier 3 — cross-chain (Phase 3)%b\n' "$DIM" "$RESET"
check RPC_URL_SOLANA "Solana-side swaps" "https://helius.dev or a public endpoint for dev"

printf '\n%b Tier 4 — Lightning/BTC (Phase 4)%b\n' "$DIM" "$RESET"
check LND_TLS_CERT_PATH  "connect to your LND node" "run your own node, or https://voltage.cloud"
check LND_MACAROON_PATH  "connect to your LND node" "run your own node, or https://voltage.cloud"

printf '\n%b Tier 5 — billing (Phase 6)%b\n' "$DIM" "$RESET"
check STRIPE_SECRET_KEY     "create checkout sessions" "https://dashboard.stripe.com"
check STRIPE_PRO_PRICE_ID   "the Pro plan price object" "Stripe dashboard -> Products"
check STRIPE_WEBHOOK_SECRET "verify webhook signatures" "Stripe dashboard -> Webhooks"

printf '\n%b Tier 6 — deploy/release%b\n' "$DIM" "$RESET"
check FLY_API_TOKEN "deploy apps/api" "flyctl auth login && flyctl auth token"
check NPM_TOKEN     "publish @anyx/sdk" "npmjs.com -> Access Tokens"

printf '\n'
info "Done. Nothing above blocks local development — missing keys degrade to mocked responses."
exit "$EXIT_CODE"
