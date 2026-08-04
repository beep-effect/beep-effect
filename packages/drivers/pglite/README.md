# @beep/pglite

Driver-level PGlite (embedded PostgreSQL) runtime via @effect/sql-pglite.

## Installation

```bash
bun add @beep/pglite
```

## Usage

```ts
import { VERSION } from "@beep/pglite"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/pglite` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
