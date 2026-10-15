# First-logon harness instrumentation for the practice-gateway proof VM.
# Test hook only: a real lawyer machine has none of this. It lets the host
# copy builds in and run probes over SSH with a dedicated harness key.
$ErrorActionPreference = 'Stop'
Start-Transcript -Path C:\harness-setup.log -Append
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
Set-Service sshd -StartupType Automatic
Start-Service sshd
if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Protocol TCP -LocalPort 22 -Action Allow -Direction Inbound | Out-Null
}
# The capability's own rule covers only Private networks; the VM NIC is Public.
Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Profile Any
$keys = 'C:\ProgramData\ssh\administrators_authorized_keys'
Set-Content -Path $keys -Value '@@SSH_PUBKEY@@' -Encoding ascii
icacls $keys /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell -Value 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -PropertyType String -Force | Out-Null
Set-Content -Path C:\harness-ready.txt -Value (Get-Date -Format o)
Stop-Transcript
