#!/usr/bin/env bash
# Provision the machine-local Effect reference checkout and link it into this
# checkout as .repos/effect (gitignored). Agents validate Effect v4 APIs against
# real source through this link, never training-data priors (AGENTS.md §Tool
# Routing).
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

# --- Effect reference checkout (machine-local, shared across clones/worktrees) ---
# .repos/effect is gitignored; agents read real Effect v4 source through this link.
EFFECT_REF="${BEEP_EFFECT_CHECKOUT:-${HOME}/YeeBois/dev/effect}"
# Canonicalize the path: a relative override would be resolved against $PWD by
# git clone but against .repos/ by the symlink, silently naming two different
# locations.
EFFECT_REF="$(resolve_existing_parent_path "${EFFECT_REF}")" || die "cannot resolve BEEP_EFFECT_CHECKOUT '${BEEP_EFFECT_CHECKOUT:-}' to an absolute path"
EFFECT_LINK="${REPO_ROOT}/.repos/effect"
# -e not -d: a linked git worktree's .git entry is a file, and that is a valid checkout.
if [[ ! -e "${EFFECT_REF}/.git" ]]; then
  log "cloning Effect reference into ${EFFECT_REF}"
  mkdir -p "$(dirname "${EFFECT_REF}")"
  git clone --quiet https://github.com/Effect-TS/effect.git "${EFFECT_REF}"
fi
mkdir -p "${REPO_ROOT}/.repos"
if [[ -L "${EFFECT_LINK}" ]]; then
  if [[ "$(readlink "${EFFECT_LINK}")" != "${EFFECT_REF}" ]]; then
    log "relinking .repos/effect -> ${EFFECT_REF}"
    ln -sfn "${EFFECT_REF}" "${EFFECT_LINK}"
  else
    log ".repos/effect already linked to ${EFFECT_REF}"
  fi
elif [[ -e "${EFFECT_LINK}" ]]; then
  warn ".repos/effect exists and is not a symlink; remove it and re-run to link the shared checkout"
else
  log "linking .repos/effect -> ${EFFECT_REF}"
  ln -s "${EFFECT_REF}" "${EFFECT_LINK}"
fi

log "done."
