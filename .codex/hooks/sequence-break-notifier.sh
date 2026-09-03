#!/usr/bin/env bash
# Codex and Claude share one schema-owned, content-free notification worker.
# Keeping this adapter tiny prevents the two hook integrations from acquiring
# distinct bracketing, damping, privacy, or transport behavior.

worker="${BASH_SOURCE[0]%/*}/../../.claude/hooks/sequence-break-notifier.sh"
if [ -x "${worker}" ]; then
  exec "${worker}" "$@"
fi

exit 0
