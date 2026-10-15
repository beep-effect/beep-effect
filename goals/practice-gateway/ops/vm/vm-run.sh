#!/usr/bin/env bash
# Run a command in the proof VM.
#   vm-run.sh ssh '<powershell>'              over the harness SSH (network logon)
#   vm-run.sh interactive '<cmd.exe command>'  in the lawyer's interactive logon
#                                             session via a one-shot scheduled task
#   vm-run.sh copy <local-file> <C:/remote/path>
# Credential Manager only works in an interactive logon session (an SSH key
# logon gets Win32 error 1312), so anything touching stored credentials must
# use the interactive mode, as the gateway does when Claude Desktop runs it.
set -euo pipefail
STATE="${VM_STATE:-$HOME/VMs/practice-gateway}"
PORT="${SSH_PORT:-2222}"
OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null
  -o IdentitiesOnly=yes -o IdentityAgent=none -o LogLevel=ERROR -i "$STATE/state/harness_ed25519")
MODE="${1:?usage: vm-run.sh ssh|interactive|copy ...}"
shift
case "$MODE" in
  ssh) ssh "${OPTS[@]}" -p "$PORT" lawyer@127.0.0.1 "$1" ;;
  copy) scp "${OPTS[@]}" -P "$PORT" "$1" "lawyer@127.0.0.1:$2" ;;
  interactive)
    CMD="$1" WAIT="${WAIT_SECONDS:-30}"
    ssh "${OPTS[@]}" -p "$PORT" lawyer@127.0.0.1 "
\$log = 'C:\\Users\\lawyer\\vm-run.log'; Remove-Item \$log -ErrorAction SilentlyContinue
\$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c ' + '$CMD' + ' > ' + \$log + ' 2>&1')
\$principal = New-ScheduledTaskPrincipal -UserId 'lawyer' -LogonType Interactive
Register-ScheduledTask -TaskName 'beep-vm-run' -Action \$action -Principal \$principal -Force | Out-Null
Start-ScheduledTask -TaskName 'beep-vm-run'
\$deadline = (Get-Date).AddSeconds($WAIT)
while ((Get-ScheduledTask -TaskName 'beep-vm-run').State -eq 'Running' -and (Get-Date) -lt \$deadline) { Start-Sleep -Milliseconds 500 }
Start-Sleep -Seconds 1
Get-Content \$log -ErrorAction SilentlyContinue
\$result = (Get-ScheduledTaskInfo -TaskName 'beep-vm-run').LastTaskResult
Unregister-ScheduledTask -TaskName 'beep-vm-run' -Confirm:\$false
exit \$result"
    ;;
  *) echo "unknown mode $MODE" >&2; exit 1 ;;
esac
