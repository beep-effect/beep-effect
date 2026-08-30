#!/usr/bin/env bash
# Install and enable the user-level Yeet PR dead-owner watcher.
set -euo pipefail

repo_root="${1:-$(git rev-parse --show-toplevel)}"
script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
unit_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
unit_path="${unit_dir}/beep-yeet-pr-lease-watch.service"
mkdir -p "$unit_dir"

temporary="$(mktemp "${unit_dir}/.beep-yeet-watch.XXXXXX")"
escaped_repo_root="${repo_root//\\/\\\\}"
escaped_repo_root="${escaped_repo_root//|/\\|}"
sed -e "s|@WATCH_SCRIPT@|${escaped_repo_root}/scripts/yeet-pr-lease-watch.sh|g" \
  -e "s|@WATCH_ROOTS@|${escaped_repo_root}|g" \
  "${script_root}/systemd/beep-yeet-pr-lease-watch.service" >"$temporary"
mv -f "$temporary" "$unit_path"

systemctl --user daemon-reload
systemctl --user enable --now beep-yeet-pr-lease-watch.service
printf 'setup-yeet-pr-lease-watcher: enabled %s\n' "$unit_path"
