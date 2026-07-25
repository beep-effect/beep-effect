#!/usr/bin/env bash
# Contract assertion 3: exact CLI writers reject/skip cleanly under the guard.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight

LOG="$LOGS/a3-config-set-doctor.log"
CFG="$ROOT/current/openclaw.json"
FAILURES=0
mkdir -p "$LOGS"
exec > >(tee "$LOG") 2>&1

MUTATED=0
SERVICE_QUIESCED=0
SERVICE_RESTORED=0
PRE_ACTIVE_STATE="$(systemctl --user show -p ActiveState --value "$UNIT" 2>/dev/null || true)"
PRE_UNIT_ACTIVE=0
[[ "$PRE_ACTIVE_STATE" == "active" ]] && PRE_UNIT_ACTIVE=1
echo "pre-state service=$UNIT active=$PRE_UNIT_ACTIVE ActiveState=${PRE_ACTIVE_STATE:-unknown}"

wait_quiesced() {
  local waited=0 active_state cgroup
  while (( waited < 40 )); do
    active_state="$(systemctl --user show -p ActiveState --value "$UNIT" 2>/dev/null || true)"
    cgroup="$(systemctl --user show -p ControlGroup --value "$UNIT" 2>/dev/null || true)"
    if [[ "$active_state" == "inactive" ]] &&
        [[ -z "$(ports_inventory)" ]] &&
        [[ -z "$cgroup" || ! -s "/sys/fs/cgroup$cgroup/cgroup.procs" ]]; then
      echo "service-quiesced-for-assertion-3 ActiveState=$active_state listeners=0 cgroup_members=0"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo "FATAL: service would not quiesce for assertion 3"
  unit_cgroup_pids
  ports_inventory
  return 1
}

wait_health() {
  local port="$1" waited=0 code path
  while (( waited < 40 )); do
    for path in /health /healthz /readyz; do
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 \
        "http://127.0.0.1:$port$path" 2>/dev/null || true)"
      if [[ "$code" =~ ^2 ]]; then
        echo "probe=http://127.0.0.1:$port$path status=$code"
        return 0
      fi
    done
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

restore_service() {
  if (( PRE_UNIT_ACTIVE != 0 )); then
    systemctl --user restart "$UNIT"
    [[ "$(systemctl --user show -p ActiveState --value "$UNIT")" == "active" ]] ||
      { echo "FATAL: service did not restore to active state"; return 1; }
    [[ "$(readlink "$ROOT/current")" == "$ACTIVE_GEN" ]] ||
      { echo "FATAL: active generation changed during assertion 3"; return 1; }
    wait_health "$ACTIVE_PORT" ||
      { echo "FATAL: restored service failed health probe on port $ACTIVE_PORT"; return 1; }
    echo "post-state service=$UNIT active=1 ActiveState=active generation=$ACTIVE_GEN port=$ACTIVE_PORT"
  else
    wait_quiesced
    echo "post-state service=$UNIT active=0 ActiveState=inactive"
  fi
  SERVICE_RESTORED=1
}

a3_abort() {
  local rc=$?
  trap - EXIT INT TERM
  if (( SERVICE_QUIESCED != 0 && SERVICE_RESTORED == 0 )); then
    echo "A3-ABORT: restoring recorded service state"
    restore_service || rc=1
  fi
  if (( MUTATED != 0 )); then
    echo "A3-ABORT: running full harness cleanup"
    "$SCRIPT_DIR/cleanup.sh" || true
  fi
  exit "$rc"
}
trap a3_abort EXIT INT TERM

writer_env() {
  env -i \
    PATH="$NODEBIN:/usr/bin:/bin" \
    HOME="$ISOHOME" \
    OPENCLAW_CONFIG_PATH="$CFG" \
    OPENCLAW_STATE_DIR="$STATE" \
    OPENCLAW_NIX_MODE=1 \
    OPENCLAW_SERVICE_REPAIR_POLICY=external \
    OLLAMA_API_KEY=ollama-local \
    timeout 45 "$OCA" "$@"
}

logical_sqlite_hash() {
  local database="$1" hash
  test -f "$database" ||
    { echo "FATAL: SQLite database disappeared before logical inventory: $database" >&2; return 73; }
  hash="$(
    python3 - "$database" "$CFG" <<'PY' |
import re
import sqlite3
import sys

database, config_path = sys.argv[1:]
source = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
copy = sqlite3.connect(":memory:")
source.backup(copy)
source.close()
tables = {row[0] for row in copy.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
)}

observed_at = re.compile(r'("observedAt"\s*:\s*)"(?:[^"\\]|\\.)*"')
mode = re.compile(r'("mode"\s*:\s*)(?:33188|420)(?=\s*[,}])')

def normalize_fingerprint(value):
    if value is None:
        return None
    value = observed_at.sub(r'\1"<observation-time>"', value)
    return mode.sub(r'\g<1>420', value)

if "config_health_entries" in tables:
    rows = copy.execute(
        """
        SELECT rowid, last_known_good_json, last_promoted_good_json
        FROM config_health_entries
        WHERE config_path = ?
        """,
        (config_path,),
    ).fetchall()
    for rowid, last_known_good, last_promoted_good in rows:
        copy.execute(
            """
            UPDATE config_health_entries
            SET last_known_good_json = ?,
                last_promoted_good_json = ?,
                updated_at_ms = 0
            WHERE rowid = ?
            """,
            (
                normalize_fingerprint(last_known_good),
                normalize_fingerprint(last_promoted_good),
                rowid,
            ),
        )
if "schema_meta" in tables:
    copy.execute(
        """
        UPDATE schema_meta
        SET updated_at = 0
        WHERE meta_key = 'primary' AND role = 'global'
        """
    )
copy.commit()
print(f"user_version={copy.execute('PRAGMA user_version').fetchone()[0]}")
print("\n".join(copy.iterdump()))
copy.close()
PY
    sha256sum |
      awk '{print $1}'
  )" || {
    echo "FATAL: could not produce normalized logical SQLite inventory: $database" >&2
    return 73
  }
  printf '%s  %s\n' "$hash" "$database [logical SQLite dump + user_version; observation volatility normalized]"
}

config_health_snapshot() {
  local output="$1"
  python3 - "$STATE" "$CFG" > "$output" <<'PY'
import json
import pathlib
import sqlite3
import sys

state, config_path = sys.argv[1:]
matches = []
for database in sorted(pathlib.Path(state).rglob("*.sqlite")):
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    has_table = connection.execute(
        """
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'config_health_entries'
        """
    ).fetchone()
    if has_table:
        rows = connection.execute(
            """
            SELECT config_path, last_known_good_json, last_promoted_good_json
            FROM config_health_entries
            WHERE config_path = ?
            """,
            (config_path,),
        ).fetchall()
        matches.extend((str(database), *row) for row in rows)
    connection.close()

if len(matches) != 1:
    raise SystemExit(
        f"FATAL: expected exactly one config_health_entries row for {config_path}; "
        f"found {len(matches)}"
    )

database, recorded_path, last_known_good_raw, last_promoted_good_raw = matches[0]
fingerprints = []
for column, raw in (
    ("last_known_good_json", last_known_good_raw),
    ("last_promoted_good_json", last_promoted_good_raw),
):
    # last_promoted_good_json is legitimately NULL until a config is promoted.
    # Emit a stable sentinel so the before/after comparison still catches a
    # NULL -> value transition; last_known_good_json stays strictly required.
    if raw is None and column == "last_promoted_good_json":
        fingerprints.extend(("<null>", "<null>"))
        continue
    try:
        fingerprint = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as error:
        raise SystemExit(f"FATAL: {column} is not valid fingerprint JSON: {error}")
    observed_hash = fingerprint.get("hash") if isinstance(fingerprint, dict) else None
    observed_bytes = fingerprint.get("bytes") if isinstance(fingerprint, dict) else None
    if not isinstance(observed_hash, str) or not observed_hash:
        raise SystemExit(f"FATAL: {column} lacks a non-empty hash")
    if isinstance(observed_bytes, bool) or not isinstance(observed_bytes, int) or observed_bytes < 0:
        raise SystemExit(f"FATAL: {column} lacks a non-negative integer bytes value")
    fingerprints.extend((observed_hash, str(observed_bytes)))

print("\t".join((database, recorded_path, *fingerprints)))
PY
}

log_config_health_snapshot() {
  local phase="$1" snapshot="$2"
  local database recorded_path known_hash known_bytes promoted_hash promoted_bytes
  IFS=$'\t' read -r \
    database recorded_path known_hash known_bytes promoted_hash promoted_bytes < "$snapshot"
  echo "config-health-positive-evidence: phase=$phase path=$recorded_path database=$database hash=$known_hash bytes=$known_bytes promoted_hash=$promoted_hash promoted_bytes=$promoted_bytes"
}

run_writer() {
  local name="$1"
  shift
  local out="$LOGS/a3-${name}.log" rc branch="unclassified" command_failed=0
  local app_log="$STATE/log/openclaw.log" log_size_before log_size_after log_size_delta database
  local health_before="$S1/a3-${name}-before.config-health.tsv"
  local health_after="$S1/a3-${name}-after.config-health.tsv"
  echo "== assertion 3: $name =="
  log_size_before="$(stat -c %s "$app_log" 2>/dev/null || printf '0')"
  config_health_snapshot "$health_before"
  log_config_health_snapshot before "$health_before"
  inventory_runtime > "$S1/a3-${name}-before.inventory"
  set +e
  writer_env "$@" >"$out" 2>&1
  rc=$?
  set -e
  echo "exit=$rc"
  inventory_runtime > "$S1/a3-${name}-after.inventory"
  config_health_snapshot "$health_after"
  log_config_health_snapshot after "$health_after"
  log_size_after="$(stat -c %s "$app_log" 2>/dev/null || printf '0')"
  log_size_delta=$((log_size_after - log_size_before))
  sed -n '1,200p' "$out"
  echo "inventory-compared-byte-exact: privileged root and pointer; unit files; identity; all type/mode/owner/inode/path/link metadata; all nonvolatile regular-file hashes; each normalized SQLite logical dump plus PRAGMA user_version"
  echo "logical-sqlite-normalization: table=config_health_entries row=config_path=$CFG fields=last_known_good_json.observedAt,last_promoted_good_json.observedAt action=replace-observation-time"
  echo "logical-sqlite-normalization: table=config_health_entries row=config_path=$CFG fields=last_known_good_json.mode,last_promoted_good_json.mode action=treat-33188-full-st_mode-and-420-permission-bits-as-420"
  echo "logical-sqlite-normalization: table=config_health_entries row=config_path=$CFG field=updated_at_ms action=replace-observation-epoch-millis"
  echo "logical-sqlite-normalization: table=schema_meta row=meta_key=primary,role=global field=updated_at action=replace-observation-epoch-millis"
  echo "inventory-excluded-volatile: path=$app_log content-hash reason=application-log size_before=$log_size_before size_after=$log_size_after size_delta=$log_size_delta"
  while IFS= read -r -d '' database; do
    echo "inventory-excluded-volatile: path=${database}-wal content-hash reason=raw-SQLite-sidecar-logical-database-compared"
    echo "inventory-excluded-volatile: path=${database}-shm content-hash reason=raw-SQLite-sidecar-logical-database-compared"
  done < <(find "$STATE" -xdev -type f -name '*.sqlite' -print0 | LC_ALL=C sort -z)

  if (( rc == 124 )); then
    echo "ASSERT-FAIL: $name timed out"
    command_failed=1
  elif grep -Eiq \
      'stack trace|^[[:space:]]+at .+:[0-9]+:[0-9]+|uncaught|unhandled.*rejection|core dump(ed)?|segmentation fault|ENOENT|ENOTDIR|no such file or directory|cannot find module|module not found|command not found' \
      "$out"; then
    echo "ASSERT-FAIL: $name emitted a crash or incidental ENOENT signature"
    command_failed=1
  elif (( rc != 0 )) &&
      grep -Fq 'NixModeConfigMutationError' "$out" &&
      grep -Fq 'Config is managed by Nix (`OPENCLAW_NIX_MODE=1`), so OpenClaw treats openclaw.json as immutable.' "$out"; then
    branch="app-layer-refusal"
  elif (( rc != 0 )) &&
      grep -Eiq 'permission denied|operation not permitted|read-only file system|EACCES|EPERM|EROFS' "$out"; then
    branch="os-denial"
  elif (( rc == 0 )) &&
      [[ "$name" == "doctor-repair" ]] &&
      grep -Fq 'Doctor config writes are disabled because OpenClaw is running in Nix mode.' "$out"; then
    branch="clean-skip"
  else
    echo "ASSERT-FAIL: $name lacked a pinned refusal or genuine clean-skip signature"
    command_failed=1
  fi
  echo "mechanism=$branch exit=$rc"

  if [[ "$name" == "config-set" &&
        ( "$branch" == "app-layer-refusal" || "$branch" == "os-denial" ) ]] &&
      ! grep -Fxq "Config path: $CFG" "$out"; then
    echo "ASSERT-FAIL: config-set refusal did not name the exact active config path"
    command_failed=1
  fi
  if ! cmp -s "$health_before" "$health_after"; then
    echo "ASSERT-FAIL: $name changed config-health hash or bytes for the exact active config path"
    diff -u "$health_before" "$health_after" || true
    command_failed=1
  else
    echo "config-health-positive-assertion: path=$CFG hash-and-bytes-identical"
  fi
  if ! cmp -s "$S1/a3-${name}-before.inventory" "$S1/a3-${name}-after.inventory"; then
    echo "ASSERT-FAIL: $name changed byte-exact inventory or non-observation SQLite content"
    diff -u "$S1/a3-${name}-before.inventory" "$S1/a3-${name}-after.inventory" || true
    command_failed=1
  fi
  if (( command_failed == 0 )); then
    echo "ASSERT-PASS: $name used $branch, preserved the attested config hash and bytes, and left all protected non-observation content byte-stable"
  else
    FAILURES=$((FAILURES + 1))
  fi
}

test -r "$CFG" || { echo "FATAL: run setup-root.sh first"; exit 66; }
sudo -n true || { echo "FATAL: sudo is not interactively primed"; exit 77; }
for help in "$S1/help/config-set.txt" "$S1/help/doctor.txt"; do
  test -s "$help" || { echo "FATAL: required archived help missing: $help"; exit 66; }
done
grep -Eq '(^|[[:space:]])--fix([=[:space:]]|$)' "$S1/help/doctor.txt" ||
  { echo "FATAL: exact doctor repair command is unsupported"; exit 69; }
grep -Eq '(^|[[:space:]])--non-interactive([=[:space:]]|$)' "$S1/help/doctor.txt" ||
  { echo "FATAL: exact non-interactive doctor repair surface is unsupported"; exit 69; }

ACTIVE_GEN="$(readlink "$ROOT/current")"
ACTIVE_PORT="$(jq -er '.gateway.port | select(type == "number")' "$CFG")"
[[ "$ACTIVE_GEN" =~ ^[0-9a-f]{64}$ ]] ||
  { echo "FATAL: active generation is invalid"; exit 73; }
[[ "$ACTIVE_PORT" =~ ^1902[123]$ ]] ||
  { echo "FATAL: active generation port is not a spike port: $ACTIVE_PORT"; exit 73; }

MUTATED=1
SERVICE_QUIESCED=1
systemctl --user stop "$UNIT"
wait_quiesced
run_writer config-set config set logging.level debug
run_writer doctor-repair doctor --fix --non-interactive

scan_token_shapes "$LOG" "$LOGS/a3-config-set.log" "$LOGS/a3-doctor-repair.log"
restore_service
if (( FAILURES == 0 )); then
  MUTATED=0
  trap - EXIT INT TERM
  echo "A3-PASS"
else
  echo "A3-FAIL count=$FAILURES"
  exit 1
fi
