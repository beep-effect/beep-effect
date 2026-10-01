#!/usr/bin/env bash
# Bootstrap a hosted agent container (Claude Code on the web) for beep-effect.
# Packet: goals/cloud-agent-readiness (D1, D2, F15). Usage:
#   bash scripts/cloud-session-setup.sh [--check]
# Proven routes only (2026-10-01 probe): GitHub release archives and the npm
# registry are reachable; bun.sh is not. Idempotent; writes only under
# ~/.cache/beep and node_modules. Exit 78 = environment configuration error
# (a denied host), with the remedy on one line.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
CACHE="${HOME}/.cache/beep"
TOOLS="${CACHE}/tools/bin"
GITLEAKS_VERSION="${GITLEAKS_VERSION:-8.30.1}"   # CI pin: .github/workflows/check.yml
TYPOS_VERSION="${TYPOS_VERSION:-1.44.0}"         # CI pin: .github/workflows/heavy.yml
SHELLCHECK_VERSION="${SHELLCHECK_VERSION:-0.10.0}" # SPEC verification matrix
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

log() { printf 'cloud-session-setup: %s\n' "$*"; }
fail78() { printf 'cloud-session-setup: DENIED %s — remedy: %s\n' "$1" "$2" >&2; exit 78; }

cd "$REPO_ROOT"
mkdir -p "$TOOLS"
export PATH="${CACHE}/bun/current:${TOOLS}:${PATH}"

# 1. Pinned bun (D1): GitHub release archive verified against the tracked digest,
#    npm package as the fallback route. Never bun.sh/install, never cp over a busy binary.
want="$(tr -d '[:space:]' < .bun-version)"
have="$(bun --version 2>/dev/null || true)"
if [ "$have" != "$want" ]; then
  log "bun ${have:-missing} != pinned ${want}; provisioning"
  if ! $CHECK_ONLY; then
    dir="${CACHE}/bun/${want}"
    mkdir -p "$dir"
    if curl -fsSL -o "${dir}/bun-linux-x64.zip" \
        "https://github.com/oven-sh/bun/releases/download/bun-v${want}/bun-linux-x64.zip"; then
      expected="$(tr -d '[:space:]' < .bun-linux-x64.sha256)"
      actual="$(sha256sum "${dir}/bun-linux-x64.zip" | cut -d' ' -f1)"
      [ "$expected" = "$actual" ] || { log "bun archive digest mismatch (expected ${expected}, got ${actual})"; exit 1; }
      (cd "$dir" && unzip -oq bun-linux-x64.zip)
      ln -sfn "${dir}/bun-linux-x64" "${CACHE}/bun/current"
    elif command -v npm >/dev/null 2>&1; then
      log "github.com release download denied; falling back to npm"
      npm install --prefix "${dir}/npm" --no-audit --no-fund "bun@${want}" >/dev/null
      ln -sfn "${dir}/npm/node_modules/.bin" "${CACHE}/bun/current"
    else
      fail78 "github.com and no npm" "allow github.com release downloads or registry.npmjs.org"
    fi
    hash -r
  fi
fi
$CHECK_ONLY || { [ "$(bun --version)" = "$want" ] || { log "bun still $(bun --version) after provisioning"; exit 1; }; }
log "bun $(bun --version 2>/dev/null || echo missing) (pinned ${want})"

# 2. Commit-gate tools lefthook needs (F15): gitleaks and typos at CI's pins.
if ! command -v gitleaks >/dev/null 2>&1 && ! $CHECK_ONLY; then
  curl -fsSL -o "${CACHE}/gitleaks.tar.gz" \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    || fail78 "github.com (gitleaks)" "allow github.com release downloads"
  tar -xzf "${CACHE}/gitleaks.tar.gz" -C "$TOOLS" gitleaks
fi
if ! command -v typos >/dev/null 2>&1 && ! $CHECK_ONLY; then
  curl -fsSL -o "${CACHE}/typos.tar.gz" \
    "https://github.com/crate-ci/typos/releases/download/v${TYPOS_VERSION}/typos-v${TYPOS_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    || fail78 "github.com (typos)" "allow github.com release downloads"
  tar -xzf "${CACHE}/typos.tar.gz" -C "$TOOLS" ./typos 2>/dev/null || tar -xzf "${CACHE}/typos.tar.gz" -C "$TOOLS"
fi
if ! command -v shellcheck >/dev/null 2>&1 && ! $CHECK_ONLY; then
  curl -fsSL -o "${CACHE}/shellcheck.tar.xz" \
    "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
    || fail78 "github.com (shellcheck)" "allow github.com release downloads"
  tar -xJf "${CACHE}/shellcheck.tar.xz" -C "${CACHE}" && cp "${CACHE}/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" "$TOOLS/"
fi
log "gitleaks $(gitleaks version 2>/dev/null || echo missing); typos $(typos --version 2>/dev/null || echo missing)"

# 3. Preflight the Effect snapshot registry (D2). A 403 is a network-policy denial.
probe_pkg="$(rg -o -m1 'https://pkg\.pr\.new/[^"]+' package.json | head -1 || true)"
code="$(curl -s -o /dev/null -w '%{http_code}' "${probe_pkg:-https://pkg.pr.new/}" 2>/dev/null)" || code=000
case "$code" in
  2*|3*) log "pkg.pr.new reachable (HTTP ${code})" ;;
  *) fail78 "pkg.pr.new (HTTP ${code})" "add pkg.pr.new to the environment's allowed domains (Network access) — every Effect 4.0.0 snapshot package is served from it" ;;
esac
if $CHECK_ONLY; then
  log "check: gh=$(gh auth status >/dev/null 2>&1 && echo ok || echo unauthenticated) systemd-user=$(systemctl --user is-system-running >/dev/null 2>&1 && echo ok || echo absent) op=$(command -v op >/dev/null 2>&1 && echo present || echo absent)"
  exit 0
fi

# 4. Frozen install, three attempts (mirrors .github/actions/setup-monorepo-ci).
for attempt in 1 2 3; do
  if bun install --frozen-lockfile; then break; fi
  [ "$attempt" -eq 3 ] && { log "bun install --frozen-lockfile failed after 3 attempts"; exit 1; }
  log "bun install failed (attempt ${attempt}/3); retrying in $((attempt * 15))s"; sleep $((attempt * 15))
done

# 5. Never report success on a silent partial install (F6).
[ -f node_modules/effect/package.json ] || { log "node_modules/effect is missing after install — the pkg.pr.new packages did not resolve"; exit 1; }
bun run beep --help >/dev/null 2>&1 || { log "bun run beep --help failed"; exit 1; }
log "ready: bun $(bun --version), effect $(python3 -c 'import json;print(json.load(open("node_modules/effect/package.json"))["version"])' 2>/dev/null || echo '?')"
# shellcheck disable=SC2016 # the literal $PATH is for the caller's shell to expand
printf 'export PATH="%s:%s:$PATH"\nexport BEEP_AGENT_HOST=cloud\n' "${CACHE}/bun/current" "$TOOLS"
