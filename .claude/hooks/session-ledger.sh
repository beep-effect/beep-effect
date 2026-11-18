#!/usr/bin/env bash
# SessionStart: record this session's message routes (its presence row) beside
# the session ledger, then print the live session-ledger rows for this
# repository so a resuming session sees where its siblings stopped, then the
# hot Palantiri parcels `beep session open` last staged. Reads the JSON Lines
# file `beep session note` appends to and the staged `hot.json`; appends only
# to the presence file; never runs the CLI, never blocks.
#
# `session-ledger.sh` records a Claude Code session and prints; with `codex`
# as its first argument it records a Codex session and prints nothing (the
# Codex SessionStart hook in `.codex/hooks.json`). The presence row decodes as
# `SessionPresence` (`packages/tooling/tool/cli/src/commands/Session/Route.schemas.ts`).
set -u
command -v jq >/dev/null 2>&1 || exit 0
mode="${1:-claude}"
# The hot parcels file `beep session open` stages (owner-only) under the
# Palantiri state directory: account headroom, lane reds and host pressure,
# one line each with its freshness, as of the time it was written.
print_hot_parcels() {
  hot="${BEEP_PALANTIRI_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/palantiri}/hot.json"
  [ -s "$hot" ] || return 0
  jq -r '
    select(.schemaVersion == "palantiri-hot/v2")
    | "[palantiri] hot parcels as of \(.writtenAt) (bun run beep session open to refresh):",
      (.lines[] | "- \(.parcel): \(.text)")
  ' "$hot" 2>/dev/null || true
}
[ "$mode" = "codex" ] || trap print_hot_parcels EXIT
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
# The routes come from the session's own environment: its session id
# (environment first, then the hook payload on stdin), its entrypoint, and its
# T3 address (T3CODE_THREAD_ID plus this host's T3 environment id). Presence is
# never a claim on the checkout; ownership stays with the ledger.
record_presence() {
  harness="$1"
  input=""
  [ -t 0 ] || input="$(timeout 1 cat 2>/dev/null || true)"
  stdin_sid="$(printf '%s' "$input" | jq -r '.session_id? // empty' 2>/dev/null || true)"
  case "$harness" in
    claude-code)
      sid="${CLAUDE_CODE_SESSION_ID:-$stdin_sid}"
      entry="${CLAUDE_CODE_ENTRYPOINT:-unknown}"
      case "$entry" in claude-desktop | cli | sdk-cli | t3-code) ;; *) entry=unknown ;; esac
      ;;
    *)
      # A Codex worker launched from a Claude shell inherits that session's id;
      # the ledger keys its rows to the launcher, which recorded these routes.
      [ -z "${CLAUDE_CODE_SESSION_ID:-}" ] || return 0
      sid="${CODEX_THREAD_ID:-$stdin_sid}"
      entry=unknown
      [ -z "${T3CODE_THREAD_ID:-}" ] || entry=t3-code
      ;;
  esac
  [ -n "$sid" ] || return 0
  env_file="${T3CODE_HOME:-$HOME/.t3}/userdata/environment-id"
  env_id=""
  if [ -n "${T3CODE_THREAD_ID:-}" ] && [ -r "$env_file" ]; then
    env_id="$(tr -d '[:space:]' <"$env_file")"
  fi
  checkout="$(git -C "$repo_root" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$repo_root")"
  # Detached reads as HEAD, like the ledger; symbolic-ref also names an unborn branch.
  branch="$(git -C "$repo_root" symbolic-ref --short -q HEAD 2>/dev/null)" || branch=HEAD
  (
    umask 077
    mkdir -p "$root" || exit 0
    jq -cn \
      --arg owner "$owner" --arg name "$name" --arg harness "$harness" --arg entry "$entry" \
      --arg sid "$sid" --arg thread "${T3CODE_THREAD_ID:-}" --arg env "$env_id" \
      --arg checkout "$checkout" --arg branch "$branch" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
      {
        schemaVersion: "session-presence/v1",
        repository: { host: "github.com", owner: $owner, name: $name },
        harness: $harness, entrypoint: $entry, sessionId: $sid,
        routes: (
          (if $thread != "" and $env != "" then
            [{ _tag: "t3-thread", environmentId: $env, threadId: $thread, provider: $harness }] else [] end)
          + (if $harness == "claude-code" then [{ _tag: "claude-peer", sessionId: $sid, nameHint: null }] else [] end)
          | if length == 0 then
              [{ _tag: "unroutable", harness: $harness, nativeId: $sid,
                 reason: "Codex outside T3 accepts no inbound message" }]
            else . end
        ),
        checkout: $checkout, branch: $branch, recordedAt: $now
      }' >>"$root/github.com__${owner}__${name}.presence.jsonl"
  ) 2>/dev/null || true
}
if [ "$mode" = "codex" ]; then
  record_presence codex
  exit 0
fi
record_presence claude-code
[ -s "$file" ] || exit 0
# One jq pass over the whole file: each line is parsed on its own with
# `fromjson?`, so a torn or corrupt line drops only itself, and a long
# uncompacted ledger still costs one process.
jq -r -R -s '
  [split("\n")[] | select(length > 0) | (fromjson? // empty) | select(type == "object")]
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
