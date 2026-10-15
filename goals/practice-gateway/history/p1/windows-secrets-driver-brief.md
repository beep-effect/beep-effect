# Brief — `@beep/windows-secrets` driver

Unit of P1 for `goals/practice-gateway` (SPEC decision: Credential Manager for
small secrets, DPAPI-protected files for blobs, via `bun:ffi`).

## Package

- Create with `bun run beep create-package windows-secrets --family drivers
  --type library --description "Windows Credential Manager and DPAPI secret
  storage for the practice gateway"` (never `mkdir`).
- Effect v4, schema first, `Context.Service` contract before implementation,
  `Effect.fn`/`Effect.fnUntraced` for generator functions, JSDoc per
  `.patterns/jsdoc-documentation.md`, `effect/HashMap` etc. never `Map`/`Set`.

## Contract

Schemas (`WindowsSecrets.models.ts`):

- `SecretTarget`: branded string, `beep/<provider>/<key>` (lowercase
  kebab segments), the Credential Manager target name.
- Secret values are `Redacted<string>` (`effect/Redacted`); never logged.

Errors (`WindowsSecrets.errors.ts`), tagged:

- `SecretStoreFailure { operation: "read" | "write" | "delete" | "protect" |
  "unprotect", code: number (GetLastError), reason }`.
- `SecretTooLarge { target, bytes, limit: 2560 }` — Credential Manager blob
  cap; callers store large values as DPAPI-protected files instead.
- `SecretStoreUnsupported { platform }` — non-Windows host with the live
  layer.

Service (`WindowsSecrets.service.ts`), `WindowsSecretStore`:

- `get(target): Effect<Option<Redacted<string>>, SecretStoreFailure>`
  (missing credential → `Option.none`, not an error: ERROR_NOT_FOUND 1168).
- `set(target, value): Effect<void, SecretStoreFailure | SecretTooLarge>`
  (UTF-16LE blob, `CRED_TYPE_GENERIC`, `CRED_PERSIST_LOCAL_MACHINE`).
- `remove(target): Effect<void, SecretStoreFailure>` (missing → success).
- `protect(bytes: Uint8Array): Effect<Uint8Array, SecretStoreFailure>` and
  `unprotect(...)`: DPAPI `CryptProtectData`/`CryptUnprotectData`, current
  user scope, `CRYPTPROTECT_UI_FORBIDDEN`.

Layers:

- `WindowsSecretStore.layerWindows`: `bun:ffi` `dlopen` of `advapi32.dll`
  (`CredWriteW`, `CredReadW`, `CredDeleteW`, `CredFree`), `crypt32.dll`
  (`CryptProtectData`, `CryptUnprotectData`), `kernel32.dll` (`LocalFree`,
  `GetLastError`). Fails with `SecretStoreUnsupported` off Windows. Struct
  layouts (CREDENTIALW, DATA_BLOB) written explicitly for x64 with offsets
  documented in comments.
- `WindowsSecretStore.layerMemory`: in-memory implementation over
  `effect/MutableHashMap` with an identity "protect" transform marked as a
  test double, used by tests and non-Windows development.

## Tests

- Unit tests run on Linux against `layerMemory`: get-missing is none,
  set/get round-trip, remove idempotent, `SecretTooLarge` at 2,561 bytes,
  target schema accepts/rejects.
- A Windows-only smoke entry (`src/bin/smoke.ts` or a test guarded by
  `process.platform === "win32"`) that exercises `layerWindows` end to end;
  the orchestrator runs it in the clean Windows VM.

## Done when

- `bun run beep quality package-verify @beep/windows-secrets` passes.
- No secret value ever reaches a log, error message or exception text.
