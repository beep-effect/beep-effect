#!/usr/bin/env bash
# beep-worker-graft-guard/v1
# Installed as ~/.local/bin/graft; native vendor CLI stays intact.
set -euo pipefail
unset SSH_AUTH_SOCK

vendor_file="$HOME/.config/beep/graft-guard/vendor-path"
if [[ ! -r "$vendor_file" ]]; then
  printf '%s\n' 'graft guard: missing vendor-path configuration.' >&2
  exit 78
fi
IFS= read -r vendor < "$vendor_file"
if [[ ! -x "$vendor" || "$vendor" == "$0" ]]; then
  printf '%s\n' 'graft guard: native CLI unavailable; reconcile the installed vendor path.' >&2
  exit 78
fi

# Only unambiguous help/version forms bypass the scope. A literal query or an
# option value named --help must not accidentally bypass graph limits.
if (( $# == 0 )); then
  exec "$vendor"
fi
if (( $# == 1 )); then
  case "$1" in
    --help|-h|--version|-v|help) exec "$vendor" "$@" ;;
  esac
fi
if (( $# == 2 )) && [[ "$2" == --help || "$2" == -h ]]; then
  case "$1" in
    build|ask|skeleton|check|stats|viz|mcp|callers|blast|grep|map|init|uninstall|trail|telemetry|upgrade|version|help|claude-md)
      exec "$vendor" "$@"
      ;;
  esac
fi

# Maintenance subprocesses often receive only HOME/PATH. Derive the user bus
# address without depending on the graphical shell's environment.
runtime_uid="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$runtime_uid}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
if ! systemctl --user cat beep-graft.slice >/dev/null 2>&1; then
  printf '%s\n' 'graft guard: user bus or beep-graft.slice unavailable; refusing unbounded execution.' >&2
  exit 69
fi

command_name=''
skip_value=0
for arg in "$@"; do
  if (( skip_value )); then
    skip_value=0
    continue
  fi
  case "$arg" in
    --dir|--provider|--model|--api-key|--base-url) skip_value=1 ;;
    --*=*|-*) ;;
    *) command_name="$arg"; break ;;
  esac
done

scope_args=(
  --user --scope --quiet --collect
  "--unit=beep-graft-command-$$"
  --slice=beep-graft.slice
  --property=MemoryMax=8G
  --property=MemorySwapMax=256M
  --property=OOMPolicy=kill
  --property=TimeoutStopSec=15s
)
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=6144"

# Servers retain their lifetime, but share the same resource ceiling. Finite
# commands also have a systemd deadline and an outer timeout as a backstop.
case "$command_name" in
  mcp|viz)
    exec systemd-run "${scope_args[@]}" "$vendor" "$@"
    ;;
  *)
    exec timeout --signal=TERM --kill-after=15s 615 \
      systemd-run "${scope_args[@]}" --property=RuntimeMaxSec=600s \
      "$vendor" "$@"
    ;;
esac
