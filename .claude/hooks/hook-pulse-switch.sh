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
    # Take the sentinel by RENAMING it, in one atomic step, rather than reading it
    # and unlinking later. `rename(2)` either moves the file or does not; there is
    # no interval in which the path still resolves but is already committed to
    # deletion.
    #
    # The read-then-`rm` form this replaces had the worst race in the switch. A
    # `disarm` landing between the read and the `rm` would find the sentinel
    # present, report "already disarmed", and exit 0 — and then `arm` would delete
    # the very sentinel it had just been told about. The operator is told the
    # instrument is off while collection is running, which is the one direction a
    # kill switch must never fail in. Claiming first makes that unrepresentable:
    # once the path is free, a concurrent `disarm` legitimately wins it via `ln`
    # and the instrument really is disarmed.
    claimed="${sentinel}.arming.$$"
    if ! mv "${sentinel}" "${claimed}" 2>/dev/null; then
      echo "hook-pulse already armed"
      exit 0
    fi
    # From here the sentinel is claimed but the window is not yet recorded, so the
    # instrument is already collecting again while the gap is still unwritten. Any
    # failure in that span — `mkdir`, jq, a full disk on the append — must put the
    # sentinel BACK rather than drop it. Deleting it instead (the obvious
    # `rm -f "${claimed}"` trap) would resume collection *and* destroy the only
    # record of when the gap began, with no window row written either: the gap
    # would vanish rather than be recorded as unknown, which is the failure this
    # ledger exists to make impossible. `set -euo pipefail` makes those aborts
    # real, not hypothetical.
    #
    # So the trap restores, and is cleared only once the append has succeeded.
    # `arm` is therefore all-or-nothing: either the window is durable and the
    # sentinel is gone, or nothing moved and the operator can retry.
    #
    # The restore is `mv -f`, and overwriting a sentinel that a concurrent
    # `disarm` published into the freed path is the CORRECT resolution, not a
    # second race. If this `arm` failed, the instrument never actually re-armed,
    # so the gap has run continuously since the original `disarmedAt`. Keeping the
    # newer start would claim coverage over a stretch that was never collected.
    # Between two candidate starts the earlier one is always the honest choice
    # here: it over-reports uncertainty, and this ledger exists to mark what is
    # unknown rather than to look tidy.
    trap 'mv -f "${claimed}" "${sentinel}" 2>/dev/null || true' EXIT
    mkdir -p "$(dirname "${windows}")"
    # A hand-written or `touch`-created sentinel has no timestamp; record that
    # honestly as an unknown window start instead of inventing one.
    jq -c -n --slurpfile sentinelDoc "${claimed}" --arg rearmedAt "$(now)" \
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
    # The window is durable; the claim can now be dropped rather than restored.
    trap - EXIT
    rm -f "${claimed}"
    # A `disarm` can win the freed path between the rename above and here. The
    # appended window is still correct — the instrument really was off across it,
    # and the new gap stays open until some later `arm` closes it — but reporting
    # a bare "armed" would be false by the time the operator reads it. Report the
    # state that actually holds rather than the transition that occurred.
    if [ -e "${sentinel}" ]; then
      echo "hook-pulse window appended to ${windows}; a concurrent disarm already re-disarmed the instrument"
    else
      echo "hook-pulse armed; disarm window appended to ${windows}"
    fi
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
