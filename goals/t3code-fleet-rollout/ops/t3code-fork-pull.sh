#!/usr/bin/env bash
# Fleet host side of the T3 Code fork rollout. Reads the hub's latest.json, and when the
# published version differs from the running service version, installs it through T3's
# own staged updater (`t3 update <version>`), which verifies SHA256SUMS, trials the new
# runtime, rolls back on failure, and restarts the user service.
#
# Host config (never committed): $HOME/.config/t3code-fork/pull.env
#   T3CODE_FORK_MIRROR=https://<hub>.<tailnet>.ts.net:<port>
#   T3CODE_FORK_ALLOW_DOWNGRADE=1   # only for a deliberate rollback
set -euo pipefail

conf=${T3CODE_FORK_PULL_ENV:-$HOME/.config/t3code-fork/pull.env}
[[ -r "$conf" ]] || { echo "missing $conf" >&2; exit 78; }
# shellcheck disable=SC1090
set -a; . "$conf"; set +a
mirror=${T3CODE_FORK_MIRROR:?T3CODE_FORK_MIRROR unset in $conf}
mirror=${mirror%/}
t3_home=${T3CODE_HOME:-$HOME/.t3}
t3_bin=${T3CODE_FORK_T3_BIN:-$HOME/.local/bin/t3}
state="$t3_home/runtime/service-state.json"
stamp="$t3_home/runtime/fork-current"
service_env="$t3_home/service.env"

latest=$(curl -fsS --max-time 20 "$mirror/latest.json")
read -r version fork_commit arch < <(printf '%s' "$latest" | python3 -c '
import json,sys; d=json.load(sys.stdin); print(d["version"], d["forkCommit"], d["arch"])')
[[ "$arch" == linux-x64 && "$(uname -m)" == x86_64 ]] || { echo "published arch $arch does not match this host" >&2; exit 1; }

active=""
[[ -r "$state" ]] && active=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("activeVersion",""))' "$state" 2>/dev/null || true)
if [[ "$active" == "$version" ]]; then
  printf '%s %s\n' "$fork_commit" "$version" > "$stamp"
  echo "current: t3@$version ($fork_commit)"
  exit 0
fi

# Pin the launcher's release source to the mirror too, so a remote "Update server" can
# only ever resolve fork versions. Survives `t3 update` and `t3 service install`.
mkdir -p "$t3_home"
touch "$service_env"; chmod 600 "$service_env"
if grep -q '^T3CODE_RELEASE_BASE_URL=' "$service_env"; then
  sed -i "s|^T3CODE_RELEASE_BASE_URL=.*|T3CODE_RELEASE_BASE_URL=$mirror|" "$service_env"
else
  printf 'T3CODE_RELEASE_BASE_URL=%s\n' "$mirror" >> "$service_env"
fi

echo "updating t3@${active:-none} -> t3@$version ($fork_commit) from $mirror"
downgrade=()
[[ "${T3CODE_FORK_ALLOW_DOWNGRADE:-0}" == 1 ]] && downgrade=(--allow-downgrade)
T3CODE_RELEASE_BASE_URL="$mirror" "$t3_bin" update "$version" --yes "${downgrade[@]}"

# `t3 update` swaps the runtime the launcher runs; the launcher itself (the unit's ExecStart)
# moves only on a local reconcile. Non-interactive; restarts the service once more.
T3CODE_RELEASE_BASE_URL="$mirror" "$t3_bin" service install "${downgrade[@]}"
"$t3_bin" service status
printf '%s %s\n' "$fork_commit" "$version" > "$stamp"
echo "installed t3@$version ($fork_commit)"
