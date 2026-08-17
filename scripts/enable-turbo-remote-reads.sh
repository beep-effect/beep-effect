#!/usr/bin/env bash
# Enable read-only Turbo remote cache reads for one checkout.
#
# Writes the four-name quad into <checkout>/.env (git-ignored). The token is
# stored as a 1Password secret *reference* — this script never resolves, reads,
# or prints a secret value, and the reference stays a reference on disk so
# `op run` resolves it at spawn time.
#
# Idempotent: an already-present name is reported and left alone.
# See standards/turbo-remote-cache.md.
#
# Usage (from any beep-effect checkout):
#   TURBO_API=https://<id>.execute-api.<region>.amazonaws.com \
#   TURBO_TEAM=<team-slug> \
#   TURBO_TOKEN_REF=op://<vault>/<item>/<field> \
#     bash scripts/enable-turbo-remote-reads.sh
#
#   # or target another checkout explicitly:
#   ... bash scripts/enable-turbo-remote-reads.sh /path/to/checkout

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${REPO_ROOT}/.env"
CACHE_MODE="local:rw,remote:r"

log() { printf 'enable-turbo-remote-reads: %s\n' "$*"; }
die() { printf 'enable-turbo-remote-reads: ERROR: %s\n' "$*" >&2; exit 1; }

[[ -d "${REPO_ROOT}" ]] || die "not a directory: ${REPO_ROOT}"
[[ -f "${REPO_ROOT}/turbo.json" ]] || die "not a beep-effect checkout: ${REPO_ROOT}"

: "${TURBO_API:?set TURBO_API to the cache endpoint (gh variable list, or the CiTurboCache stack output)}"
: "${TURBO_TEAM:?set TURBO_TEAM to the cache team slug (gh variable list)}"
: "${TURBO_TOKEN_REF:?set TURBO_TOKEN_REF to the 1Password reference for the READ-ONLY cache token}"

case "${TURBO_API}" in
  https://*) ;;
  *) die "TURBO_API must be an https:// endpoint" ;;
esac

case "${TURBO_TOKEN_REF}" in
  op://*) ;;
  *) die "TURBO_TOKEN_REF must be a 1Password reference (op://vault/item/field), never a token value" ;;
esac

if [[ ! -f "${ENV_FILE}" ]]; then
  log "creating ${ENV_FILE}"
  : >"${ENV_FILE}"
fi

# The workstation posture is read-only by contract: no agent checkout ever
# holds the trusted write token, and remote writes stay with the main-push CI
# jobs. The CLI refuses any other posture, so do not hand-edit this value.
append_name() {
  local name="$1" value="$2" printable="$3"
  if grep -Eq "^[[:space:]]*${name}=" "${ENV_FILE}"; then
    log "${name} already present in .env — leaving it unchanged"
    return 0
  fi
  printf '%s=%s\n' "${name}" "${value}" >>"${ENV_FILE}"
  log "wrote ${name}=${printable}"
}

if ! grep -q 'Turbo remote cache' "${ENV_FILE}"; then
  printf '\n# Turbo remote cache (read-only; standards/turbo-remote-cache.md)\n' >>"${ENV_FILE}"
fi

append_name TURBO_API "${TURBO_API}" "${TURBO_API}"
append_name TURBO_TOKEN "${TURBO_TOKEN_REF}" "<1Password reference>"
append_name TURBO_TEAM "${TURBO_TEAM}" "${TURBO_TEAM}"
append_name TURBO_CACHE "${CACHE_MODE}" "${CACHE_MODE}"

log "done. Verify without executing a lane:"
log "  cd ${REPO_ROOT} && bun run beep quality check --filter=@beep/types --dry=json"
log "and confirm the logged turbo command carries --cache=${CACHE_MODE}."
