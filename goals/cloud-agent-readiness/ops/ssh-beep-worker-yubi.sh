#!/bin/bash
set -euo pipefail
agent="$HOME/.ssh/agent-dankserver.sock"
key="$HOME/.ssh/id_ed25519_sk_dankserver"
forward=(-a)
admin=false
if [[ ${1:-} == --admin ]]; then forward=(-A); admin=true; shift; fi
[[ -S "$agent" ]] || { echo 'Dedicated YubiKey agent is unavailable; initialize it with ssh-dankserver-yubi.' >&2; exit 78; }
alert="$HOME/.local/bin/yubikey-touch-alert"
source_name="ssh-beep-worker-${BASHPID}"
cleanup() { "$alert" stop "$source_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM
# A multiplexed command uses an authenticated channel and cannot need a new touch.
# Fail closed if that channel disappears after the check; never silently start auth.
quiet_connection=false
query_connection=false
reuse_options=()
query_arguments=("$@")
while (( ${#query_arguments[@]} )); do
  case "${query_arguments[0]}" in
    -G|-O|-Q|-V) quiet_connection=true; query_connection=true; break ;;
    -o|-S|-p|-i|-F|-l|-J|-L|-R|-D|-W|-w|-E|-e|-b|-B|-c|-m) query_arguments=("${query_arguments[@]:2}") ;;
    --) break ;;
    -*) query_arguments=("${query_arguments[@]:1}") ;;
    *) break ;;
  esac
done
control_path="$(ssh -G -F /dev/null "elpresidank@beep-worker.tailc7c348.ts.net" "$@" 2>/dev/null | awk '$1 == "controlpath" { sub(/^[^ ]+ /, ""); print; exit }' || true)"
if [[ -n "$control_path" && "$control_path" != none ]] &&
  ssh -F /dev/null -S "$control_path" -O check "elpresidank@beep-worker.tailc7c348.ts.net" >/dev/null 2>&1; then
  quiet_connection=true
  reuse_options=(-S "$control_path" -o ControlMaster=no -o ProxyCommand=false)
fi
if ! "$quiet_connection"; then
  "$alert" start "$source_name" 'beep-worker SSH is waiting for YubiKey authentication.'
elif "$admin" && ! "$query_connection"; then
  # OpenSSH's normal multiplex client exits without running LocalCommand.
  "$alert" start "$source_name" 'beep-worker admin SSH reused; a remote sudo command may request a YubiKey touch.'
fi
printf -v local_command '%q stop %q >/dev/null 2>&1' "$alert" "$source_name"
if "$admin"; then
  printf -v next_alert '%q start %q %q' "$alert" "$source_name" \
    'beep-worker admin SSH connected; a remote sudo command may request a YubiKey touch.'
  local_command+="; $next_alert"
fi
env SSH_AUTH_SOCK="$agent" ssh "${reuse_options[@]}" -F /dev/null "${forward[@]}" -o PermitLocalCommand=yes -o "LocalCommand=$local_command" -o IdentityAgent="$agent" -o IdentitiesOnly=yes -i "$key" -o UserKnownHostsFile="$HOME/.ssh/known_hosts_beep-worker" -o StrictHostKeyChecking=yes -o HostKeyAlias=192.168.1.8 -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no elpresidank@beep-worker.tailc7c348.ts.net "$@"
