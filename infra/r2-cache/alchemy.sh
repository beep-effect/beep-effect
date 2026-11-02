#!/usr/bin/env bash
# Provisioning runs on the owner workstation, not on cache consumers.
set -euo pipefail
set +x
umask 077
revision=95f15813480deb39f922d6590f223bc1a5eeb5a1
distilled=b659514328c8001c39ac22667da2d331b980310b
tool="${XDG_CACHE_HOME:-$HOME/.cache}/beep/alchemy-r2-pilot-95f1581"
reference="${BEEP_REFERENCES_ROOT:-$HOME/YeeBois/references/effect}/alchemy"
state="${XDG_STATE_HOME:-$HOME/.local/state}/beep/r2-cache/alchemy"
source_dir="$(cd "$(dirname "$0")" && pwd)"
operation="${1:-plan}"
case "$operation" in
  plan|deploy|destroy)
    action="$operation"; config=alchemy.run.ts; stage=r2-pilot
    template=alchemy.run.ts.template
    ;;
  plan-signed-credentials|deploy-signed-credentials|destroy-signed-credentials)
    action="${operation%-signed-credentials}"; config=alchemy.signed-credentials.ts
    stage=r2-signed-credentials; template=alchemy.signed-credentials.ts.template
    ;;
  *) echo 'Usage: alchemy.sh plan|deploy|destroy|plan-signed-credentials|deploy-signed-credentials|destroy-signed-credentials' >&2; exit 2 ;;
esac
confirmation=()
if [[ $# -gt 1 ]]; then
  [[ $# -eq 2 && "$2" == --yes && "$action" == deploy ]] || { echo '--yes is accepted only for an explicitly reviewed deploy.' >&2; exit 2; }
  confirmation=(--yes)
fi
if [[ ! -d "$tool/.git" ]]; then
  git clone --no-hardlinks --no-checkout "$reference" "$tool"
  git -C "$tool" checkout --detach "$revision"
fi
[[ "$(git -C "$tool" rev-parse HEAD)" == "$revision" ]] || { echo 'Alchemy source pin mismatch' >&2; exit 1; }
[[ "$(git -C "$tool" rev-parse HEAD:submodules/distilled)" == "$distilled" ]] || exit 1
if [[ ! -e "$tool/submodules/distilled/.git" ]]; then git -C "$tool" submodule update --init submodules/distilled; fi
if [[ ! -d "$tool/node_modules" ]]; then
  (cd "$tool" && pnpm install --filter alchemy... --filter @alchemy.run/cloudflare... --ignore-scripts --frozen-lockfile)
fi
mkdir -p "$(dirname "$state")" "$tool/pilot"
if [[ -d "$tool/.alchemy" && ! -L "$tool/.alchemy" ]]; then
  [[ ! -e "$state" ]] || { echo 'Two Alchemy state roots exist; reconcile them before provisioning.' >&2; exit 1; }
  cp -a "$tool/.alchemy" "$state"
  mv "$tool/.alchemy" "$tool/.alchemy.before-durable-state"
fi
mkdir -p "$state"
# Token resources persist Redacted outputs here; prevent traversal by other local users.
chmod 0700 "$state"
if [[ -L "$tool/.alchemy" ]]; then
  [[ "$(readlink -f "$tool/.alchemy")" == "$state" ]] || { echo 'Unexpected Alchemy state owner' >&2; exit 1; }
else
  ln -s "$state" "$tool/.alchemy"
fi
cp "$source_dir/$template" "$tool/pilot/$config"
archive="$(mktemp --suffix=.tar.gz "$(dirname "$state")/state-before-${operation}-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
(cd "$(dirname "$state")" && tar -czf "$archive" alchemy)
cd "$tool"
args=("$action" --config "./pilot/$config" --stage "$stage")
[[ "$action" == plan ]] && args+=(--detailed)
# Default to interactive approval; unattended deploys require explicit --yes after plan review.
# Destruction retains interactive approval and never accepts --yes through this wrapper.
exec bun run alchemy "${args[@]}" "${confirmation[@]}"
