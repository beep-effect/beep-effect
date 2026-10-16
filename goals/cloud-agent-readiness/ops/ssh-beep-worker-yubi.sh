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
"$alert" start "$source_name" 'beep-worker SSH is waiting for YubiKey authentication.'
printf -v local_command '%q stop %q >/dev/null 2>&1' "$alert" "$source_name"
if "$admin"; then
  printf -v next_alert '%q start %q %q' "$alert" "$source_name" \
    'beep-worker admin SSH connected; a remote sudo command may request a YubiKey touch.'
  local_command+="; $next_alert"
fi
env SSH_AUTH_SOCK="$agent" ssh -F /dev/null "${forward[@]}" -o PermitLocalCommand=yes -o "LocalCommand=$local_command" -o IdentityAgent="$agent" -o IdentitiesOnly=yes -i "$key" -o UserKnownHostsFile="$HOME/.ssh/known_hosts_beep-worker" -o StrictHostKeyChecking=yes -o HostKeyAlias=192.168.1.8 -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no elpresidank@beep-worker.tailc7c348.ts.net "$@"
