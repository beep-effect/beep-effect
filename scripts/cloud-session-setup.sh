#!/usr/bin/env bash
# Bootstrap a hosted agent container (Claude Code on the web) for beep-effect.
# Packet: goals/cloud-agent-readiness (D1, D2, D3, F5, F6, F15).
#
# Usage:
#   bash scripts/cloud-session-setup.sh [--check] [--host cloud]
#
# Exit codes: 0 ready; 1 provisioning or install failure (digest mismatch,
# incomplete install); 78 environment configuration error (a denied host),
# with the host and its remedy on one line.
#
# Idempotent; never edits a tracked file. Binaries land in ~/.bun/bin only when
# the caller's `bun` already lives there (so the caller's PATH needs no change);
# otherwise (no bun, or a mise-managed or relocated one) they land in
# ~/.cache/beep/bin, which the printed env file adds to PATH. `--check` probes
# and reports without writing anything.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
CACHE="${HOME}/.cache/beep"
ENV_FILE="${CACHE}/cloud-env.sh"

# CI pins and the digests of the exact release archives (sha256 of the archive).
GITLEAKS_VERSION="8.30.1"   # .github/workflows/check.yml
GITLEAKS_SHA256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
TYPOS_VERSION="1.44.0"      # .github/workflows/heavy.yml
TYPOS_SHA256="1b788b7d764e2f20fe089487428a3944ed218d1fb6fcd8eac4230b5893a38779"
SHELLCHECK_VERSION="0.10.0" # SPEC verification matrix; verification-only, never blocks setup
SHELLCHECK_SHA256="6c881ab0698e4e6ea235245f22832860544f17ba386442fe7e9d629f8cbedf87"

CHECK_ONLY=false
HOST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=true ;;
    --host) HOST="${2:-}"; shift ;;
    *) printf 'cloud-session-setup: unknown argument %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf 'cloud-session-setup: %s\n' "$*"; }
warn() { printf 'cloud-session-setup: WARN: %s\n' "$*" >&2; }
fail78() { printf 'cloud-session-setup: DENIED %s — remedy: %s\n' "$1" "$2" >&2; exit 78; }

# Where binaries go: bun's own install directory (~/.bun/bin) when that is
# where the caller's bun lives, because it is already on PATH; otherwise a cache
# directory the env file adds to PATH. Never a mise shim directory or any other
# toolchain-managed location (a workstation keeps its own bun management).
BIN_DIR="${CACHE}/bin"
if [ "$(command -v bun 2>/dev/null || true)" = "${HOME}/.bun/bin/bun" ]; then
  BIN_DIR="${HOME}/.bun/bin"
fi

# Download URL -> file, verifying the archive digest. Returns 1 when the host
# is unreachable or denied, 2 on a digest mismatch (a hard failure), 4 when
# the transfer timed out (bounded so a hung transfer still reaches the
# fallback route; a timeout is reported as slow, never as a denial).
fetch_verified() {
  local url="$1" out="$2" expected="$3" actual rc=0
  curl -fsSL --connect-timeout 20 --max-time 300 -o "$out" "$url" || rc=$?
  if [ "$rc" -eq 28 ]; then
    log "download of ${url} timed out (20s connect / 300s total); this is a slow transfer, not a denied host"
    return 4
  fi
  [ "$rc" -eq 0 ] || return 1
  actual="$(sha256sum "$out" | cut -d' ' -f1)"
  if [ "$actual" != "$expected" ]; then
    log "digest mismatch for ${url}: expected ${expected}, got ${actual}"
    return 2
  fi
}

# HTTP reachability probe; prints the status code, 000 when unreachable.
probe() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || true)"
  printf '%s' "${code:-000}"
}

reachable() { case "$1" in 2*|3*) return 0 ;; *) return 1 ;; esac; }

cd "$REPO_ROOT"
ORIG_PATH="$PATH"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) ;;
  *) printf 'cloud-session-setup: only Linux x86_64 containers are supported (this is %s-%s); use the workstation toolchain (mise) instead\n' "$(uname -s)" "$(uname -m)" >&2; exit 2 ;;
esac
want="$(tr -d '[:space:]' < .bun-version)"
have="$(bun --version 2>/dev/null || true)"
bun_url="https://github.com/oven-sh/bun/releases/download/bun-v${want}/bun-linux-x64.zip"
probe_pkg="$(rg -o -m1 'https://pkg\.pr\.new/[^"]+' package.json | head -1 || true)"
# Fail closed: the probe must hit a real snapshot URL, never the site root.
[ -n "$probe_pkg" ] || { printf 'cloud-session-setup: no pkg.pr.new URL in package.json; cannot probe the snapshot registry\n' >&2; exit 1; }

# --check: probe every route and gate, report all of them, then exit (0, or 78
# when a required host is denied). Nothing is written.
if $CHECK_ONLY; then
  gh_code="$(probe "$bun_url")"
  npm_code="$(probe "https://registry.npmjs.org/bun/${want}")"
  pkg_code="$(probe "$probe_pkg")"
  log "check: bun=${have:-missing} (pinned ${want}) bun-release=HTTP ${gh_code} npm=HTTP ${npm_code} pkg.pr.new=HTTP ${pkg_code}"
  log "check: gitleaks=$(command -v gitleaks >/dev/null 2>&1 && gitleaks version || echo missing) typos=$(command -v typos >/dev/null 2>&1 && typos --version | cut -d' ' -f2 || echo missing) shellcheck=$(command -v shellcheck >/dev/null 2>&1 && echo present || echo missing)"
  log "check: gh=$(gh auth status >/dev/null 2>&1 && echo ok || echo unauthenticated) systemd-user=$(systemctl --user is-system-running >/dev/null 2>&1 && echo ok || echo absent) op=$(command -v op >/dev/null 2>&1 && echo present || echo absent)"
  if [ "$have" != "$want" ] && ! reachable "$gh_code" && ! reachable "$npm_code"; then
    fail78 "github.com (HTTP ${gh_code}) and registry.npmjs.org (HTTP ${npm_code})" "allow github.com release downloads or registry.npmjs.org so bun ${want} can be provisioned"
  fi
  reachable "$pkg_code" || fail78 "pkg.pr.new (HTTP ${pkg_code})" "add pkg.pr.new to the environment's allowed domains (Network access) — every Effect 4.0.0 snapshot package is served from it"
  exit 0
fi

mkdir -p "$CACHE" "$BIN_DIR"

# 1. Pinned bun (D1): the GitHub release archive verified against the tracked
#    digest, npm as the fallback route. Never bun.sh/install (F2). A busy binary
#    is replaced by rename, never by copy (F5).
if [ "$have" != "$want" ]; then
  log "bun ${have:-missing} != pinned ${want}; provisioning"
  work="${CACHE}/bun/${want}"
  mkdir -p "$work"
  expected="$(tr -d '[:space:]' < .bun-linux-x64.sha256)"
  if fetch_verified "$bun_url" "${work}/bun-linux-x64.zip" "$expected"; then
    (cd "$work" && unzip -oq bun-linux-x64.zip)
    new_bun="${work}/bun-linux-x64/bun"
  else
    rc=$?
    [ "$rc" -eq 2 ] && exit 1
    bun_timed_out=false
    [ "$rc" -eq 4 ] && bun_timed_out=true
    if $bun_timed_out; then
      log "github.com release download timed out; trying the npm route"
    else
      log "github.com release download denied; trying the npm route"
    fi
    if command -v npm >/dev/null 2>&1 && npm install --prefix "${work}/npm" --no-audit --no-fund "bun@${want}" >/dev/null 2>&1; then
      new_bun="$(readlink -f "${work}/npm/node_modules/.bin/bun")"
    elif $bun_timed_out; then
      # Name a denied npm route even when GitHub only timed out, so the
      # operator is not told to retry a transfer that policy would block.
      npm_code="$(probe "https://registry.npmjs.org/bun/${want}")"
      reachable "$npm_code" || fail78 "registry.npmjs.org (HTTP ${npm_code}); the github.com release download timed out" "allow registry.npmjs.org, or rerun once github.com release downloads complete within 300s"
      log "bun ${want} not provisioned: the github.com download timed out (slow transfer, not a denial) and the npm install failed although registry.npmjs.org is reachable (HTTP ${npm_code}); rerun, or check proxy throughput"; exit 1
    else
      fail78 "github.com and registry.npmjs.org" "allow github.com release downloads or registry.npmjs.org so bun ${want} can be provisioned"
    fi
  fi
  cp "$new_bun" "${BIN_DIR}/bun.new" && chmod 755 "${BIN_DIR}/bun.new" && mv -f "${BIN_DIR}/bun.new" "${BIN_DIR}/bun"
  [ -e "${BIN_DIR}/bunx" ] || ln -s bun "${BIN_DIR}/bunx"
  hash -r
  # The freshly provisioned binary must win for the rest of this script even
  # when a stale bun directory sits earlier on PATH. ORIG_PATH decides the
  # handoff message, so this does not change what the caller is told.
  export PATH="${BIN_DIR}:${PATH}"
elif [ -x "${BIN_DIR}/bun" ] && [ "$("${BIN_DIR}/bun" --version 2>/dev/null || true)" != "$want" ]; then
  # The caller's bun already matches the pin (a mise-managed one, say) but an
  # earlier setup left an older bun in the cache directory. Remove it so the
  # env file cannot put it ahead of the correct one; PATH is left alone.
  log "removing stale ${BIN_DIR}/bun ($("${BIN_DIR}/bun" --version 2>/dev/null || echo unreadable)) so it cannot shadow the caller's pinned bun"
  rm -f "${BIN_DIR}/bun" "${BIN_DIR}/bunx"
fi
[ "$(bun --version)" = "$want" ] || { log "bun is still $(bun --version) after provisioning"; exit 1; }
log "bun $(bun --version) (pinned ${want}) at $(command -v bun)"

# 2. Commit-gate tools lefthook needs (F15), each verified against its pinned
#    archive digest. shellcheck is verification-only and never blocks setup.
# extract <name> <archive>: place the named binary into BIN_DIR.
extract_tool() {
  case "$1" in
    gitleaks) tar -xzf "$2" -C "$BIN_DIR" gitleaks ;;
    typos) tar -xzf "$2" -C "$BIN_DIR" ./typos ;;
    shellcheck) tar -xJf "$2" -C "$CACHE" && cp "${CACHE}/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" "$BIN_DIR/" ;;
  esac
}
# install_tool <name> <url> <sha256>: 0 installed or already in BIN_DIR, 1 host denied,
# 2 digest mismatch, 3 extraction failed (a local problem, never a network denial). Presence is checked in BIN_DIR, not on PATH, so a tool that
# happens to be reachable in this shell is still installed for later shells.
install_tool() {
  local name="$1" url="$2" expected="$3"
  local archive="${CACHE}/${name}.archive"
  [ -x "${BIN_DIR}/${name}" ] && return 0
  fetch_verified "$url" "$archive" "$expected" || return $?
  extract_tool "$name" "$archive" || return 3
}
# tool_failed <name> <rc>: map install_tool's non-zero codes to the right exit.
tool_failed() {
  case "$2" in
    2) exit 1 ;;
    3) log "could not extract the ${1} archive into ${BIN_DIR} (disk space or permissions)"; exit 1 ;;
    4) log "${1} not provisioned: the download timed out (slow transfer, not a denial); rerun, or check proxy throughput"; exit 1 ;;
    *) fail78 "github.com (${1})" "allow github.com release downloads; lefthook's pre-commit gate needs ${1}" ;;
  esac
}
install_tool gitleaks "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" "$GITLEAKS_SHA256" \
  || tool_failed gitleaks $?
install_tool typos "https://github.com/crate-ci/typos/releases/download/v${TYPOS_VERSION}/typos-v${TYPOS_VERSION}-x86_64-unknown-linux-musl.tar.gz" "$TYPOS_SHA256" \
  || tool_failed typos $?
install_tool shellcheck "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" "$SHELLCHECK_SHA256" \
  || warn "shellcheck not provisioned (verification-only; setup continues)"
# Report from BIN_DIR by path: it is not necessarily on this script's PATH.
# shellcheck is verification-only: an unreadable binary must not stop setup.
shellcheck_version="missing"
if [ -x "${BIN_DIR}/shellcheck" ]; then
  shellcheck_version="$("${BIN_DIR}/shellcheck" --version 2>/dev/null | sed -n 's/^version: //p')" || shellcheck_version="unreadable"
  [ -n "$shellcheck_version" ] || shellcheck_version="unreadable"
fi
log "gitleaks $("${BIN_DIR}/gitleaks" version); typos $("${BIN_DIR}/typos" --version | cut -d' ' -f2); shellcheck ${shellcheck_version}"

# 3. Preflight the Effect snapshot registry (D2). A denial is a network-policy error.
pkg_code="$(probe "$probe_pkg")"
reachable "$pkg_code" || fail78 "pkg.pr.new (HTTP ${pkg_code})" "add pkg.pr.new to the environment's allowed domains (Network access) — every Effect 4.0.0 snapshot package is served from it"
log "pkg.pr.new reachable (HTTP ${pkg_code})"

# 4. Frozen install, three attempts (mirrors .github/actions/setup-monorepo-ci).
for attempt in 1 2 3; do
  if bun install --frozen-lockfile; then break; fi
  [ "$attempt" -eq 3 ] && { log "bun install --frozen-lockfile failed after 3 attempts"; exit 1; }
  log "bun install failed (attempt ${attempt}/3); retrying in $((attempt * 15))s"; sleep $((attempt * 15))
done

# 5. Never report success on a silent partial install (F6): every package the
#    root catalog pins to pkg.pr.new must be present.
missing=""
while IFS= read -r name; do
  [ -f "node_modules/${name}/package.json" ] || missing="${missing} ${name}"
done < <(bun -e 'const c=require("./package.json").catalog??{};for(const [k,v] of Object.entries(c)) if(String(v).includes("pkg.pr.new")) console.log(k)')
[ -z "$missing" ] || { log "incomplete install — snapshot packages missing:${missing}"; exit 1; }
bun run beep --help >/dev/null 2>&1 || { log "bun run beep --help failed"; exit 1; }

# 6. Environment handoff. Binaries already sit on the caller's PATH when they
#    went to ~/.bun/bin; otherwise the caller sources the env file printed below.
#    BEEP_AGENT_HOST is written only when --host cloud was passed (D3).
{
  # shellcheck disable=SC2016 # the literal $PATH is for the caller's shell to expand
  printf 'export PATH="%s:$PATH"\n' "$BIN_DIR"
  [ "$HOST" = "cloud" ] && printf 'export BEEP_AGENT_HOST=cloud\n'
} > "$ENV_FILE"
log "ready: bun $(bun --version), effect $(bun -e 'console.log(require("effect/package.json").version)')"
case ":${ORIG_PATH}:" in
  *":${BIN_DIR}:"*)
    if [ "$HOST" = "cloud" ]; then
      log "ACTION: source ${ENV_FILE} to export BEEP_AGENT_HOST=cloud in your shell"
    else
      log "env file: ${ENV_FILE} (nothing to source; ${BIN_DIR} is already on your PATH)"
    fi ;;
  *) log "ACTION: source ${ENV_FILE} before running bun or committing — ${BIN_DIR} is not on your PATH, so lefthook cannot find gitleaks and typos until you do" ;;
esac
