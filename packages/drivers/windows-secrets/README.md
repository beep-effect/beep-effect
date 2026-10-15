# @beep/windows-secrets

Windows Credential Manager and DPAPI secret storage for the practice gateway

## Installation

```bash
bun add @beep/windows-secrets
```

## Usage

```ts
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import { SecretTarget, WindowsSecretStore } from "@beep/windows-secrets"

const target = SecretTarget.make("beep/m365/refresh-token")

const program = Effect.gen(function* () {
  const store = yield* WindowsSecretStore
  yield* store.set(target, Redacted.make("token"))
  return yield* store.get(target) // Option<Redacted<string>>
})
```

- `WindowsSecretStore.layerWindows`: Credential Manager (values up to 2,560
  UTF-16LE bytes) and DPAPI `protect`/`unprotect` through `bun:ffi`. Fails
  with `SecretStoreUnsupported` off Windows; native bindings load only after
  that check.
- `WindowsSecretStore.layerMemory`: in-memory test double; `protect` is an
  identity copy.

## Windows smoke

`scripts/smoke.ts` exercises the live layer end to end (write, read,
overwrite, size cap, delete, DPAPI round trip) on a throwaway target and
prints `PASS`/`FAIL` per step without printing secret values. On Windows,
from the repository root:

```bash
bun run packages/drivers/windows-secrets/scripts/smoke.ts
```

Or build a standalone binary on any host and copy it to the VM:

```bash
bun build --compile --target=bun-windows-x64 \
  packages/drivers/windows-secrets/scripts/smoke.ts --outfile windows-secrets-smoke.exe
```

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/windows-secrets` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
