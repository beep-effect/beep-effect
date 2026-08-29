# @beep/govinfo

GovInfo driver package

## Installation

```bash
bun add @beep/govinfo
```

## Usage

```ts
import { VERSION } from "@beep/govinfo"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/govinfo` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
