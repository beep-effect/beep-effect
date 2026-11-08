# @beep/execution-authority-use-cases

Execution authority slice use cases: the append-only execution ledger port and its typed errors.

## Installation

```bash
bun add @beep/execution-authority-use-cases
```

## Usage

```ts
import * as Package from "@beep/execution-authority-use-cases"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/execution-authority-use-cases` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
