#!/usr/bin/env bash
# Shared noninteractive CI prerequisite; never invoked by the local agent.
set -euo pipefail
if [[ ! -x /usr/bin/bwrap ]]; then
  privilege=()
  if [[ "$EUID" -ne 0 ]]; then
    privilege=(sudo -n)
  fi
  if command -v dnf >/dev/null 2>&1; then
    "${privilege[@]}" dnf install -y bubblewrap
  elif command -v apt-get >/dev/null 2>&1; then
    bash scripts/ci-prune-apt-sources.sh
    "${privilege[@]}" apt-get update
    "${privilege[@]}" apt-get install -y --no-install-recommends bubblewrap
  else
    echo "::error::Producer inspection requires /usr/bin/bwrap; no supported package manager."
    exit 1
  fi
fi
test -x /usr/bin/bwrap
/usr/bin/bwrap --version
