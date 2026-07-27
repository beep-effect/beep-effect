#!/usr/bin/env bash
# Shared safety and evidence helpers for the P0 spike 1 harness.
set -euo pipefail

require_context() {
  P="${SPIKE_P:?SPIKE_P is required (absolute disposable scratch directory)}"
  case "$P" in /*) ;; *) echo "FATAL: SPIKE_P must be absolute" >&2; return 64 ;; esac
  (( EUID != 0 )) || { echo "FATAL: run as the service user, not root" >&2; return 77; }
  [[ "$P" =~ ^/[A-Za-z0-9._/-]+$ && "$P" != "/" ]] ||
    { echo "FATAL: SPIKE_P must use only path-safe characters and cannot be /" >&2; return 64; }
  test -d "$P" && test ! -L "$P" ||
    { echo "FATAL: SPIKE_P must be an existing non-symlink directory" >&2; return 73; }
  [[ "$(realpath -e -- "$P")" == "$P" ]] ||
    { echo "FATAL: SPIKE_P must be canonical and contain no symlink traversal" >&2; return 73; }
  [[ "$(stat -c %u "$P")" == "$EUID" ]] ||
    { echo "FATAL: SPIKE_P must be owned by the service user" >&2; return 73; }

  S1="$P/spike1"
  LOGS="$S1/logs"
  STATE="$S1/state"
  ISOHOME="$S1/isohome"
  WORKSPACE="$S1/workspace"
  CREDENTIALS="$S1/credentials"
  ROOT="/etc/beep/openclaw-spike"
  UNIT="openclaw-spike.service"
  UNIT_PATH="$HOME/.config/systemd/user/$UNIT"
  NODEBIN="$HOME/.local/share/mise/installs/node/24/bin"
  PACKAGE_ROOT="$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/openclaw"
  OCA="$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2/node_modules/.bin/openclaw"
  GATEWAY_CREDENTIAL="$CREDENTIALS/gateway-token"
  TELEGRAM_CREDENTIAL="$CREDENTIALS/telegram-token"
  RUNTIME_CREDENTIALS="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/credentials/$UNIT"
  ROOT_MANIFEST="$S1/privileged-paths.manifest"
  ROOT_MARKER="$ROOT/.beep-p0-spike1"
}

init_scratch() {
  if test -e "$S1" && test ! -f "$S1/.beep-p0-spike1-scratch"; then
    echo "FATAL: $S1 exists without the spike1 scratch marker" >&2
    return 73
  fi
  if test -d "$S1" &&
      find "$S1" -xdev \
        \( -type l -o \( -type f -links +1 \) -o ! -uid "$EUID" \) \
        -print -quit | grep -q .; then
    echo "FATAL: spike scratch contains a symlink, hard-linked file, or foreign-owned entry" >&2
    return 73
  fi
  mkdir -p "$S1"
  printf 'beep-p0-spike1\n' > "$S1/.beep-p0-spike1-scratch"
  chmod 0600 "$S1/.beep-p0-spike1-scratch"
}

require_preflight() {
  test -f "$S1/preflight.ok" ||
    { echo "FATAL: run ./preflight.sh successfully before any mutating script" >&2; return 66; }
}

assert_user_contained() {
  local target="$1" parent
  parent="$(realpath -m -- "$S1")"
  target="$(realpath -m -- "$target")"
  [[ "$target" == "$parent" || "$target" == "$parent/"* ]] ||
    { echo "FATAL: path escapes spike scratch: $target" >&2; return 73; }
}

safe_user_remove() {
  local target
  for target in "$@"; do
    assert_user_contained "$target"
    rm -rf -- "$target"
  done
}

verify_owned_root() {
  local marker_hash expected_marker_hash
  sudo test ! -L "$ROOT" ||
    { echo "FATAL: privileged spike root is a symlink: $ROOT" >&2; return 73; }
  [[ "$(realpath -e -- /etc/beep)" == "/etc/beep" ]] ||
    { echo "FATAL: /etc/beep does not resolve canonically" >&2; return 73; }
  [[ "$(sudo realpath -e -- "$ROOT")" == "$ROOT" ]] ||
    { echo "FATAL: privileged spike root escapes its canonical path" >&2; return 73; }
  sudo test -f "$ROOT_MARKER" ||
    { echo "FATAL: privileged spike root lacks the spike1 marker" >&2; return 73; }
  sudo test ! -L "$ROOT_MARKER" ||
    { echo "FATAL: privileged spike marker is a symlink" >&2; return 73; }
  marker_hash="$(sudo sha256sum "$ROOT_MARKER" | awk '{print $1}')"
  expected_marker_hash="$(printf 'beep-p0-spike1\n' | sha256sum | awk '{print $1}')"
  [[ "$marker_hash" == "$expected_marker_hash" ]] ||
    { echo "FATAL: privileged spike marker content is invalid" >&2; return 73; }
  [[ "$(sudo stat -c '%U:%G:%a' "$ROOT")" == "root:root:755" ]] ||
    { echo "FATAL: privileged spike root ownership/mode is not root:root 0755" >&2; return 73; }
  [[ "$(sudo stat -c '%U:%G:%a' "$ROOT_MARKER")" == "root:root:644" ]] ||
    { echo "FATAL: privileged spike marker ownership/mode is invalid" >&2; return 73; }
}

record_root_path() {
  local path="$1"
  assert_user_contained "$ROOT_MANIFEST"
  [[ "$path" == "$ROOT" || "$path" == "$ROOT/"* ]] ||
    { echo "FATAL: privileged manifest path escapes root: $path" >&2; return 73; }
  grep -Fqx -- "$path" "$ROOT_MANIFEST" 2>/dev/null ||
    printf '%s\n' "$path" >> "$ROOT_MANIFEST"
}

unrecord_root_path() {
  local path="$1" next
  next="$(mktemp -- "$ROOT_MANIFEST.next.XXXXXX")"
  assert_user_contained "$next"
  chmod 0600 "$next"
  grep -Fvx -- "$path" "$ROOT_MANIFEST" > "$next" || true
  mv -- "$next" "$ROOT_MANIFEST"
}

verify_generation() {
  local dir="$1" name="${1##*/}" actual
  [[ "$name" =~ ^[0-9a-f]{64}$ ]] ||
    { echo "FATAL: generation is not a full SHA-256 basename: $name" >&2; return 73; }
  sudo test -d "$dir" && sudo test ! -L "$dir" &&
    sudo test -f "$dir/openclaw.json" && sudo test ! -L "$dir/openclaw.json" ||
    { echo "FATAL: generation shape is invalid: $dir" >&2; return 73; }
  actual="$(sudo sha256sum "$dir/openclaw.json" | awk '{print $1}')"
  [[ "$actual" == "$name" ]] ||
    { echo "FATAL: generation $name contains config hash $actual" >&2; return 73; }
  [[ "$(sudo stat -c '%U:%G:%a' "$dir")" == "root:root:755" &&
     "$(sudo stat -c '%U:%G:%a' "$dir/openclaw.json")" == "root:root:644" ]] ||
    { echo "FATAL: generation ownership/mode is invalid: $dir" >&2; return 73; }
}

verify_root_manifest() {
  local path name target actual="$S1/privileged-paths.actual"
  test -s "$ROOT_MANIFEST" ||
    { echo "FATAL: privileged path manifest is missing or empty" >&2; return 73; }
  [[ "$(stat -c '%u:%a' "$ROOT_MANIFEST")" == "$EUID:600" ]] ||
    { echo "FATAL: privileged path manifest ownership/mode is invalid" >&2; return 73; }
  verify_owned_root
  sudo find "$ROOT" -xdev -printf '%p\n' | LC_ALL=C sort > "$actual"
  LC_ALL=C sort -u "$ROOT_MANIFEST" > "$actual.expected"
  cmp -s "$actual.expected" "$actual" || {
    echo "FATAL: privileged root has missing or unexpected entries" >&2
    diff -u "$actual.expected" "$actual" >&2 || true
    return 73
  }
  while IFS= read -r path; do
    [[ "$path" == "$ROOT" || "$path" == "$ROOT/"* ]] ||
      { echo "FATAL: manifest path escapes root: $path" >&2; return 73; }
    [[ "$(realpath -m -- "$(dirname -- "$path")")" == "$ROOT" ||
       "$(realpath -m -- "$(dirname -- "$path")")" == "$ROOT/"* ||
       "$path" == "$ROOT" ]] ||
      { echo "FATAL: manifest parent escapes root: $path" >&2; return 73; }
    name="${path##*/}"
    case "$path" in
      "$ROOT"|"$ROOT_MARKER") ;;
      "$ROOT/current"|"$ROOT"/.current.*)
        sudo test -L "$path" ||
          { echo "FATAL: pointer manifest entry is not a symlink: $path" >&2; return 73; }
        [[ "$(sudo stat -c '%U:%G' "$path")" == "root:root" ]] ||
          { echo "FATAL: pointer is not root-owned: $path" >&2; return 73; }
        target="$(sudo readlink "$path")"
        [[ "$target" =~ ^[0-9a-f]{64}$ ]] ||
          { echo "FATAL: pointer target is not a full SHA-256: $path -> $target" >&2; return 73; }
        [[ "$(sudo realpath -e "$path")" == "$ROOT/$target" ]] ||
          { echo "FATAL: pointer escapes or misses its generation: $path" >&2; return 73; }
        ;;
      "$ROOT"/[0-9a-f]*)
        if [[ "$name" == "openclaw.json" ]]; then
          verify_generation "$(dirname -- "$path")"
        else
          verify_generation "$path"
        fi
        ;;
      *)
        echo "FATAL: unrecognized privileged manifest entry: $path" >&2
        return 73
        ;;
    esac
  done < "$ROOT_MANIFEST"
}

stage_generation() {
  # bash 5.3: a name assigned in the same `local` is unset for later words in it
  local rendered="$1" hash="$2"
  local dir="$ROOT/$hash"
  [[ "$hash" =~ ^[0-9a-f]{64}$ ]] ||
    { echo "FATAL: generation hash must be full SHA-256" >&2; return 73; }
  [[ "$(sha256sum "$rendered" | awk '{print $1}')" == "$hash" ]] ||
    { echo "FATAL: rendered config does not match generation hash" >&2; return 73; }
  if sudo test -e "$dir"; then
    verify_generation "$dir"
    grep -Fqx -- "$dir" "$ROOT_MANIFEST" &&
      grep -Fqx -- "$dir/openclaw.json" "$ROOT_MANIFEST" ||
      { echo "FATAL: existing generation is absent from the creation manifest" >&2; return 73; }
  else
    sudo install -d -o root -g root -m 0755 "$dir"
    record_root_path "$dir"
    sudo install -o root -g root -m 0644 "$rendered" "$dir/openclaw.json"
    record_root_path "$dir/openclaw.json"
  fi
  verify_generation "$dir"
}

switch_root_pointer() {
  local generation="$1" label="$2"
  local tmp="$ROOT/.current.$label.$$"
  verify_generation "$ROOT/$generation"
  record_root_path "$tmp"
  sudo ln -s "$generation" "$tmp"
  if ! grep -Fqx -- "$ROOT/current" "$ROOT_MANIFEST"; then
    record_root_path "$ROOT/current"
  fi
  sudo mv -T "$tmp" "$ROOT/current"
  unrecord_root_path "$tmp"
  [[ "$(sudo readlink "$ROOT/current")" == "$generation" ]] ||
    { echo "FATAL: pointer switch did not select $generation" >&2; return 73; }
}

remove_owned_root() {
  local path
  sudo test -e "$ROOT" || return 0
  verify_root_manifest
  while IFS= read -r path; do
    if sudo test -L "$path" || sudo test -f "$path"; then
      sudo rm -- "$path"
    fi
  done < <(LC_ALL=C sort -r "$ROOT_MANIFEST")
  while IFS= read -r path; do
    if sudo test -d "$path"; then
      sudo rmdir -- "$path"
    fi
  done < <(awk '{ print length, $0 }' "$ROOT_MANIFEST" | sort -rn | cut -d' ' -f2-)
}

inventory_tree() {
  local root="$1"
  if test ! -e "$root"; then
    printf 'ABSENT\t%s\n' "$root"
    return
  fi
  (
    cd "$root"
    find . -xdev -printf '%y\t%m\t%U:%G\t%i\t%p\t%l\n' | LC_ALL=C sort
    find . -xdev -type f -print0 | LC_ALL=C sort -z |
      xargs -0 -r sha256sum
  )
}

logical_sqlite_hash() {
  local database="$1" hash
  test -f "$database" ||
    { echo "FATAL: SQLite database disappeared before logical inventory: $database" >&2; return 73; }
  hash="$(
    python3 -c \
      "import sqlite3,sys; c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True); print(f'user_version={c.execute(\"PRAGMA user_version\").fetchone()[0]}'); print('\\n'.join(c.iterdump())); c.close()" \
      "$database" |
      sha256sum |
      awk '{print $1}'
  )" || {
    echo "FATAL: could not produce logical SQLite inventory: $database" >&2
    return 73
  }
  printf '%s  %s\n' "$hash" "$database [logical SQLite dump + user_version]"
}

inventory_runtime_state() {
  local root="$STATE" file database
  if test ! -e "$root"; then
    printf 'ABSENT\t%s\n' "$root"
    return
  fi
  (
    cd "$root"
    find . -xdev -printf '%y\t%m\t%U:%G\t%i\t%p\t%l\n' | LC_ALL=C sort
    while IFS= read -r -d '' file; do
      case "$file" in
        ./log/openclaw.log|*.sqlite) continue ;;
        *.sqlite-wal) database="${file%-wal}"; test -f "$database" && continue ;;
        *.sqlite-shm) database="${file%-shm}"; test -f "$database" && continue ;;
      esac
      sha256sum "$file"
    done < <(find . -xdev -type f -print0 | LC_ALL=C sort -z)
    while IFS= read -r -d '' database; do
      logical_sqlite_hash "$database"
    done < <(find . -xdev -type f -name '*.sqlite' -print0 | LC_ALL=C sort -z)
  )
}

inventory_unit_files() {
  local root="$HOME/.config/systemd/user"
  if test ! -d "$root"; then
    printf 'ABSENT\t%s\n' "$root"
    return
  fi
  (
    cd "$root"
    find . -xdev -path './openclaw-spike*' \
      -printf '%y\t%m\t%U:%G\t%i\t%p\t%l\n' | LC_ALL=C sort
    find . -xdev -path './openclaw-spike*' -type f -print0 | LC_ALL=C sort -z |
      xargs -0 -r sha256sum
  )
}

inventory_root() {
  if ! sudo test -e "$ROOT"; then
    printf 'ABSENT\t%s\n' "$ROOT"
    return
  fi
  verify_owned_root
  (
    cd "$ROOT"
    sudo find . -xdev -printf '%y\t%m\t%U:%G\t%i\t%p\t%l\n' | LC_ALL=C sort
    sudo find . -xdev -type f -print0 | LC_ALL=C sort -z |
      sudo xargs -0 -r sha256sum
  )
}

root_hash() {
  verify_owned_root
  (
    cd "$ROOT"
    sudo find . -xdev -printf '%y\t%m\t%U:%G\t%p\t%l\n' | LC_ALL=C sort
    sudo find . -xdev -type f -print0 | LC_ALL=C sort -z |
      sudo xargs -0 -r sha256sum
  ) | sha256sum | awk '{print $1}'
}

package_tree_manifest() {
  (
    cd "$PACKAGE_ROOT"
    find . -xdev -printf '%y\t%m\t%p\t%l\n' | LC_ALL=C sort
    find . -xdev -type f -print0 | LC_ALL=C sort -z |
      xargs -0 -r sha256sum
  )
}

package_tree_hash() {
  package_tree_manifest | sha256sum | awk '{print $1}'
}

inventory_real_openclaw() {
  inventory_tree "$HOME/.openclaw"
}

inventory_runtime() {
  inventory_root
  printf '%s\n' "-- state --"
  inventory_runtime_state
  printf '%s\n' "-- home --"
  inventory_tree "$ISOHOME"
  printf '%s\n' "-- workspace --"
  inventory_tree "$WORKSPACE"
  printf '%s\n' "-- unit files --"
  inventory_unit_files
  printf '%s\n' "-- pointer --"
  if sudo test -L "$ROOT/current"; then
    printf 'target=%s resolved=%s\n' \
      "$(sudo readlink "$ROOT/current")" "$(sudo realpath -e "$ROOT/current")"
  else
    printf 'ABSENT\t%s/current\n' "$ROOT"
  fi
}

write_credential() {
  local path="$1" value="$2"
  assert_user_contained "$path"
  mkdir -p "$CREDENTIALS"
  chmod 0700 "$CREDENTIALS"
  umask 077
  printf '%s' "$value" | install -m 0600 /dev/stdin "$path"
}

credential_fingerprint() {
  local value="$1"
  printf '%s' "$value" | sha256sum | cut -c1-8
}

manager_secret_environment_absent() {
  local dump
  dump="$(systemctl --user show-environment)"
  if [[ "$dump" == *$'OPENCLAW_GATEWAY_TOKEN='* ||
        "$dump" == OPENCLAW_GATEWAY_TOKEN=* ||
        "$dump" == *$'\nTELEGRAM_BOT_TOKEN='* ||
        "$dump" == TELEGRAM_BOT_TOKEN=* ]]; then
    echo "ASSERT-FAIL: user manager contains a spike secret variable"
    return 1
  fi
  echo "ASSERT-PASS: user manager contains neither spike secret variable"
}

scan_secret_exact() {
  local secret="$1" file line
  shift
  for file in "$@"; do
    test -f "$file" || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ -n "$secret" && "$line" == *"$secret"* ]]; then
        echo "SECRET-SCAN-FAIL: exact secret appeared in $file"
        return 1
      fi
    done < "$file"
  done
}

scan_token_shapes() {
  local file
  for file in "$@"; do
    test -f "$file" || continue
    if LC_ALL=C grep -Eq \
      '(^|[^[:alnum:]_])[0-9]{6,}:[A-Za-z0-9_-]{20,}' \
      "$file"; then
      echo "SECRET-SCAN-FAIL: token-shaped value appeared in $file"
      return 1
    fi
  done
}

unit_fragment_owned_or_absent() {
  local fragment
  fragment="$(systemctl --user show -p FragmentPath --value "$UNIT" 2>/dev/null || true)"
  if [[ -z "$fragment" ]]; then
    echo "unit_fragment=absent"
    return 1
  fi
  if [[ "$fragment" != "$UNIT_PATH" || ! -f "$fragment" ]] ||
      ! grep -q '^# BEEP_P0_SPIKE1$' "$fragment"; then
    echo "FATAL: loaded $UNIT is not the harness-owned fragment: ${fragment:-unknown}" >&2
    return 73
  fi
  printf 'unit_fragment=%s marker=verified\n' "$fragment"
}

unit_cgroup_pids() {
  local cgroup
  cgroup="$(systemctl --user show -p ControlGroup --value "$UNIT" 2>/dev/null || true)"
  printf 'control_group=%s\n' "${cgroup:-absent}"
  systemctl --user show -p MainPID -p ExecMainPID -p ActiveState -p SubState "$UNIT" 2>/dev/null || true
  if [[ -n "$cgroup" && -r "/sys/fs/cgroup$cgroup/cgroup.procs" ]]; then
    while IFS= read -r pid; do
      printf 'cgroup_pid=%s argv=' "$pid"
      tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true
      printf '\n'
    done < "/sys/fs/cgroup$cgroup/cgroup.procs"
  fi
}

ports_inventory() {
  ss -H -ltnp 'sport = :19021 or sport = :19022 or sport = :19023' 2>/dev/null || true
}

redact_stream() {
  sed -E \
    -e 's/[0-9]{6,}:[A-Za-z0-9_-]+/[REDACTED_TELEGRAM_TOKEN]/g' \
    -e 's/(OPENCLAW_GATEWAY_TOKEN|TELEGRAM_BOT_TOKEN)=([^[:space:]]+)/\1=[REDACTED]/g'
}
