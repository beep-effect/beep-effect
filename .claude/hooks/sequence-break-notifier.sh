#!/usr/bin/env bash
# sequence-break-notifier: content-free, fail-open notification worker for one
# HookPulseV1 PermissionRequest row. hook-pulse.sh starts this process only after
# its canonical row is durable, and passes only schema-owned identifiers/enums.
# The worker never receives prompt, command, tool-input, tool-result, message, or
# error content.

# PermissionRequest hook stdout can decide the permission. This worker is
# detached, but closing both output streams keeps that safety invariant local and
# makes a future direct hook registration harmless rather than surprising.
exec 1>/dev/null 2>/dev/null

set -uo pipefail

# Every path is fail-open. A notifier defect must not answer, deny, delay, or
# otherwise perturb the coding-agent permission decision.
trap 'trap - EXIT; exit 0' EXIT

agent_kind="${1:-}"
session_id="${2:-}"
request_ts="${3:-}"
wait_reason="${4:-}"
target="${5:-}"
tool_name="${6:-}"
notifier_rev="${7:-}"

BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
disarm_sentinel="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"

# The shared kill switch wins before dependencies, state directories, or
# transports are consulted. A disarmed instrument does not write a misleading
# "skipped" row claiming it observed the event.
if [ -e "${disarm_sentinel}" ]; then
  exit 0
fi

case "${agent_kind}" in
  claude-code | codex-cli) ;;
  *) exit 0 ;;
esac
case "${session_id}" in
  "" | *[!0-9a-f]*) exit 0 ;;
esac
[ "${#session_id}" -eq 64 ] || exit 0
case "${tool_name}" in
  "" | *[!A-Za-z0-9_.:-]*) exit 0 ;;
esac
case "${notifier_rev}" in
  "" | log-only-0) exit 0 ;;
esac

# Target and waitReason are redundant on purpose. The schema repeats this check,
# and the worker refuses a disagreement before it can notify the operator about
# a wait class the flight recorder did not observe.
case "${target}:${wait_reason}" in
  human-input:tool-permission | plan-approval:plan-approval | tool-permission:tool-permission) ;;
  *) exit 0 ;;
esac

for dependency in jq gawk sort date flock mktemp mv mkdir; do
  command -v "${dependency}" >/dev/null 2>&1 || exit 0
done

request_epoch_ms="$(date -u -d "${request_ts}" +%s%3N 2>/dev/null)" || exit 0
case "${request_epoch_ms}" in
  "" | *[!0-9]*) exit 0 ;;
esac

state_root="${BEEP_AGENT_EVIDENCE_ROOT}/sequence-break"
ledger_dir="${state_root}/notification-events"
damping_dir="${state_root}/damping"
hook_ledger_dir="${BEEP_AGENT_EVIDENCE_ROOT}/hook-events"
mkdir -p "${ledger_dir}" "${damping_dir}" || exit 0

now_epoch_ms() {
  date -u +%s%3N
}

now_iso() {
  local value
  value="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  case "${value}" in
    *N*) date -u +%Y-%m-%dT%H:%M:%SZ ;;
    *) printf '%s' "${value}" ;;
  esac
}

age_ms() {
  local current age
  current="$(now_epoch_ms)" || return 1
  age=$((current - request_epoch_ms))
  if [ "${age}" -lt 0 ]; then
    age=0
  fi
  printf '%s' "${age}"
}

append_delivery() {
  local transport="${1}"
  local stage="${2}"
  local status="${3}"
  local reason="${4:-}"
  local measured_age="${5}"
  local ts day delivery row shard_path

  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi

  case "${transport}" in desktop | ntfy) ;; *) return 0 ;; esac
  case "${stage}" in initial | reminder | urgent) ;; *) return 0 ;; esac
  case "${status}" in sent | skipped | failed) ;; *) return 0 ;; esac
  case "${measured_age}" in "" | *[!0-9]*) return 0 ;; esac

  ts="$(now_iso)" || return 0
  day="${ts:0:10}"
  case "${status}" in
    sent)
      delivery='{"status":"sent"}'
      ;;
    skipped)
      case "${reason}" in
        transport-unconfigured | storm-damped | circuit-open | bracket-resolved | bracket-unattributed | coordination-unavailable | instrument-disarmed) ;;
        *) reason="coordination-unavailable" ;;
      esac
      delivery="$(jq -cn --arg reason "${reason}" '{status:"skipped",reason:$reason}')" || return 0
      ;;
    failed)
      case "${reason}" in command-unavailable | command-failed | timeout | unknown) ;; *) reason="unknown" ;; esac
      delivery="$(jq -cn --arg reason "${reason}" '{status:"failed",reason:$reason}')" || return 0
      ;;
  esac

  row="$(
    jq -cn \
      --arg schemaVersion "sequence-break-notification/v1" \
      --arg ts "${ts}" \
      --arg requestTs "${request_ts}" \
      --arg sessionId "${session_id}" \
      --arg agentKind "${agent_kind}" \
      --arg notifierRev "${notifier_rev}" \
      --arg target "${target}" \
      --arg waitReason "${wait_reason}" \
      --arg stage "${stage}" \
      --argjson ageMs "${measured_age}" \
      --arg transport "${transport}" \
      --argjson delivery "${delivery}" \
      '{
        schemaVersion:$schemaVersion,
        ts:$ts,
        requestTs:$requestTs,
        sessionId:$sessionId,
        agentKind:$agentKind,
        notifierRev:$notifierRev,
        target:$target,
        waitReason:$waitReason,
        stage:$stage,
        ageMs:$ageMs,
        evidenceTier:"derived",
        transport:$transport,
        delivery:$delivery
      }'
  )" || return 0

  shard_path="${ledger_dir}/sequence-break-${day}-${session_id}.ndjson"
  printf '%s\n' "${row}" >>"${shard_path}" 2>/dev/null || true
}

append_pair_skipped() {
  local stage="${1}"
  local reason="${2}"
  local measured_age
  measured_age="$(age_ms)" || measured_age=0
  append_delivery desktop "${stage}" skipped "${reason}" "${measured_age}"
  append_delivery ntfy "${stage}" skipped "${reason}" "${measured_age}"
}

# Replays one session's HookPulseV1 rows with the PLAN.md two-hop rule and
# returns only the state of this exact PermissionRequest timestamp. Each request
# claims the nearest preceding unpaired PreToolUse for the same tool; only that
# toolUseId's terminal event can close it. SessionEnd tombstones open brackets.
bracket_status() {
  local files=()
  shopt -s nullglob
  files=("${hook_ledger_dir}"/hook-pulse-*-${session_id}.ndjson)
  shopt -u nullglob
  if [ "${#files[@]}" -eq 0 ]; then
    printf 'unknown'
    return 0
  fi

  jq -r --arg session "${session_id}" --arg agent "${agent_kind}" '
      select(.sessionId == $session and .agentKind == $agent)
      | [
          .ts,
          (if .hookEvent == "PreToolUse" then 1
           elif .hookEvent == "PermissionRequest" then 2
           elif (.hookEvent == "PostToolUse" or .hookEvent == "PostToolUseFailure" or .hookEvent == "PermissionDenied") then 3
           else 4 end),
          .hookEvent,
          (.toolName // ""),
          (.toolUseId // "")
        ] | @tsv
    ' "${files[@]}" 2>/dev/null \
    | LC_ALL=C sort -t $'\t' -k1,1 -k2,2n \
    | gawk -F '\t' -v targetTs="${request_ts}" -v targetTool="${tool_name}" '
        function key2(a,b) { return a SUBSEP b }
        function key3(a,b,c) { return a SUBSEP b SUBSEP c }
        {
          ts=$1; event=$3; tool=$4; toolUseId=$5
          if (event == "PreToolUse" && tool != "" && toolUseId != "") {
            stack=tool
            top[stack]++
            stackId[key2(stack,top[stack])]=toolUseId
            status[toolUseId]="unpaired"
          } else if (event == "PermissionRequest") {
            stack=tool
            found=""
            for (position=top[stack]; position>=1; position--) {
              candidate=stackId[key2(stack,position)]
              if (status[candidate] == "unpaired") {
                found=candidate
                break
              }
            }
            if (found != "") {
              status[found]="claimed"
              if (ts == targetTs && tool == targetTool) {
                targetMatches++
                targetId=found
              }
            } else if (ts == targetTs && tool == targetTool) {
              targetMatches++
              targetUnattributed=1
            }
          } else if ((event == "PostToolUse" || event == "PostToolUseFailure" || event == "PermissionDenied") && toolUseId != "") {
            if (status[toolUseId] == "claimed") status[toolUseId]="closed"
            else if (status[toolUseId] == "unpaired") status[toolUseId]="closed-auto"
          } else if (event == "SessionEnd") {
            for (candidate in status) if (status[candidate] == "claimed") status[candidate]="tombstoned"
          }
        }
        END {
          if (targetMatches != 1 || targetUnattributed == 1 || targetId == "") print "unknown"
          else if (status[targetId] == "claimed") print "open"
          else print "resolved"
        }
      '
}

initial_status="$(bracket_status)" || initial_status="unknown"
case "${initial_status}" in
  resolved)
    append_pair_skipped initial bracket-resolved
    exit 0
    ;;
  open) ;;
  *)
    append_pair_skipped initial bracket-unattributed
    exit 0
    ;;
esac

# One lock covers the read/compare/write claim. The state is shared across every
# clone and worktree, so a test-then-write sequence here would be the same TOCTOU
# class already retired from the kill switch.
damping_key="${session_id}-${target}"
damping_lock="${damping_dir}/${damping_key}.lock"
damping_state="${damping_dir}/${damping_key}.json"
exec 9>>"${damping_lock}" || {
  append_pair_skipped initial coordination-unavailable
  exit 0
}
if ! flock -w 1 9; then
  append_pair_skipped initial coordination-unavailable
  exit 0
fi

storm_seconds="${BEEP_SEQUENCE_BREAK_STORM_SECONDS:-900}"
case "${storm_seconds}" in "" | *[!0-9]*) storm_seconds=900 ;; esac
current_ms="$(now_epoch_ms)" || current_ms="${request_epoch_ms}"
expires_ms=0
if [ -f "${damping_state}" ]; then
  expires_ms="$(jq -r '.expiresEpochMs // 0' "${damping_state}" 2>/dev/null)"
  case "${expires_ms}" in "" | *[!0-9]*) expires_ms=0 ;; esac
fi
if [ "${current_ms}" -lt "${expires_ms}" ]; then
  flock -u 9 || true
  append_pair_skipped initial storm-damped
  exit 0
fi

expires_ms=$((current_ms + storm_seconds * 1000))
damping_tmp="$(mktemp "${damping_state}.XXXXXX")" || {
  flock -u 9 || true
  append_pair_skipped initial coordination-unavailable
  exit 0
}
if ! jq -cn \
  --arg schemaVersion "sequence-break-damping/v1" \
  --arg sessionId "${session_id}" \
  --arg target "${target}" \
  --arg notifierRev "${notifier_rev}" \
  --argjson claimedEpochMs "${current_ms}" \
  --argjson expiresEpochMs "${expires_ms}" \
  '{schemaVersion:$schemaVersion,sessionId:$sessionId,target:$target,notifierRev:$notifierRev,claimedEpochMs:$claimedEpochMs,expiresEpochMs:$expiresEpochMs}' \
  >"${damping_tmp}" 2>/dev/null; then
  rm -f "${damping_tmp}"
  flock -u 9 || true
  append_pair_skipped initial coordination-unavailable
  exit 0
fi
if ! mv "${damping_tmp}" "${damping_state}"; then
  rm -f "${damping_tmp}"
  flock -u 9 || true
  append_pair_skipped initial coordination-unavailable
  exit 0
fi
flock -u 9 || true

notification_title() {
  case "${target}" in
    human-input) printf 'Coding agent needs your input' ;;
    plan-approval) printf 'Coding agent plan is awaiting approval' ;;
    tool-permission) printf 'Coding agent needs permission' ;;
  esac
}

notification_body() {
  local stage="${1}"
  local measured_age="${2}"
  local age_minutes=$((measured_age / 60000))
  case "${stage}" in
    initial) printf 'A human decision is blocking progress now.' ;;
    reminder) printf 'The human decision has been waiting for %s minutes.' "${age_minutes}" ;;
    urgent) printf 'The human decision is still blocked after %s minutes.' "${age_minutes}" ;;
  esac
}

deliver_desktop() {
  local stage="${1}"
  local measured_age="${2}"
  local urgency title body exit_code runtime_dir bus_address
  if [ "${BEEP_SEQUENCE_BREAK_DESKTOP_ENABLED:-1}" != "1" ]; then
    append_delivery desktop "${stage}" skipped transport-unconfigured "${measured_age}"
    return 0
  fi
  command -v notify-send >/dev/null 2>&1 || {
    append_delivery desktop "${stage}" failed command-unavailable "${measured_age}"
    return 0
  }
  command -v timeout >/dev/null 2>&1 || {
    append_delivery desktop "${stage}" failed command-unavailable "${measured_age}"
    return 0
  }
  case "${stage}" in initial) urgency=normal ;; reminder | urgent) urgency=critical ;; esac
  title="$(notification_title)"
  body="$(notification_body "${stage}" "${measured_age}")"

  # Terminal and background agent processes on this workstation do not always
  # inherit the graphical session variables even though the Plasma user bus is
  # live. Reconstruct only the conventional same-UID bus address, and refuse if
  # its socket is absent; no display name or session content enters evidence.
  runtime_dir="${XDG_RUNTIME_DIR:-}"
  if [ -z "${runtime_dir}" ]; then
    command -v id >/dev/null 2>&1 || {
      append_delivery desktop "${stage}" failed command-unavailable "${measured_age}"
      return 0
    }
    runtime_dir="/run/user/$(id -u)"
  fi
  bus_address="${DBUS_SESSION_BUS_ADDRESS:-}"
  if [ -z "${bus_address}" ]; then
    if [ ! -S "${runtime_dir}/bus" ]; then
      append_delivery desktop "${stage}" failed command-failed "${measured_age}"
      return 0
    fi
    bus_address="unix:path=${runtime_dir}/bus"
  fi

  # Recheck at the transport boundary, after all setup that can consume time.
  # The stage-level check alone is insufficient if disarm races bus discovery.
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi
  if XDG_RUNTIME_DIR="${runtime_dir}" DBUS_SESSION_BUS_ADDRESS="${bus_address}" \
    timeout 2s notify-send --app-name="beep agent" --urgency="${urgency}" --expire-time=0 "${title}" "${body}"; then
    append_delivery desktop "${stage}" sent "" "${measured_age}"
  else
    exit_code=$?
    if [ "${exit_code}" -eq 124 ]; then
      append_delivery desktop "${stage}" failed timeout "${measured_age}"
    else
      append_delivery desktop "${stage}" failed command-failed "${measured_age}"
    fi
  fi
}

deliver_ntfy() {
  local stage="${1}"
  local measured_age="${2}"
  local base_url="${BEEP_SEQUENCE_BREAK_NTFY_BASE_URL:-https://ntfy.sh}"
  local topic="${BEEP_SEQUENCE_BREAK_NTFY_TOPIC:-}"
  local token="${BEEP_SEQUENCE_BREAK_NTFY_TOKEN:-}"
  local title body priority exit_code

  # Keep secret-bearing configuration out of every child process. The local
  # copies stay in this worker only; curl receives the topic over JSON stdin and
  # an optional bearer header over an inherited file descriptor.
  unset BEEP_SEQUENCE_BREAK_NTFY_TOPIC BEEP_SEQUENCE_BREAK_NTFY_TOKEN

  case "${topic}" in "" | *[!A-Za-z0-9_-]*)
    append_delivery ntfy "${stage}" skipped transport-unconfigured "${measured_age}"
    return 0
    ;;
  esac
  case "${base_url}" in https://*) ;; *)
    append_delivery ntfy "${stage}" skipped transport-unconfigured "${measured_age}"
    return 0
    ;;
  esac
  case "${base_url}${token}" in *$'\n'* | *$'\r'*)
    append_delivery ntfy "${stage}" skipped transport-unconfigured "${measured_age}"
    return 0
    ;;
  esac
  command -v curl >/dev/null 2>&1 || {
    append_delivery ntfy "${stage}" failed command-unavailable "${measured_age}"
    return 0
  }

  # Consult the shared network breaker before publishing. The probe deliberately
  # does not use `--fail`: any HTTP response proves the route is reachable,
  # while DNS/connect/TLS/timeout failures trip the machine-wide circuit. Topic,
  # token, and notification body never enter the probe or its ledger.
  local breaker_path="${BASH_SOURCE[0]%/*}/circuit-breaker.sh"
  local probe_exit
  if [ ! -x "${breaker_path}" ]; then
    append_delivery ntfy "${stage}" failed command-unavailable "${measured_age}"
    return 0
  fi
  if "${breaker_path}" run network hook -- \
    curl --silent --show-error --max-time 3 --output /dev/null "${base_url%/}/" \
    >/dev/null 2>&1; then
    probe_exit=0
  else
    probe_exit=$?
  fi
  case "${probe_exit}" in
    0) ;;
    75)
      append_delivery ntfy "${stage}" skipped circuit-open "${measured_age}"
      return 0
      ;;
    28)
      append_delivery ntfy "${stage}" failed timeout "${measured_age}"
      return 0
      ;;
    *)
      append_delivery ntfy "${stage}" failed command-failed "${measured_age}"
      return 0
      ;;
  esac

  # The reachability probe can consume the entire three-second timeout. Honor a
  # disarm that arrived during it before any topic or notification body leaves
  # the machine.
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi

  title="$(notification_title)"
  body="$(notification_body "${stage}" "${measured_age}")"
  case "${stage}" in initial) priority=3 ;; reminder) priority=4 ;; urgent) priority=5 ;; esac

  # JSON publishing targets the public server root; the secret topic travels in
  # stdin, never in the URL or process arguments. An optional bearer header is
  # exposed to curl through an inherited file descriptor, not `-H "Bearer ..."`
  # where process listings could capture it.
  if [ -n "${token}" ]; then
    exec 8< <(printf 'Authorization: Bearer %s\n' "${token}")
    if printf '{"topic":"%s","title":"%s","message":"%s","priority":%s,"tags":["robot"]}' \
      "${topic}" "${title}" "${body}" "${priority}" \
      | curl --fail --silent --show-error --max-time 3 --request POST \
          --header 'Content-Type: application/json' --header @/dev/fd/8 \
          --data-binary @- "${base_url%/}/" >/dev/null 2>&1; then
      exit_code=0
    else
      exit_code=$?
    fi
    exec 8<&-
  elif printf '{"topic":"%s","title":"%s","message":"%s","priority":%s,"tags":["robot"]}' \
    "${topic}" "${title}" "${body}" "${priority}" \
    | curl --fail --silent --show-error --max-time 3 --request POST \
        --header 'Content-Type: application/json' --data-binary @- "${base_url%/}/" >/dev/null 2>&1; then
    exit_code=0
  else
    exit_code=$?
  fi

  if [ "${exit_code}" -eq 0 ]; then
    append_delivery ntfy "${stage}" sent "" "${measured_age}"
  elif [ "${exit_code}" -eq 28 ]; then
    append_delivery ntfy "${stage}" failed timeout "${measured_age}"
  else
    append_delivery ntfy "${stage}" failed command-failed "${measured_age}"
  fi
}

deliver_stage() {
  local stage="${1}"
  local measured_age
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi
  measured_age="$(age_ms)" || measured_age=0
  deliver_desktop "${stage}" "${measured_age}"
  deliver_ntfy "${stage}" "${measured_age}"
}

deliver_stage initial

max_stage="${BEEP_SEQUENCE_BREAK_MAX_STAGE:-urgent}"
case "${max_stage}" in initial) exit 0 ;; reminder | urgent) ;; *) max_stage=urgent ;; esac

reminder_seconds="${BEEP_SEQUENCE_BREAK_REMINDER_SECONDS:-300}"
urgent_seconds="${BEEP_SEQUENCE_BREAK_URGENT_SECONDS:-900}"
case "${reminder_seconds}" in "" | *[!0-9]*) reminder_seconds=300 ;; esac
case "${urgent_seconds}" in "" | *[!0-9]*) urgent_seconds=900 ;; esac
if [ "${urgent_seconds}" -lt "${reminder_seconds}" ]; then
  urgent_seconds="${reminder_seconds}"
fi

sleep "${reminder_seconds}" || exit 0
if [ -e "${disarm_sentinel}" ]; then exit 0; fi
reminder_status="$(bracket_status)" || reminder_status="unknown"
case "${reminder_status}" in
  open) deliver_stage reminder ;;
  resolved) append_pair_skipped reminder bracket-resolved; exit 0 ;;
  *) append_pair_skipped reminder bracket-unattributed; exit 0 ;;
esac

if [ "${max_stage}" = "reminder" ]; then
  exit 0
fi

sleep "$((urgent_seconds - reminder_seconds))" || exit 0
if [ -e "${disarm_sentinel}" ]; then exit 0; fi
urgent_status="$(bracket_status)" || urgent_status="unknown"
case "${urgent_status}" in
  open) deliver_stage urgent ;;
  resolved) append_pair_skipped urgent bracket-resolved ;;
  *) append_pair_skipped urgent bracket-unattributed ;;
esac

exit 0
