# @beep/phoenix

Phoenix API driver package

## Installation

```bash
bun add @beep/phoenix
```

## Usage

```ts
import { VERSION } from "@beep/phoenix"
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
bun run lint
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/phoenix` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
