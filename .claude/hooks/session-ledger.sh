#!/usr/bin/env bash
# SessionStart: print the live session-ledger rows for this repository so a
# resuming session sees where its siblings stopped. Reads the JSON Lines file
# `beep session note` appends to; never blocks, never writes.
set -u
command -v jq >/dev/null 2>&1 || exit 0
repo_root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
origin="$(git -C "$repo_root" config --get remote.origin.url 2>/dev/null || true)"
case "$origin" in
  *github.com[:/]*) ;;
  *) exit 0 ;;
esac
slug="$(printf '%s' "$origin" | sed -E 's#^.*github\.com[:/]##; s#\.git$##; s#/+$##' | tr '[:upper:]' '[:lower:]')"
owner="${slug%%/*}"
name="${slug#*/}"
root="${BEEP_SESSION_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/sessions}"
file="$root/github.com__${owner}__${name}.jsonl"
[ -s "$file" ] || exit 0
jq -r -s '
  map(select(type == "object"))
  | group_by(.checkout)
  | map(max_by(.recordedAt))
  | map(select(.state != "done"))
  | sort_by(.recordedAt) | reverse | .[:12]
  | if length == 0 then empty else
      "[session-ledger] \(length) live session(s) for this repository (bun run beep session open):",
      (.[] | "- \(.state) \(.lane) (\(.branch)\(if .pr then ", PR #\(.pr)" else "" end)) \(.recordedAt): \(.next)")
    end
' "$file" 2>/dev/null || true
exit 0
