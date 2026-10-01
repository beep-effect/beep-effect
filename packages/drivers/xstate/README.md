# @beep/xstate

XState v6 and @xstate/effect driver: Stately inspector wiring, machine serialization, and model-based test bridges

## Installation

```bash
bun add @beep/xstate
```

## Usage

```ts
import { VERSION } from "@beep/xstate"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/xstate` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
