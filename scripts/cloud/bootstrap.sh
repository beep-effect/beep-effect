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
#   - Fail loud on the core toolchain (bun, pinned Node, dependencies, tsgo patch);
#     best-effort on the optional tools (portless, 1Password CLI).
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
NODE_VERSION="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo 24.22.1)"
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
pids=()
cleanup_run_dir() {
  local pid
  trap '' INT TERM HUP
  # Only active jobs owned by this shell are timeout supervisors. TERM cancels
  # their process groups; their kill-after grace handles unresponsive children.
  for pid in $(jobs -pr); do
    kill -TERM "${pid}" 2>/dev/null || true
  done
  # Bare wait also joins a worker interrupted between launch and PID recording.
  wait || true
  rm -rf -- "${run_dir}"
}
trap cleanup_run_dir EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

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
# Each whole worker has a four-minute deadline, including retries and local
# verification/extraction, with five seconds to terminate unresponsive children.
OP_PINNED_VERSION="2.39.0"

need_bun=0
if ! command -v bun >/dev/null 2>&1 || [ "$(timeout --kill-after=1s 5s bun --version 2>/dev/null)" != "${BUN_VERSION}" ]; then
  need_bun=1
fi

need_node=0
if ! command -v node >/dev/null 2>&1 || [ "$(timeout --kill-after=1s 5s node --version 2>/dev/null | sed 's/^v//')" != "${NODE_VERSION}" ]; then
  need_node=1
fi


if [ "${need_bun}" = "1" ]; then
  log "fetching bun ${BUN_VERSION}"
  timeout --kill-after=5s 240s bash "${REPO_ROOT}/scripts/cloud/fetch.sh" bun "${run_dir}" "${BUN_VERSION}" & pids+=("$!:bun")
fi
if [ "${need_node}" = "1" ]; then
  log "fetching node ${NODE_VERSION}"
  timeout --kill-after=5s 240s bash "${REPO_ROOT}/scripts/cloud/fetch.sh" node "${run_dir}" "${NODE_VERSION}" & pids+=("$!:node")
fi
if [ "${BEEP_CLOUD_SKIP_OP:-0}" != "1" ]; then
  log "fetching 1Password CLI ${OP_PINNED_VERSION}"
  timeout --kill-after=5s 240s bash "${REPO_ROOT}/scripts/cloud/fetch.sh" op "${run_dir}" "${OP_PINNED_VERSION}" & pids+=("$!:op")
fi

op_ok=1
node_ok=1
for entry in "${pids[@]:-}"; do
  [ -n "${entry}" ] || continue
  pid="${entry%%:*}"; name="${entry##*:}"
  if ! wait "${pid}"; then
    case "${name}" in
      bun) die "bun ${BUN_VERSION} download or checksum failed." ;;
      node) node_ok=0; warn "Node ${NODE_VERSION} provisioning failed." ;;
      op) op_ok=0; warn "1Password CLI download or signature verification failed; skipping op (op-backed secret runs unavailable)." ;;
    esac
  fi
done

# ---------------------------------------------------------------------------
# 2. Place the toolchain
# ---------------------------------------------------------------------------
# Download jobs are settled; retain the vendor shell's foreground signal behavior
# for installation rather than deferring cancellation behind an install command.
trap - INT TERM HUP
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
        warn "nvm did not yield a Node ${NODE_VERSION} binary."
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

if [ "${node_ok}" != "1" ] || ! command -v node >/dev/null 2>&1 || [ "$(timeout --kill-after=1s 5s node --version 2>/dev/null | sed 's/^v//')" != "${NODE_VERSION}" ]; then
  die "Node ${NODE_VERSION} is required; refusing to continue with an unverified or older runtime."
fi

op_path=""
if [ "${op_ok}" = "1" ] && [ -f "${run_dir}/op.verified" ]; then
  op_work="${run_dir}/op"
  if [ -w /usr/local/bin ]; then
    install -m 0755 "${op_work}/op" /usr/local/bin/op
    op_path=/usr/local/bin/op
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n install -m 0755 "${op_work}/op" /usr/local/bin/op
    op_path=/usr/local/bin/op
  else
    install -m 0755 "${op_work}/op" "${BUN_INSTALL}/bin/op"
    op_path="${BUN_INSTALL}/bin/op"
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

op_version=missing
if [ -n "${op_path}" ]; then
  op_version="$("${op_path}" --version 2>/dev/null || echo missing)"
fi
log "ready: bun $(bun --version), node $(node --version 2>/dev/null || echo missing), portless $(portless --version 2>/dev/null || echo missing), op ${op_version}"
