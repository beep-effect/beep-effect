# @beep/occt

Driver-level OpenCascade (replicad/opencascade.js WASM) solid construction and hidden-line projection wrapper.

## Installation

```bash
bun add @beep/occt
```

## Usage

```ts
import { VERSION } from "@beep/occt"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/occt` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
