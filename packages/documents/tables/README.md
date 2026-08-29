# @beep/documents-tables

Documents persistence boundary for DMS sync-state table projections
(`documents_sync_item`, `documents_sync_operation`, `documents_sync_cursor`,
`documents_sync_conflict`).

## Installation

```bash
bun add @beep/documents-tables
```

## Usage

```ts
import { DbSchema } from "@beep/documents-tables/tables"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/documents-tables` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
