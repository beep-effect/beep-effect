#!/usr/bin/env bash
# Stable external adapter; sampling and reporting are owned by Effect Ci tooling.
set -uo pipefail
if (( $# < 2 )) || [[ ! "$1" =~ ^[a-z][a-z0-9-]{0,63}$ ]]; then
  echo 'usage: ci-runner-resources.sh <lane> <command> [args...]' >&2
  exit 64
fi
lane="$1"; shift
# Forward shutdown to the runtime so scoped children and sampler are cleaned up.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bun "$root/packages/tooling/tool/cli/src/bin.ts" -- ci runner-resources "$lane" "$1" -- "${@:2}" <&0 &
child=$!
stop() { trap - INT TERM; kill -TERM "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; exit "$1"; }
trap 'stop 130' INT
trap 'stop 143' TERM
wait "$child"
exit "$?"
