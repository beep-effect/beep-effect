#!/usr/bin/env bash
# One-step onboarding proof around the operator's only manual part (signing in
# to Claude inside the VM and clicking Claude's own dialogs).
#
#   onboarding-proof.sh prepare <practice-setup.exe> [snapshot]
#       revert to a snapshot (default clean), boot, wait for the harness, put
#       the exe on the lawyer's desktop, start a 15 s screenshot recorder.
#       `claude-signed-in` (saved with `snapshot.sh save claude-signed-in`
#       after a sign-in, extension not yet installed) skips the operator's
#       sign-in; it holds a live Claude session, so keep it local only.
#   onboarding-proof.sh verify <evidence.md>
#       collect evidence: setup run record, Claude extension registry entry
#       (id/version only), whether a Claude account is signed in (key presence
#       only, never values), and the installed gateway's --self-check
#   onboarding-proof.sh finish
#       stop the recorder, shut down, and revert to clean so no real sign-in
#       state stays in the VM image
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME="${VM_NAME:-practice-gateway-win11}"
STATE="${VM_STATE:-$HOME/VMs/practice-gateway}"
CONN="qemu:///session"
RUN="$HERE/vm-run.sh"
EXT_ID="local.mcpb.beep-effect-contributors.beep-practice-gateway"
v() { virsh -c "$CONN" "$@"; }

wait_for_harness() {
  for _ in $(seq 1 60); do
    "$RUN" ssh 'Test-Path C:\harness-ready.txt' 2>/dev/null | grep -q True && return 0
    sleep 10
  done
  echo "harness SSH did not come up" >&2
  return 1
}

case "${1:?usage: onboarding-proof.sh prepare <exe> | verify <evidence.md> | finish}" in
  prepare)
    EXE="${2:?prepare needs the path to practice-setup.exe}"
    FROM="${3:-clean}"
    [[ "$(v domstate "$NAME")" == "shut off" ]] || { v destroy "$NAME" >/dev/null; sleep 3; }
    "$HERE/snapshot.sh" revert "$FROM"
    v start "$NAME" >/dev/null
    wait_for_harness
    "$RUN" copy "$EXE" 'C:/Users/lawyer/Desktop/practice-setup.exe'
    SHOTS="$STATE/shots/onboarding-proof-$(date +%Y%m%d-%H%M)"
    mkdir -p "$SHOTS"
    echo "$SHOTS" >"$STATE/shots/current-proof-dir"
    nohup bash -c "while true; do f=\"$SHOTS/\$(date +%H%M%S)\"; virsh -c $CONN screenshot $NAME \"\$f.ppm\" >/dev/null 2>&1 && magick \"\$f.ppm\" -resize 60% \"\$f.png\" && rm -f \"\$f.ppm\"; sleep 15; done" \
      >/dev/null 2>&1 &
    echo $! >"$STATE/shots/recorder.pid"
    echo "Ready. Open the VM:  setsid remote-viewer \$(virsh -c $CONN domdisplay $NAME) >/dev/null 2>&1 &"
    echo "Then double-click practice-setup on the desktop and follow its console."
    ;;
  verify)
    OUT="${2:?verify needs an evidence file path}"
    {
      echo "# Onboarding proof evidence ($(date -u +%Y-%m-%dT%H:%MZ))"
      echo
      echo "## practice-setup run record"
      echo '```json'
      "$RUN" ssh 'Get-Content $env:LOCALAPPDATA\beep\practice-setup\last-run.json -Raw -ErrorAction SilentlyContinue'
      echo '```'
      echo
      echo "## Claude extension registry entry"
      echo '```'
      "$RUN" ssh "\$r = Get-Content \"\$env:APPDATA\\Claude\\extensions-installations.json\" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json; \$e = \$r.extensions.'$EXT_ID'; if (\$e) { 'id=' + \$e.id; 'version=' + \$e.version } else { 'not installed' }"
      echo '```'
      echo
      echo "## Claude account signed in (key presence only)"
      "$RUN" ssh '$c = Get-Content "$env:APPDATA\Claude\config.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json; [bool]($c.PSObject.Properties.Name -contains "lastKnownAccountUuid")'
      echo
      echo "## Installed gateway --self-check (interactive session)"
      echo '```json'
      WAIT_SECONDS=60 "$RUN" interactive "set NODE_PATH=%APPDATA%\\Claude\\Claude Extensions\\$EXT_ID\\node_modules&& \"%APPDATA%\\Claude\\Claude Extensions\\$EXT_ID\\practice-gateway.exe\" --self-check" || true
      echo '```'
      echo
      echo "Screenshots: \`$(cat "$STATE/shots/current-proof-dir")\` (not in the repo)."
    } >"$OUT"
    echo "wrote $OUT"
    ;;
  finish)
    [[ -f "$STATE/shots/recorder.pid" ]] && kill "$(cat "$STATE/shots/recorder.pid")" 2>/dev/null || true
    rm -f "$STATE/shots/recorder.pid"
    "$RUN" ssh 'Stop-Computer -Force' >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do [[ "$(v domstate "$NAME")" == "shut off" ]] && break; sleep 4; done
    [[ "$(v domstate "$NAME")" == "shut off" ]] || v destroy "$NAME" >/dev/null
    "$HERE/snapshot.sh" revert clean
    echo "VM reverted to clean; no sign-in state remains."
    ;;
  *) echo "unknown action $1" >&2; exit 1 ;;
esac
