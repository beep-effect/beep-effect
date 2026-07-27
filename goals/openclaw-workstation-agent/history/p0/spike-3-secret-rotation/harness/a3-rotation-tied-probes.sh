#!/usr/bin/env bash
set -euo pipefail

HARNESS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=lib.sh
source "$HARNESS/lib.sh"
spike3_require_scratch

S3=$SPIKE3_DIR
LOGS=$SPIKE3_LOGS
OC=$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw
NODE_DIR=$HOME/.local/share/mise/installs/node/24/bin
CONFIG=${A1_CLIENT_CONFIG:-}
STATE=$S3/state
HOME_DIR=$S3/home
NEW_TOKEN=${A1_NEW_GATEWAY_TOKEN:-}
NONCE=${A1_CHAIN_NONCE:-}

fail() { spike3_fail "ASSERT-FAIL: $*"; }
blocked() { printf 'ASSERT-BLOCKED: %s\n' "$*" >&2; exit 2; }
section() { printf '\n=== %s ===\n' "$*"; }
run_authenticated() {
  spike3_run_openclaw "$OC" "$NODE_DIR" "$HOME_DIR" "$CONFIG" "$STATE" "$@"
}
cleanup_vars() {
  unset NEW_TOKEN A1_NEW_GATEWAY_TOKEN A1_CLIENT_CONFIG OP_SERVICE_ACCOUNT_TOKEN
}
trap cleanup_vars EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

unset OP_SERVICE_ACCOUNT_TOKEN
spike3_assert_scratch_ownership
mkdir -p "$LOGS"
exec > >(tee -a "$LOGS/a3-probes.log") 2>&1
[[ -s "$LOGS/preflight.ok" &&
  -f "$LOGS/setup-capabilities-verified" ]] ||
  fail "verified setup capability evidence missing"
[[ -n "$NONCE" && -n "$NEW_TOKEN" && -n "$CONFIG" &&
  -f "$S3/a1-rotation-event" ]] ||
  fail "must be invoked by a1-rotate-same-ref.sh"
read -r recorded_nonce old_fp new_fp reload_epoch <"$S3/a1-rotation-event"
[[ "$NONCE" == "$recorded_nonce" ]] || fail "rotation-event nonce mismatch"
[[ "$reload_epoch" =~ ^[0-9]+$ &&
  $(( $(date +%s) - reload_epoch )) -le 30 ]] ||
  fail "rotation-event proof is stale"
printf 'tied-event old-sha256-prefix=%s new-sha256-prefix=%s reload-epoch=%s\n' \
  "$old_fp" "$new_fp" "$reload_epoch"

section "authenticated model completion after tied reload"
run_authenticated agent --agent spike3 \
  --session-key "rotation-$new_fp" \
  --message "Reply with exactly: SPIKE3_MODEL_OK" \
  --thinking off --timeout 120 --json >"$LOGS/a3-model.json" \
  2>"$LOGS/a3-model.stderr.log" ||
  fail "authenticated model completion command failed"
jq -e '
  (.result.payloads? // []) as $payloads |
  select(
    .status == "ok" and
    ((.runId? // "") | type == "string" and length > 0) and
    ((.result.meta.stopReason? // "") == "stop") and
    (.result.meta | has("aborted") and .aborted == false) and
    all($payloads[]; .isError? != true) and
    any($payloads[];
      .isError? != true and
      .isReasoning? != true and
      ((.text? // null) | type == "string") and
      ((.text | gsub("^\\s+|\\s+$"; "")) == "SPIKE3_MODEL_OK")
    )
  ) |
  {
    status,
    runId,
    provider: .result.meta.agentMeta.provider,
    model: .result.meta.agentMeta.model,
    payloads: $payloads
  }
' "$LOGS/a3-model.json" >"$LOGS/a3-model-selected.json" ||
  fail "completion failed the pinned gateway payload schema"
# This OpenClaw build emits no `transport` field (its executionTrace.runner is
# always "embedded" — the agent runs inside the GATEWAY process). Prove
# gateway-served transport from the gateway's own WS response line for this
# exact runId instead of a field that does not exist (verified 2026-07-26).
model_run_id=$(jq -r '.runId' "$LOGS/a3-model.json")
[[ -n "$model_run_id" && "$model_run_id" != "null" ]] ||
  fail "completion response carried no runId to bind to gateway transport"
# Two acceptable proofs, because the `[ws] ⇄ res ✓ agent` acknowledgement is
# emitted nondeterministically (present 2026-07-26 run 3, absent run 6 for an
# otherwise identical successful completion). Either line appearing in the
# GATEWAY's own log file proves the gateway process ran the turn — a locally
# executed (`--local`) turn never reaches this file at all.
grep -qaE "res .* agent .*runId=$model_run_id|\[agent\] run $model_run_id ended with stopReason=" \
  "$LOGS/gateway.log" ||
  fail "completion was not served over the authenticated gateway socket"
printf 'gateway-served-completion runId=%s\n' "$model_run_id"
printf 'ASSERT-PASS: authenticated gateway model completion succeeded after tied reload\n'

section "Telegram live probe after the same reload"
[[ -f "$S3/telegram-enabled" ]] ||
  blocked "operator-created Telegram reference was absent at setup"
run_authenticated channels status --channel telegram --probe \
  --timeout 15000 --json >"$LOGS/a3-telegram.json" \
  2>"$LOGS/a3-telegram.stderr.log" ||
  fail "Telegram live probe command failed"
jq -e '
  .channelAccounts.telegram? as $accounts |
  select(
    ($accounts | type == "array") and
    ([$accounts[] | select(.accountId == "default")] | length == 1)
  ) |
  $accounts[] |
  select(.accountId == "default") |
  select(
    .probe.ok == true and
    ((.lastError? // "") == "") and
    ((.probe.error? // "") == "") and
    ((.probe.failure? // "") == "") and
    (.probe.failed? != true)
  )
' "$LOGS/a3-telegram.json" >"$LOGS/a3-telegram-selected.json" ||
  fail "requested Telegram default account failed its live probe"
printf 'ASSERT-PASS: Telegram live probe succeeded after tied rotation\n'

section "evidence secret scan"
for file in "$LOGS"/a3-*; do
  [[ -f "$file" ]] || continue
  spike3_scan_logs rotated-gateway "$NEW_TOKEN" "$file"
done
spike3_scan_logs rotated-gateway "$NEW_TOKEN" "$STATE/log/openclaw.log"
printf 'ASSERT-PASS: model and Telegram probes are causally tied to reload event %s\n' \
  "$NONCE"
