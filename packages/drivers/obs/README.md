# @beep/obs

Driver-level obs-websocket v5 client for OBS Studio recording control.

## Installation

```bash
bun add @beep/obs
```

## Usage

```ts
import { VERSION } from "@beep/obs"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/obs` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
