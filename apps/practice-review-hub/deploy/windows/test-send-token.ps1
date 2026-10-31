# Windows PowerShell 5.1 integration checks. Only synthetic bytes enter these pipes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Core
$sender = Join-Path $PSScriptRoot 'send-token.ps1'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$user = $identity.User
$otherOwner = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
if ($user.Equals($otherOwner)) { throw 'The test needs a distinct current-user SID.' }

function New-TestPipe([string]$name, [Security.Principal.SecurityIdentifier]$owner) {
  $security = New-Object System.IO.Pipes.PipeSecurity
  $security.SetOwner($owner)
  $security.AddAccessRule((New-Object System.IO.Pipes.PipeAccessRule($user, [System.IO.Pipes.PipeAccessRights]::FullControl, [Security.AccessControl.AccessControlType]::Allow)))
  return New-Object System.IO.Pipes.NamedPipeServerStream($name, [System.IO.Pipes.PipeDirection]::In, 1, [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous, 4096, 4096, $security)
}

foreach ($scenario in @('same-user', 'wrong-owner', 'expired-replaced')) {
  $pipeName = 'beep-hub-test-' + [guid]::NewGuid().ToString('N')
  if ($scenario -eq 'expired-replaced') {
    $expired = New-TestPipe $pipeName $user
    $expired.Dispose()
  }
  $owner = if ($scenario -eq 'same-user') { $user } else { $otherOwner }
  # The administrator group is a different kernel owner SID. The elevated
  # disposable runner can create this object without provisioning another user.
  $server = New-TestPipe $pipeName $owner
  $process = New-Object Diagnostics.Process
  try {
    $wait = $server.BeginWaitForConnection($null, $null)
    $process.StartInfo.FileName = (Join-Path $PSHOME 'powershell.exe')
    $process.StartInfo.Arguments = '-NoProfile -NonInteractive -File "' + $sender + '" -PipeName ' + $pipeName
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    if (-not $process.Start()) { throw 'Could not start the test sender.' }
    $dummy = 'synthetic-pipe-regression-bytes'
    $process.StandardInput.Write($dummy)
    $process.StandardInput.Close()
    if (-not $wait.AsyncWaitHandle.WaitOne(10000)) { throw 'Sender did not connect.' }
    $server.EndWaitForConnection($wait)
    $read = New-Object System.IO.StreamReader($server)
    $received = $read.ReadToEnd()
    if (-not $process.WaitForExit(10000)) { throw 'Sender did not exit.' }
    if ($scenario -eq 'same-user') {
      if ($process.ExitCode -ne 0 -or $received -ne $dummy) { throw 'Same-user transfer failed.' }
    } else {
      if ($process.ExitCode -eq 0 -or $received.Length -ne 0) { throw 'A foreign-owned pipe received bytes.' }
    }
    Write-Output "$scenario passed"
  } finally {
    if ($process.Id -and -not $process.HasExited) { $process.Kill() }
    $process.Dispose()
    $server.Dispose()
  }
}
