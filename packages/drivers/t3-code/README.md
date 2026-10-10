# @beep/t3-code

Typed local T3 host session messaging and lifecycle observations.

## Installation

```bash
bun add @beep/t3-code
```

## Usage

```ts
import { VERSION } from "@beep/t3-code"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/t3-code` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
