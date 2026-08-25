#!/usr/bin/env bash
#
# Runs a forge subcommand, or explains why it did not.
#
# Solidity lives in the same monorepo as the TypeScript, so `bun run build` at
# the root reaches this package. Foundry is a separate toolchain that most
# contributors will not have installed, and a missing optional toolchain should
# not turn the whole monorepo build red.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v forge >/dev/null 2>&1; then
  if [ -x "$HOME/.foundry/bin/forge" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
  else
    echo "SKIPPED (@anyx/contracts): foundry is not installed."
    echo "  Install it with: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 0
  fi
fi

if [ ! -d lib/forge-std ] || [ ! -d lib/openzeppelin-contracts ]; then
  echo "SKIPPED (@anyx/contracts): Solidity dependencies are not installed."
  echo "  Install them with: bun run --cwd packages/contracts deps"
  exit 0
fi

exec forge "$@"
