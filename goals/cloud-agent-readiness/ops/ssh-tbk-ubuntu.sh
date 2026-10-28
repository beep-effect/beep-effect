#!/bin/bash
# tbk-ubuntu: YubiKey SSH; --admin also forwards the dedicated agent for sudo.
set -euo pipefail
agent="$HOME/.ssh/agent-dankserver.sock"
key="$HOME/.ssh/id_ed25519_sk_dankserver"
forward=(-a)
admin=false
if [[ ${1:-} == --admin ]]; then forward=(-A); admin=true; shift; fi
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  printf '%s\n' 'Usage: ssh-tbk-ubuntu [--admin] [remote command ...]' \
    'Default: YubiKey login with no agent forwarding.' \
    '--admin: forward the dedicated YubiKey agent for remote touch-to-sudo.'
  exit 0
fi
[[ -f "$key" && -f "$key.pub" ]] || { echo 'The workstation YubiKey handle is missing.' >&2; exit 78; }
# Share the established dedicated agent; never stop another authentication owner.
umask 077
exec 9>"$HOME/.ssh/agent-dankserver.init.lock"
flock -w 5 9 || { echo 'Dedicated agent initialization is busy; try again after it finishes.' >&2; exit 75; }
agent_status=0
env SSH_AUTH_SOCK="$agent" ssh-add -l >/dev/null 2>&1 || agent_status=$?
if (( agent_status == 2 )); then
  if [[ -e "$agent" || -L "$agent" ]]; then
    [[ -S "$agent" && -O "$agent" && ! -L "$agent" ]] || { echo 'Unexpected dedicated agent socket ownership or type.' >&2; exit 78; }
    rm -- "$agent"
  fi
  eval "$(ssh-agent -a "$agent" -s 9>&-)" >/dev/null
  printf '%s\n' "$SSH_AGENT_PID" > "$HOME/.ssh/agent-dankserver.pid"
elif (( agent_status > 2 )); then
  echo 'Could not inspect the dedicated YubiKey agent.' >&2
  exit 78
fi
if ! env SSH_AUTH_SOCK="$agent" ssh-add -l -E sha256 2>/dev/null | grep -Fq 'SHA256:bVUwE95rPZDRHE6byIIJdOkfc90OHj1dFC1sc1Rz1HA'; then
  # Fail before ssh-add could request sensitive text through the terminal.
  ssh-keygen -y -P '' -f "$key" >/dev/null 2>&1 || {
    echo 'The key handle needs secure unlocking; use the Plasma sensitive-entry process.' >&2
    exit 78
  }
  env SSH_AUTH_SOCK="$agent" SSH_ASKPASS_REQUIRE=never ssh-add -q "$key" </dev/null
fi
flock -u 9
exec 9>&-
alert="$HOME/.local/bin/yubikey-touch-alert"
source_name="ssh-tbk-ubuntu-${BASHPID}"
cleanup() { "$alert" stop "$source_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM
# A multiplexed command uses an authenticated channel and cannot need a new touch.
# Fail closed if that channel disappears after the check; never silently start auth.
quiet_connection=false
reuse_options=()
query_arguments=("$@")
while (( ${#query_arguments[@]} )); do
  case "${query_arguments[0]}" in
    -G|-O|-Q|-V) quiet_connection=true; break ;;
    -o|-S|-p|-i|-F|-l|-J|-L|-R|-D|-W|-w|-E|-e|-b|-B|-c|-m) query_arguments=("${query_arguments[@]:2}") ;;
    --) break ;;
    -*) query_arguments=("${query_arguments[@]:1}") ;;
    *) break ;;
  esac
done
control_path="$(ssh -G -F /dev/null "tbkventures@100.64.127.50" "$@" 2>/dev/null | awk '$1 == "controlpath" { sub(/^[^ ]+ /, ""); print; exit }' || true)"
if [[ -n "$control_path" && "$control_path" != none ]] &&
  ssh -F /dev/null -S "$control_path" -O check "tbkventures@100.64.127.50" >/dev/null 2>&1; then
  quiet_connection=true
  reuse_options=(-S "$control_path" -o ControlMaster=no -o ProxyCommand=false)
fi
if ! "$quiet_connection"; then "$alert" start "$source_name" 'tbk-ubuntu SSH is waiting for a YubiKey touch.'; fi
printf -v local_command '%q stop %q >/dev/null 2>&1' "$alert" "$source_name"
if "$admin"; then
  printf -v next_alert '%q start %q %q' "$alert" "$source_name" \
    'tbk-ubuntu admin SSH connected; a remote sudo command may request a YubiKey touch.'
  local_command+="; $next_alert"
fi
env SSH_AUTH_SOCK="$agent" ssh "${reuse_options[@]}" -F /dev/null "${forward[@]}" \
  -o PermitLocalCommand=yes -o "LocalCommand=$local_command" \
  -o IdentityAgent="$agent" -o IdentitiesOnly=yes -i "$key" \
  -o StrictHostKeyChecking=yes -o HostKeyAlias=tbk-ubuntu \
  -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no \
  tbkventures@100.64.127.50 "$@"
