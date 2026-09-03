#!/usr/bin/env bash
# Local inbox adapter for Claude Code, Codex, and Grok-compatible tails.
# The hook never calls GitHub or git. Its hot path reads only .beep/inbox state.
# PreToolUse events inject context without denying tools. Unacknowledged P0 rows
# remain a hard gate only at Stop and SubagentStop.
set -u

harness="${1:-claude}"
payload="$(cat 2>/dev/null || true)"

# A missing parser must not turn inbox bookkeeping into a standing denial.
command -v jq >/dev/null 2>&1 || exit 0

event="$(printf '%s' "$payload" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
session_id="$(printf '%s' "$payload" | jq -r '.session_id // "anonymous"' 2>/dev/null || printf 'anonymous')"

root="${BEEP_YEET_HOOK_ROOT:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$root" ]; then
  root="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
fi
if [ -z "$root" ]; then
  root="$PWD"
fi

# Hooks can fire from a package directory. Walk to the checkout without
# invoking git, so a failure boundary never waits on repository plumbing.
while [ "$root" != "/" ] && [ ! -e "$root/.git" ]; do
  root="${root%/*}"
  [ -n "$root" ] || root="/"
done

inbox="$root/.beep/inbox"
failures="$inbox/failures.ndjson"
active_failures="$inbox/active.ndjson"
active_failures_version="$inbox/active-p0-safe-v2"
if [ -f "$active_failures" ] && [ -f "$active_failures_version" ]; then
  failures="$active_failures"
fi
acks="$inbox/acks"
dispatch="$inbox/dispatch.json"
sessions="$inbox/sessions"

failures_present=true
[ -f "$failures" ] || failures_present=false

# Refuse to follow a local symlink at the evidence boundary. Report the broken
# state as context, but fail open so bookkeeping cannot deadlock repair work.
if [ "$failures_present" = true ] && { [ -L "$failures" ] || [ ! -r "$failures" ]; }; then
  context="yeet inbox state is unreadable. Inspect $failures before trusting the checkout as clear."
  if [ "$event" = "Stop" ] || [ "$event" = "SubagentStop" ]; then
    jq -cn --arg context "$context" '{hookSpecificOutput:{hookEventName:"Stop",additionalContext:$context}}'
  else
    jq -cn --arg event "$event" --arg context "$context" \
      '{hookSpecificOutput:{hookEventName:$event,additionalContext:$context}}'
  fi
  exit 0
fi

mkdir -p "$sessions" 2>/dev/null || exit 0

pretool_tool_name=''
pretool_checkout_mutating=false
if [ "$event" = "PreToolUse" ]; then
  pretool_tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null || true)"
  case "$pretool_tool_name" in
    Bash|Write|Edit|NotebookEdit|MultiEdit|apply_patch) pretool_checkout_mutating=true ;;
    *) pretool_checkout_mutating=false ;;
  esac
fi

parse_timestamp_epoch() {
  timestamp="$1"
  normalized_timestamp="$timestamp"
  case "$normalized_timestamp" in
    *.*Z) normalized_timestamp="${normalized_timestamp%%.*}Z" ;;
  esac
  parsed_epoch="$(date -u -d "$normalized_timestamp" +%s 2>/dev/null || true)"
  if [ -n "$parsed_epoch" ]; then
    printf '%s' "$parsed_epoch"
    return 0
  fi
  parsed_epoch="$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$normalized_timestamp" +%s 2>/dev/null || true)"
  [ -n "$parsed_epoch" ] || return 1
  printf '%s' "$parsed_epoch"
}

active_ack_ids() {
  loaded_ack_ids='[]'
  if [ -d "$acks" ]; then
    for loaded_ack_path in "$acks"/*; do
      [ -e "$loaded_ack_path" ] || continue
      [ -f "$loaded_ack_path" ] && [ ! -L "$loaded_ack_path" ] || continue
      loaded_waive_expiry="$(jq -r 'select(.resolution.kind == "waive") | .resolution.expiresAt // empty' "$loaded_ack_path" 2>/dev/null || true)"
      if [ -n "$loaded_waive_expiry" ]; then
        loaded_expiry_epoch="$(parse_timestamp_epoch "$loaded_waive_expiry" || true)"
        loaded_now_epoch="$(date +%s)"
        if [ -z "$loaded_expiry_epoch" ] || [ "$loaded_expiry_epoch" -le "$loaded_now_epoch" ]; then
          continue
        fi
      fi
      loaded_ack_id="${loaded_ack_path##*/}"
      loaded_ack_ids="$(printf '%s' "$loaded_ack_ids" | jq -c --arg id "$loaded_ack_id" '. + [$id]')"
    done
  fi
  printf '%s' "$loaded_ack_ids"
}

# Serialize per-session seen-state updates when possible. A busy or unavailable
# bookkeeping mutex must not hide inbox context or bypass the Stop P0 decision.
if exec 9>"$inbox/hook-mutex.lock" 2>/dev/null; then
  if command -v flock >/dev/null 2>&1; then
    flock -w 1 9 2>/dev/null || true
  fi
fi

ack_ids="$(active_ack_ids)"

wave='null'
if [ -f "$dispatch" ] && [ ! -L "$dispatch" ] && [ -r "$dispatch" ]; then
  wave="$(jq -c 'select(.schemaVersion == "yeet-dispatch/v1")' "$dispatch" 2>/dev/null || printf 'null')"
  [ -n "$wave" ] || wave='null'
fi

# Decode complete NDJSON rows, keep the first observation for each id, join
# receipt existence and current-head liveness, and drop superseded evidence.
entries='[]'
if [ "$failures_present" = true ]; then
entries="$(jq -Rsc --argjson acks "$ack_ids" --argjson wave "$wave" '
  def valid_id: type == "string" and test("^[A-Za-z0-9._-]+$");
  def decoded_rows:
    split("\n")
    | map(try fromjson catch empty)
    | map(select(.schemaVersion == "yeet-inbox/v1" and (.id | valid_id)))
    | unique_by(.id);
  decoded_rows
  | map(. as $row | select(($acks | index($row.id)) == null))
  | map(. + {
      _liveness: (
        if ($wave | type) != "object" then "unknown"
        elif (.capsule.headSha? == null or .capsule.prNumber? == null) then "unknown"
        elif (.capsule.headSha == $wave.headSha and .capsule.prNumber == $wave.prNumber) then "live"
        else "superseded"
        end
      )
    })
  | map(select(._liveness != "superseded"))
' "$failures" 2>/dev/null || printf '[]')"
fi

session_key="$(printf '%s' "$harness:$session_id" | cksum | awk '{print $1}')"
state_path="$sessions/$harness-$session_key.json"
state='{"schemaVersion":"yeet-hook-session/v1","incidentId":null,"seenIds":[]}'
if [ -f "$state_path" ] && [ ! -L "$state_path" ] && [ -r "$state_path" ]; then
  loaded="$(jq -c 'select(.schemaVersion == "yeet-hook-session/v1")' "$state_path" 2>/dev/null || true)"
  [ -z "$loaded" ] || state="$loaded"
fi

write_state() {
  state_tmp="$(mktemp "$sessions/.yeet-hook-state.XXXXXX" 2>/dev/null || true)"
  [ -n "$state_tmp" ] || return 0
  if printf '%s\n' "$state" >"$state_tmp" 2>/dev/null; then
    mv -f "$state_tmp" "$state_path" 2>/dev/null || true
  else
    rm -f "$state_tmp" 2>/dev/null || true
  fi
}

entry_label='def row_label:
  (.capsule.lane // .capsule.shard // .capsule.threadId // .capsule.base // .kind // "incident") as $label
  | "\(.severity) \($label) [\(.id)]";
def detail:
  row_label +
  (if .capsule.prNumber? != null then " PR #\(.capsule.prNumber)" else "" end) +
  (if .capsule.link? != null then " \(.capsule.link)" else "" end);'

render_context() {
  selected="$1"
  printf '%s' "$selected" | jq -r "$entry_label"'
    "Fix this now. The checkout has unacknowledged Yeet inbox work:\n" +
    (map("- " + detail) | join("\n")) +
    "\nAcknowledge each row with exactly one form: " +
    "`bun run beep yeet inbox ack <id> --fix-sha <sha>`; " +
    "`bun run beep yeet inbox ack <id> --environment-only --reason \"<text>\"`; " +
    "`bun run beep yeet inbox ack <id> --wontfix --reason \"<text>\"`; " +
    "`bun run beep yeet inbox ack <id> --thread-url <url>`; or " +
    "`bun run beep yeet inbox ack <id> --waive --actor <actor> --expires-at <timestamp> --shard <shard> --reason \"<text>\"`."
  '
}

mark_seen() {
  selected="$1"
  ids="$(printf '%s' "$selected" | jq -c 'map(.id)')"
  state="$(printf '%s' "$state" | jq -c --argjson ids "$ids" '.seenIds = ((.seenIds + $ids) | unique)')"
  write_state
}

unseen_for() {
  severities="$1"
  seen="$(printf '%s' "$state" | jq -c '.seenIds // []')"
  printf '%s' "$entries" | jq -c --argjson severities "$severities" --argjson seen "$seen" \
    'map(. as $row | select(($severities | index($row.severity)) != null and ($seen | index($row.id)) == null))'
}

emit_context() {
  selected="$1"
  [ "$(printf '%s' "$selected" | jq 'length')" -gt 0 ] || return 1
  context="$(render_context "$selected")"
  jq -cn --arg event "$event" --arg context "$context" \
    '{hookSpecificOutput:{hookEventName:$event,additionalContext:$context}}'
  mark_seen "$selected"
  return 0
}

first_p0="$(printf '%s' "$entries" | jq -c '[.[] | select(.severity == "P0")][0] // empty')"
if [ -z "$first_p0" ]; then
  state="$(printf '%s' "$state" | jq -c '.incidentId = null')"
  write_state
fi

case "$harness:$event" in
  grok:*|*:GrokTail)
    if [ "$(printf '%s' "$entries" | jq 'length')" -eq 0 ]; then
      printf '[yeet] inbox clear\n'
    else
      printf '%s' "$entries" | jq -r "$entry_label"'"[yeet] inbox", (.[] | "- " + detail)'
    fi
    ;;

  *:SessionStart)
    selected="$(unseen_for '["P0","P1","P2"]')"
    emit_context "$selected" || true
    ;;

  *:UserPromptSubmit)
    selected="$(unseen_for '["P0","P1"]')"
    emit_context "$selected" || true
    ;;

  *:PreToolUse)
    if [ -n "$first_p0" ]; then
      incident_id="$(printf '%s' "$state" | jq -r '.incidentId // empty')"
      row_id="$(printf '%s' "$first_p0" | jq -r '.id')"
      context="$(render_context "[$first_p0]")"
      tool_command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
      p0_new_work=false

      # A2-A3 in goals/ship-velocity/SPEC.md ratified re-arming only for
      # unrelated new work. Agent/Task/spawn_agent can launch checkout-mutating
      # children; Skill, plan/discovery, cancellation, MCP, and unknown tools
      # cannot.
      case "$pretool_tool_name" in
        Agent|Task|spawn_agent)
          p0_new_work=true
          ;;
        Bash)
          case "$tool_command" in
            *"git switch"*|*"git checkout -b"*|*"worktree new"*|*"create-package"*|*"goals bootstrap"*)
              p0_new_work=true
              ;;
          esac
          ;;
      esac

      if [ "$p0_new_work" = true ]; then
        if [ "$incident_id" != "$row_id" ]; then
          state="$(printf '%s' "$state" | jq -c --arg id "$row_id" '.incidentId = $id')"
          write_state
        fi
        deny_context="[p0-new-work] Unacknowledged P0 work keeps this checkout in incident mode. Finish or acknowledge it before starting unrelated Agent/Task/spawn_agent or workspace/bootstrap work.
$context"
        jq -cn --arg context "$deny_context" \
          '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$context}}'
      elif [ "$pretool_checkout_mutating" = true ] && [ "$incident_id" != "$row_id" ]; then
        state="$(printf '%s' "$state" | jq -c --arg id "$row_id" '.incidentId = $id')"
        write_state
        deny_context="[p0-attention] The first checkout-mutating tool after a new P0 gets an explicit reminder.
$context"
        jq -cn --arg context "$deny_context" \
          '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$context}}'
      else
        jq -cn --arg context "$context" \
          '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$context}}'
      fi
    else
      selected="$(unseen_for '["P1"]')"
      emit_context "$selected" || true
    fi
    ;;

  *:Stop|*:SubagentStop)
    if [ -n "$first_p0" ]; then
      context="$(render_context "$entries")"
      jq -cn --arg context "$context" '{decision:"block",reason:$context}'
    else
      printf '{}\n'
    fi
    ;;

  *)
    ;;
esac
