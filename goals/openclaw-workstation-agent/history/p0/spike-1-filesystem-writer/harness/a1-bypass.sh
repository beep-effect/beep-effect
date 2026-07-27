#!/usr/bin/env bash
# Contract assertion 1: every service-user filesystem bypass must fail.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
require_context
require_preflight
LOG="$S1/logs/a1-bypass.log"
PTR="$ROOT/current"
CFG="$PTR/openclaw.json"
GEN_DIR="$(readlink -f "$PTR")"
FAILURES=0

mkdir -p "$S1/logs" "$S1/a1-user"
exec > >(tee "$LOG") 2>&1

MUTATED=0
a1_abort() {
  local rc=$?
  trap - EXIT INT TERM
  if (( MUTATED != 0 )); then
    echo "A1-ABORT: running full harness cleanup"
    "$SCRIPT_DIR/cleanup.sh" || true
  fi
  exit "$rc"
}
trap a1_abort EXIT INT TERM

snapshot() {
  sha256sum "$CFG"
  printf 'pointer=%s resolved=%s\n' "$(readlink "$PTR")" "$(readlink -f "$PTR")"
  stat -c '%A %a %U:%G %i %n' "$ROOT" "$PTR" "$GEN_DIR" "$CFG"
  find "$ROOT" -maxdepth 2 -printf '%M %u:%g %i %p -> %l\n' | sort
}

expect_denied() {
  local name="$1"
  shift
  local out="$S1/a1-user/${name}.stderr" rc
  case "$name" in
    write-append|truncate|rename-config|unlink-config)
      test -f "$CFG" || { echo "ASSERT-FAIL: $name target config is absent"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    write-tmp-in-generation|create-generation-entry)
      test -d "$GEN_DIR" || { echo "ASSERT-FAIL: $name generation is absent"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    replace-tmp-rename)
      test -f "$CFG" && test -f "$S1/a1-user/replacement.json" ||
        { echo "ASSERT-FAIL: $name source/target precondition failed"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    rename-entry-into-generation)
      test -d "$GEN_DIR" && test -L "$S1/a1-user/replacement-pointer" ||
        { echo "ASSERT-FAIL: $name source/target precondition failed"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    create-root-entry)
      test -d "$ROOT" || { echo "ASSERT-FAIL: $name root is absent"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    rename-entry-into-root|retarget-pointer-atomic)
      test -d "$ROOT" && test -L "$S1/a1-user/replacement-pointer" ||
        { echo "ASSERT-FAIL: $name source/target precondition failed"; FAILURES=$((FAILURES + 1)); return; }
      ;;
    rename-pointer|retarget-pointer-direct)
      test -L "$PTR" || { echo "ASSERT-FAIL: $name pointer is absent"; FAILURES=$((FAILURES + 1)); return; }
      ;;
  esac
  set +e
  # stdin from /dev/null: a denied target makes tools like `mv` prompt
  # ("overriding mode 0644?") and a pty run would hang on it forever
  "$@" >"$S1/a1-user/${name}.stdout" 2>"$out" </dev/null
  rc=$?
  set -e
  printf 'ATTEMPT %-30s exit=%s errno_text=%q\n' "$name" "$rc" "$(tr '\n' ' ' < "$out")"
  if (( rc == 0 )); then
    echo "ASSERT-FAIL: $name unexpectedly succeeded"
    FAILURES=$((FAILURES + 1))
  elif ! grep -Eiq \
      'permission denied|operation not permitted|read-only file system|EACCES|EPERM|EROFS' "$out"; then
    echo "ASSERT-FAIL: $name failed without an OS permission/read-only signature"
    FAILURES=$((FAILURES + 1))
  else
    echo "ASSERT-PASS: $name denied by the filesystem"
  fi
}

echo "== assertion 1: immutable root bypass attempts as uid=$(id -u) user=$(id -un) =="
test -f "$CFG" || { echo "FATAL: config target is absent"; exit 66; }
test -d "$GEN_DIR" || { echo "FATAL: generation directory is absent"; exit 66; }
test -L "$PTR" || { echo "FATAL: active pointer is not a symlink"; exit 66; }
[[ "$GEN_DIR" == "$ROOT/"* ]] || { echo "FATAL: active generation escapes root"; exit 73; }
echo "== before inventory =="
snapshot | tee "$S1/a1-before.txt"
MUTATED=1

printf '{"replacement":true}\n' > "$S1/a1-user/replacement.json"
rm -f "$S1/a1-user/replacement-pointer"
ln -s "$(readlink "$PTR")" "$S1/a1-user/replacement-pointer"

expect_denied write-append bash -c 'printf x >> "$1"' _ "$CFG"
expect_denied truncate bash -c ': > "$1"' _ "$CFG"
expect_denied write-tmp-in-generation bash -c 'printf x > "$1/.user-tmp"' _ "$GEN_DIR"
expect_denied replace-tmp-rename mv -T "$S1/a1-user/replacement.json" "$CFG"
expect_denied rename-config mv "$CFG" "$GEN_DIR/openclaw.renamed"
expect_denied unlink-config rm "$CFG"
expect_denied create-generation-entry touch "$GEN_DIR/user-created"
expect_denied rename-entry-into-generation mv "$S1/a1-user/replacement-pointer" "$GEN_DIR/user-entry"
rm -f "$S1/a1-user/replacement-pointer"
ln -s "$(readlink "$PTR")" "$S1/a1-user/replacement-pointer"
expect_denied create-root-entry touch "$ROOT/user-created"
expect_denied rename-entry-into-root mv "$S1/a1-user/replacement-pointer" "$ROOT/user-entry"
rm -f "$S1/a1-user/replacement-pointer"
ln -s "$(readlink "$PTR")" "$S1/a1-user/replacement-pointer"
[[ "$PTR" == "$ROOT/current" ]] ||
  { echo "FATAL: pointer operation target escaped root"; exit 73; }
expect_denied rename-pointer mv "$PTR" "$ROOT/current.renamed"
expect_denied retarget-pointer-direct ln -sfn "$(readlink "$PTR")" "$PTR"
expect_denied retarget-pointer-atomic mv -T "$S1/a1-user/replacement-pointer" "$PTR"

echo "== after inventory =="
snapshot | tee "$S1/a1-after.txt"
if cmp -s "$S1/a1-before.txt" "$S1/a1-after.txt"; then
  echo "ASSERT-PASS: zero mutation; before/after inventory is byte-identical"
else
  echo "ASSERT-FAIL: immutable root inventory changed"
  diff -u "$S1/a1-before.txt" "$S1/a1-after.txt" || true
  FAILURES=$((FAILURES + 1))
fi

if (( FAILURES == 0 )); then
  MUTATED=0
  trap - EXIT INT TERM
  echo "A1-PASS"
else
  echo "A1-FAIL count=$FAILURES"
  exit 1
fi
