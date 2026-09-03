#!/usr/bin/env bash
# Enable read-only Turbo remote cache reads for one checkout.
#
# Writes the four-name quad into <checkout>/.env (git-ignored). The token is
# stored as a 1Password secret *reference* — this script never resolves, reads,
# or prints a secret value, and the reference stays a reference on disk so
# `op run` resolves it at spawn time.
#
# Idempotent by default: an already-present nonblank name is reported and left alone; blank
# placeholders are repaired from the supplied reference-only configuration. Set
# TURBO_TOKEN_REPLACE=1 to replace a nonblank TURBO_TOKEN when it differs from TURBO_TOKEN_REF.
# Duplicate assignments fail before the file is modified because their effective value is
# ambiguous across dotenv consumers.
# See standards/turbo-remote-cache.md.
#
# Usage (from any beep-effect checkout):
#   TURBO_API=https://<id>.execute-api.<region>.amazonaws.com \
#   TURBO_TEAM=<team-slug> \
#   TURBO_TOKEN_REF=op://<vault>/<item>/<field> \
#     bash scripts/enable-turbo-remote-reads.sh
#
#   # Correct or rotate an existing token reference:
#   TURBO_TOKEN_REPLACE=1 \
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
TOKEN_REPLACE="${TURBO_TOKEN_REPLACE:-0}"

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

if [[ ! "${TURBO_TOKEN_REF}" =~ ^op://[^/]+/[^/]+/[^/]+$ ]]; then
  die "TURBO_TOKEN_REF must be a 1Password reference (op://vault/item/field), never a token value"
fi

case "${TOKEN_REPLACE}" in
  0 | 1) ;;
  *) die "TURBO_TOKEN_REPLACE must be 0 or 1" ;;
esac

if [[ ! -f "${ENV_FILE}" ]]; then
  log "creating ${ENV_FILE}"
  : >"${ENV_FILE}"
fi

assert_unique_name() {
  local name="$1" count
  count="$(grep -Ec "^[[:space:]]*${name}=" "${ENV_FILE}" || true)"
  (( count <= 1 )) || die "duplicate ${name} assignments in .env; refusing to modify it"
}

for name in TURBO_API TURBO_TOKEN TURBO_TEAM TURBO_CACHE; do
  assert_unique_name "${name}"
done

describe_token_state() {
  local value="$1" reference_path vault item_path item
  case "${value}" in
    op://*)
      reference_path="${value#op://}"
      vault="${reference_path%%/*}"
      item_path="${reference_path#*/}"
      item="${item_path%%/*}"
      printf 'reference %s/%s' "${vault}" "${item}"
      ;;
    *) printf 'raw value (not shown)' ;;
  esac
}

# The workstation posture is read-only by contract: no agent checkout ever
# holds the trusted write token, and remote writes stay with the main-push CI
# jobs. The CLI refuses any other posture, so do not hand-edit this value.
ensure_name() {
  local name="$1" value="$2" printable="$3" current temporary
  if grep -Eq "^[[:space:]]*${name}=" "${ENV_FILE}"; then
    current="$(sed -n -E "s/^[[:space:]]*${name}=[[:space:]]*(.*)[[:space:]]*$/\\1/p" "${ENV_FILE}" | head -n 1)"
    current="${current#\"}"
    current="${current%\"}"
    current="${current#\'}"
    current="${current%\'}"
    if [[ -n "${current//[[:space:]]/}" ]]; then
      if [[ "${name}" == "TURBO_TOKEN" && "${TOKEN_REPLACE}" == "1" && "${current}" != "${value}" ]]; then
        temporary="$(mktemp "${ENV_FILE}.XXXXXX")"
        awk -v name="$name" -v replacement="${name}=${value}" '
          BEGIN { pattern = "^[[:space:]]*" name "[[:space:]]*=" }
          $0 ~ pattern { if (!replaced) print replacement; replaced = 1; next }
          { print }
        ' "${ENV_FILE}" >"${temporary}"
        mv -f "${temporary}" "${ENV_FILE}"
        log "replaced TURBO_TOKEN (prior: $(describe_token_state "${current}")) with <1Password reference>"
        return 0
      fi
      log "${name} already present in .env — leaving it unchanged"
      return 0
    fi
    temporary="$(mktemp "${ENV_FILE}.XXXXXX")"
    awk -v name="$name" -v replacement="${name}=${value}" '
      BEGIN { pattern = "^[[:space:]]*" name "[[:space:]]*=" }
      $0 ~ pattern { if (!replaced) print replacement; replaced = 1; next }
      { print }
    ' "${ENV_FILE}" >"${temporary}"
    mv -f "${temporary}" "${ENV_FILE}"
    log "repaired blank ${name}=${printable}"
    return 0
  fi
  printf '%s=%s\n' "${name}" "${value}" >>"${ENV_FILE}"
  log "wrote ${name}=${printable}"
}

if ! grep -q 'Turbo remote cache' "${ENV_FILE}"; then
  printf '\n# Turbo remote cache (read-only; standards/turbo-remote-cache.md)\n' >>"${ENV_FILE}"
fi

ensure_name TURBO_API "${TURBO_API}" "${TURBO_API}"
ensure_name TURBO_TOKEN "${TURBO_TOKEN_REF}" "<1Password reference>"
ensure_name TURBO_TEAM "${TURBO_TEAM}" "${TURBO_TEAM}"
ensure_name TURBO_CACHE "${CACHE_MODE}" "${CACHE_MODE}"

log "done. Verify without executing a lane:"
log "  cd ${REPO_ROOT} && bun run check --filter=@beep/types --dry=json"
log "and confirm the logged turbo command carries --cache=${CACHE_MODE}."
