#!/usr/bin/env bash
# yeet-pr-wave-notifier: fail-open escalation worker for one pull request wave
# whose owner session is not live (goals/yeet-pr-events W9; pr-event-awareness
# D11, D18, D19, D36). The `--until-ready` monitor spawns it detached, once per
# wave, with the path of a descriptor it wrote under
# `<checkout>/.beep/yeet/pr-wave-notifier/waves/<waveKey>.json`.
#
# Content rule (D18): only the local desktop notification may carry the
# descriptor's one-line summary and its `yeet resume <pr>` command. The ntfy
# post and the evidence ledger stay generic: no pull request number, head,
# row id, summary, or session content ever reaches them. The ledger keys rows
# by the opaque wave key (a digest) and records only transport outcomes.
#
# Liveness (D19): the monitor's live-owner probe (`isClaudeSessionLive`) reads
# Claude sessions only, so every Codex-attributed owner escalates here with
# ownerReason `non-claude-harness` until the resume-footer Codex live guard
# ships. That is intended and recorded in every ledger row, not suppressed.
#
# Transports (D36): notify-send and ntfy. OSC 777 needs a terminal and a unit
# has none, so it is not on this path. The transport ladder is copied from
# sequence-break-notifier.sh (same-UID bus reconstruction, ntfy through the
# shared circuit breaker, bearer token through an inherited descriptor); that
# worker is neither called nor edited.
#
# The worker resolves when every row in the wave is acknowledged
# (`.beep/inbox/acks/<rowId>` exists) or the wave record moved to another head
# or pull request (superseded), and gives up after a bounded wait.

exec 1>/dev/null 2>/dev/null

set -uo pipefail
umask 077

trap 'trap - EXIT; exit 0' EXIT

descriptor_path="${1:-}"

# Capture phone configuration once, then drop the exported names before any
# external command can inherit them.
ntfy_base_url="${BEEP_SEQUENCE_BREAK_NTFY_BASE_URL:-https://ntfy.sh}"
ntfy_topic="${BEEP_SEQUENCE_BREAK_NTFY_TOPIC:-}"
ntfy_token="${BEEP_SEQUENCE_BREAK_NTFY_TOKEN:-}"
unset BEEP_SEQUENCE_BREAK_NTFY_BASE_URL BEEP_SEQUENCE_BREAK_NTFY_TOPIC BEEP_SEQUENCE_BREAK_NTFY_TOKEN

BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
disarm_sentinel="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"

# The shared kill switch wins before anything else is consulted.
if [ -e "${disarm_sentinel}" ]; then
  exit 0
fi

for dependency in jq date mkdir; do
  command -v "${dependency}" >/dev/null 2>&1 || exit 0
done

[ -n "${descriptor_path}" ] && [ -f "${descriptor_path}" ] && [ -O "${descriptor_path}" ] || exit 0

descriptor_field() {
  jq -er --arg field "${1}" '.[$field] | select(type == "string" or type == "number") | tostring' \
    "${descriptor_path}" 2>/dev/null
}

schema_version="$(descriptor_field schemaVersion)" || exit 0
[ "${schema_version}" = "yeet-pr-wave-descriptor/v1" ] || exit 0
wave_key="$(descriptor_field waveKey)" || exit 0
case "${wave_key}" in "" | *[!0-9a-f]*) exit 0 ;; esac
[ "${#wave_key}" -eq 16 ] || exit 0
pr_number="$(descriptor_field prNumber)" || exit 0
case "${pr_number}" in "" | *[!0-9]*) exit 0 ;; esac
head_sha="$(descriptor_field headSha)" || exit 0
case "${head_sha}" in "" | *[!0-9a-fA-F]*) exit 0 ;; esac
checkout="$(descriptor_field checkout)" || exit 0
case "${checkout}" in /*) ;; *) exit 0 ;; esac
[ -d "${checkout}" ] || exit 0
urgency="$(descriptor_field urgency)" || exit 0
case "${urgency}" in critical | normal) ;; *) exit 0 ;; esac
owner_reason="$(descriptor_field ownerReason)" || exit 0
case "${owner_reason}" in no-owner-record | non-claude-harness | claude-session-not-live | registry-unreadable | repository-unresolved) ;; *) exit 0 ;; esac
desktop_title="$(descriptor_field desktopTitle)" || exit 0
desktop_body="$(descriptor_field desktopBody)" || exit 0

row_ids=()
while IFS= read -r row_id; do
  case "${row_id}" in "" | .* | *[!A-Za-z0-9._-]*) exit 0 ;; esac
  row_ids+=("${row_id}")
done < <(jq -r '.rowIds[]? | select(type == "string")' "${descriptor_path}" 2>/dev/null)
[ "${#row_ids[@]}" -gt 0 ] || exit 0

acks_dir="${checkout}/.beep/inbox/acks"
dispatch_path="${checkout}/.beep/inbox/dispatch.json"

state_root="${BEEP_AGENT_EVIDENCE_ROOT}/pr-wave"
ledger_dir="${state_root}/notification-events"
mkdir -p "${ledger_dir}" || exit 0

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

started_ms="$(now_epoch_ms)" || exit 0
case "${started_ms}" in "" | *[!0-9]*) exit 0 ;; esac

waited_ms() {
  local current waited
  current="$(now_epoch_ms)" || current="${started_ms}"
  waited=$((current - started_ms))
  [ "${waited}" -ge 0 ] || waited=0
  printf '%s' "${waited}"
}

# One generic ledger row. Nothing from the descriptor except the opaque wave
# key, the urgency, and the owner-liveness reason is ever written.
append_row() {
  local stage="${1}" transport="${2}" status="${3}" reason="${4:-}"
  local ts day row delivery
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi
  case "${stage}" in initial | reminder | resolution) ;; *) return 0 ;; esac
  case "${transport}" in desktop | ntfy | none) ;; *) return 0 ;; esac
  case "${status}" in
    sent) delivery='{"status":"sent"}' ;;
    skipped)
      case "${reason}" in transport-unconfigured | circuit-open | coordination-unavailable) ;; *) reason="coordination-unavailable" ;; esac
      delivery="$(jq -cn --arg reason "${reason}" '{status:"skipped",reason:$reason}')" || return 0
      ;;
    failed)
      case "${reason}" in command-unavailable | command-failed | timeout | unknown) ;; *) reason="unknown" ;; esac
      delivery="$(jq -cn --arg reason "${reason}" '{status:"failed",reason:$reason}')" || return 0
      ;;
    acked | superseded | timeout)
      delivery="$(jq -cn --arg outcome "${status}" '{status:"resolved",outcome:$outcome}')" || return 0
      ;;
    *) return 0 ;;
  esac
  ts="$(now_iso)" || return 0
  day="${ts:0:10}"
  row="$(
    jq -cn \
      --arg schemaVersion "yeet-pr-wave-notification/v1" \
      --arg ts "${ts}" \
      --arg waveKey "${wave_key}" \
      --arg urgency "${urgency}" \
      --arg ownerReason "${owner_reason}" \
      --arg stage "${stage}" \
      --arg transport "${transport}" \
      --argjson waitedMs "$(waited_ms)" \
      --argjson delivery "${delivery}" \
      '{
        schemaVersion:$schemaVersion,
        ts:$ts,
        waveKey:$waveKey,
        urgency:$urgency,
        ownerReason:$ownerReason,
        livenessProbe:"claude-only",
        stage:$stage,
        waitedMs:$waitedMs,
        evidenceTier:"derived",
        transport:$transport,
        delivery:$delivery
      }'
  )" || return 0
  printf '%s\n' "${row}" >>"${ledger_dir}/pr-wave-${day}-${wave_key}.ndjson" 2>/dev/null || true
}

# Every row acknowledged: resolved. The wave record pinned to another head or
# pull request: superseded (a push landed, so someone is acting on it).
wave_state() {
  local row_id pinned
  local acked=1
  for row_id in "${row_ids[@]}"; do
    if [ ! -e "${acks_dir}/${row_id}" ]; then
      acked=0
      break
    fi
  done
  if [ "${acked}" -eq 1 ]; then
    printf 'acked'
    return 0
  fi
  if [ -f "${dispatch_path}" ]; then
    pinned="$(jq -er '[(.headSha // ""), ((.prNumber // "") | tostring)] | @tsv' "${dispatch_path}" 2>/dev/null)" || pinned=""
    if [ -n "${pinned}" ] && [ "${pinned}" != "${head_sha}"$'\t'"${pr_number}" ]; then
      printf 'superseded'
      return 0
    fi
  fi
  printf 'open'
}

notification_id=""
runtime_dir=""
bus_address=""

# Reconstruct only the conventional same-UID session bus when the unit did not
# forward DBUS_SESSION_BUS_ADDRESS, and refuse when its socket is absent.
resolve_bus() {
  runtime_dir="${XDG_RUNTIME_DIR:-}"
  if [ -z "${runtime_dir}" ]; then
    command -v id >/dev/null 2>&1 || return 1
    runtime_dir="/run/user/$(id -u)"
  fi
  bus_address="${DBUS_SESSION_BUS_ADDRESS:-}"
  if [ -z "${bus_address}" ]; then
    [ -S "${runtime_dir}/bus" ] || return 1
    bus_address="unix:path=${runtime_dir}/bus"
  fi
  return 0
}

deliver_desktop() {
  local stage="${1}"
  local title body output exit_code
  local replace=()
  if [ "${BEEP_PR_WAVE_NOTIFIER_DESKTOP_ENABLED:-1}" != "1" ]; then
    append_row "${stage}" desktop skipped transport-unconfigured
    return 0
  fi
  if ! command -v notify-send >/dev/null 2>&1 || ! command -v timeout >/dev/null 2>&1; then
    append_row "${stage}" desktop failed command-unavailable
    return 0
  fi
  if ! resolve_bus; then
    append_row "${stage}" desktop failed command-failed
    return 0
  fi
  title="$(jq -nr --arg value "${desktop_title}" '$value | gsub("[\u0000-\u001f\u007f-\u009f]"; " ") | .[0:160]')" || title="Pull request wave needs an owner"
  body="$(jq -nr --arg value "${desktop_body}" '$value | gsub("[\u0000-\u0009\u000b-\u001f\u007f-\u009f]"; " ") | .[0:480] | @html')" || body=""
  if [ -n "${notification_id}" ]; then
    replace=(--replace-id="${notification_id}")
  fi
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi
  if output="$(
    XDG_RUNTIME_DIR="${runtime_dir}" DBUS_SESSION_BUS_ADDRESS="${bus_address}" \
      timeout 3s notify-send --app-name="beep yeet" --urgency="${urgency}" --expire-time=0 --print-id \
      "${replace[@]}" "${title}" "${body}" </dev/null 2>/dev/null
  )"; then
    output="${output%%$'\n'*}"
    case "${output}" in "" | *[!0-9]*) ;; *) notification_id="${output}" ;; esac
    append_row "${stage}" desktop sent
  else
    exit_code=$?
    if [ "${exit_code}" -eq 124 ]; then
      append_row "${stage}" desktop failed timeout
    else
      append_row "${stage}" desktop failed command-failed
    fi
  fi
}

# Closing the persistent notification once the wave resolves is best effort.
close_desktop() {
  [ -n "${notification_id}" ] || return 0
  command -v gdbus >/dev/null 2>&1 || return 0
  command -v timeout >/dev/null 2>&1 || return 0
  resolve_bus || return 0
  XDG_RUNTIME_DIR="${runtime_dir}" DBUS_SESSION_BUS_ADDRESS="${bus_address}" \
    timeout 2s gdbus call --session --dest org.freedesktop.Notifications \
    --object-path /org/freedesktop/Notifications \
    --method org.freedesktop.Notifications.CloseNotification "${notification_id}" \
    </dev/null >/dev/null 2>&1 || true
}

deliver_ntfy() {
  local stage="${1}"
  local base_url="${ntfy_base_url}"
  local topic="${ntfy_topic}"
  local token="${ntfy_token}"
  local title body priority exit_code probe_exit

  case "${topic}" in "" | *[!A-Za-z0-9_-]*)
    append_row "${stage}" ntfy skipped transport-unconfigured
    return 0
    ;;
  esac
  case "${base_url}" in https://*) ;; *)
    append_row "${stage}" ntfy skipped transport-unconfigured
    return 0
    ;;
  esac
  case "${base_url}${token}" in *$'\n'* | *$'\r'* | *'"'* | *'\'*)
    append_row "${stage}" ntfy skipped transport-unconfigured
    return 0
    ;;
  esac
  command -v curl >/dev/null 2>&1 || {
    append_row "${stage}" ntfy failed command-unavailable
    return 0
  }

  # Same reachability probe as the sequence-break worker: any HTTP response
  # proves the route; DNS/connect/TLS/timeout failures trip the shared breaker.
  local breaker_path="${BASH_SOURCE[0]%/*}/circuit-breaker.sh"
  if [ ! -x "${breaker_path}" ]; then
    append_row "${stage}" ntfy failed command-unavailable
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
    75) append_row "${stage}" ntfy skipped circuit-open; return 0 ;;
    76) append_row "${stage}" ntfy skipped coordination-unavailable; return 0 ;;
    28) append_row "${stage}" ntfy failed timeout; return 0 ;;
    *) append_row "${stage}" ntfy failed command-failed; return 0 ;;
  esac
  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi

  # Generic by contract: no pull request number, summary, or resume command.
  title="Pull request needs attention"
  case "${stage}" in
    initial) body="A pull request wave is waiting and no live agent session owns it." ;;
    *) body="A pull request wave is still waiting for an owner." ;;
  esac
  case "${urgency}:${stage}" in
    critical:initial) priority=4 ;;
    critical:*) priority=5 ;;
    *:initial) priority=3 ;;
    *) priority=4 ;;
  esac

  # The topic travels on stdin, never in the URL or argv; the bearer header
  # reaches curl through an inherited descriptor, never `-H "Bearer ..."`.
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
    append_row "${stage}" ntfy sent
  elif [ "${exit_code}" -eq 28 ]; then
    append_row "${stage}" ntfy failed timeout
  else
    append_row "${stage}" ntfy failed command-failed
  fi
}

deliver_stage() {
  if [ -e "${disarm_sentinel}" ]; then
    exit 0
  fi
  deliver_desktop "${1}"
  deliver_ntfy "${1}"
}

resolve() {
  append_row resolution none "${1}"
  close_desktop
  exit 0
}

# A wave that resolved between the monitor's read and this start notifies no one.
state="$(wave_state)"
case "${state}" in acked | superseded) resolve "${state}" ;; esac

deliver_stage initial

poll_seconds="${BEEP_PR_WAVE_NOTIFIER_POLL_SECONDS:-30}"
max_seconds="${BEEP_PR_WAVE_NOTIFIER_MAX_SECONDS:-14400}"
reminder_seconds="${BEEP_PR_WAVE_NOTIFIER_REMINDER_SECONDS:-1800}"
case "${poll_seconds}" in "" | *[!0-9]* | 0) poll_seconds=30 ;; esac
case "${max_seconds}" in "" | *[!0-9]*) max_seconds=14400 ;; esac
case "${reminder_seconds}" in "" | *[!0-9]*) reminder_seconds=1800 ;; esac
reminded=0

while :; do
  state="$(wave_state)"
  case "${state}" in acked | superseded) resolve "${state}" ;; esac
  elapsed_seconds=$(($(waited_ms) / 1000))
  if [ "${elapsed_seconds}" -ge "${max_seconds}" ]; then
    resolve timeout
  fi
  if [ "${reminded}" -eq 0 ] && [ "${reminder_seconds}" -gt 0 ] && [ "${elapsed_seconds}" -ge "${reminder_seconds}" ]; then
    reminded=1
    deliver_stage reminder
  fi
  sleep "${poll_seconds}" || exit 0
  if [ -e "${disarm_sentinel}" ]; then
    exit 0
  fi
done
