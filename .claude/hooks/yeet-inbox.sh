#!/usr/bin/env bash
# Local backpressure adapter for Claude Code, Codex, and Grok-compatible tails.
# The hook never calls GitHub or git. Its hot path reads only .beep/inbox state.
# Only Bash, Write, Edit, and NotebookEdit can directly mutate this checkout, so
# lease and one-shot P0 fences apply only to those tools. Harness tools evolve;
# every other name is context-only except the ratified P0 new-work launches.
# A live Yeet lease process descended from this hook's parent belongs to the
# launching harness session; the next unlocked hook refresh records that owner.
set -u

harness="${1:-claude}"
payload="$(cat 2>/dev/null || true)"

# A missing parser must not turn the mutex into a broken standing denial.
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

empty_stop_output() {
  if [ "$event" = "Stop" ] || [ "$event" = "SubagentStop" ]; then
    printf '{}\n'
  fi
}

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
    Bash|Write|Edit|NotebookEdit) pretool_checkout_mutating=true ;;
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

proc_start() {
  proc_pid="$1"
  [ -r "/proc/$proc_pid/stat" ] || return 1
  proc_rest="$(sed 's/^.*) //' "/proc/$proc_pid/stat" 2>/dev/null || true)"
  [ -n "$proc_rest" ] || return 1
  # shellcheck disable=SC2086
  set -- $proc_rest
  eval 'printf "%s" "${20:-}"'
}

proc_state() {
  proc_pid="$1"
  [ -r "/proc/$proc_pid/stat" ] || return 1
  proc_rest="$(sed 's/^.*) //' "/proc/$proc_pid/stat" 2>/dev/null || true)"
  [ -n "$proc_rest" ] || return 1
  # shellcheck disable=SC2086
  set -- $proc_rest
  printf '%s' "${1:-}"
}

proc_parent() {
  proc_pid="$1"
  [ -r "/proc/$proc_pid/stat" ] || return 1
  proc_rest="$(sed 's/^.*) //' "/proc/$proc_pid/stat" 2>/dev/null || true)"
  [ -n "$proc_rest" ] || return 1
  # shellcheck disable=SC2086
  set -- $proc_rest
  [ -n "${2:-}" ] || return 1
  printf '%s' "$2"
}

proc_has_ancestor() {
  lineage_pid="$1"
  lineage_ancestor="$2"
  case "$lineage_pid" in ''|*[!0-9]*) return 1 ;; esac
  case "$lineage_ancestor" in ''|*[!0-9]*) return 1 ;; esac
  lineage_depth=0
  while [ "$lineage_pid" -gt 1 ] && [ "$lineage_depth" -lt 64 ]; do
    [ "$lineage_pid" = "$lineage_ancestor" ] && return 0
    lineage_parent="$(proc_parent "$lineage_pid" || true)"
    case "$lineage_parent" in ''|*[!0-9]*) return 1 ;; esac
    [ "$lineage_parent" != "$lineage_pid" ] || return 1
    lineage_pid="$lineage_parent"
    lineage_depth="$((lineage_depth + 1))"
  done
  [ "$lineage_pid" = "$lineage_ancestor" ]
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

unacked_stop_p0_rows() {
  [ "$failures_present" = true ] || { printf '[]'; return 0; }
  stop_ack_ids="$(active_ack_ids)"
  stop_wave='null'
  if [ -f "$dispatch" ] && [ ! -L "$dispatch" ] && [ -r "$dispatch" ]; then
    stop_wave="$(jq -c 'select(.schemaVersion == "yeet-dispatch/v1")' "$dispatch" 2>/dev/null || printf 'null')"
    [ -n "$stop_wave" ] || stop_wave='null'
  fi
  jq -Rsc --argjson acks "$stop_ack_ids" --argjson wave "$stop_wave" '
    split("\n")
    | map(try fromjson catch empty)
    | map(select(.schemaVersion == "yeet-inbox/v1" and .severity == "P0"))
    | unique_by(.id)
    | map(. as $row | select(($acks | index($row.id)) == null))
    | map(select(
        ($wave | type) != "object"
        or .capsule.headSha? == null
        or .capsule.prNumber? == null
        or (.capsule.headSha == $wave.headSha and .capsule.prNumber == $wave.prNumber)
      ))
  ' "$failures" 2>/dev/null || printf '[]'
}

block_stop_while_mutex_unavailable() {
  if [ "$event" != "Stop" ] && [ "$event" != "SubagentStop" ]; then
    return 0
  fi
  stop_rows="$(unacked_stop_p0_rows)"
  [ "$(printf '%s' "$stop_rows" | jq 'length')" -gt 0 ] || { printf '{}\n'; return 0; }
  stop_context="$(printf '%s' "$stop_rows" | jq -r '
    "Fix this now. The checkout has unacknowledged Yeet inbox work:\n" +
    (map("- " + .severity + " " + (.capsule.lane // .capsule.shard // .kind // "incident") + " [" + .id + "]") | join("\n"))
  ')"
  jq -cn --arg context "$stop_context" '{decision:"block",reason:$context}'
}

deny_mutating_nonowner_while_mutex_unavailable() {
  [ "$pretool_checkout_mutating" = true ] || return 0
  unavailable_lease="$inbox/pr-lease.json"
  [ -f "$unavailable_lease" ] && [ ! -L "$unavailable_lease" ] && [ -r "$unavailable_lease" ] || return 0
  unavailable_status="$(jq -r 'select(.schemaVersion == "yeet-pr-lease/v1") | .status // "active"' "$unavailable_lease" 2>/dev/null || true)"
  case "$unavailable_status" in active|claiming) ;; *) return 0 ;; esac
  unavailable_session="$(jq -r '.sessionId // empty' "$unavailable_lease" 2>/dev/null || true)"
  unavailable_pid="$(jq -r '.pid // empty' "$unavailable_lease" 2>/dev/null || true)"
  unavailable_start="$(jq -r '.procStart // empty' "$unavailable_lease" 2>/dev/null || true)"
  current_start="$(proc_start "$PPID" || true)"
  unavailable_observed_start="$(proc_start "$unavailable_pid" || true)"
  if [ "$unavailable_session" = "$harness:$session_id" ] || {
    [ "$unavailable_pid" = "$PPID" ] && [ -n "$current_start" ] && [ "$unavailable_start" = "$current_start" ];
  } || {
    [ -n "$unavailable_observed_start" ] && [ "$unavailable_start" = "$unavailable_observed_start" ] &&
      proc_has_ancestor "$unavailable_pid" "$PPID";
  }; then
    return 0
  fi
  context="[lease-mutex-busy] Published PR ownership cannot be verified while its mutex is busy. Retry this checkout-mutating tool after the active ownership generation settles."
  jq -cn --arg context "$context" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$context}}'
}

# Every adapter shares this checkout-local critical section. A contended or
# unavailable lock fails closed for non-owner mutation and retries at the next
# hook boundary.
exec 9>"$inbox/hook-mutex.lock" 2>/dev/null || {
  deny_mutating_nonowner_while_mutex_unavailable
  block_stop_while_mutex_unavailable
  exit 0
}
if command -v flock >/dev/null 2>&1; then
  if ! flock -w 1 9 2>/dev/null; then
    deny_mutating_nonowner_while_mutex_unavailable
    block_stop_while_mutex_unavailable
    exit 0
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
    "\nAcknowledge each row with `bun run beep yeet inbox ack <id> --fix-sha <sha>`, or use a reasoned wontfix/thread receipt."
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

# Published-PR ownership is a separate generation from the inbox session
# state. Hooks refresh the current owner, CAS-take over a dead/frozen owner,
# and fence mutations from a zombie session that lost ownership.
pr_lease="$inbox/pr-lease.json"
pr_lease_retirements="$inbox/pr-lease-retirements"
current_owner_pid="$PPID"

current_proc_start="$(proc_start "$current_owner_pid" || true)"
current_lease_session="$harness:$session_id"
lease_generation=''
lease_status=''
lease_session=''
lease_pid=''
lease_proc_start=''
lease_owner_alive=false
lease_owner_frozen=false
lease_owner_stale=false
lease_owned_by_current=false

load_pr_lease() {
  lease_generation=''
  lease_status=''
  [ -f "$pr_lease" ] && [ ! -L "$pr_lease" ] && [ -r "$pr_lease" ] || return 1
  lease_generation="$(jq -r 'select(.schemaVersion == "yeet-pr-lease/v1") | .generationId // empty' "$pr_lease" 2>/dev/null || true)"
  [ -n "$lease_generation" ] || return 1
  lease_status="$(jq -r '.status // "active"' "$pr_lease" 2>/dev/null || true)"
  case "$lease_status" in
    active|claiming) ;;
    *) lease_generation=''; return 1 ;;
  esac
  lease_session="$(jq -r '.sessionId // empty' "$pr_lease")"
  lease_pid="$(jq -r '.pid // empty' "$pr_lease")"
  lease_proc_start="$(jq -r '.procStart // empty' "$pr_lease")"
  lease_refreshed_at="$(jq -r '.refreshedAt // empty' "$pr_lease")"
  observed_start="$(proc_start "$lease_pid" || true)"
  observed_state="$(proc_state "$lease_pid" || true)"
  refreshed_epoch="$(parse_timestamp_epoch "$lease_refreshed_at" || true)"
  stale_seconds="${BEEP_YEET_LEASE_STALE_SECONDS:-240}"
  if [ -n "$refreshed_epoch" ] && [ "$(( $(date +%s) - refreshed_epoch ))" -ge "$stale_seconds" ]; then
    lease_owner_stale=true
  else
    lease_owner_stale=false
  fi
  if [ -n "$observed_start" ] && [ "$observed_start" = "$lease_proc_start" ]; then
    lease_owner_alive=true
  else
    lease_owner_alive=false
  fi
  case "$observed_state" in
    T|t) lease_owner_frozen=true ;;
    *) lease_owner_frozen=false ;;
  esac
  if [ "$lease_session" = "$current_lease_session" ] || {
    [ "$lease_pid" = "$current_owner_pid" ] && [ -n "$current_proc_start" ] && [ "$lease_proc_start" = "$current_proc_start" ];
  } || {
    [ "$lease_owner_alive" = true ] && proc_has_ancestor "$lease_pid" "$current_owner_pid";
  }; then
    lease_owned_by_current=true
  else
    lease_owned_by_current=false
  fi
  return 0
}

apply_pr_lease_retirement_requests() {
  [ -d "$pr_lease_retirements" ] && [ ! -L "$pr_lease_retirements" ] || return 0
  for retirement_path in "$pr_lease_retirements"/*.json; do
    [ -e "$retirement_path" ] || continue
    [ -f "$retirement_path" ] && [ ! -L "$retirement_path" ] && [ -r "$retirement_path" ] || continue
    retirement_request="$(jq -c '
      select(
        .schemaVersion == "yeet-pr-lease-retirement/v1"
        and (.generationId | type) == "string"
        and (.headSha | type) == "string"
        and (.prNumber | type) == "number"
        and (.reason | type) == "string"
      )
    ' "$retirement_path" 2>/dev/null || true)"
    [ -n "$retirement_request" ] || continue
    if [ ! -f "$pr_lease" ] || [ -L "$pr_lease" ] || [ ! -r "$pr_lease" ]; then
      rm -f "$retirement_path" 2>/dev/null || true
      continue
    fi
    retirement_generation="$(printf '%s' "$retirement_request" | jq -r '.generationId')"
    retirement_head="$(printf '%s' "$retirement_request" | jq -r '.headSha')"
    retirement_pr="$(printf '%s' "$retirement_request" | jq -r '.prNumber | tostring')"
    retirement_reason="$(printf '%s' "$retirement_request" | jq -r '.reason')"
    observed_lease="$(jq -c 'select(.schemaVersion == "yeet-pr-lease/v1")' "$pr_lease" 2>/dev/null || true)"
    [ -n "$observed_lease" ] || continue
    observed_generation="$(printf '%s' "$observed_lease" | jq -r '.generationId // empty')"
    observed_status="$(printf '%s' "$observed_lease" | jq -r '.status // "active"')"
    if [ "$observed_generation" != "$retirement_generation" ] || [ "$observed_status" = "retired" ]; then
      rm -f "$retirement_path" 2>/dev/null || true
      continue
    fi
    [ "$observed_status" = "active" ] || continue
    observed_head="$(printf '%s' "$observed_lease" | jq -r '.headSha // empty')"
    observed_pr="$(printf '%s' "$observed_lease" | jq -r '.prNumber // empty | tostring')"
    [ "$observed_head" = "$retirement_head" ] && [ "$observed_pr" = "$retirement_pr" ] || continue
    lease_tmp="$(mktemp "$inbox/.pr-lease-retired.XXXXXX" 2>/dev/null || true)"
    [ -n "$lease_tmp" ] || continue
    retired_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if jq -c \
      --arg generation "$retirement_generation" \
      --arg head "$retirement_head" \
      --arg pr "$retirement_pr" \
      --arg retired_at "$retired_at" \
      --arg reason "$retirement_reason" \
      'select(
         .generationId == $generation
         and .headSha == $head
         and (.prNumber | tostring) == $pr
         and (.status // "active") == "active"
       )
       | .status = "retired"
       | .retiredAt = $retired_at
       | .refreshedAt = $retired_at
       | .retireReason = ("requested:" + $reason)' \
      "$pr_lease" >"$lease_tmp" 2>/dev/null && [ -s "$lease_tmp" ] && mv -f "$lease_tmp" "$pr_lease" 2>/dev/null; then
      rm -f "$retirement_path" 2>/dev/null || true
    else
      rm -f "$lease_tmp" 2>/dev/null || true
    fi
  done
}

write_pr_lease_generation() {
  expected_generation="$1"
  takeover_reason="${2:-}"
  load_pr_lease || return 0
  [ "$lease_generation" = "$expected_generation" ] || return 0
  lease_tmp="$(mktemp "$inbox/.pr-lease.XXXXXX" 2>/dev/null || true)"
  [ -n "$lease_tmp" ] || return 0
  now_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  next_generation="$expected_generation"
  if [ -n "$takeover_reason" ]; then
    next_generation="$session_key-$(date +%s)"
  fi
  if jq -c \
    --arg expected "$expected_generation" \
    --arg generation "$next_generation" \
    --arg session "$current_lease_session" \
    --argjson pid "$current_owner_pid" \
    --arg proc_start "$current_proc_start" \
    --arg now "$now_iso" \
    --arg reason "$takeover_reason" \
    'select(.generationId == $expected)
     | .generationId = $generation
     | .sessionId = $session
     | .pid = $pid
     | .procStart = $proc_start
     | .refreshedAt = $now
     | .status = "active"
     | if $reason == "" then . else .takeoverOf = $expected | .takeoverReason = $reason end' \
    "$pr_lease" >"$lease_tmp" 2>/dev/null; then
    mv -f "$lease_tmp" "$pr_lease" 2>/dev/null || true
  else
    rm -f "$lease_tmp" 2>/dev/null || true
  fi
}

apply_pr_lease_retirement_requests

if load_pr_lease; then
  observed_generation="$lease_generation"
  if [ "$lease_owned_by_current" = true ]; then
    write_pr_lease_generation "$observed_generation"
  elif [ "$lease_owner_stale" = true ] && {
    [ "$lease_owner_alive" = false ] || [ "$lease_owner_frozen" = true ];
  }; then
    # This hook invocation is the resumed owner: the hook mutex is the CAS
    # boundary. Recovery must not depend on a hosted failure capsule because a
    # hard-killed early publisher can strand its lease before any P0 exists.
    write_pr_lease_generation "$observed_generation" "stale-dead-or-frozen"
  fi
  load_pr_lease || true
fi

if [ "$pretool_checkout_mutating" = true ] && [ -n "$lease_generation" ] && [ "$lease_owned_by_current" = false ]; then
  context="[lease-nonowner] Published PR ownership belongs to session $lease_session (pid $lease_pid). This session lost lease generation $lease_generation and is fenced from checkout-mutating tools."
  jq -cn --arg context "$context" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$context}}'
  exit 0
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
      # unrelated new work. Agent/Task can launch checkout-mutating children;
      # Skill, plan/discovery, cancellation, MCP, and unknown tools cannot.
      case "$pretool_tool_name" in
        Agent|Task)
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
        deny_context="[p0-new-work] Unacknowledged P0 work keeps this checkout in incident mode; starting unrelated Agent/Task or workspace/bootstrap work is blocked until ACK.
$context"
        jq -cn --arg context "$deny_context" \
          '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$context}}'
      elif [ "$pretool_checkout_mutating" = true ] && [ "$incident_id" != "$row_id" ]; then
        state="$(printf '%s' "$state" | jq -c --arg id "$row_id" '.incidentId = $id')"
        write_state
        deny_context="[p0-attention] The first checkout-mutating tool after a new P0 is interrupted once.
$context"
        jq -cn --arg context "$deny_context" \
          '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$context}}'
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
