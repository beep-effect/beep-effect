#!/usr/bin/env bash
# Merge-gate table for every open PR. Ported to the repo CLI as `bun run beep yeet gate-table`
# (goals/orchestrator-handoff P2); this wrapper keeps pollers armed before the port working.
# usage: gate.sh [--json]   (the old --no-threads flag is accepted and ignored: drafts read no
# threads and every ready PR's thread count is read, since an unread count is never zero)
set -euo pipefail
args=()
for arg in "$@"; do
  [ "$arg" = "--no-threads" ] || args+=("$arg")
done
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
exec bun run --silent beep yeet gate-table "${args[@]}"
