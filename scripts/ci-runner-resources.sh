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
# A private launch receipt distinguishes boot failure from a completed lane.
# Only the child wrapper marks it, immediately before executing the lane.
started="$(mktemp)" || { echo '::warning::Runner resource measurement unavailable; running lane directly.' >&2; exec "$@"; }
trap 'rm -f "$started"' EXIT
bun "$root/packages/tooling/tool/cli/src/bin.ts" -- ci runner-resources "$lane" bash -- -c \
  'printf started > "$1"; shift; exec "$@"' beep-ci-resource-start "$started" "$@" <&0 &
child=$!
stop() { trap - INT TERM; kill -TERM "$child" 2>/dev/null || true; wait "$child" 2>/dev/null || true; exit "$1"; }
trap 'stop 130' INT
trap 'stop 143' TERM
wait "$child"
status=$?
if [[ ! -s "$started" ]]; then
  echo '::warning::Runner resource measurement unavailable; running lane directly.' >&2
  rm -f "$started"
  exec "$@"
fi
exit "$status"
