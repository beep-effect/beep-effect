# @beep/m365

Microsoft Graph v1.0 driver (delegated auth-code+PKCE, read-only verbs)

## Installation

```bash
bun add @beep/m365
```

## Usage

```ts
import { VERSION } from "@beep/m365"
```

## Token Cache Persistence

The live auth layer uses the in-memory MSAL token cache by default. Supplying
`tokenCachePath` opts into encrypted persistence through
`@azure/msal-node-extensions`, which is an optional dependency because it pulls
native keychain support (`keytar` / libsecret on Linux). Headless CI and
non-desktop hosts should omit `tokenCachePath` or inject an externally minted
token with `M365Auth.layerStatic`.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/m365` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
