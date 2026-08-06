#!/usr/bin/env bash
# hook-pulse-switch: arm / disarm / status for the hook-pulse kill switch
# (goals/coding-agent-effectiveness-evidence-loop, P1: "one file disarms every
# telemetry hook in under a second; the disarm window self-labels
# `evidenceTier: unknown`").
#
# The switch is the sentinel file's existence — `hook-pulse.sh` tests for it as
# its first action, before jq and before reading stdin, so `touch`/`rm` on the
# sentinel path is a valid manual disarm/arm. This helper exists so the disarm
# window is *explicit* rather than inferred from missing rows: `disarm` stamps an
# ISO-8601 UTC timestamp into the sentinel, and `arm` closes the window by
# appending a self-labelled record to `hook-pulse-disarm-windows.ndjson`.
#
# That window record is deliberately NOT a `HookPulseV1` row and deliberately
# NOT written under `hook-events/`: `HookPulseEvent` has no member for "the
# instrument was off", so a disarm window cannot be represented in the canonical
# ledger without inventing a hook event. Keeping it in a sibling file leaves
# `hook-events/` decodable as pure `HookPulseV1` for P4 replay while making the
# gap machine-readable at analysis time.
#
# Usage:
#   hook-pulse-switch.sh disarm [reason]
#   hook-pulse-switch.sh arm
#   hook-pulse-switch.sh status

set -euo pipefail

# Same precedence as `hook-pulse.sh`, so disarming with a custom evidence root
# disarms the writer that is actually using it.
BEEP_AGENT_EVIDENCE_ROOT="${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/beep/agent-evidence}"
sentinel="${BEEP_HOOK_PULSE_DISARM_SENTINEL:-${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse.disarmed}"
windows="${BEEP_AGENT_EVIDENCE_ROOT}/hook-pulse-disarm-windows.ndjson"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

case "${1:-status}" in
  disarm)
    mkdir -p "$(dirname "${sentinel}")"
    # Idempotent on purpose. The instrumentation gap begins at the FIRST disarm,
    # so re-running `disarm` while already disarmed must not move `disarmedAt`
    # forward: `arm` copies that timestamp into the append-only window ledger, and
    # a later start would record a shorter gap than actually occurred. That
    # silently reclassifies genuinely uninstrumented time as covered — the same
    # class of quiet wrongness as a wait bracket that closes on the wrong event,
    # and worse than a loud failure because the ledger still looks complete.
    # Preserving the original reason follows for the same reason: the window is
    # attributed to why the instrument first went down, not to the latest command.
    # Claiming the sentinel is a single atomic step, not test-then-write. A
    # `[ -e ]` guard followed by a redirect is TOCTOU: two `disarm` runs against
    # this shared evidence root — and it IS shared, one XDG store across every
    # clone and worktree — can both see it absent and the later one clobbers the
    # first `disarmedAt`, which is the very bug the guard exists to prevent.
    #
    # `ln` is the atomic primitive here: it fails with EEXIST rather than
    # overwriting, and unlike `set -o noclobber` with `: >` it publishes a
    # fully-formed sentinel in one step. The noclobber form would create an empty
    # file first, leaving a window in which a concurrent `arm` reads a sentinel
    # with no timestamp and records the gap as having an unknown start. The temp
    # file is written in the sentinel's own directory so the link cannot cross a
    # filesystem boundary.
    staged="${sentinel}.staged.$$"
    trap 'rm -f "${staged}"' EXIT
    jq -n -c --arg disarmedAt "$(now)" --arg reason "${2:-unspecified}" \
      '{ disarmedAt: $disarmedAt, reason: $reason, evidenceTier: "unknown" }' >"${staged}"
    if ln "${staged}" "${sentinel}" 2>/dev/null; then
      rm -f "${staged}"
      echo "hook-pulse disarmed: ${sentinel}"
      exit 0
    fi
    rm -f "${staged}"
    # Lost the race, or it was already disarmed — same outcome either way: the gap
    # began at whatever start is already recorded, so leave it alone.
    #
    # jq's `//` cannot cover an EMPTY sentinel: with no input jq emits nothing and
    # still exits 0, so neither the alternative nor `||` fires and the message
    # renders "since ;". Same empty-output trap as the `capture()` defect in
    # `hook-pulse.sh`. Default in the shell, where an empty string is observable.
    disarmed_at="$(jq -r '.disarmedAt // empty' "${sentinel}" 2>/dev/null || true)"
    case "${disarmed_at}" in "") disarmed_at="an unrecorded time" ;; esac
    echo "hook-pulse already disarmed since ${disarmed_at}; original window start left intact"
    exit 0
    ;;
  arm)
    if [ ! -e "${sentinel}" ]; then
      echo "hook-pulse already armed"
      exit 0
    fi
    mkdir -p "$(dirname "${windows}")"
    # A hand-written or `touch`-created sentinel has no timestamp; record that
    # honestly as an unknown window start instead of inventing one.
    jq -c -n --slurpfile sentinelDoc "${sentinel}" --arg rearmedAt "$(now)" \
      '{
         schemaVersion: "hook-pulse-disarm-window/v1",
         disarmedAt: ($sentinelDoc[0].disarmedAt? // null),
         rearmedAt: $rearmedAt,
         reason: ($sentinelDoc[0].reason? // null),
         evidenceTier: "unknown"
       }' 2>/dev/null >>"${windows}" ||
      jq -c -n --arg rearmedAt "$(now)" \
        '{
           schemaVersion: "hook-pulse-disarm-window/v1",
           disarmedAt: null,
           rearmedAt: $rearmedAt,
           reason: null,
           evidenceTier: "unknown"
         }' >>"${windows}"
    rm -f "${sentinel}"
    echo "hook-pulse armed; disarm window appended to ${windows}"
    ;;
  status)
    if [ -e "${sentinel}" ]; then
      echo "disarmed: ${sentinel}"
      cat "${sentinel}"
    else
      echo "armed (no sentinel at ${sentinel})"
    fi
    ;;
  *)
    echo "usage: ${0##*/} {arm|disarm [reason]|status}" >&2
    exit 2
    ;;
esac
