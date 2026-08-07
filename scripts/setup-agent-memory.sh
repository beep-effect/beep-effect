#!/usr/bin/env bash
# Provision machine-local state required by the basic-memory + codegraph MCP
# servers registered in repository .mcp.json / enabledMcpjsonServers.
#
# Idempotent. Safe to re-run on a fresh machine, clone, or worktree.
# See standards/memory-architecture/07-shared-memory-adoption.md §Bootstrap.
#
# Usage (from any beep-effect checkout):
#   bash scripts/setup-agent-memory.sh
#   # or:
#   bash scripts/setup-agent-memory.sh /path/to/checkout

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
STORE_DIR="${BEEP_SHARED_STORE:-${HOME}/YeeBois/memory/beep-shared}"
BASIC_MEMORY_PKG="${BASIC_MEMORY_PKG:-basic-memory@0.22.1}"

log() { printf 'setup-agent-memory: %s\n' "$*"; }
warn() { printf 'setup-agent-memory: WARN: %s\n' "$*" >&2; }
die() { printf 'setup-agent-memory: ERROR: %s\n' "$*" >&2; exit 1; }

command -v uvx >/dev/null 2>&1 || die "uvx not on PATH (install uv: https://docs.astral.sh/uv/)"
command -v codegraph >/dev/null 2>&1 || die "codegraph not on PATH (install: npm i -g codegraph@1.5.0 or equivalent)"

# --- basic-memory project (machine-local store, shared across clones) ---
if [[ ! -d "${STORE_DIR}" ]]; then
  log "creating store at ${STORE_DIR}"
  mkdir -p "${STORE_DIR}"/{decisions,code-facts,episodes,profiles}
  if [[ ! -f "${STORE_DIR}/README.md" ]]; then
    cat >"${STORE_DIR}/README.md" <<'EOF'
# beep-shared — cross-agent memory store

Provisional README created by scripts/setup-agent-memory.sh.
Replace with the conventions README from an existing beep-shared checkout
(or copy from standards/memory-architecture/07-shared-memory-adoption.md
§Store conventions) before writing production notes.
EOF
  fi
  if [[ ! -d "${STORE_DIR}/.git" ]]; then
    git -C "${STORE_DIR}" init -q
    git -C "${STORE_DIR}" add .
    git -C "${STORE_DIR}" -c user.email="agent@local" -c user.name="setup-agent-memory" \
      commit -q -m "init beep-shared: conventions and folder structure" || true
  fi
else
  log "store already present at ${STORE_DIR}"
fi

if uvx "${BASIC_MEMORY_PKG}" project list 2>/dev/null | grep -q 'beep-shared'; then
  log "basic-memory project beep-shared already registered"
else
  log "registering basic-memory project beep-shared -> ${STORE_DIR}"
  uvx "${BASIC_MEMORY_PKG}" project add beep-shared "${STORE_DIR}"
fi

# --- codegraph index (per-checkout; .codegraph/ is gitignored) ---
if [[ ! -d "${REPO_ROOT}/.codegraph" ]]; then
  log "running codegraph init in ${REPO_ROOT}"
  (
    cd "${REPO_ROOT}"
    DO_NOT_TRACK=1 CODEGRAPH_NO_UPDATE_CHECK=1 codegraph init
    DO_NOT_TRACK=1 CODEGRAPH_NO_UPDATE_CHECK=1 codegraph telemetry off || true
  )
else
  log "codegraph index already present at ${REPO_ROOT}/.codegraph"
fi

# --- health probes (non-fatal) ---
if uvx "${BASIC_MEMORY_PKG}" doctor >/dev/null 2>&1; then
  log "basic-memory doctor: clean"
else
  warn "basic-memory doctor reported issues (run: uvx ${BASIC_MEMORY_PKG} doctor)"
fi

log "done. Restart the coding agent so MCP servers reattach."
log "If tools are still unavailable, fall back to repo-local docs (AGENTS.md)."
