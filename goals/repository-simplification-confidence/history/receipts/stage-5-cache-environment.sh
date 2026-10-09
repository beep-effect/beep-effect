#!/usr/bin/env bash
# Operator-run only: the G lane's resume ruling defers all home configuration writes.
set -euo pipefail
mode=${1:---dry-run}
case "$mode" in --dry-run|--apply) ;; *) printf 'usage: %s [--dry-run|--apply]\n' "$0" >&2; exit 64 ;; esac
target="$HOME/.config/environment.d/90-beep-turbo-cache.conf"
if [[ -L "$target" ]]; then printf 'refusing symlink: %s\n' "$target" >&2; exit 1; fi
desired=$(printf 'TURBO_CACHE_DIR=${TURBO_CACHE_DIR:-%s/.cache/beep/turbo}' "$HOME")
if [[ -f "$target" ]] && [[ "$(cat "$target")" == "$desired" ]]; then
  printf 'already applied: %s\n' "$target"
  exit 0
fi
if [[ -f "$target" ]] && [[ $(awk '!/^[[:space:]]*(#|$)/ && !/^TURBO_CACHE_DIR=/ {n++} END {print n+0}' "$target") != 0 ]]; then
  printf 'refusing to replace unowned fields in %s\n' "$target" >&2; exit 1
fi
printf 'target: %s\nexpected owned field: %s\n' "$target" "$desired"
if [[ "$mode" == --dry-run ]]; then printf 'dry run; no files changed\n'; exit 0; fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$HOME/.config-backups/rsc-g-cache-environment.$stamp"
mkdir -p "$backup" "$(dirname "$target")"
if [[ -f "$target" ]]; then
  cp -p -- "$target" "$backup/90-beep-turbo-cache.conf"
  printf 'rollback: cp -p -- %q %q\n' "$backup/90-beep-turbo-cache.conf" "$target"
else
  printf 'absent\n' > "$backup/original-state"
  printf 'rollback: rm -- %q\n' "$target"
fi
staging=$(mktemp "${target}.XXXXXX")
trap 'rm -f -- "$staging"' EXIT
printf '%s\n' "$desired" > "$staging"
chmod 644 "$staging"
mv -- "$staging" "$target"
[[ "$(cat "$target")" == "$desired" ]]
printf 'owned-field drift check passed; re-login to load the durable manager source\n'
