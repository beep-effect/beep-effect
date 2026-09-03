#!/usr/bin/env bash
# Shared machine-wide breaker for repeated op, gh, and network probes. The
# command still owns its stdout/stderr and exit code; the breaker ledger retains
# only a bounded probe class and tagged outcome, never command content.

set -uo pipefail
umask 077

action="${1:-}"
if [ -n "${action}" ]; then shift; fi

BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
state_root="${BEEP_AGENT_EVIDENCE_ROOT}/circuit-breaker"
event_dir="${state_root}/events"
open_dir="${state_root}/open"
breaker_rev="${BEEP_CIRCUIT_BREAKER_REV:-shared-cooldown-1}"
disarm_sentinel="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"

case "${breaker_rev}" in
  "" | *[!A-Za-z0-9_.:-]*) exit 64 ;;
esac

for dependency in jq date flock mktemp mv mkdir; do
  command -v "${dependency}" >/dev/null 2>&1 || exit 69
done

mkdir -p "${event_dir}" "${open_dir}" || exit 73

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

valid_probe() {
  case "${1:-}" in op | gh | network) return 0 ;; *) return 1 ;; esac
}

valid_caller() {
  case "${1:-}" in claude-code | codex-cli | hook | operator) return 0 ;; *) return 1 ;; esac
}

# The telemetry kill switch suppresses breaker evidence without disabling the
# operational guard. This script is also used by the notifier's network path;
# bypassing the breaker while telemetry is disarmed would re-enable the retry
# storm the guard exists to stop.
append_event() {
  local probe="${1}"
  local caller="${2}"
  local status="${3}"
  local first="${4:-}"
  local second="${5:-}"
  local ts day outcome row

  if [ -e "${disarm_sentinel}" ]; then
    return 0
  fi

  case "${status}" in
    probe-succeeded | coordination-skipped | reset)
      outcome="$(jq -cn --arg status "${status}" '{status:$status}')" || return 0
      ;;
    tripped)
      case "${first}:${second}" in *[!0-9:]* | :* | *:) return 0 ;; esac
      outcome="$(
        jq -cn \
          --arg status "${status}" \
          --argjson exitCode "${first}" \
          --argjson retryAfterEpochMs "${second}" \
          '{status:$status,exitCode:$exitCode,retryAfterEpochMs:$retryAfterEpochMs}'
      )" || return 0
      ;;
    retry-skipped)
      case "${first}" in "" | *[!0-9]*) return 0 ;; esac
      outcome="$(
        jq -cn \
          --arg status "${status}" \
          --argjson retryAfterEpochMs "${first}" \
          '{status:$status,retryAfterEpochMs:$retryAfterEpochMs}'
      )" || return 0
      ;;
    *) return 0 ;;
  esac

  ts="$(now_iso)" || return 0
  day="${ts:0:10}"
  row="$(
    jq -cn \
      --arg schemaVersion "circuit-breaker-event/v1" \
      --arg ts "${ts}" \
      --arg probe "${probe}" \
      --arg caller "${caller}" \
      --arg breakerRev "${breaker_rev}" \
      --argjson outcome "${outcome}" \
      '{
        schemaVersion:$schemaVersion,
        ts:$ts,
        probe:$probe,
        caller:$caller,
        breakerRev:$breakerRev,
        evidenceTier:"derived",
        outcome:$outcome
      }'
  )" || return 0

  printf '%s\n' "${row}" >>"${event_dir}/circuit-breaker-${day}.ndjson" 2>/dev/null || true
}

read_valid_state() {
  local state_file="${1}"
  local probe="${2}"
  jq -cer --arg probe "${probe}" '
      select(
        .schemaVersion == "circuit-breaker-open/v1"
        and .probe == $probe
        and (.breakerRev | type) == "string"
        and (.breakerRev | length) > 0
        and (.trippedEpochMs | type) == "number"
        and .trippedEpochMs >= 0
        and (.retryAfterEpochMs | type) == "number"
        and .retryAfterEpochMs >= .trippedEpochMs
        and (.exitCode | type) == "number"
        and .exitCode > 0
        and (.exitCode | floor) == .exitCode
      )
    ' "${state_file}" 2>/dev/null
}

write_open_state() {
  local state_file="${1}"
  local probe="${2}"
  local tripped_ms="${3}"
  local retry_after_ms="${4}"
  local exit_code="${5}"
  local state_tmp

  state_tmp="$(mktemp "${state_file}.XXXXXX")" || return 1
  if ! jq -cn \
    --arg schemaVersion "circuit-breaker-open/v1" \
    --arg probe "${probe}" \
    --arg breakerRev "${breaker_rev}" \
    --argjson trippedEpochMs "${tripped_ms}" \
    --argjson retryAfterEpochMs "${retry_after_ms}" \
    --argjson exitCode "${exit_code}" \
    '{
      schemaVersion:$schemaVersion,
      probe:$probe,
      breakerRev:$breakerRev,
      trippedEpochMs:$trippedEpochMs,
      retryAfterEpochMs:$retryAfterEpochMs,
      exitCode:$exitCode
    }' >"${state_tmp}" 2>/dev/null; then
    rm -f -- "${state_tmp}"
    return 1
  fi
  if ! mv -- "${state_tmp}" "${state_file}"; then
    rm -f -- "${state_tmp}"
    return 1
  fi
}

run_guarded() {
  local probe="${1:-}"
  local caller="${2:-}"
  shift 2 2>/dev/null || return 64
  if [ "${1:-}" != "--" ]; then return 64; fi
  shift
  if ! valid_probe "${probe}" || ! valid_caller "${caller}" || [ "$#" -eq 0 ]; then return 64; fi

  local lock_path="${open_dir}/${probe}.lock"
  local state_file="${open_dir}/${probe}.json"
  local state current_ms retry_after_ms cooldown_seconds exit_code tripped_ms

  exec 9>>"${lock_path}" || {
    append_event "${probe}" "${caller}" coordination-skipped
    return 75
  }
  if ! flock -w 1 9; then
    append_event "${probe}" "${caller}" coordination-skipped
    return 75
  fi

  if [ -f "${state_file}" ]; then
    state="$(read_valid_state "${state_file}" "${probe}")" || {
      append_event "${probe}" "${caller}" coordination-skipped
      flock -u 9 || true
      return 75
    }
    retry_after_ms="$(jq -r '.retryAfterEpochMs' <<<"${state}")"
    current_ms="$(now_epoch_ms)" || current_ms=0
    if [ "${current_ms}" -lt "${retry_after_ms}" ]; then
      append_event "${probe}" "${caller}" retry-skipped "${retry_after_ms}"
      flock -u 9 || true
      return 75
    fi
  fi

  "$@"
  exit_code=$?
  if [ "${exit_code}" -eq 0 ]; then
    rm -f -- "${state_file}"
    append_event "${probe}" "${caller}" probe-succeeded
    flock -u 9 || true
    return 0
  fi

  cooldown_seconds="${BEEP_CIRCUIT_BREAKER_COOLDOWN_SECONDS:-900}"
  case "${cooldown_seconds}" in "" | *[!0-9]*) cooldown_seconds=900 ;; esac
  tripped_ms="$(now_epoch_ms)" || tripped_ms=0
  retry_after_ms=$((tripped_ms + cooldown_seconds * 1000))
  if ! write_open_state "${state_file}" "${probe}" "${tripped_ms}" "${retry_after_ms}" "${exit_code}"; then
    append_event "${probe}" "${caller}" coordination-skipped
    flock -u 9 || true
    return 75
  fi
  append_event "${probe}" "${caller}" tripped "${exit_code}" "${retry_after_ms}"
  flock -u 9 || true
  return "${exit_code}"
}

reset_probe() {
  local probe="${1:-}"
  local caller="${2:-}"
  if ! valid_probe "${probe}" || ! valid_caller "${caller}"; then return 64; fi

  local lock_path="${open_dir}/${probe}.lock"
  local state_file="${open_dir}/${probe}.json"
  exec 9>>"${lock_path}" || return 75
  flock -w 1 9 || return 75
  rm -f -- "${state_file}"
  append_event "${probe}" "${caller}" reset
  flock -u 9 || true
}

status_probe() {
  local probe="${1}"
  local state_file="${open_dir}/${probe}.json"
  if [ -f "${state_file}" ]; then
    read_valid_state "${state_file}" "${probe}"
  else
    jq -cn --arg probe "${probe}" '{probe:$probe,status:"closed"}'
  fi
}

case "${action}" in
  run)
    run_guarded "$@"
    exit $?
    ;;
  reset)
    reset_probe "${1:-}" "${2:-}"
    exit $?
    ;;
  status)
    if [ "$#" -eq 0 ]; then
      for probe in op gh network; do status_probe "${probe}" || exit 75; done
    elif [ "$#" -eq 1 ] && valid_probe "${1}"; then
      status_probe "${1}" || exit 75
    else
      exit 64
    fi
    ;;
  *)
    exit 64
    ;;
esac

exit 0
