# @beep/csv

CSV as an Effect Schema codec: any dialect read leniently or strictly into one table model, written back canonically

## Installation

```bash
bun add @beep/csv
```

## Usage

```ts
import * as Package from "@beep/csv"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/csv` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
