# Runs in the device owner's desktop session (for example a one-shot schtasks /it task): receives the token on a user-only named pipe and stores it DPAPI-protected.
param(
  [Parameter(Mandatory)][string]$PipeName,
  [string]$OutPath = (Join-Path $env:LOCALAPPDATA 'beep\practice-review-hub\api-token.dpapi'),
  [string]$StatusPath = (Join-Path $PSScriptRoot 'status-recv.txt')
)
$ErrorActionPreference = 'Stop'
function Status([string]$line) { Add-Content -Path $StatusPath -Value $line -Encoding ascii }
try {
  Set-Content -Path $StatusPath -Value 'starting' -Encoding ascii
  Add-Type -AssemblyName System.Security
  Add-Type -AssemblyName System.Core
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $sec = New-Object System.IO.Pipes.PipeSecurity
  $sec.SetOwner($sid)
  $sec.AddAccessRule((New-Object System.IO.Pipes.PipeAccessRule($sid, [System.IO.Pipes.PipeAccessRights]::ReadWrite, [System.Security.AccessControl.AccessControlType]::Allow)))
  $server = New-Object System.IO.Pipes.NamedPipeServerStream($PipeName, [System.IO.Pipes.PipeDirection]::In, 1, [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous, 4096, 4096, $sec)
  Status 'listening'
  $wait = $server.BeginWaitForConnection($null, $null)
  if (-not $wait.AsyncWaitHandle.WaitOne(180000)) { Status 'error: no sender within 180s'; exit 5 }
  $server.EndWaitForConnection($wait)
  $ms = New-Object System.IO.MemoryStream
  $server.CopyTo($ms); $server.Dispose()
  $token = [Text.Encoding]::ASCII.GetString($ms.ToArray()).Trim()
  if ($token -notmatch '^[A-Za-z0-9._~+/=-]{32,256}$') { Status 'error: token has the wrong shape'; exit 6 }
  $blob = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::ASCII.GetBytes($token), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $dir = Split-Path -Parent $OutPath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $tmp = "$OutPath.tmp"
  [IO.File]::WriteAllBytes($tmp, $blob)
  Move-Item -Force -Path $tmp -Destination $OutPath
  $sha = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($token))
  $hex = -join ($sha[0..5] | ForEach-Object { $_.ToString('x2') })
  Status ("stored length=" + $token.Length + " sha256=" + $hex)
} catch { Status ('error: ' + $_.Exception.GetType().Name) ; exit 7 }
