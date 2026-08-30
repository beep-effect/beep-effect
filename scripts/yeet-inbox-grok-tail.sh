#!/usr/bin/env bash
# Print the current checkout inbox in a Grok Monitor-compatible tail pass.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf '{"cwd":"%s","hook_event_name":"GrokTail","session_id":"grok-monitor"}\n' "$repo_root" \
  | BEEP_YEET_HOOK_ROOT="$repo_root" bash "$repo_root/.claude/hooks/yeet-inbox.sh" grok
