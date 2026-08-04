# @beep/drizzle

Product-neutral Drizzle execution capability for Effect services. The package owns driver-level execution,
transaction boundaries, and technical error normalization.

## Installation

```bash
bun add @beep/drizzle
```

## Service Layer

```ts
import { Drizzle, type DrizzleClient } from "@beep/drizzle"
import { Effect } from "effect"

const client: DrizzleClient = {
  execute: (statement, parameters) =>
    Effect.succeed([
      {
        statement,
        parameters
      }
    ]),
  withTransaction: (use) => use(client)
}

const program = Effect.gen(function* () {
  const drizzle = yield* Drizzle
  const rows = yield* drizzle.execute("select * from documents where id = $1", ["doc_123"])

  return yield* drizzle.withTransaction((transaction) =>
    transaction.execute("select * from documents where id = $1", [rows.length])
  )
})

const runnable = program.pipe(Effect.provide(Drizzle.makeLayer(client)))
```

`DrizzleClient` is intentionally narrow. Runtime adapters can wrap Postgres, SQLite, PGLite, or another
Drizzle-backed boundary as long as they expose `execute` and `withTransaction` through Effects.

## Surface Map

| Export | Role |
| --- | --- |
| `Drizzle` | Product-neutral Effect service for driver execution. |
| `DrizzleError` | Technical driver error with optional query context. |
| `EntityTable` | Generic metadata-only table projection for schema-first entities. |

## Entity Table Projection

`EntityTable.pgTableFrom(entity)` is the generic metadata-only projection from
`@beep/schema/EntitySchema` definitions into typed Drizzle `pgTable` metadata.
It attaches the entity definition and source entity schema to the table so
package-local table proofs can assert the projection without executing a live
database.

`@beep/drizzle` stays product-neutral and driver-level. Concrete product tables
belong in table packages such as `@beep/shared-tables` and
`@beep/workspace-tables`.

## Error Normalization

```ts
import { DrizzleError } from "@beep/drizzle"
import * as O from "effect/Option"

const cause = new Error("Failed query: select * from documents where id = $1\nparams: doc_123,opaque")
const error = DrizzleError.fromUnknown("execute", cause)

const query = O.getOrThrow(error.query)
const params = O.getOrThrow(error.params)

void query
void params
```

`DrizzleError.fromUnknown` preserves explicit query context first, then falls back to native Drizzle
Effect query errors or Drizzle's failed-query message text. Fallback message params are kept as one
opaque diagnostic value so comma-bearing values are not split incorrectly.

## Development

```bash
bun run check
bun run test
bun run docgen
bun run lint
```

`bun run test` runs both unit tests and integration tests. Integration tests live under `test/integration` and
self-skip unless `BEEP_TEST_DATABASE_URL` or `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` is set. Tests
import package source through `@beep/drizzle` or other `@beep/*` aliases. Use relative imports only for local
helpers, fixtures, and snapshots.

## License

MIT
