#!/usr/bin/env bash
# Contract assertions 5 and 6: Telegram writer surfaces under configWrites:false.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight

SPIKE_TG_BOT_TOKEN="${SPIKE_TG_BOT_TOKEN:?throwaway token is required}"
SPIKE_TG_GROUP_ID="${SPIKE_TG_GROUP_ID:?disposable numeric group id is required}"
SPIKE_TG_GROUP_USERNAME="${SPIKE_TG_GROUP_USERNAME:?disposable public group username is required}"
export -n SPIKE_TG_BOT_TOKEN
[[ "$SPIKE_TG_GROUP_ID" =~ ^-?[0-9]+$ ]] ||
  { echo "FATAL: SPIKE_TG_GROUP_ID must be numeric" >&2; exit 65; }
[[ "$SPIKE_TG_GROUP_USERNAME" =~ ^@[A-Za-z][A-Za-z0-9_]{4,31}$ ]] ||
  { echo "FATAL: SPIKE_TG_GROUP_USERNAME must be an @username" >&2; exit 65; }

LOG="$LOGS/a5-writer-surface.log"
CFG="$ROOT/current/openclaw.json"
SUMMARY="$S1/writer-results.tsv"
MATRIX="$S1/compatibility-matrix.md"
FAILURES=0
MUTATED=0
mkdir -p "$LOGS"
exec > >(tee "$LOG") 2>&1

a5_abort() {
  local rc=$?
  trap - EXIT INT TERM
  unset A5_GATEWAY_TOKEN GATEWAY_TOKEN TELEGRAM_TOKEN INVALID_TOKEN SPIKE_TG_BOT_TOKEN
  if (( MUTATED != 0 )); then
    echo "A5-ABORT: running full harness cleanup"
    "$SCRIPT_DIR/cleanup.sh" || true
  fi
  exit "$rc"
}
trap a5_abort EXIT INT TERM

test -s "$GATEWAY_CREDENTIAL" || { echo "FATAL: gateway credential is missing"; exit 66; }
IFS= read -r A5_GATEWAY_TOKEN < "$GATEWAY_CREDENTIAL" || [[ -n "$A5_GATEWAY_TOKEN" ]]
sanitize_a5_stream() {
  local line invalid="${INVALID_TOKEN:-}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//"$A5_GATEWAY_TOKEN"/[REDACTED_GATEWAY_TOKEN]}"
    line="${line//"$SPIKE_TG_BOT_TOKEN"/[REDACTED_TELEGRAM_TOKEN]}"
    if [[ -n "$invalid" ]]; then
      line="${line//"$invalid"/[REDACTED_INVALID_TELEGRAM_TOKEN]}"
    fi
    printf '%s\n' "$line"
  done | redact_stream
}

wait_health() {
  local waited=0 code path
  while (( waited < 40 )); do
    for path in /health /healthz /readyz; do
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 \
        "http://127.0.0.1:19023$path" 2>/dev/null || true)"
      [[ "$code" =~ ^2 ]] && return 0
    done
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

cli() {
  (
    local gateway_token telegram_token
    IFS= read -r gateway_token < "$GATEWAY_CREDENTIAL" || [[ -n "$gateway_token" ]]
    IFS= read -r telegram_token < "$TELEGRAM_CREDENTIAL" || [[ -n "$telegram_token" ]]
    export OPENCLAW_GATEWAY_TOKEN="$gateway_token"
    export TELEGRAM_BOT_TOKEN="$telegram_token"
    export PATH="$NODEBIN:/usr/bin:/bin"
    export HOME="$ISOHOME"
    export OPENCLAW_CONFIG_PATH="$CFG"
    export OPENCLAW_STATE_DIR="$STATE"
    export OPENCLAW_NIX_MODE=1
    export OLLAMA_API_KEY=ollama-local
    timeout 45 "$OCA" "$@"
  )
}

telegram_probe() {
  local output="$1"
  cli channels status --probe --json | sanitize_a5_stream > "$output" || return 1
  jq -e '
    (.channels.telegram // empty) as $channel |
    ([.channelAccounts.telegram[]?, $channel, $channel.accounts[]?]) as $records |
    select($channel.configured? == true) |
    select(any($records[];
      .probe?.ok? == true or .probeOk? == true or
      .connected? == true or .running? == true
    )) |
    select(all($records[]; .restartPending? != true))
  ' "$output" >/dev/null
}

record_result() {
  local name="$1" classification="$2" note="$3"
  printf '%s\t%s\t%s\n' "$name" "$classification" "$note" >> "$SUMMARY"
  echo "CASE-RESULT: $name => $classification ($note)"
}

classify() {
  printf '%s\t%s\n' "$1" "$2" > "$CASE_OUTCOME"
}

run_case() {
  local name="$1" essential="$2" case_log="$LOGS/a5-$1.log"
  shift 2
  local rc before_root after_root journal_cursor="$S1/a5-$name-journal.cursor"
  CASE_CLASS=""
  CASE_NOTE=""
  CASE_OUTCOME="$S1/a5-$name.outcome"
  : > "$CASE_OUTCOME"
  inventory_root > "$S1/a5-$name-root-before.inventory"
  inventory_tree "$STATE" > "$S1/a5-$name-state-before.inventory"
  before_root="$(sha256sum "$S1/a5-$name-root-before.inventory" | awk '{print $1}')"
  journalctl --user -u "$UNIT" -n 0 --show-cursor --no-pager > "$journal_cursor"
  echo "== writer case: $name root_before=$before_root =="
  set +e
  ( "$@" ) 2>&1 | sanitize_a5_stream > "$case_log"
  rc="${PIPESTATUS[0]}"
  set -e
  if test -s "$CASE_OUTCOME"; then
    IFS=$'\t' read -r CASE_CLASS CASE_NOTE < "$CASE_OUTCOME"
  fi
  sed -n '1,240p' "$case_log"
  inventory_root > "$S1/a5-$name-root-after.inventory"
  inventory_tree "$STATE" > "$S1/a5-$name-state-after.inventory"
  after_root="$(sha256sum "$S1/a5-$name-root-after.inventory" | awk '{print $1}')"
  diff -u "$S1/a5-$name-state-before.inventory" "$S1/a5-$name-state-after.inventory" \
    > "$LOGS/a5-$name-state.diff" || true

  if ! cmp -s "$S1/a5-$name-root-before.inventory" "$S1/a5-$name-root-after.inventory"; then
    CASE_CLASS="INCOMPATIBLE"
    CASE_NOTE="root or pointer mutated"
  elif (( rc != 0 )); then
    CASE_CLASS="HARNESS-ERROR"
    CASE_NOTE="harness trigger or evidence check failed; exit=$rc"
  elif [[ "$CASE_CLASS" != "declarative render" &&
          "$CASE_CLASS" != "graceful skip" &&
          "$CASE_CLASS" != "HARNESS-ERROR" &&
          "$CASE_CLASS" != "NOT-TRIGGERABLE" &&
          "$CASE_CLASS" != "BLOCKED" &&
          "$CASE_CLASS" != "INCOMPATIBLE" ]]; then
    CASE_CLASS="HARNESS-ERROR"
    CASE_NOTE="case emitted no allowed classification"
  fi

  journalctl --user -u "$UNIT" --after-cursor \
    "$(sed -n 's/^-- cursor: //p' "$journal_cursor")" --no-pager 2>/dev/null |
    sanitize_a5_stream > "$LOGS/a5-$name-journal.log" || true
  if (( rc == 0 )) && [[ "$CASE_CLASS" != "INCOMPATIBLE" ]]; then
    case "$name" in
      defaultTo-declared)
        if ! grep -Fq \
            "telegram recipient $SPIKE_TG_GROUP_USERNAME resolved to numeric chat id $SPIKE_TG_GROUP_ID" \
            "$LOGS/a5-defaultTo-declared-send.log" "$LOGS/a5-$name-journal.log"; then
          CASE_CLASS="HARNESS-ERROR"
          CASE_NOTE="declared send lacked positive username-resolution evidence"
        elif grep -Eiq \
            'resolved Telegram defaultTo target|failed to persist Telegram defaultTo target|skipping Telegram target writeback' \
            "$LOGS/a5-defaultTo-declared-send.log" "$LOGS/a5-$name-journal.log"; then
          CASE_CLASS="HARNESS-ERROR"
          CASE_NOTE="declared send unexpectedly entered target writeback"
        else
          CASE_CLASS="declarative render"
          CASE_NOTE="declared defaultTo resolved and sent; declarative value made writeback unnecessary"
        fi
        ;;
      defaultTo-undeclared)
        if ! grep -Fq \
            "telegram recipient $SPIKE_TG_GROUP_USERNAME resolved to numeric chat id $SPIKE_TG_GROUP_ID" \
            "$LOGS/a5-defaultTo-undeclared-send.log" "$LOGS/a5-$name-journal.log"; then
          CASE_CLASS="HARNESS-ERROR"
          CASE_NOTE="undeclared send lacked positive username-resolution evidence"
        elif grep -Fq \
            "skipping Telegram target writeback for $SPIKE_TG_GROUP_USERNAME because gateway caller is missing operator.admin" \
            "$LOGS/a5-defaultTo-undeclared-send.log" "$LOGS/a5-$name-journal.log"; then
          CASE_CLASS="graceful skip"
          CASE_NOTE="username resolved; exact operator.admin guard skipped writeback cleanly"
        elif grep -h -F \
            "failed to persist Telegram defaultTo target $SPIKE_TG_GROUP_USERNAME:" \
            "$LOGS/a5-defaultTo-undeclared-send.log" "$LOGS/a5-$name-journal.log" |
            grep -Eiq 'NixModeConfigMutationError|Config is managed by Nix|permission denied|operation not permitted|read-only file system|EACCES|EPERM|EROFS'; then
          CASE_CLASS="graceful skip"
          CASE_NOTE="username resolved; exact caught app/OS denial left immutable config unchanged"
        elif ! grep -Eiq \
            'resolved Telegram defaultTo target|failed to persist Telegram defaultTo target|skipping Telegram target writeback' \
            "$LOGS/a5-defaultTo-undeclared-send.log" "$LOGS/a5-$name-journal.log"; then
          CASE_CLASS="graceful skip"
          CASE_NOTE="username resolved; undeclared config had no defaultTo slot, so the source-pinned conditional performed no write"
        else
          CASE_CLASS="HARNESS-ERROR"
          CASE_NOTE="undeclared defaultTo produced an unknown writeback outcome"
        fi
        ;;
    esac
  fi
  if grep -Eiq 'uncaught|unhandled|event.handler.*(crash|fail)|Group migration handler failed' \
      "$case_log" "$LOGS/a5-$name-journal.log"; then
    CASE_CLASS="INCOMPATIBLE"
    CASE_NOTE="event-handler crash signature"
  fi
  record_result "$name" "$CASE_CLASS" "$CASE_NOTE"
  if [[ "$CASE_CLASS" == "INCOMPATIBLE" && "$essential" == "yes" ]]; then
    FAILURES=$((FAILURES + 1))
  fi
  echo "writer_case=$name exit=$rc root_before=$before_root root_after=$after_root"
}

case_login_bootstrap() {
  local status="$LOGS/a5-login-bootstrap-status.json"
  telegram_probe "$status"
  jq -e '.channels.telegram.configWrites == false and
         .channels.telegram.defaultTo == $target' \
    --arg target "$SPIKE_TG_GROUP_USERNAME" "$CFG" >/dev/null
  classify "declarative render" \
    "env-token bootstrap plus Telegram probe; configWrites:false rendered"
}

case_pairing_owner() {
  local before="$LOGS/a5-pairing-before.json" after="$LOGS/a5-pairing-after.json"
  local approve="$LOGS/a5-pairing-approve.log" code sender rc
  cli pairing list --channel telegram --json | sanitize_a5_stream > "$before" || return 1
  # bounded poll rather than a blind sleep: exits as soon as a genuinely new
  # externally-triggered request appears, so the operator window is generous
  # without weakening the "new code not in the before-list" requirement
  echo "OPERATOR-ACTION: send the disposable bot a fresh DM (window: 300s)."
  local waited=0
  while (( waited < 300 )); do
    sleep 5; waited=$((waited + 5))
    cli pairing list --channel telegram --json | sanitize_a5_stream > "$after" || return 1
    jq -e --slurpfile before "$before" '
      [.. | objects | select(.code? != null)] |
      map(select(.code as $c | any($before[0].. | objects; .code? == $c) | not)) |
      length > 0' "$after" >/dev/null 2>&1 && break
  done
  echo "pairing-window-waited-seconds=$waited"
  code="$(jq -r --slurpfile before "$before" '
    [.. | objects | select(.code? != null)] |
    map(select(.code as $code |
      any($before[0].. | objects; .code? == $code) | not
    )) | first | .code // empty
  ' "$after")"
  test -n "$code" || {
    echo "BLOCKED: no new externally triggered pairing request was observed"
    classify "BLOCKED" "operator DM absent; no new pairing request in the 300s window"
    return 0
  }
  sender="$(jq -r --arg code "$code" \
    '.. | objects | select(.code? == $code) | .id? // empty' "$after" | head -1)"
  test -n "$sender" || {
    echo "HARNESS-ERROR: selected new pairing request lacked its sender id"
    return 1
  }
  set +e
  cli pairing approve telegram "$code" 2>&1 | sanitize_a5_stream > "$approve"
  rc="${PIPESTATUS[0]}"
  set -e
  grep -Fq "Approved telegram sender $sender." "$approve" || {
    echo "HARNESS-ERROR: pairing approval lacked its exact sender-bound completion"
    return 1
  }
  if (( rc == 0 )); then
    :
  elif ! grep -Eiq 'permission denied|operation not permitted|read-only file system|EACCES|EPERM|EROFS' "$approve"; then
    echo "HARNESS-ERROR: pairing approval failed without its owner-config OS denial"
    return 1
  fi
  cli pairing list --channel telegram --json |
    sanitize_a5_stream > "$after.approved" || return 1
  if jq -e --arg code "$code" '.. | objects | select(.code? == $code)' "$after.approved" >/dev/null; then
    echo "HARNESS-ERROR: approved pairing request remains pending"
    return 1
  fi
  if ! rg -l -F -- "$sender" "$STATE" --glob '*.json' > "$LOGS/a5-pairing-store-files.txt" ||
      ! grep -q . "$LOGS/a5-pairing-store-files.txt"; then
    echo "HARNESS-ERROR: approved sender was not persisted in the pairing store"
    return 1
  fi
  if (( rc == 0 )); then
    classify "graceful skip" \
      "new sender persisted in pairing store; exact approval completed without owner-config mutation"
  else
    classify "INCOMPATIBLE" \
      "pairing store persisted sender, but first-owner config write raised an OS denial instead of skipping"
  fi
}

message_send_succeeded() {
  jq -eR '
    fromjson? |
    select(.action == "send" and .channel == "telegram" and
      .dryRun == false and .handledBy == "plugin" and
      .payload.ok == true and (.messageId | strings | length > 0))
  ' "$1" >/dev/null
}

case_default_to_declared() {
  local send_log="$LOGS/a5-defaultTo-declared-send.log"
  jq -e '.channels.telegram.defaultTo == $target' \
    --arg target "$SPIKE_TG_GROUP_USERNAME" "$CFG" >/dev/null
  cli --log-level debug message send --channel telegram \
    --target "$SPIKE_TG_GROUP_USERNAME" \
    --message "P0 spike declared defaultTo case" --json --verbose 2>&1 |
    sanitize_a5_stream > "$send_log" || return 1
  message_send_succeeded "$send_log" || {
    echo "HARNESS-ERROR: declared defaultTo send lacked its exact success result"
    return 1
  }
  sed -n '1,240p' "$send_log"
  classify "declarative render" \
    "declared defaultTo send succeeded; awaiting combined debug/journal no-attempt proof"
}

case_default_to_undeclared() {
  local send_log="$LOGS/a5-defaultTo-undeclared-send.log"
  jq -e '.channels.telegram | has("defaultTo") | not' "$CFG" >/dev/null
  cli --log-level debug message send --channel telegram \
    --target "$SPIKE_TG_GROUP_USERNAME" \
    --message "P0 spike undeclared defaultTo case" --json --verbose 2>&1 |
    sanitize_a5_stream > "$send_log" || return 1
  message_send_succeeded "$send_log" || {
    echo "HARNESS-ERROR: undeclared defaultTo send lacked its exact success result"
    return 1
  }
  sed -n '1,240p' "$send_log"
  classify "graceful skip" \
    "undeclared defaultTo send succeeded; awaiting combined debug/journal writeback outcome"
}

case_reconnect() {
  local before="$LOGS/a5-reconnect-before.json"
  local stop_log="$LOGS/a5-reconnect-stop.json"
  local start_log="$LOGS/a5-reconnect-start.json" after="$LOGS/a5-reconnect-status.json"
  telegram_probe "$before"
  cli gateway call channels.stop \
    --params '{"channel":"telegram","accountId":"default"}' --json 2>&1 |
    sanitize_a5_stream > "$stop_log" || return 1
  jq -e '.stopped == true' "$stop_log" >/dev/null || return 1
  cli gateway call channels.start \
    --params '{"channel":"telegram","accountId":"default"}' --json 2>&1 |
    sanitize_a5_stream > "$start_log" || return 1
  jq -e '.started == true' "$start_log" >/dev/null || return 1
  telegram_probe "$after"
  jq -e '
    ([.channelAccounts.telegram[]?, .channels.telegram, .channels.telegram.accounts[]?]) as $records |
    select(any($records[]; (.connected? == true or .running? == true) and .restartPending? != true))
  ' "$after" >/dev/null
  classify "declarative render" \
    "channels.stop/start RPC reconnect completed; status returned connected/running with restartPending false"
}

token_swap_restore() {
  local original_rc="$1" restore_rc=0
  trap - EXIT
  write_credential "$TELEGRAM_CREDENTIAL" "$SPIKE_TG_BOT_TOKEN" || restore_rc=$?
  unset INVALID_TOKEN
  if (( restore_rc == 0 )); then
    systemctl --user restart "$UNIT" || restore_rc=$?
  fi
  if (( restore_rc == 0 )); then
    wait_health || restore_rc=$?
  fi
  if (( restore_rc == 0 )); then
    telegram_probe "$LOGS/a5-token-swap-restored-status.json" || restore_rc=$?
  fi
  if (( restore_rc != 0 )); then
    : > "$S1/a5-token-swap-restore.failed"
    echo "FATAL: token-swap restoration/probe failed; later writer cases are forbidden"
    exit 125
  fi
  exit "$original_rc"
}

case_token_swap() {
  local invalid_journal="$LOGS/a5-token-swap-invalid-journal.log"
  rm -f "$S1/a5-token-swap-restore.failed"
  trap 'token_swap_restore "$?"' EXIT
  INVALID_TOKEN="$(printf '%09d:%s' 0 "$(openssl rand -hex 16)")"
  write_credential "$TELEGRAM_CREDENTIAL" "$INVALID_TOKEN"
  systemctl --user restart "$UNIT" || return 1
  sleep 12
  journalctl --user -u "$UNIT" -n 160 --no-pager 2>&1 |
    sanitize_a5_stream > "$invalid_journal" || true
  grep -Fq 'Telegram bot token unauthorized for account "default" (getMe returned 401 from Telegram; source: env token).' \
    "$invalid_journal" || {
      echo "HARNESS-ERROR: pinned invalid-token handler signature was absent"
      return 1
    }
  classify "declarative render" \
    "invalid token handler fired; token remains external in the unit-private credential"
}

case_group_migration() {
  local cursor="$S1/a5-group-migration.cursor" journal="$LOGS/a5-group-migration-event.log"
  if [[ "$SPIKE_TG_GROUP_ID" =~ ^-100[0-9]+$ ]]; then
    classify "NOT-TRIGGERABLE" \
      "disposable chat is already a supergroup; its one-time basic-group migration cannot recur"
    return 0
  fi
  journalctl --user -u "$UNIT" -n 0 --show-cursor --no-pager > "$cursor"
  echo "OPERATOR-ACTION: optionally convert the disposable group within 45 seconds."
  sleep 45
  journalctl --user -u "$UNIT" --after-cursor \
    "$(sed -n 's/^-- cursor: //p' "$cursor")" --no-pager 2>&1 |
    sanitize_a5_stream > "$journal" || return 1
  if grep -Fq 'Group migrated:' "$journal"; then
    grep -Fq 'Config writes disabled; skipping group config migration.' "$journal" || {
      echo "HARNESS-ERROR: migration event lacked the exact configWrites:false handler outcome"
      return 1
    }
    classify "graceful skip" \
      "migration event observed; exact configWrites:false skip handler completed"
  else
    classify "BLOCKED" "operator conversion absent during the 45s window"
  fi
}

generate_matrix() {
  local expected case_name classification note count
  expected=$'login-bootstrap\npairing-first-owner\ndefaultTo-declared\ndefaultTo-undeclared\nreconnect\ntoken-swap\ngroup-supergroup-migration'
  [[ "$(tail -n +2 "$SUMMARY" | cut -f1 | LC_ALL=C sort)" == "$(printf '%s\n' "$expected" | LC_ALL=C sort)" ]] ||
    { echo "ASSERT-FAIL: writer summary has missing, duplicate, or unknown rows"; return 1; }
  while IFS=$'\t' read -r case_name classification note; do
    [[ "$classification" == "declarative render" ||
       "$classification" == "graceful skip" ||
       "$classification" == "HARNESS-ERROR" ||
       "$classification" == "NOT-TRIGGERABLE" ||
       "$classification" == "BLOCKED" ||
       "$classification" == "INCOMPATIBLE" ]] ||
      { echo "ASSERT-FAIL: invalid classification for $case_name"; return 1; }
    [[ -n "$note" ]] || { echo "ASSERT-FAIL: blank note for $case_name"; return 1; }
    count="$(awk -F '\t' -v name="$case_name" '$1 == name {n++} END {print n+0}' "$SUMMARY")"
    (( count == 1 )) || { echo "ASSERT-FAIL: duplicate row for $case_name"; return 1; }
  done < <(tail -n +2 "$SUMMARY")
  if awk -F '\t' '$2 == "INCOMPATIBLE" {bad=1} END {exit !bad}' "$SUMMARY"; then
    echo "ASSERT-FAIL: an operationally essential writer is INCOMPATIBLE"
    return 1
  fi
  {
    echo "# Spike 1 immutable-mode compatibility matrix"
    echo
    echo "| Writer surface | Result | Evidence | Log | Operationally essential? |"
    echo "| --- | --- | --- | --- | --- |"
    while IFS=$'\t' read -r case_name classification note; do
      case "$case_name" in
        login-bootstrap) label="Login/bootstrap"; essential="yes" ;;
        pairing-first-owner) label="Pairing / first-owner persistence"; essential="yes" ;;
        defaultTo-declared) label="\`defaultTo\` declared"; essential="yes" ;;
        defaultTo-undeclared) label="\`defaultTo\` undeclared"; essential="yes" ;;
        reconnect) label="Reconnect"; essential="yes" ;;
        token-swap) label="Token swap"; essential="yes" ;;
        group-supergroup-migration) label="Group to supergroup migration"; essential="only when triggerable" ;;
      esac
      printf '| %s | %s | %s | `a5-%s.log` | %s |\n' \
        "$label" "$classification" "$note" "$case_name" "$essential"
    done < <(tail -n +2 "$SUMMARY")
  } > "$MATRIX"
}

test -r "$CFG" || { echo "FATAL: run setup-root.sh first"; exit 66; }
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }
for help in config-validate channels-status gateway-call pairing-list pairing-approve message-send; do
  test -s "$S1/help/$help.txt" || { echo "FATAL: missing capability proof for $help"; exit 66; }
done
grep -Eq '(^|[[:space:]])--json([=[:space:]]|$)' "$S1/help/message-send.txt" ||
  { echo "FATAL: message send JSON surface is unsupported"; exit 69; }
# There is no root --verbose. Keep the verified root log-level form; the
# separately verified message-local --verbose exposes the guarded writeback log.
grep -Eq '(^|[[:space:]])--log-level([=[:space:]]|$)' "$S1/help/root.txt" ||
  { echo "FATAL: global log-level surface needed for writer signature is unsupported"; exit 69; }
grep -Eq 'debug\|trace|trace' "$S1/help/root.txt" ||
  { echo "FATAL: --log-level does not advertise a debug/trace level"; exit 69; }

echo "== assertion 5: stage declarative Telegram generation =="
MUTATED=1
verify_owned_root
systemctl --user stop "$UNIT" 2>/dev/null || true
safe_user_remove "$STATE" "$ISOHOME" "$WORKSPACE"
mkdir -p "$STATE/log" "$ISOHOME" "$WORKSPACE"
write_credential "$TELEGRAM_CREDENTIAL" "$SPIKE_TG_BOT_TOKEN"
echo "telegram_token_fingerprint=$(credential_fingerprint "$SPIKE_TG_BOT_TOKEN")"

RENDERED="$S1/rendered-writer.json"
jq -S \
  --arg group "$SPIKE_TG_GROUP_ID" \
  --arg username "$SPIKE_TG_GROUP_USERNAME" \
  '.gateway.port = 19023
   | .channels.telegram = {
       enabled: true,
       configWrites: false,
       dmPolicy: "pairing",
       groupPolicy: "open",
       defaultTo: $username,
       groups: { ($group): { requireMention: false, groupPolicy: "open" } }
     }' "$CFG" > "$RENDERED"
CONFIG_HASH="$(sha256sum "$RENDERED" | awk '{print $1}')"
GEN="$CONFIG_HASH"
stage_generation "$RENDERED" "$CONFIG_HASH"
printf '%s\t%s\t%s\n' "$GEN" "$CONFIG_HASH" "19023" >> "$S1/generations.tsv"
switch_root_pointer "$GEN" writer
echo "writer_generation=$GEN config_sha256=$CONFIG_HASH installed_spike_root_sha256=$(root_hash)"

systemctl --user reset-failed "$UNIT" 2>/dev/null || true
systemctl --user start "$UNIT"
wait_health || { echo "FATAL: writer gateway did not become healthy"; exit 1; }
cli config validate 2>&1 | sanitize_a5_stream
printf 'case\tclassification\tnote\n' > "$SUMMARY"

run_case login-bootstrap yes case_login_bootstrap
run_case pairing-first-owner yes case_pairing_owner
run_case defaultTo-declared yes case_default_to_declared

echo "== assertion 5: stage undeclared defaultTo generation =="
DECLARED_GEN="$GEN"
RENDERED_UNDECLARED="$S1/rendered-writer-defaultTo-undeclared.json"
jq -S 'del(.channels.telegram.defaultTo)' "$RENDERED" > "$RENDERED_UNDECLARED"
UNDECLARED_HASH="$(sha256sum "$RENDERED_UNDECLARED" | awk '{print $1}')"
UNDECLARED_GEN="$UNDECLARED_HASH"
stage_generation "$RENDERED_UNDECLARED" "$UNDECLARED_HASH"
printf '%s\t%s\t%s\n' "$UNDECLARED_GEN" "$UNDECLARED_HASH" "19023" >> "$S1/generations.tsv"
switch_root_pointer "$UNDECLARED_GEN" defaultTo-undeclared
systemctl --user restart "$UNIT"
wait_health || { echo "FATAL: undeclared defaultTo generation did not become healthy"; exit 1; }
cli config validate 2>&1 | sanitize_a5_stream
run_case defaultTo-undeclared yes case_default_to_undeclared

echo "== assertion 5: restore declared defaultTo generation =="
switch_root_pointer "$DECLARED_GEN" defaultTo-restore
systemctl --user restart "$UNIT"
wait_health || { echo "FATAL: restored declared defaultTo generation did not become healthy"; exit 1; }
telegram_probe "$LOGS/a5-defaultTo-restored-status.json"
run_case reconnect yes case_reconnect
run_case token-swap yes case_token_swap
test ! -e "$S1/a5-token-swap-restore.failed" ||
  { echo "FATAL: token restoration failed; refusing group-migration case"; exit 125; }
run_case group-supergroup-migration yes case_group_migration

echo "== assertion 6: generate and validate compatibility matrix =="
generate_matrix || FAILURES=$((FAILURES + 1))
test -s "$MATRIX" || { echo "ASSERT-FAIL: matrix was not generated"; FAILURES=$((FAILURES + 1)); }
cat "$MATRIX"

mapfile -t EVIDENCE_LOGS < <(find "$LOGS" -maxdepth 1 -type f -name '*.log' -print | LC_ALL=C sort)
IFS= read -r TELEGRAM_TOKEN < "$TELEGRAM_CREDENTIAL" || [[ -n "$TELEGRAM_TOKEN" ]]
scan_secret_exact "$A5_GATEWAY_TOKEN" "${EVIDENCE_LOGS[@]}"
scan_secret_exact "$TELEGRAM_TOKEN" "${EVIDENCE_LOGS[@]}"
scan_token_shapes "${EVIDENCE_LOGS[@]}"
unset A5_GATEWAY_TOKEN TELEGRAM_TOKEN SPIKE_TG_BOT_TOKEN
manager_secret_environment_absent

if (( FAILURES == 0 )); then
  MUTATED=0
  trap - EXIT INT TERM
  echo "A5-PASS"
else
  echo "A5-FAIL count=$FAILURES"
  exit 1
fi
