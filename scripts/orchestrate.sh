#!/usr/bin/env bash
# Lightweight orchestrator helper for AnyAIx402 multi-agent loops.
# Does not call external APIs; scans repo artifacts and prints next actions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cmd="${1:-status}"

print_header() {
  echo "=== AnyX Orchestrator ($(date -u +%Y-%m-%dT%H:%MZ)) ==="
}

count_open_bugs() {
  local n=0
  shopt -s nullglob
  for f in artifacts/bugs/BUG-*.md; do
    if ! grep -qiE '^status:\s*closed' "$f" 2>/dev/null; then
      n=$((n + 1))
    fi
  done
  echo "$n"
}

case "$cmd" in
  status)
    print_header
    echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo "Docs plan: docs/MULTI_AGENT_PLAN.md"
    echo "Agent specs: agents/ ($(ls agents/*.md 2>/dev/null | wc -l) files)"
    echo "Open bug files (no status: closed): $(count_open_bugs)"
    echo "Blocked tasks:"
    shopt -s nullglob
    blocked=(artifacts/tasks/BLOCKED-*.md)
    if ((${#blocked[@]})); then
      printf '  - %s\n' "${blocked[@]}"
    else
      echo "  (none)"
    fi
    if [[ -f .env.local ]]; then
      echo "Secrets: .env.local present (do not commit)"
    else
      echo "Secrets: MISSING — copy .env.example → .env.local"
    fi
    echo
    echo "Pipeline: PLAN → IMPLEMENT → TEST → BUG_REPORT → FIX → RETEST → DEPLOY"
    ;;

  next)
    print_header
    if [[ ! -f .env.local ]]; then
      echo "NEXT: Human — create .env.local from .env.example (Phase 0–1 keys)."
      echo "OWNER: human + orchestrator"
      exit 0
    fi
    open_bugs="$(count_open_bugs)"
    if [[ "$open_bugs" != "0" ]]; then
      echo "NEXT: FIX/RETEST — $open_bugs open bug file(s) under artifacts/bugs/"
      echo "OWNER: qa + owning specialist"
      exit 0
    fi
    if [[ ! -f package.json ]] || ! grep -q '"workspaces"' package.json 2>/dev/null; then
      echo "NEXT: Phase 0 — Initialize Turborepo monorepo (Task 0.1)."
      echo "OWNER: devops + api-backend (scaffold), see docs/agents.md"
      echo "Write: artifacts/tasks/TASK-phase0-monorepo.md"
      exit 0
    fi
    echo "NEXT: Consult docs/MULTI_AGENT_PLAN.md §6 for current phase exit criteria."
    echo "OWNER: orchestrator — create artifacts/tasks/TASK-*.md for the next AC gap"
    ;;

  loop-help)
    print_header
    cat <<'EOF'
Automated loop (for cloud agents):

  1. ./scripts/orchestrate.sh next
  2. Implement as assigned specialist
  3. Run tests (bun test / forge test when available)
  4. On failure: write artifacts/bugs/BUG-YYYYMMDD-NNN.md
  5. Fix → retest (max 5 iterations) → escalate
  6. Deploy only if CI green, no P0 bugs, /health OK, secrets present

Never skip TEST after IMPLEMENT.
EOF
    ;;

  *)
    echo "Usage: $0 {status|next|loop-help}"
    exit 1
    ;;
esac
