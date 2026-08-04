# @beep/postgres

Driver-level Postgres runtime, SQLSTATE diagnostics, SQL formatting, and Drizzle Effect composition.

## Installation

```bash
bun add @beep/postgres
```

## Usage

```ts
import { PostgresClient, PostgresError, formatSql, makeDrizzle } from "@beep/postgres"
import { NativePgClient } from "@beep/postgres"

void PostgresClient
void PostgresError
void formatSql
void makeDrizzle
void NativePgClient
```

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

`bun run test` runs both unit tests and integration tests. Integration tests live under `test/integration` and self-skip unless `BEEP_TEST_DATABASE_URL` or `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` is set. Tests import package source through `@beep/postgres` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
