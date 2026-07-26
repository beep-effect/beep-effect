#!/usr/bin/bash
# Read-only witness probe. Captures every observable a mutation would move, so a
# before/after pair proves "no mutation occurred" for the negative lanes.
#   $1 = label
set -uo pipefail
UNIT_NAME="openclaw-spike.service"
UNIT_PATH="${HOME}/.config/systemd/user/${UNIT_NAME}"
WANTS="${HOME}/.config/systemd/user/default.target.wants/${UNIT_NAME}"

printf '### WITNESS %s (%s)\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'unit_file_exists=%s\n' "$([ -e "$UNIT_PATH" ] && echo yes || echo no)"
printf 'wants_symlink_exists=%s\n' "$([ -e "$WANTS" ] && echo yes || echo no)"
out="$(systemctl --user list-unit-files "$UNIT_NAME" 2>&1)"; rc=$?
printf 'list-unit-files rc=%s out=%s\n' "$rc" "$(printf '%s' "$out" | tr '\n' '/')"
printf 'UnitsLoadTimestampMonotonic=%s\n' \
  "$(systemctl --user show --property=UnitsLoadTimestampMonotonic --value)"
printf 'LoadState=%s ActiveState=%s UnitFileState=%s\n' \
  "$(systemctl --user show "$UNIT_NAME" --property=LoadState --value)" \
  "$(systemctl --user show "$UNIT_NAME" --property=ActiveState --value)" \
  "$(systemctl --user show "$UNIT_NAME" --property=UnitFileState --value)"
printf 'Linger=%s\n' "$(loginctl show-user "$(id -un)" --property=Linger --value)"
