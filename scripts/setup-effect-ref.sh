#!/usr/bin/env bash
# Provision the manifest-defined Effect reference workspace and its gitignored
# member/workspace links. Existing reference checkouts are never modified.
#
# Idempotent. Safe to re-run on a fresh machine, clone, or worktree.
#
# Usage (from any beep-effect checkout):
#   bash scripts/setup-effect-ref.sh
#   # or:
#   bash scripts/setup-effect-ref.sh /path/to/checkout

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

log() { printf 'setup-effect-ref: %s\n' "$*"; }
warn() { printf 'setup-effect-ref: WARN: %s\n' "$*" >&2; }
die() { printf 'setup-effect-ref: ERROR: %s\n' "$*" >&2; exit 1; }

# Resolve an absolute path even when its final components do not exist. The
# existing prefix is resolved physically; the missing suffix is normalized
# without relying on GNU realpath extensions.
resolve_existing_parent_path() (
  target_path="$1"
  unresolved_suffix=""

  case "${target_path}" in
    /*) ;;
    *) target_path="${PWD}/${target_path}" ;;
  esac

  while [ ! -d "${target_path}" ]; do
    path_component="${target_path##*/}"
    unresolved_suffix="/${path_component}${unresolved_suffix}"
    parent_path="${target_path%/*}"
    [ "${parent_path}" != "${target_path}" ] || return 1
    [ -n "${parent_path}" ] || parent_path="/"
    target_path="${parent_path}"
  done

  resolved_path="$(cd -P "${target_path}" && pwd -P)" || return 1
  IFS=/
  set -f
  set -- ${unresolved_suffix}

  for path_component do
    case "${path_component}" in
      ""|.) ;;
      ..)
        if [ "${resolved_path}" != "/" ]; then
          resolved_path="${resolved_path%/*}"
          [ -n "${resolved_path}" ] || resolved_path="/"
        fi
        ;;
      *)
        if [ "${resolved_path}" = "/" ]; then
          resolved_path="/${path_component}"
        else
          resolved_path="${resolved_path}/${path_component}"
        fi
        ;;
    esac
  done

  printf '%s\n' "${resolved_path}"
)

# Parse before making any changes. Command substitution preserves node failures;
# a process substitution would hide them from set -e.
command -v node >/dev/null 2>&1 || die "node is required to read scripts/references.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_ROWS="$(node -e '
  const manifest = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  const rows = [manifest.rootDefault, manifest.workspaceLink,
    ...manifest.members.flatMap(({ name, url }) => [name, url])];
  if (rows.some(value => typeof value !== "string" || !value || /[\r\n]/.test(value))) {
    throw new Error("reference manifest fields must be nonempty single-line strings");
  }
  process.stdout.write(rows.join("\n"));
' < "${SCRIPT_DIR}/references.json")" || die "cannot read reference manifest"

link_reference() {
  local link_name="$1" reference_path="$2"
  local link_path="${REPO_ROOT}/${link_name}"
  if [[ -L "${link_path}" ]]; then
    if [[ "$(readlink "${link_path}")" != "${reference_path}" ]]; then
      log "relinking ${link_name} -> ${reference_path}"
      ln -sfn "${reference_path}" "${link_path}"
    else
      log "${link_name} already linked to ${reference_path}"
    fi
  elif [[ -e "${link_path}" ]]; then
    warn "${link_name} exists and is not a symlink; remove it and re-run to link the shared checkout"
  else
    log "linking ${link_name} -> ${reference_path}"
    ln -s "${reference_path}" "${link_path}"
  fi
}

{
  IFS= read -r ROOT_DEFAULT
  IFS= read -r WORKSPACE_LINK
  # Expand only the literal $HOME prefix, never arbitrary shell expressions.
  case "${ROOT_DEFAULT}" in
    '$HOME'/*) ROOT_DEFAULT="${HOME}/${ROOT_DEFAULT#'$HOME/'}" ;;
  esac
  REFERENCES_ROOT="${BEEP_REFERENCES_ROOT:-${ROOT_DEFAULT}}"
  REFERENCES_ROOT="$(resolve_existing_parent_path "${REFERENCES_ROOT}")" || die "cannot resolve BEEP_REFERENCES_ROOT '${REFERENCES_ROOT}' to an absolute path"
  mkdir -p "${REPO_ROOT}/.repos"
  while IFS= read -r MEMBER_NAME && IFS= read -r MEMBER_URL; do
    MEMBER_ROOT="${REFERENCES_ROOT}/${MEMBER_NAME}"
    # -e not -d: linked worktrees have a .git file.
    if [[ ! -e "${MEMBER_ROOT}/.git" ]]; then
      log "cloning ${MEMBER_NAME} reference into ${MEMBER_ROOT}"
      mkdir -p "${REFERENCES_ROOT}"
      git clone --quiet "${MEMBER_URL}" "${MEMBER_ROOT}"
      # graft writes graft/, .graft/ and .ignore into the clone; exclude them per clone (R3).
      mkdir -p "${MEMBER_ROOT}/.git/info"
      printf 'graft/\n.graft/\n.ignore\n' >> "${MEMBER_ROOT}/.git/info/exclude"
    fi
    link_reference ".repos/${MEMBER_NAME}" "${MEMBER_ROOT}"
  done
  link_reference "${WORKSPACE_LINK}" "${REFERENCES_ROOT}"
} <<< "${MANIFEST_ROWS}"

log "done."
