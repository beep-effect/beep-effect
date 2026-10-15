# Evidence — `@beep/windows-secrets` on Windows (2026-10-14)

- **VM:** clean-VM harness (`ops/vm/create-vm.sh`), Windows 11 Enterprise
  Evaluation, `Microsoft Windows NT 10.0.26300.0`, from
  `win11-enterprise-eval-26h2-en-us.iso` (8,225,329,152 bytes, SHA-256
  `bc3f24086ebadc94489066b5ad78089e2cf5c3491e90e790bb81a2b199c10e38`, Microsoft
  Evaluation Center en-US direct link).
- **Binary:** `bun build --compile --target=bun-windows-x64
  packages/drivers/windows-secrets/scripts/smoke.ts` (bun-windows-x64 v1.4.2),
  driver commit `e54e00091a`.

## Run 1 — over harness SSH (network logon)

DPAPI steps passed; every Credential Manager call failed with Win32 error
1312 (`ERROR_NO_SUCH_LOGON_SESSION`). A key-authenticated SSH logon has no
credential vault. Not a driver defect.

## Run 2 — interactive logon session (`ops/vm/vm-run.sh interactive`)

```
PASS get before set is none
PASS set then get round-trips
PASS set overwrites
PASS value at the cap is accepted
PASS value past the cap fails with SecretTooLarge
PASS remove deletes the credential
PASS remove of a missing credential succeeds
PASS DPAPI protect changes the bytes and unprotect restores them
PASS DPAPI round-trips empty input
PASS windows-secrets smoke
```

"get before set is none" and "remove of a missing credential succeeds" pass,
so `ERROR_NOT_FOUND` (1168) reaches the driver intact through `bun:ffi`; the
GetLastError-clobbering risk did not materialize.

## Consequence

Credential Manager is usable only in the user's interactive logon session.
The gateway runs there (launched by Claude Desktop), so this holds in
production; the doctor gains an `interactive-session` probe, and every VM
proof that touches credentials uses the interactive runner.
