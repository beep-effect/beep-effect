#!/usr/bin/env bash
# Codex and Claude share the same machine-wide circuit-breaker implementation.

breaker="${BASH_SOURCE[0]%/*}/../../.claude/hooks/circuit-breaker.sh"
if [ -x "${breaker}" ]; then
  exec "${breaker}" "$@"
fi

exit 69
