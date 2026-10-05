#!/usr/bin/env bash
# Cloud environment bootstrap for beep-effect.
#
# One repo-owned script behind every vendor cloud environment (Claude Code cloud
# sessions, Codex cloud, Cursor Cloud Agents). Each vendor UI gets a one-line
# setup script that calls this file, so the eight per-account environments stay
# thin and every later toolchain change flows through git instead of eight
# dashboards. Runbook: docs/runbooks/cloud-environments.md.
#
# Contract
#   - Idempotent and snapshot-safe: re-runs are cheap no-ops when the pinned
#     toolchain and the lockfile-matched dependency tree are already on disk, so
#     the same file serves a cached setup script and a per-session hook.
#   - Durable preparation only: toolchain + workspace dependencies + the tsgo
#     patch. No dev servers, no secrets, no background processes.
#   - Fail loud on the core toolchain (bun, dependencies, tsgo patch); best-effort
#     on the optional tools (Node 24, portless, 1Password CLI).
#   - Scoped to cloud VMs: without a cloud marker the script exits 0 untouched,
#     so a SessionStart hook can call it unconditionally. BEEP_CLOUD_FORCE=1
#     overrides the guard for local dry runs.
#
# Vendor detection (BEEP_CLOUD_VENDOR wins when set):
#   claude  CLAUDE_CODE_REMOTE=true   (Claude cloud sessions set it on the VM)
#   codex   CODEX_ENV_* or CODEX_PROXY_CERT (codex-universal image markers);
#           the Codex setup script also passes BEEP_CLOUD_VENDOR=codex explicitly
#   cursor  .cursor/install.sh passes BEEP_CLOUD_VENDOR=cursor
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# 0. Cloud guard + vendor detection
# ---------------------------------------------------------------------------
detect_vendor() {
  if [ -n "${BEEP_CLOUD_VENDOR:-}" ]; then
    printf '%s' "${BEEP_CLOUD_VENDOR}"
  elif [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
    printf 'claude'
  elif [ -n "${CODEX_PROXY_CERT:-}" ] || env | grep -q '^CODEX_ENV_'; then
    printf 'codex'
  elif [ -n "${CURSOR_AGENT:-}" ]; then
    printf 'cursor'
  else
    printf ''
  fi
}

VENDOR="$(detect_vendor)"
if [ -z "${VENDOR}" ] && [ "${BEEP_CLOUD_FORCE:-0}" != "1" ]; then
  # Not a cloud VM (a developer workstation running the SessionStart hook).
  exit 0
fi
VENDOR="${VENDOR:-forced}"
log() { printf '[beep-cloud:%s] %s\n' "${VENDOR}" "$*"; }
warn() { printf '[beep-cloud:%s] WARN: %s\n' "${VENDOR}" "$*" >&2; }
die() { printf '[beep-cloud:%s] ERROR: %s\n' "${VENDOR}" "$*" >&2; exit 1; }

[ "$(uname -s)" = "Linux" ] || die "Linux only (cloud VMs are Ubuntu x86_64); got $(uname -s)."
[ "$(uname -m)" = "x86_64" ] || die "x86_64 only; got $(uname -m)."

BUN_VERSION="$(tr -d '[:space:]' < .bun-version)"
NODE_VERSION="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo 24)"
export BUN_INSTALL="${BUN_INSTALL:-${HOME}/.bun}"
NODE_PREFIX="${HOME}/.local/node${NODE_VERSION}"
# Directory holding the Node this script provisioned. The tarball path fills
# NODE_PREFIX; the nvm path repoints this at nvm's versioned bin directory.
NODE_BIN_DIR="${NODE_PREFIX}/bin"
export PATH="${BUN_INSTALL}/bin:${NODE_BIN_DIR}:${PATH}"

bootstrap_cache="${XDG_CACHE_HOME:-${HOME}/.cache}/beep/cloud-bootstrap"
install -d -m 0700 "${bootstrap_cache}"
# Every download lands in one per-run directory created here, in the parent
# shell, so the EXIT trap removes it on success and on every failure path (the
# fetches run in background subshells and could not register their own
# cleanup). Leftovers from a run that was killed outright are swept first:
# this script also runs on session start and resume, and VM disk is finite.
find "${bootstrap_cache}" -mindepth 1 -maxdepth 1 -name 'run.*' -mmin +60 -exec rm -rf -- {} + 2>/dev/null || true
run_dir="$(mktemp -d "${bootstrap_cache}/run.XXXXXX")"
cleanup_run_dir() { rm -rf -- "${run_dir}"; }
trap cleanup_run_dir EXIT

# Symlink into /usr/local/bin when we can, so tools resolve for every shell the
# vendor spawns (login, non-login, the agent's own exec daemon). Claude and
# Codex setup scripts run as root; Cursor has passwordless sudo.
link_global() {
  local target="$1" name="$2"
  if [ -w /usr/local/bin ]; then
    ln -sf "${target}" "/usr/local/bin/${name}"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n ln -sf "${target}" "/usr/local/bin/${name}"
  fi
}

# Setup and agent phases run in separate shells on Codex and Claude, so PATH
# exported here does not reach the agent. Persist it where each vendor's agent
# shell reads it: ~/.bashrc (Codex, Cursor) and $CLAUDE_ENV_FILE (Claude
# SessionStart hooks).
persist_path() {
  local line="export PATH=\"${BUN_INSTALL}/bin:${NODE_BIN_DIR}:\$PATH\""
  local marker="# beep-cloud-bootstrap PATH"
  # Keyed on the exact line, not the marker alone: a re-run that resolves a
  # different Node directory (an nvm patch bump) appends the new one, and the
  # later export wins.
  if ! { [ -f "${HOME}/.bashrc" ] && grep -qxF "${line}" "${HOME}/.bashrc"; }; then
    printf '\n%s\n%s\n' "${marker}" "${line}" >> "${HOME}/.bashrc"
  fi
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf '%s\n' "${line}" >> "${CLAUDE_ENV_FILE}"
  fi
}

# ---------------------------------------------------------------------------
# 1. Downloads (parallel; each writes into its own workdir)
# ---------------------------------------------------------------------------
# Claude caches a setup script only when it finishes in roughly five minutes,
# so independent network fetches run concurrently and the install step waits.

need_bun=0
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null)" != "${BUN_VERSION}" ]; then
  need_bun=1
fi

need_node=0
if ! command -v node >/dev/null 2>&1 || [ "$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1)" != "${NODE_VERSION}" ]; then
  need_node=1
fi

fetch_bun() {
  local sha work archive
  sha="$(tr -d '[:space:]' < .bun-linux-x64.sha256)"
  work="${run_dir}/bun"
  mkdir -p "${work}"
  archive="${work}/bun-linux-x64.zip"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${archive}" \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip"
  printf '%s  %s\n' "${sha}" "${archive}" | sha256sum --check --strict - >/dev/null
  unzip -oq "${archive}" -d "${work}"
}

fetch_node() {
  # nvm first when the image ships it (Cursor); otherwise the official tarball
  # from nodejs.org, which the Claude Trusted allowlist admits.
  if [ -s "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" ]; then
    printf 'nvm' > "${run_dir}/node.mode"
    return 0
  fi
  local index version work
  index="$(curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    "https://nodejs.org/dist/index.tab")" || return 1
  version="$(printf '%s\n' "${index}" | awk -v major="v${NODE_VERSION}." 'index($1, major) == 1 { print $1; exit }')"
  [ -n "${version}" ] || return 1
  work="${run_dir}/node"
  mkdir -p "${work}"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${work}/node.tar.xz" \
    "https://nodejs.org/dist/${version}/node-${version}-linux-x64.tar.xz"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${work}/SHASUMS256.txt" \
    "https://nodejs.org/dist/${version}/SHASUMS256.txt"
  (cd "${work}" && grep " node-${version}-linux-x64.tar.xz\$" SHASUMS256.txt | sed 's# .*# node.tar.xz#' | sha256sum --check --strict - >/dev/null)
  printf 'tarball' > "${run_dir}/node.mode"
}

# 1Password CLI: always download + GPG-verify the pinned release; never trust an
# `op` already on PATH (a reused snapshot could carry an unverified binary that
# would then handle OP_SERVICE_ACCOUNT_TOKEN). Best-effort: op-backed runs are
# optional, the toolchain is not.
OP_PINNED_VERSION="2.39.0"
OP_GPG_FINGERPRINT="3FEF9748469ADBE15DA7CA80AC2D62742012EA22"
OP_GPG_KEY_URL="https://downloads.1password.com/linux/keys/1password.asc"
fetch_op() {
  local work ver
  work="${run_dir}/op"
  mkdir -p "${work}"
  ver="v${OP_PINNED_VERSION}"
  curl -fsSLo "${work}/op.zip" "https://cache.agilebits.com/dist/1P/op2/pkg/${ver}/op_linux_amd64_${ver}.zip" || return 1
  unzip -oq "${work}/op.zip" op op.sig -d "${work}" || return 1
  [ -f "${work}/op" ] && [ -f "${work}/op.sig" ] || return 1
  export GNUPGHOME="${work}/gnupg"
  mkdir -p "${GNUPGHOME}" && chmod 700 "${GNUPGHOME}"
  curl -fsSL "${OP_GPG_KEY_URL}" | gpg --batch --import >/dev/null 2>&1 || return 1
  gpg --batch --with-colons --fingerprint 2>/dev/null | grep -q "^fpr:::::::::${OP_GPG_FINGERPRINT}:" || return 1
  gpg --batch --status-fd=1 --verify "${work}/op.sig" "${work}/op" 2>/dev/null \
    | grep -q "^\[GNUPG:\] VALIDSIG ${OP_GPG_FINGERPRINT} " || return 1
  unset GNUPGHOME
  : > "${run_dir}/op.verified"
}

pids=()
if [ "${need_bun}" = "1" ]; then
  log "fetching bun ${BUN_VERSION}"
  fetch_bun & pids+=("$!:bun")
fi
if [ "${need_node}" = "1" ]; then
  log "fetching node ${NODE_VERSION}"
  fetch_node & pids+=("$!:node")
fi
if [ "${BEEP_CLOUD_SKIP_OP:-0}" != "1" ]; then
  log "fetching 1Password CLI ${OP_PINNED_VERSION}"
  fetch_op & pids+=("$!:op")
fi

op_ok=1
node_ok=1
for entry in "${pids[@]:-}"; do
  [ -n "${entry}" ] || continue
  pid="${entry%%:*}"; name="${entry##*:}"
  if ! wait "${pid}"; then
    case "${name}" in
      bun) die "bun ${BUN_VERSION} download or checksum failed." ;;
      node) node_ok=0; warn "Node ${NODE_VERSION} provisioning failed; the image's node stays on PATH (Next.js and portless want 24+)." ;;
      op) op_ok=0; warn "1Password CLI download or signature verification failed; skipping op (op-backed secret runs unavailable)." ;;
    esac
  fi
done

# ---------------------------------------------------------------------------
# 2. Place the toolchain
# ---------------------------------------------------------------------------
if [ "${need_bun}" = "1" ]; then
  install -d -m 0755 "${BUN_INSTALL}/bin"
  install -m 0755 "${run_dir}/bun/bun-linux-x64/bun" "${BUN_INSTALL}/bin/bun"
  ln -sfn bun "${BUN_INSTALL}/bin/bunx"
fi
# Link only a Bun this script placed. An image that already ships the pinned
# Bun elsewhere (for example at /usr/local/bin/bun) keeps its own executable;
# linking unconditionally would replace it with a dangling symlink.
if [ -x "${BUN_INSTALL}/bin/bun" ]; then
  link_global "${BUN_INSTALL}/bin/bun" bun
  link_global "${BUN_INSTALL}/bin/bunx" bunx
fi

if [ "${need_node}" = "1" ] && [ "${node_ok}" = "1" ]; then
  case "$(cat "${run_dir}/node.mode" 2>/dev/null || true)" in
    nvm)
      export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
      set +e
      # shellcheck disable=SC1091
      . "${NVM_DIR}/nvm.sh"
      nvm install "${NODE_VERSION}" >/dev/null
      nvm alias default "${NODE_VERSION}" >/dev/null
      nvm use "${NODE_VERSION}" >/dev/null
      nvm_node="$(nvm which "${NODE_VERSION}" 2>/dev/null)"
      set -e
      # `nvm use` only changes this shell. Agent shells that never source
      # nvm.sh would fall back to the image's older Node, so resolve nvm's
      # versioned bin directory and persist and link that.
      if [ -n "${nvm_node}" ] && [ -x "${nvm_node}" ]; then
        NODE_BIN_DIR="$(dirname "${nvm_node}")"
      else
        node_ok=0
        warn "nvm did not yield a Node ${NODE_VERSION} binary; the image's node stays on PATH."
      fi
      ;;
    tarball)
      rm -rf "${NODE_PREFIX}"
      install -d -m 0755 "${NODE_PREFIX}"
      tar -xJf "${run_dir}/node/node.tar.xz" -C "${NODE_PREFIX}" --strip-components=1
      ;;
  esac
  if [ "${node_ok}" = "1" ] && [ -x "${NODE_BIN_DIR}/node" ]; then
    export PATH="${NODE_BIN_DIR}:${PATH}"
    link_global "${NODE_BIN_DIR}/node" node
    link_global "${NODE_BIN_DIR}/npm" npm
    link_global "${NODE_BIN_DIR}/npx" npx
  fi
fi

if [ "${op_ok}" = "1" ] && [ -f "${run_dir}/op.verified" ]; then
  op_work="${run_dir}/op"
  if [ -w /usr/local/bin ]; then
    install -m 0755 "${op_work}/op" /usr/local/bin/op
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n install -m 0755 "${op_work}/op" /usr/local/bin/op
  else
    install -m 0755 "${op_work}/op" "${BUN_INSTALL}/bin/op"
  fi
fi

# portless: dev servers run only through portless-wrapped package scripts and it
# is not a workspace dependency, so it has to be on PATH.
if ! command -v portless >/dev/null 2>&1; then
  if ! bun add -g portless >/dev/null 2>&1; then
    warn "portless install failed; dev servers will not start until it is on PATH."
  fi
fi
[ -x "${BUN_INSTALL}/bin/portless" ] && link_global "${BUN_INSTALL}/bin/portless" portless

persist_path

# ---------------------------------------------------------------------------
# 3. Workspace dependencies (lockfile-keyed, so a resumed VM skips it)
# ---------------------------------------------------------------------------
# --ignore-scripts skips only the root lifecycle scripts. Bun runs no dependency
# lifecycle scripts without a trustedDependencies allowlist (none declared), so
# nothing dependency-side is lost. The root postinstall (`lefthook install` +
# GHA-runner prep) is not needed to build or run anything here, and lefthook
# fails whenever the vendor overrides git core.hooksPath. The one root script
# that matters, `prepare` (the Effect tsgo patch), runs explicitly below.
# Two stamps, because a cached VM can resume on a newer commit that changes one
# without the other: the install stamp is keyed on bun.lock, the prepare stamp
# on everything `bun run prepare` reads (the script text in package.json, the
# prune helper, and the lockfile that pins the tsgo and TypeScript versions).
lock_stamp="node_modules/.beep-cloud-bootstrap.lock.sha256"
prepare_stamp="node_modules/.beep-cloud-bootstrap.prepare.sha256"
lock_hash="$(sha256sum bun.lock | cut -d' ' -f1)"
prepare_hash="$(cat bun.lock package.json scripts/prune-tsgo-backups.mjs | sha256sum | cut -d' ' -f1)"
if [ -d node_modules ] && [ "$(cat "${lock_stamp}" 2>/dev/null || true)" = "${lock_hash}" ]; then
  log "dependencies already match bun.lock; skipping install"
else
  install_attempts=3
  attempt=1
  while :; do
    if bun install --frozen-lockfile --ignore-scripts; then
      break
    fi
    if [ "${attempt}" -ge "${install_attempts}" ]; then
      die "bun install --frozen-lockfile failed after ${install_attempts} attempts (on Claude cloud check the environment's Custom allowlist carries buf.build; see docs/runbooks/cloud-environments.md)."
    fi
    warn "bun install failed (attempt ${attempt}/${install_attempts}); retrying in $((attempt * 15))s"
    sleep $((attempt * 15))
    attempt=$((attempt + 1))
  done
  printf '%s' "${lock_hash}" > "${lock_stamp}"
  # A fresh install replaces the patched compiler, so the patch must re-run.
  rm -f "${prepare_stamp}"
fi

if [ "$(cat "${prepare_stamp}" 2>/dev/null || true)" = "${prepare_hash}" ]; then
  log "tsgo patch already matches its inputs; skipping prepare"
else
  bun run prepare
  printf '%s' "${prepare_hash}" > "${prepare_stamp}"
fi

log "ready: bun $(bun --version), node $(node --version 2>/dev/null || echo missing), portless $(portless --version 2>/dev/null || echo missing), op $(op --version 2>/dev/null || echo missing)"
