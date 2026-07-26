#!/usr/bin/env bash
set -euo pipefail

SPIKE3_ETC_ROOT=/etc/beep/openclaw-spike
SPIKE3_CREDENTIAL=$SPIKE3_ETC_ROOT/op-service-account-token
SPIKE3_UNIT=openclaw-spike.service
SPIKE3_PORT=19031
SPIKE3_MARKER_TEXT=beep-p0-spike3-owned-v1

spike3_fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

spike3_require_scratch() {
  local requested=${SPIKE_P:?export SPIKE_P=/absolute/disposable/path}
  [[ "$requested" = /* && "$requested" != / && "$requested" != *'/../'* &&
    "$requested" != */.. && "$requested" != *'/./'* && "$requested" != */. ]] ||
    spike3_fail "SPIKE_P must be a normalized absolute disposable path"
  [[ "$requested" != *[[:space:]]* ]] ||
    spike3_fail "SPIKE_P must not contain whitespace"
  [[ "$(realpath -m -- "$requested")" == "$requested" ]] ||
    spike3_fail "SPIKE_P must already be canonical"
  SPIKE3_P=$requested
  SPIKE3_DIR=$SPIKE3_P/spike3
  SPIKE3_LOGS=$SPIKE3_DIR/logs
}

spike3_assert_config_path() {
  local path=$1
  local resolved
  [[ "$path" = /* && "$path" != *'/../'* && "$path" != */.. ]] ||
    spike3_fail "OpenClaw config path must be normalized and absolute: $path"
  resolved=$(realpath -m -- "$path")
  case "$resolved" in
    "$SPIKE3_DIR"|"$SPIKE3_DIR/"*|"$SPIKE3_ETC_ROOT"|"$SPIKE3_ETC_ROOT/"*) ;;
    *) spike3_fail "resolved OpenClaw config escaped Spike 3 isolation: $resolved" ;;
  esac
}

spike3_run_openclaw() {
  local oc=$1
  local node_dir=$2
  local home_dir=$3
  local config=$4
  local state=$5
  shift 5
  spike3_assert_config_path "$config"
  env -i PATH="$node_dir:/usr/bin:/bin" HOME="$home_dir" \
    OPENCLAW_CONFIG_PATH="$config" OPENCLAW_STATE_DIR="$state" \
    "$oc" "$@"
}

spike3_write_client_config() {
  local source=$1
  local target=$2
  local url=$3
  local token=$4
  local expected_uid mode
  spike3_assert_config_path "$source"
  spike3_assert_config_path "$target"
  [[ -f "$source" && ! -L "$source" && ! -e "$target" && ! -L "$target" ]] ||
    spike3_fail "client config source or target is unsafe: $target"
  (
    umask 077
    printf %s "$token" |
      jq --rawfile token /dev/stdin --arg url "$url" '
        .gateway.mode = "remote" |
        .gateway.remote = {url: $url, token: $token}
      ' "$source" >"$target"
  )
  expected_uid=$(id -u)
  mode=$(stat -c '%a' -- "$target")
  [[ "$(stat -c '%u:%h:%F' -- "$target")" == \
    "$expected_uid:1:regular file" && "$mode" == 600 ]] ||
    spike3_fail "client config was not created as runner-owned mode 0600"
  printf 'client-config-created path=%s mode=%s\n' "$target" "$mode"
}

spike3_remove_client_config() {
  local path=$1
  local mode
  spike3_assert_config_path "$path"
  [[ -e "$path" || -L "$path" ]] || return 0
  [[ -f "$path" && ! -L "$path" && "$(stat -c '%h' -- "$path")" == 1 ]] ||
    spike3_fail "refusing to remove unsafe client config: $path"
  mode=$(stat -c '%a' -- "$path")
  printf 'client-config-removing path=%s mode=%s\n' "$path" "$mode"
  shred -u -- "$path" 2>/dev/null || rm -f -- "$path"
  [[ ! -e "$path" && ! -L "$path" ]] ||
    spike3_fail "client config removal failed: $path"
  printf 'client-config-removed path=%s mode=%s\n' "$path" "$mode"
}

spike3_assert_scratch_ownership() {
  local marker=$SPIKE3_DIR/.beep-spike3-scratch
  local nonce_file=$SPIKE3_LOGS/preflight-nonce
  local expected_uid path kind uid mode links marker_nonce archived_nonce
  expected_uid=$(id -u)
  [[ -d "$SPIKE3_DIR" && ! -L "$SPIKE3_DIR" &&
    "$(realpath -e -- "$SPIKE3_DIR")" == "$SPIKE3_DIR" &&
    "$(stat -c '%u:%a' -- "$SPIKE3_DIR")" == "$expected_uid:700" ]] ||
    spike3_fail "Spike 3 scratch root must be canonical, runner-owned, and mode 0700"
  for path in "$marker" "$nonce_file" "$SPIKE3_LOGS/privileged-paths.manifest"; do
    [[ -f "$path" && ! -L "$path" ]] ||
      spike3_fail "required scratch provenance file is missing or unsafe: $path"
    IFS=: read -r uid mode links kind < <(stat -c '%u:%a:%h:%F' -- "$path")
    # stat %F reports an empty regular file as "regular empty file"; the
    # privileged-paths manifest is legitimately empty until a path is recorded
    [[ "$uid" == "$expected_uid" && "$mode" == 600 && "$links" == 1 &&
      ( "$kind" == "regular file" || "$kind" == "regular empty file" ) ]] ||
      spike3_fail "scratch provenance file has unsafe metadata: $path"
  done
  marker_nonce=$(<"$marker")
  archived_nonce=$(<"$nonce_file")
  [[ "$marker_nonce" =~ ^[0-9a-f]{32}$ &&
    "$marker_nonce" == "$archived_nonce" ]] ||
    spike3_fail "scratch ownership nonce is missing or mismatched"
  while IFS= read -r -d '' path; do
    [[ ! -L "$path" ]] ||
      spike3_fail "symlink found in Spike 3 scratch: $path"
    IFS=: read -r uid links kind < <(stat -c '%u:%h:%F' -- "$path")
    [[ "$uid" == "$expected_uid" ]] ||
      spike3_fail "foreign-owned Spike 3 scratch entry: $path"
    if [[ "$kind" == "regular file" ]]; then
      [[ "$links" == 1 ]] ||
        spike3_fail "hard-linked Spike 3 scratch file: $path"
    fi
  done < <(find -P "$SPIKE3_DIR" -xdev -print0)
}

spike3_record_privileged_path() {
  local path=$1 manifest=$SPIKE3_LOGS/privileged-paths.manifest
  spike3_privileged_path_allowed "$path" ||
    spike3_fail "refusing unrecognized privileged manifest path: $path"
  grep -Fxq -- "$path" "$manifest" || printf '%s\n' "$path" >>"$manifest"
}

spike3_privileged_path_allowed() {
  local path=$1
  case "$path" in
    "$SPIKE3_ETC_ROOT"|"$SPIKE3_CREDENTIAL"|\
    "$SPIKE3_ETC_ROOT/.beep-spike3-root"|\
    "$SPIKE3_ETC_ROOT/current"|"$SPIKE3_ETC_ROOT/current.new")
      return 0
      ;;
  esac
  [[ "$path" =~ ^/etc/beep/openclaw-spike/[0-9a-f]{64}(/(\.beep-spike3-generation|openclaw\.json))?$ ]]
}

spike3_validate_privileged_manifest() {
  local manifest=$SPIKE3_LOGS/privileged-paths.manifest path
  [[ -f "$manifest" && ! -L "$manifest" ]] ||
    spike3_fail "privileged path manifest is missing or unsafe"
  [[ "$(sort "$manifest" | uniq -d)" == "" ]] ||
    spike3_fail "privileged path manifest contains duplicates"
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    spike3_privileged_path_allowed "$path" ||
      spike3_fail "privileged path manifest contains an unrecognized path: $path"
  done <"$manifest"
}

spike3_manifest_has() {
  grep -Fxq -- "$1" "$SPIKE3_LOGS/privileged-paths.manifest"
}

spike3_assert_privileged_tree() {
  local actual expected path
  spike3_validate_privileged_manifest
  actual=$(mktemp)
  expected=$(mktemp)
  if sudo test -e "$SPIKE3_ETC_ROOT" || sudo test -L "$SPIKE3_ETC_ROOT"; then
    sudo find -P "$SPIKE3_ETC_ROOT" -xdev -print | sort >"$actual"
  fi
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if sudo test -e "$path" || sudo test -L "$path"; then
      printf '%s\n' "$path"
    fi
  done <"$SPIKE3_LOGS/privileged-paths.manifest" | sort >"$expected"
  if ! cmp -s "$actual" "$expected"; then
    rm -f -- "$actual" "$expected"
    spike3_fail "privileged root differs from the creation-time path manifest"
  fi
  rm -f -- "$actual" "$expected"
}

spike3_assert_exact_privileged_path() {
  local path=$1 parent resolved
  spike3_manifest_has "$path" ||
    spike3_fail "privileged path was not recorded at creation time: $path"
  parent=$(dirname -- "$path")
  [[ "$(realpath -e -- "$parent")" == "$parent" ]] ||
    spike3_fail "privileged path parent is non-canonical: $path"
  if sudo test -L "$path"; then
    resolved=$(realpath -e -- "$path")
    [[ "$resolved" == "$SPIKE3_ETC_ROOT/"* ]] ||
      spike3_fail "privileged symlink escaped the Spike 3 root: $path"
  else
    [[ "$(realpath -e -- "$path")" == "$path" ]] ||
      spike3_fail "privileged path is non-canonical: $path"
  fi
}

spike3_pid_ancestor_chain() {
  local pid=${1:-$$} parent
  while [[ "$pid" =~ ^[0-9]+$ ]] && ((pid > 0)); do
    printf '%s\n' "$pid"
    [[ -r "/proc/$pid/stat" ]] || break
    parent=$(awk '$1 == "PPid:" {print $2}' "/proc/$pid/status")
    [[ "$parent" != "$pid" ]] || break
    pid=$parent
  done
}

spike3_matching_pids() {
  local state_dir=$1 oc=$2 node=$3 control_group=$4 port=$5
  local proc_dir pid variable exe
  local -A excluded=() cgroup_pids=() listener_pids=()
  while IFS= read -r pid; do excluded["$pid"]=1; done < <(spike3_pid_ancestor_chain "$$")
  if [[ -n "$control_group" &&
    -r "/sys/fs/cgroup$control_group/cgroup.procs" ]]; then
    while IFS= read -r pid; do cgroup_pids["$pid"]=1; done \
      <"/sys/fs/cgroup$control_group/cgroup.procs"
  fi
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && listener_pids["$pid"]=1
  done < <(
    ss -ltnpH "sport = :$port" 2>/dev/null |
      sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -nu
  )
  for proc_dir in /proc/[0-9]*; do
    pid=${proc_dir#/proc/}
    [[ -z ${excluded["$pid"]+x} ]] || continue
    if [[ -n ${cgroup_pids["$pid"]+x} || -n ${listener_pids["$pid"]+x} ]]; then
      printf '%s\n' "$pid"
      continue
    fi
    while IFS= read -r variable; do
      if [[ "$variable" == "OPENCLAW_STATE_DIR=$state_dir" ]]; then
        printf '%s\n' "$pid"
        continue 2
      fi
    done < <(tr '\0' '\n' 2>/dev/null <"$proc_dir/environ" || true)
    exe=$(readlink -f -- "$proc_dir/exe" 2>/dev/null || true)
    if [[ "$exe" == "$(realpath -e -- "$node")" ]] &&
      tr '\0' '\n' 2>/dev/null <"$proc_dir/cmdline" | grep -Fxq -- "$oc"; then
      printf '%s\n' "$pid"
    fi
  done
}

spike3_require_ref() {
  local ref=$1 tail vault item field
  [[ "$ref" == op://* ]] || spike3_fail "reference must start with op://"
  tail=${ref#op://}
  vault=${tail%%/*}
  tail=${tail#*/}
  item=${tail%%/*}
  field=${tail#*/}
  [[ -n "$vault" && -n "$item" && -n "$field" && "$field" != */* &&
    "$vault" != *[[:space:]]* && "$item" != *[[:space:]]* &&
    "$field" != *[[:space:]]* ]] ||
    spike3_fail "reference must be a named op://vault/item/field"
}

spike3_unit_file() {
  printf '%s/.config/systemd/user/%s\n' "$HOME" "$SPIKE3_UNIT"
}

spike3_assert_unit_owned_or_absent() {
  local unit_file fragment
  unit_file=$(spike3_unit_file)
  fragment=$(systemctl --user show "$SPIKE3_UNIT" -p FragmentPath --value \
    2>/dev/null || true)
  if [[ -n "$fragment" ]]; then
    [[ "$fragment" == "$unit_file" && ! -L "$fragment" &&
      -f "$fragment" ]] ||
      spike3_fail "refusing loaded unit from unowned FragmentPath: $fragment"
    grep -Fxq '# beep-p0-spike3-owned-v1' "$fragment" ||
      spike3_fail "loaded unit lacks the Spike 3 ownership marker"
  fi
  if [[ -e "$unit_file" || -L "$unit_file" ]]; then
    [[ ! -L "$unit_file" && -f "$unit_file" ]] ||
      spike3_fail "refusing symlink or non-file unit path: $unit_file"
    grep -Fxq '# beep-p0-spike3-owned-v1' "$unit_file" ||
      spike3_fail "unit file lacks the Spike 3 ownership marker"
  fi
}

spike3_assert_credential() {
  local group group_gid owner gid mode kind parent parent_owner parent_gid
  local parent_mode members primary_users
  [[ "$SPIKE3_CREDENTIAL" == /etc/beep/openclaw-spike/op-service-account-token &&
    "$SPIKE3_CREDENTIAL" != *'..'* ]] ||
    spike3_fail "credential path constant is invalid"
  sudo test ! -L "$SPIKE3_CREDENTIAL" ||
    spike3_fail "credential must not be a symlink"
  sudo test -f "$SPIKE3_CREDENTIAL" ||
    spike3_fail "credential is missing or not a regular file"
  [[ "$(realpath -e -- "$SPIKE3_CREDENTIAL")" == "$SPIKE3_CREDENTIAL" ]] ||
    spike3_fail "credential realpath escaped its exact path"

  group=$(id -gn)
  group_gid=$(id -g)
  IFS=: read -r owner gid mode kind < <(
    sudo stat -Lc '%u:%g:%a:%F' -- "$SPIKE3_CREDENTIAL"
  )
  [[ "$owner" == 0 && "$gid" == "$group_gid" && "$mode" == 440 &&
    "$kind" == "regular file" ]] ||
    spike3_fail "credential must be regular root:$group mode 0440"
  [[ -r "$SPIKE3_CREDENTIAL" ]] ||
    spike3_fail "service user cannot read the credential source"

  for parent in /etc /etc/beep "$SPIKE3_ETC_ROOT"; do
    [[ ! -L "$parent" && "$(realpath -e -- "$parent")" == "$parent" ]] ||
      spike3_fail "credential parent is missing, symlinked, or non-canonical: $parent"
    IFS=: read -r parent_owner parent_gid parent_mode < <(
      stat -Lc '%u:%g:%a' -- "$parent"
    )
    [[ "$parent_owner" == 0 ]] && (( (8#$parent_mode & 0022) == 0 )) ||
      spike3_fail "credential parent must be root-owned and not group/world writable: $parent"
    printf 'credential-parent path=%s owner=%s gid=%s mode=%s\n' \
      "$parent" "$parent_owner" "$parent_gid" "$parent_mode"
  done
  members=$(getent group "$group" | cut -d: -f4)
  [[ -z "$members" || "$members" == "$(id -un)" ]] ||
    spike3_fail "private primary group has supplementary members: $group"
  primary_users=$(getent passwd | awk -F: -v gid="$group_gid" \
    '$4 == gid {print $1}' | sort -u | paste -sd, -)
  [[ "$primary_users" == "$(id -un)" ]] ||
    spike3_fail "primary group is shared by other accounts: $group"
  printf 'credential path=%s owner=0 group=%s mode=0440\n' \
    "$SPIKE3_CREDENTIAL" "$group"
  printf 'credential parents=/etc,/etc/beep,%s canonical=yes writable-by-group-or-world=no\n' \
    "$SPIKE3_ETC_ROOT"
  printf 'credential service-user-readable=yes private-group-extra-members=none\n'
}

spike3_inventory() {
  local root=$1 rel path type meta digest target
  if [[ ! -e "$root" ]]; then
    printf 'ABSENT\n'
    return
  fi
  while IFS= read -r -d '' rel; do
    path=$root${rel:+/$rel}
    type=$(stat -c '%F' -- "$path")
    meta=$(stat -c '%a:%u:%g:%s' -- "$path")
    digest=-
    target=-
    if [[ -f "$path" && ! -L "$path" ]]; then
      digest=$(sha256sum -- "$path" | cut -d' ' -f1)
    elif [[ -L "$path" ]]; then
      target=$(readlink -- "$path")
    fi
    printf 'path=%q type=%q meta=%s sha256=%s target=%q\n' \
      "$rel" "$type" "$meta" "$digest" "$target"
  done < <(find -P "$root" -xdev -printf '%P\0' | sort -z)
}

spike3_tree_hash() {
  local root=$1 rel path type meta digest target
  while IFS= read -r -d '' rel; do
    path=$root${rel:+/$rel}
    type=$(stat -c '%F' -- "$path")
    meta=$(stat -c '%a:%u:%g:%s' -- "$path")
    digest=-
    target=-
    if [[ -f "$path" && ! -L "$path" ]]; then
      digest=$(sha256sum -- "$path" | cut -d' ' -f1)
    elif [[ -L "$path" ]]; then
      target=$(readlink -- "$path")
    fi
    printf 'path=%q type=%q meta=%s sha256=%s target=%q\n' \
      "$rel" "$type" "$meta" "$digest" "$target"
  done < <(find -P "$root" -xdev -printf '%P\0' | sort -z) |
    sha256sum | cut -d' ' -f1
}

spike3_installed_root_manifest() {
  local path rel type meta digest target
  while IFS= read -r -d '' path; do
    rel=${path#"$SPIKE3_ETC_ROOT"}
    rel=${rel#/}
    type=$(sudo stat -c '%F' -- "$path")
    meta=$(sudo stat -c '%a:%u:%g:%s' -- "$path")
    digest=-
    target=-
    if sudo test -f "$path" && sudo test ! -L "$path"; then
      if [[ "$path" == "$SPIKE3_CREDENTIAL" ]]; then
        digest=REDACTED_BOOTSTRAP_CREDENTIAL
      else
        digest=$(sudo sha256sum -- "$path" | cut -d' ' -f1)
      fi
    elif sudo test -L "$path"; then
      target=$(sudo readlink -- "$path")
    fi
    printf 'path=%q type=%q meta=%s sha256=%s target=%q\n' \
      "$rel" "$type" "$meta" "$digest" "$target"
  done < <(sudo find -P "$SPIKE3_ETC_ROOT" -xdev -print0 | sort -z)
}

spike3_scan_logs() {
  local label=$1 secret=$2 file content
  shift 2
  [[ -n "$secret" && "$secret" != *$'\n'* && "$secret" != *$'\r'* ]] ||
    spike3_fail "cannot audit empty or multiline secret: $label"
  for file in "$@"; do
    [[ -e "$file" ]] || continue
    [[ -f "$file" && ! -L "$file" ]] ||
      spike3_fail "refusing to scan non-regular or symlinked evidence: $file"
    content=$(<"$file")
    if [[ "$content" == *"$secret"* ]]; then
      : >"$file"
      printf 'EVIDENCE-DESTROYED: secret plaintext detected during post-command scan\n' \
        >>"$file"
      spike3_fail "secret plaintext detected; contaminated evidence destroyed: $file"
    fi
    if grep -Eq \
      '(ops_[A-Za-z0-9_-]{20,}|[0-9]{6,12}:[A-Za-z0-9_-]{20,}|(sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,})' \
      "$file"; then
      : >"$file"
      printf 'EVIDENCE-DESTROYED: token-shaped value detected during post-command scan\n' \
        >>"$file"
      spike3_fail "token-shaped value detected; contaminated evidence destroyed: $file"
    fi
  done
  printf 'log-scan label=%s sha256-prefix=%s plaintext=absent token-shapes=absent\n' \
    "$label" "$(printf %s "$secret" | sha256sum | cut -c1-8)"
}

spike3_scan_token_shapes() {
  local file
  for file in "$@"; do
    [[ -e "$file" ]] || continue
    [[ -f "$file" && ! -L "$file" ]] ||
      spike3_fail "refusing to scan non-regular or symlinked evidence: $file"
    if grep -Eq \
      '(ops_[A-Za-z0-9_-]{20,}|[0-9]{6,12}:[A-Za-z0-9_-]{20,}|(sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,})' \
      "$file"; then
      : >"$file"
      printf 'EVIDENCE-DESTROYED: token-shaped value detected during post-command scan\n' \
        >>"$file"
      spike3_fail "token-shaped value detected; contaminated evidence destroyed: $file"
    fi
  done
  printf 'log-scan token-shapes=absent files=%s\n' "$#"
}

spike3_remove_owned_root_artifacts() {
  local marker=$SPIKE3_ETC_ROOT/.beep-spike3-root current=$SPIKE3_ETC_ROOT/current
  local pending=$SPIKE3_ETC_ROOT/current.new generation generation_marker
  local config config_sha
  spike3_assert_privileged_tree
  if sudo test -e "$marker"; then
    spike3_assert_exact_privileged_path "$marker"
    [[ "$(sudo cat -- "$marker")" == "$SPIKE3_MARKER_TEXT" ]] ||
      spike3_fail "root marker content mismatch"
    [[ "$(sudo stat -Lc '%u:%g:%a:%F' -- "$marker")" == \
      "0:0:644:regular file" ]] ||
      spike3_fail "root marker metadata mismatch"
  elif sudo test -e "$current" || sudo test -L "$current"; then
    spike3_fail "refusing unmarked root pointer"
  fi

  if sudo test -L "$current"; then
    spike3_assert_exact_privileged_path "$current"
    [[ "$(sudo stat -c '%u:%g:%F' -- "$current")" == \
      "0:0:symbolic link" ]] ||
      spike3_fail "current pointer is not root-owned"
    generation=$(realpath -e -- "$current")
    [[ "$generation" =~ ^/etc/beep/openclaw-spike/[0-9a-f]{64}$ &&
      "$(dirname -- "$generation")" == "$SPIKE3_ETC_ROOT" ]] ||
      spike3_fail "current pointer escaped the Spike 3 root"
    sudo rm -f -- "$current"
  elif sudo test -e "$current"; then
    spike3_fail "current exists but is not a symlink"
  fi
  if sudo test -L "$pending"; then
    spike3_assert_exact_privileged_path "$pending"
    generation=$(readlink -- "$pending")
    [[ "$generation" =~ ^[0-9a-f]{64}$ ]] ||
      spike3_fail "pending pointer has an invalid target"
    sudo rm -f -- "$pending"
  elif sudo test -e "$pending"; then
    spike3_fail "pending pointer exists but is not a symlink"
  fi
  while IFS= read -r generation; do
    [[ "$generation" =~ ^/etc/beep/openclaw-spike/[0-9a-f]{64}$ ]] ||
      spike3_fail "invalid generation in privileged manifest"
    sudo test -e "$generation" || continue
    spike3_assert_exact_privileged_path "$generation"
    generation_marker=$generation/.beep-spike3-generation
    config=$generation/openclaw.json
    [[ "$(sudo stat -Lc '%u:%g:%a:%F' -- "$generation")" == \
      "0:0:755:directory" ]] ||
      spike3_fail "generation metadata mismatch"
    if sudo test -e "$generation_marker"; then
      spike3_assert_exact_privileged_path "$generation_marker"
      [[ "$(sudo cat -- "$generation_marker")" == "$SPIKE3_MARKER_TEXT" ]] ||
        spike3_fail "generation marker is invalid"
      sudo rm -f -- "$generation_marker"
    fi
    if sudo test -e "$config"; then
      spike3_assert_exact_privileged_path "$config"
      config_sha=$(sudo sha256sum -- "$config" | cut -d' ' -f1)
      [[ "$(basename -- "$generation")" == "$config_sha" ]] ||
        spike3_fail "generation basename does not equal its full config hash"
      sudo rm -f -- "$config"
    fi
    if [[ -n "$(sudo find -P "$generation" -mindepth 1 -print -quit)" ]]; then
      spike3_fail "manifested generation contains unexpected entries"
    fi
    sudo rmdir -- "$generation"
  done < <(
    sed -nE '\|^/etc/beep/openclaw-spike/[0-9a-f]{64}$|p' \
      "$SPIKE3_LOGS/privileged-paths.manifest"
  )
  if sudo test -e "$marker"; then
    sudo rm -f -- "$marker"
  fi
  {
    printf '%s\n' "$SPIKE3_ETC_ROOT" "$SPIKE3_CREDENTIAL"
  } >"$SPIKE3_LOGS/privileged-paths.manifest"
}
