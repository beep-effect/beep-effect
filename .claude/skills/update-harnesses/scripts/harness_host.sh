#!/usr/bin/env bash
# Host agent for /update-harnesses. Runs ON one fleet host: piped over SSH stdin by
# update_harnesses.ts (`bash -s -- <mode> <harness>...`) or run locally on the hub.
#
#   harness_host.sh status|update <harness>...
#
# Harnesses: claude codex grok kimi junie cursor-agent muse t3code
#
# For each CLI harness it finds every install on the PATH the host's T3 service uses
# (agents launched by T3 resolve binaries through it), then the usual user dirs, and
# classifies each install by how it was installed. `update` updates every install this
# account can write, with the method that owns it. Root-owned installs are reported,
# never touched. Records go to stdout as tab-separated lines starting with "@@";
# command output goes to stderr.
#
#   @@HOST     <hostname> <user> <os> <systemd 1|0>
#   @@INSTALL  <harness> <active 1|0|stale> <method> <writable 1|0> <version> <path>
#   @@RESULT   <harness> <status> <before> <after> <method> <path> <note>
#   @@APPARMOR <drift 0|1> <sdk-path> <cli-path>
#   @@NOTE     <harness> <text>   (read-only config finding, both modes)
#
# status is one of: updated current failed skipped absent
set -uo pipefail

mode=${1:-}
case "$mode" in status|update) shift ;; *) echo "usage: $0 status|update <harness>..." >&2; exit 64 ;; esac
harnesses=("$@")
((${#harnesses[@]})) || harnesses=(claude codex grok kimi junie cursor-agent muse t3code)

STEP_TIMEOUT=${HARNESS_STEP_TIMEOUT:-900}
JUNIE_INSTALLER_URL=https://junie.jetbrains.com/install.sh
APPARMOR_PROFILE=/etc/apparmor.d/beep-cursor-sandbox
export NO_COLOR=1 MUSE_NO_AUTO_UPDATE=1
JUNIE_MIGRATE=${HARNESS_JUNIE_MIGRATE:-1}

tab() { local IFS=$'\t'; printf '%s\n' "$*"; }
clean() { local v=${1//$'\t'/ }; v=${v//$'\n'/ }; printf '%s' "${v:--}"; }

# ---------------------------------------------------------------- effective PATH
service_path() {
  command -v systemctl >/dev/null 2>&1 || return 0
  systemctl --user show t3code.service -p Environment --value 2>/dev/null \
    | tr ' ' '\n' | sed -n 's/^"\{0,1\}PATH=//p' | tr -d '"' | tail -1
}

# PATH dirs: the T3 service PATH first (what delegated agents run), then the usual
# user/system dirs. Installs found only under some other node version's bin are "stale":
# reported, never updated (nothing runs them and their node may be gone).
search_dirs() {
  local -a dirs=() inherited=()
  local p d seen=:
  p=$(service_path)
  [[ -n "$p" ]] && IFS=: read -r -a dirs <<<"$p"
  IFS=: read -r -a inherited <<<"$ORIG_PATH"
  dirs+=("${inherited[@]}" "$HOME/.local/bin" "$HOME/.bun/bin" "$HOME/.npm-global/bin")
  # The node this shell resolves (login default) counts as on PATH.
  command -v node >/dev/null 2>&1 && dirs+=("$(dirname "$(readlink -f "$(command -v node)")")")
  dirs+=(/usr/local/bin /usr/bin)
  for d in "${dirs[@]}"; do
    [[ $d == /* && -d "$d" && "$seen" != *":$d:"* ]] || continue
    seen+="$d:"; printf 'path\t%s\n' "$d"
  done
  for d in "$HOME"/.nvm/versions/node/*/bin "$HOME"/.local/share/mise/installs/node/*/bin; do
    [[ -d "$d" && "$seen" != *":$d:"* ]] || continue
    seen+="$d:"; printf 'stale\t%s\n' "$d"
  done
}
ORIG_PATH=$PATH
SEARCH=(); SCOPE=()
while IFS=$'\t' read -r scope dir; do SEARCH+=("$dir"); SCOPE+=("$scope"); done < <(search_dirs)
PATH_DIRS=()
for i in "${!SEARCH[@]}"; do [[ ${SCOPE[$i]} == path ]] && PATH_DIRS+=("${SEARCH[$i]}"); done
export PATH="$(IFS=:; printf '%s' "${PATH_DIRS[*]}"):$PATH"

# Every install of one binary name, first = the one T3 agents run.
# Prints "scope<TAB>path<TAB>real", scope = path | stale.
installs_of() {
  local name=$1 i d real seen=$'\n'
  for i in "${!SEARCH[@]}"; do
    d=${SEARCH[$i]}
    [[ -x "$d/$name" && ! -d "$d/$name" ]] || continue
    real=$(readlink -f "$d/$name") || continue
    [[ ${real##*/} == mise ]] && continue  # a mise shim only redirects to an install found elsewhere
    [[ "$seen" == *$'\n'"$real"$'\n'* ]] && continue
    seen+="$real"$'\n'
    printf '%s\t%s\t%s\n' "${SCOPE[$i]}" "$d/$name" "$real"
  done
}

npm_prefix_of() { printf '%s' "${1%%/lib/node_modules/*}"; }
npm_pkg_of() {
  local rest=${1#*/node_modules/}
  if [[ "$rest" == @* ]]; then printf '%s' "${rest%%/*}/$(cut -d/ -f2 <<<"$rest")"; else printf '%s' "${rest%%/*}"; fi
}

# method for one install: npm | native | kimi | cursor-agent | muse | junie-managed | junie-legacy | unknown
classify() {
  local harness=$1 real=$2
  case "$real" in
    */.bun/install/global/node_modules/*) echo bun; return ;;
    */lib/node_modules/*) echo npm; return ;;
  esac
  case "$harness" in
    claude) [[ "$real" == */.local/share/claude/versions/* ]] && { echo native; return; } ;;
    codex) [[ "$real" == */.codex/packages/standalone/* ]] && { echo native; return; } ;;
    grok) [[ "$real" == "$HOME"/* && "$(od -An -tx1 -N4 "$real" 2>/dev/null | tr -d ' \n')" == 7f454c46 ]] \
            && { echo native; return; } ;;
    kimi) [[ "$real" == */.kimi-code/* ]] && { echo kimi; return; } ;;
    cursor-agent) [[ "$real" == */.local/share/cursor-agent/versions/* ]] && { echo cursor-agent; return; } ;;
    muse) grep -qs 'muse-code/channels' "$real" && { echo muse; return; } ;;
    junie)
      if grep -qs JUNIE_MANAGED_SHIM "$real"; then echo junie-managed; return; fi
      [[ "$real" == "$HOME"/* ]] && { echo junie-legacy; return; } ;;
  esac
  echo unknown
}

writable() { # method real
  local dir
  case $1 in
    npm) dir="$(npm_prefix_of "$2")/lib/node_modules" ;;
    bun) dir="${2%%/node_modules/*}/node_modules" ;;
    *) dir=$(dirname "$2") ;;
  esac
  [[ -w "$dir" ]] && echo 1 || echo 0
}

# Version string, or "-" when the binary fails or prints none: an error message that
# names some other version (mise, a node engine check) must not read as a version.
version_of() { # harness path
  local out
  out=$(timeout 30 "$2" --version </dev/null 2>&1) || { echo -; return; }
  out=$(grep -viE 'fontconfig|warning' <<<"$out")
  [[ $1 == junie ]] && out=$(sed -n 's/.*Junie version: *//p' <<<"$out" | head -1)
  out=$(grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?([-.+][0-9A-Za-z]+)*' <<<"$out" | head -1)
  echo "${out:--}"
}

run_step() { # label command...
  echo ">>> $1: ${*:2}" >&2
  timeout "$STEP_TIMEOUT" "${@:2}" </dev/null >&2 2>&1
}

npm_update() { # real
  local prefix pkg npm_bin
  prefix=$(npm_prefix_of "$1"); pkg=$(npm_pkg_of "$1")
  npm_bin="$prefix/bin/npm"; [[ -x "$npm_bin" ]] || npm_bin=$(command -v npm) || return 127
  PATH="$prefix/bin:$PATH" run_step "npm $pkg" "$npm_bin" install -g --prefix "$prefix" \
    --no-fund --no-audit --loglevel=error "$pkg@latest"
}

bun_update() { # real
  local pkg bun_bin
  pkg=$(npm_pkg_of "$1")
  bun_bin=$(command -v bun) || return 127
  run_step "bun $pkg" "$bun_bin" add -g "$pkg@latest"
}

# The npm package and the pre-launcher shim are frozen (1468.x); the managed launcher
# is JetBrains' supported channel. The installer writes ~/.local/bin/junie, so this runs
# only when that entry is the active one (do_cli checks). The old entry is moved (not
# written through: it may be an npm symlink) to a persistent backup that is kept, and is
# put back on failure or on any signal before the new launcher is confirmed.
JUNIE_LINK="$HOME/.local/bin/junie"
JUNIE_BACKUP=""
junie_restore() {
  [[ -n "$JUNIE_BACKUP" && ( -e "$JUNIE_BACKUP" || -L "$JUNIE_BACKUP" ) ]] || return 0
  rm -f "$JUNIE_LINK"; mv -f "$JUNIE_BACKUP" "$JUNIE_LINK"; JUNIE_BACKUP=""
}
junie_migrate() {
  local state="$HOME/.local/state/beep/update-harnesses" rc
  mkdir -p "$state" || return 1
  if ! curl -fsSL --max-time 120 -o "$state/junie-install.sh" "$JUNIE_INSTALLER_URL"; then
    echo "junie: installer download failed" >&2; return 1
  fi
  trap '' PIPE  # a dropped SSH channel must not kill us between the move and the restore
  trap 'junie_restore; exit 130' INT TERM HUP
  if [[ -e "$JUNIE_LINK" || -L "$JUNIE_LINK" ]]; then
    JUNIE_BACKUP="$state/junie.prev.$(date +%Y%m%dT%H%M%S)"
    mv -f "$JUNIE_LINK" "$JUNIE_BACKUP" || { JUNIE_BACKUP=""; trap - INT TERM HUP PIPE; return 1; }
  fi
  run_step "junie installer" bash "$state/junie-install.sh"; rc=$?
  if ((rc)) || ! grep -qs JUNIE_MANAGED_SHIM "$(readlink -f "$JUNIE_LINK" 2>/dev/null)"; then
    echo "junie: migration failed (exit $rc); restoring previous entry" >&2
    junie_restore; rc=${rc/#0/1}
  else
    echo "junie: previous entry kept at $JUNIE_BACKUP" >&2
    JUNIE_BACKUP=""
  fi
  trap - INT TERM HUP PIPE
  return "$rc"
}

update_install() { # harness method path real
  local h=$1 m=$2 p=$3 r=$4
  case "$m" in
    npm)
      if [[ $h == junie ]]; then junie_migrate; else npm_update "$r"; fi ;;
    bun)
      if [[ $h == junie ]]; then junie_migrate; else bun_update "$r"; fi ;;
    native)
      run_step "$h" "$p" update ;;
    kimi) run_step kimi "$p" upgrade --yes ;;
    cursor-agent) run_step cursor-agent "$p" update ;;
    muse) MUSE_NO_AUTO_UPDATE=0 MUSE_SYNC_UPDATE=1 run_step muse "$p" --version ;;
    junie-managed) run_step junie "$p" update ;;
    junie-legacy) junie_migrate ;;
    *) return 99 ;;
  esac
}

do_cli() {
  local h=$1 name=$1 path real m w v active=1 any=0 after status note rc
  local -a rows=()
  while IFS=$'\t' read -r scope path real; do
    [[ -n "$path" ]] || continue
    any=1
    m=$(classify "$h" "$real"); w=$(writable "$m" "$real"); v=$(clean "$(version_of "$h" "$path")")
    [[ $scope == stale ]] && st_active=stale || st_active=$active
    tab @@INSTALL "$h" "$st_active" "$m" "$w" "$v" "$path"
    # \x1f, not TAB: TAB is IFS whitespace, so `read` would merge an empty field.
    rows+=("$st_active"$'\x1f'"$m"$'\x1f'"$w"$'\x1f'"$v"$'\x1f'"$path"$'\x1f'"$real")
    [[ $scope == path ]] && active=0
  done < <(installs_of "$name")
  if ((!any)); then tab @@RESULT "$h" absent - - - - "not installed"; return; fi
  [[ $mode == update ]] || return 0
  # Junie: one migration covers the host; later rows are inactive copies.
  local migrated=0 migrating
  for row in "${rows[@]}"; do
    IFS=$'\x1f' read -r active m w v path real <<<"$row"
    note=""; migrating=0
    if [[ $active == stale ]]; then
      tab @@RESULT "$h" skipped "$v" - "$m" "$path" "under an unused node version; not updated"; continue
    fi
    if [[ $m == unknown ]]; then tab @@RESULT "$h" skipped "$v" - "$m" "$path" "unknown install method"; continue; fi
    if [[ $w != 1 ]]; then tab @@RESULT "$h" skipped "$v" - "$m" "$path" "not writable by $(id -un); admin route needed"; continue; fi
    if [[ $h == junie && $m != junie-managed ]]; then
      if [[ $active != 1 ]] || ((migrated)); then
        tab @@RESULT "$h" skipped "$v" - "$m" "$path" "inactive frozen copy left in place"; continue
      fi
      if [[ $JUNIE_MIGRATE != 1 ]]; then
        tab @@RESULT "$h" skipped "$v" - "$m" "$path" "frozen install; migration disabled"; continue
      fi
      if [[ $path != "$JUNIE_LINK" ]]; then
        tab @@RESULT "$h" skipped "$v" - "$m" "$path" "active entry is not $JUNIE_LINK; migrate by hand"; continue
      fi
      migrated=1; migrating=1
    fi
    update_install "$h" "$m" "$path" "$real"; rc=$?
    if ((migrating && !rc)); then m=junie-managed; note="migrated to the managed launcher"; fi
    after=$(clean "$(version_of "$h" "$path")")
    if ((rc)); then status=failed; note="exit $rc"
    elif [[ $after == - ]]; then status=failed; note="version unreadable after update"
    elif [[ $after == "$v" ]]; then status=current
    else status=updated; fi
    tab @@RESULT "$h" "$status" "$v" "$after" "$m" "$path" "$(clean "$note")"
  done
}

# ---------------------------------------------------------------- t3code (fleet pull)
t3_version() {
  if [[ -r "$HOME/.t3/runtime/fork-current" ]]; then cut -d' ' -f2 "$HOME/.t3/runtime/fork-current"
  else version_of t3 "$(command -v t3 || echo /nonexistent)"; fi
}

do_t3() {
  local before after rc method
  if systemctl --user cat t3code-fork-pull.service >/dev/null 2>&1; then method=fork-pull-unit
  elif [[ -x /workspace/bootstrap/ensure-services.sh ]]; then method=ensure-services
  elif command -v t3 >/dev/null 2>&1; then method=unmanaged
  else tab @@RESULT t3code absent - - - - "not installed"; return; fi
  before=$(t3_version)
  tab @@INSTALL t3code 1 "$method" 1 "$(clean "$before")" "$(command -v t3 || echo -)"
  [[ $mode == update ]] || return 0
  # The pull unit's own TimeoutStartSec is 20 min; outlast it so a slow pull is not
  # reported failed while it keeps running.
  case "$method" in
    fork-pull-unit) STEP_TIMEOUT=1500 run_step t3code systemctl --user start t3code-fork-pull.service; rc=$? ;;
    ensure-services) STEP_TIMEOUT=1500 run_step t3code /workspace/bootstrap/ensure-services.sh; rc=$? ;;
    *) tab @@RESULT t3code skipped "$(clean "$before")" - "$method" - "no fork pull on this host"; return ;;
  esac
  after=$(t3_version)
  if ((rc == 124)); then tab @@RESULT t3code pending "$(clean "$before")" "$(clean "$after")" "$method" - "pull still running; check again later"
  elif ((rc)); then tab @@RESULT t3code failed "$(clean "$before")" "$(clean "$after")" "$method" - "exit $rc"
  elif [[ "$after" == "$before" ]]; then tab @@RESULT t3code current "$(clean "$before")" "$(clean "$after")" "$method" - ""
  else tab @@RESULT t3code updated "$(clean "$before")" "$(clean "$after")" "$method" - ""; fi
}

# ------------------------------------------------- Cursor sandbox AppArmor pins (beep-worker)
# The profile pins two helper paths by version. Report drift; the orchestrator fixes it
# through the host's admin route, never this account.
apparmor_check() {
  [[ -r $APPARMOR_PROFILE ]] || return 0
  local t3v cur sdk cli drift=0
  t3v=$(t3_version)
  sdk="$HOME/.t3/runtime/versions/$t3v/node_modules/@cursor/sdk-linux-x64/bin/cursorsandbox"
  cur=$(readlink -f "$(command -v cursor-agent || echo /nonexistent)" 2>/dev/null)
  cli="$(dirname "$cur")/cursorsandbox"
  grep -qF " $sdk " "$APPARMOR_PROFILE" || drift=1
  grep -qF " $cli " "$APPARMOR_PROFILE" || drift=1
  [[ -x "$sdk" ]] || sdk=-
  [[ -x "$cli" ]] || cli=-
  tab @@APPARMOR "$drift" "$sdk" "$cli"
}

# ---------------------------------------------------------------- Muse settings (read-only)
# `muse serve` exits 3 when settings.json lacks schema_version, and T3's Muse provider then
# reports that it could not read the model catalog. Report it; never rewrite the file here.
muse_settings_check() {
  local f="$HOME/.config/muse/settings.json"
  [[ -n "$(installs_of muse)" && -r "$f" ]] || return 0
  grep -qE '"schema_version"[[:space:]]*:' "$f" && return 0
  tab @@NOTE muse "~/.config/muse/settings.json has no schema_version: muse serve exits 3 and T3 cannot read its model catalog"
}

# ---------------------------------------------------------------- main
. /etc/os-release 2>/dev/null || true
[[ "$(ps -o comm= -p 1 2>/dev/null)" == systemd ]] && sd=1 || sd=0
tab @@HOST "$(hostname)" "$(id -un)" "$(clean "${PRETTY_NAME:-unknown}")" "$sd"
for h in "${harnesses[@]}"; do
  case "$h" in
    t3code) do_t3 ;;
    claude|codex|grok|kimi|junie|cursor-agent) do_cli "$h" ;;
    muse) do_cli muse; muse_settings_check ;;
    *) tab @@RESULT "$h" skipped - - - - "unknown harness" ;;
  esac
done
apparmor_check
exit 0
