# Runs over SSH on the device: authenticates the connected pipe before reading stdin.
param([Parameter(Mandatory)][string]$PipeName)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Core
$rights = [System.IO.Pipes.PipeAccessRights]::Write -bor [System.IO.Pipes.PipeAccessRights]::ReadPermissions
$client = New-Object System.IO.Pipes.NamedPipeClientStream('.', $PipeName, $rights, [System.IO.Pipes.PipeOptions]::None, [Security.Principal.TokenImpersonationLevel]::Identification, [System.IO.HandleInheritability]::None)
try {
  $client.Connect(30000)
  # Read the owner from the connected kernel object, never from the textual name
  # or a separate readiness file. A replacement owned by another user is refused.
  $owner = $client.GetAccessControl().GetOwner([Security.Principal.SecurityIdentifier])
  $expected = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if (-not $expected.Equals($owner)) { throw 'The connected pipe is not owned by the current Windows user.' }
  $in = [Console]::OpenStandardInput()
  $in.CopyTo($client)
  $client.Flush()
  'sent'
} finally { $client.Dispose() }
