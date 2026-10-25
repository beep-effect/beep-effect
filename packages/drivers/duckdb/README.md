# @beep/duckdb

DuckDB driver for the repo. It has two surfaces:

- `DuckDbClient`: an `effect/sql` `SqlClient` over `@duckdb/node-api`, with a
  Migrator (`DuckDbMigrator`) and a few DuckDB-specific extras. Use it for new
  code. Anything written against the generic `SqlClient` (`SqlSchema`,
  `SqlResolver`, `SqlModel`, `KeyValueStore.layerSql`, the Migrator) runs on it.
- `DuckDb`: the older product-neutral service that returns JSON rows and takes
  named `$param` records. It stays for existing consumers and never provides
  `SqlClient`.

The package owns the technical boundary to DuckDB: connections, statement
compilation, value conversion and error classification. Domain packages own
their schemas, retention rules and projections.

Versions: effect 4.0.6, `@duckdb/node-api` 2.0.0-r.1 (engine 2.0.0).

## DuckDbClient quick start

`layer` provides both `DuckDbClient` and the generic `SqlClient`, and brings its
own `Reactivity`.

```ts
import { DuckDbClient } from "@beep/duckdb"
import * as Effect from "effect/Effect"
import * as SqlClient from "effect/sql/SqlClient"

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE TABLE people (id INTEGER PRIMARY KEY, name VARCHAR)`
  yield* sql`INSERT INTO people ${sql.insert({ id: 1, name: "Ada" })}`
  return yield* sql<{ readonly id: number; readonly name: string }>`SELECT * FROM people`
}).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })))

Effect.runPromise(program).then(console.log) // [{ id: 1, name: "Ada" }]
```

The same module is also available as a subpath:
`import * as DuckDbClient from "@beep/duckdb/DuckDbClient"`.

### Constructors and layers

| Entry point | Provides | Owns the native instance | Owns the connection |
| --- | --- | --- | --- |
| `layer(config)` | `DuckDbClient`, `SqlClient` | yes | yes |
| `layerClient(config)` | `DuckDbClient` only | yes | yes |
| `layerConfig(Config.Wrap<config>)` | `DuckDbClient`, `SqlClient` | yes | yes |
| `layerClientConfig(Config.Wrap<config>)` | `DuckDbClient` only | yes | yes |
| `make(config)` | a scoped client (needs `Scope` and `Reactivity`) | yes | yes |
| `fromInstance({ instance, ... })` | a scoped client over a caller's `DuckDBInstance` | no | yes |
| `fromConnection({ connection, ... })` | a scoped client over a caller's `DuckDBConnection` | no | no |

`layerClient` is for programs whose `SqlClient` is another database (for
example PGlite) and that use DuckDB on the side; `layerClientConfig` is its
`Config`-driven form.

`layerConfig` takes a record of `Config` values or a single `Config`:

```ts
import { DuckDbClient } from "@beep/duckdb"
import * as Config from "effect/Config"

const DuckDbLive = DuckDbClient.layerConfig({
  databasePath: Config.String("DUCKDB_PATH"),
  readOnly: Config.Boolean("DUCKDB_READ_ONLY").pipe(Config.withDefault(false)),
})
```

`Config.schema(DuckDbClientConfigData, "duckdb")` also works as input.

Adopting an instance or a connection you manage yourself:

```ts
import { DuckDbClient } from "@beep/duckdb"
import { DuckDBInstance } from "@duckdb/node-api"
import * as Effect from "effect/Effect"
import * as Reactivity from "effect/reactivity/Reactivity"

const program = Effect.gen(function* () {
  const instance = yield* Effect.promise(() => DuckDBInstance.create(":memory:"))
  const sql = yield* DuckDbClient.fromInstance({ instance })
  return yield* sql<{ readonly n: number }>`SELECT 42 AS n`
}).pipe(Effect.scoped, Effect.provide(Reactivity.layer))
```

`fromInstance` opens and closes its own connection and never closes the
instance. `fromConnection` closes neither. See "Adopted connections" below for
what `fromConnection` does and does not touch.

### Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `databasePath` | required | File path, or `":memory:"` for a private in-memory database |
| `readerConnections` | `0` | Nonnegative integer; eager read-only reader connections for streams outside transactions |
| `readOnly` | `false` | Open with `access_mode=READ_ONLY` |
| `databaseOptions` | `{}` | Native instance options passed through unchanged (`threads`, `memory_limit`, `temp_directory`, ...) |
| `timeZone` | `"UTC"` | Session `TimeZone` set on the client's connection |
| `prepareCacheSize` | `200` | Prepared statements cached per connection; `0` or less turns the cache off |
| `prepareCacheTTL` | 10 minutes | How long a prepared statement stays cached after it was prepared; use does not extend it, and the next use after expiry prepares it again |
| `transformQueryNames` | none | Maps identifiers in compiled SQL |
| `transformResultNames` | none | Maps column names in result rows |
| `spanAttributes` | none | Extra attributes on statement spans (`db.system.name=duckdb` and `db.namespace` are always set) |

The serializable fields are the `DuckDbClientConfigData` schema; the function
and duration fields live only on the `DuckDbClientConfig` type.

### Extras

The client value carries these on top of `SqlClient`:

| Extra | SQL | Inside `withTransaction` |
| --- | --- | --- |
| `exportDatabase({ directory, format? })` | `EXPORT DATABASE`; CSV by default, or Parquet | refused: files survive rollback |
| `importDatabase({ directory })` | `IMPORT DATABASE`; requires an empty target | runs on the transaction connection |
| `appendRows({ table, schema?, rows })` | Native Appender; complete rows in table column order | participates; a failed flush poisons commit |
| `copyTableToParquet({ tableName, filePath })` | `COPY "t" TO 'file' (FORMAT parquet)` | refused: file writes are not rolled back |
| `checkpoint()` / `checkpoint({ force: true })` | `CHECKPOINT` / `FORCE CHECKPOINT` | refused: database-level operation |
| `loadExtension(name)` | `LOAD 'name'` | runs on the transaction connection, not rolled back |
| `installExtension(name)` | `INSTALL 'name'` | runs on the transaction connection |
| `attach(path, alias, { readOnly })` | `ATTACH 'path' AS "alias" [(READ_ONLY)]` | runs on the transaction connection; DuckDB rolls the attach back with the transaction |
| `detach(alias)` | `DETACH "alias"` | runs on the transaction connection |

`exportDatabase` writes a restorable directory with schema and FK-ordered data.
`importDatabase` requires an empty target and restores sequence state. Export
also works from a read-only client. There is no single-file `backup` extra.

On failure or interruption, `appendRows` clears buffered rows before closing the
appender, so cleanup does not commit an earlier row outside a transaction.
`appendRows` normalizes values like statement binds, then uses each table column's
native type. Every row must include every column; use explicit values for defaults.
Append and flush calls are synchronous and can block the event loop. The appender
is always closed, including after interruption or a failed flush.
Extras always use the writer, including when reader connections are enabled.


## DuckDbMigrator

`DuckDbMigrator` re-exports the `effect/sql/Migrator` loaders (`fromRecord`,
`fromGlob`, `fromBabelGlob`, `fromFileSystem`) and `MigrationError`, and binds
`run` and `layer` to the current `SqlClient`. History lives in
`effect_sql_migrations`.

```ts
import { DuckDbClient, DuckDbMigrator } from "@beep/duckdb"
import { NodeServices } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as SqlClient from "effect/sql/SqlClient"

const loader = DuckDbMigrator.fromRecord({
  "1_create": Effect.flatMap(SqlClient.SqlClient, (sql) => sql`CREATE TABLE t (id INTEGER PRIMARY KEY)`),
})

const program = DuckDbMigrator.run({ loader }).pipe(
  Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })),
  Effect.provide(NodeServices.layer)
)

Effect.runPromise(program).then(console.log) // [[1, "create"]]
```

`run` and `layer` read the generic `SqlClient`. Under `layerClient` nothing
provides it, so hand the DuckDB client over explicitly:

```ts
import { DuckDbClient, DuckDbMigrator } from "@beep/duckdb"
import { NodeServices } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as SqlClient from "effect/sql/SqlClient"

declare const loader: DuckDbMigrator.Loader

const migrate = DuckDbMigrator.run({ loader }).pipe(
  Effect.provideServiceEffect(SqlClient.SqlClient, Effect.service(DuckDbClient.DuckDbClient)),
  Effect.provide(DuckDbClient.layerClient({ databasePath: "analytics.duckdb" })),
  Effect.provide(NodeServices.layer)
)
```

At effect 4.0.5 a failing migration is a defect (`MigrationError` through
`Effect.die`), and every migration of that run is rolled back, earlier ones
included.

With `schemaDirectory`, a run that applies migrations writes `_schema.sql` in
process through `FileSystem` and `Path` (provide platform services, such as
`NodeServices.layer`). A run with no pending migrations leaves the file alone.
The dump includes the current database's user enums, sequences, scalar and table
macros, tables and views in one stream sorted by creation OID, followed by indexes
and migration history rows. Scalar and table macro overloads are grouped into
one CREATE statement per catalog macro, preserving every signature and its catalog parameter types.
This order handles eager table-macro binding and
views that call macros; a fixed category order cannot handle both. Custom schemas
are created first; attached databases and temporary/internal objects are excluded.

Limitation: `ALTER` can add a dependency on a newer object without renewing an
older table's OID (for example a DEFAULT using a later sequence). Such dumps can
fail to restore; use export/import for a restorable database artifact in that
case. `CREATE OR REPLACE` renews view and macro OIDs on DuckDB 1.5.6. Macro default
argument expressions are not exposed by the catalog and are not preserved.

## The legacy `DuckDb` service

`DuckDb` (with `DuckDb.makeNodeLayer`, `DuckDb.makeLayer` and the
`DuckDbAdapter` contract) keeps its old API: rows
come back as JSON values decoded by `DuckDbRows` (so `count(*)` is the string
`"0"`), and parameters are positional arrays or named `$param` records passed
straight to DuckDB. Failures are `DuckDbError`, whose `cause` is now the
classified `SqlError` (its `reason.cause` holds the native error).

The interface that used to be called `DuckDbClient` is now `DuckDbAdapter`;
the `DuckDbClient` name belongs to the `effect/sql` module.

The service now shares the client's internals: native calls are serialized and
interruptible, and its `withTransaction` refuses a `COMMIT` after DuckDB has
already aborted the transaction (it rolls back and fails with `DuckDbError`,
operation `withTransaction`). That includes a statement interrupted inside the
transaction whose interruption the body swallowed (`Effect.timeoutOption`,
`Effect.race`): the interrupt aborts DuckDB's transaction. The layer closes
its connection only after a statement still running at teardown settles. A file opened read-write by `DuckDb` and by
`DuckDbClient` in one process shares one native database.

The unscoped `DuckDb.makeNodeClient` is gone (#2087). Use `makeNodeLayer`, or
move to `DuckDbClient`.

## Semantics you should know

### Transactions

- **No savepoints.** DuckDB 2.0 has none. A nested `withTransaction` runs on
  the outer transaction. If the nested block fails and the outer block catches
  that failure, the outer `COMMIT` is refused with an `UnknownError`
  (operation `commitTransaction`) and the whole transaction rolls back. Let the
  nested failure propagate, or restructure the work so no rollback is caught.
- **Safe COMMIT.** After certain failures (constraint, conversion, out of
  range, interrupt, a nested `BEGIN`, a catalog write-write conflict) DuckDB
  aborts the transaction, and a later `COMMIT` would report success while
  discarding every write. When a statement in the transaction failed or was
  interrupted, the client probes before committing. If DuckDB aborted the
  transaction, the commit fails instead. DuckDB 2.0 also aborts on parser errors,
  so a swallowed parser error refuses the commit and rolls back earlier writes.
  The same guard covers raw `COMMIT`/`END` text
  sent inside a transaction you opened with raw `BEGIN`: when it is refused,
  the client runs `ROLLBACK` itself and the `COMMIT` fails with the same
  `UnknownError`. Raw control text is tracked when it is the only statement in
  the text, with or without comments: `/* tx */ BEGIN`, `-- note` then
  `COMMIT`, `END TRANSACTION;`. `BEGIN`/`START`, `COMMIT`/`END`, and
  `ROLLBACK`/`ABORT` accept optional `TRANSACTION` or `WORK`, including bare
  `START`. Text with several statements that includes any of these controls
  or a savepoint (`BEGIN; INSERT ...`, `COMMIT; SELECT 1`,
  `INSERT ...; COMMIT WORK`) fails with an `UnknownError` before anything runs.
  Send each transaction control statement in its own call.
- **Write conflicts** classify as `SerializationError` and are retryable: commit-time
  conflicts and statement-time ones (`Conflict on update!`, `Transaction conflict:`
  after another transaction altered or dropped the table).
- **Concurrent Migrator runs** on one file from two clients are not
  coordinated by a lock: the loser fails with `SerializationError` or dies, never
  with `MigrationError` kind `Locked`.
- **Through `SqlEventLogServerUnencrypted`**, the nested-rollback refusal
  reaches the caller as a defect, not as a typed `SqlError`: its storage
  `withTransaction` runs `catchIf(isSqlError, die)` at effect 4.0.5.

### Time zones

- The client sets `SET TimeZone = 'UTC'` on its own connection (or the value
  of `timeZone`). It skips this when `databaseOptions` already has a
  `TimeZone` key and `timeZone` is absent.
- A `Date` binds as a TIMESTAMPTZ value. Under a non-UTC session zone, a `Date`
  written into a plain TIMESTAMP column stores local wall time, because DuckDB
  casts through the session zone.

### Adopted connections

`fromConnection` leaves the caller's session `TimeZone` alone unless
`timeZone` is given. Cancelling a statement calls the native
`connection.interrupt()`, which is connection-wide, so it can also cancel a
query the caller runs on that connection outside the client.

### Instances, read-only opens and instance-wide state

- File-backed opens go through DuckDB's process-wide instance cache, so every
  client of one file, and the legacy service, share one database. `":memory:"`
  is always private.
- A `readOnly` client shares the cached instance with other read-only opens of
  the file and is refused with `ConnectionError` while this process holds the
  same file read-write. In-process readers of a file you also write should use
  the read-write client.
- Legacy `DuckDb` READ_ONLY opens also use the cache and fail their first
  statement with `DuckDbError` beside an in-process writer. Standalone legacy
  READ_ONLY opens share one cached database. Law-practice projection scans and
  email reads use the build's read-write service; claims reuse the host service
  or open a cached READ_ONLY connection when run standalone.
- The refusal works in both directions. While a `readOnly` client of a file is
  open, a later read-write `DuckDbClient` open of that file fails with
  `ConnectionError` (retryable; the native cause is DuckDB's `Can't open a
  connection to same database file with a different configuration`), and the
  legacy `DuckDb` service fails its first statement with `DuckDbError`
  (`Failed to open DuckDB connection.`). Read-write opens succeed again once
  every read-only client of the file has closed.
- Opening one file twice with different `databaseOptions` fails with
  `ConnectionError` (DuckDB compares the configuration).
- `ATTACH` and `LOAD` act on the database instance. An alias attached by one
  client is visible to every client of that file and outlives the attaching
  client (probed, not covered by a test). `USE` is per connection.

### Single connection and streams

- Each client has one serialized writer. Single statements, transactions,
  `reserve`, extras and streams inside transactions stay on the writer.
  `executeStream` materializes inside a transaction and streams incrementally
  outside one.
- `readerConnections` defaults to `0`, preserving the single-connection
  behaviour. A positive value creates an eager reader pool on the same
  instance, each with its own operation lock and no prepared cache. `make`
  and `fromInstance` support it; `fromConnection` does not.
- With readers enabled, streams outside transactions lease a reader inside
  `BEGIN TRANSACTION READ ONLY` through `ROLLBACK`. Their consumers can run
  one writer statement per row without deadlocking. Readers see a committed
  snapshot; they cannot see uncommitted writer changes. Streamed writes
  (`INSERT … RETURNING`, for example) fail with `AuthorizationError`.
- Readers mirror the writer's resolved current database, search path,
  TimeZone and Calendar, including state retained by failed multi-statement
  text. `DROP SCHEMA` and `DETACH` refresh the snapshot; this does not reset
  the native writer search path. Schema creation/replacement and `ATTACH` also
  refresh it, so recreated schemas and reattached catalogs become usable by
  readers again. The writer snapshot retains the raw path. At each lease, readers omit
  missing schemas against their own committed catalog inside the read-only
  transaction, preserving valid entry order and quoting. Uncommitted writer
  schema drops do not affect reader resolution. After
  `USE memory.s; DROP SCHEMA s`, readers resolve through `main` as the writer
  does, while the writer retains `memory.s`. On DuckDB 1.5.6, a detached catalog
  retained in the path can prevent binding the snapshot query itself; readers
  report that native failure until the writer reattaches the catalog or repairs
  the path (for example, `RESET search_path`). Other raw session settings are not mirrored. Temporary tables and
  temporary macros remain writer-only; reader queries referring to them fail
  with `SqlSyntaxError` (DuckDB Catalog Error). Reader streams containing
  `USE`, `SET`, `RESET`, any `PRAGMA`, or transaction control are refused before execution
  with `AuthorizationError`, so session state cannot leak across leases. All reader `PRAGMA` text is refused
  conservatively because DuckDB also uses it to change session settings.
- With no readers, a consumer that runs one client statement per row outside
  a transaction still deadlocks; collect first or use `withTransaction`.
  Streams on a `reserve`d connection still deadlock with readers enabled.
  Holding the connection prevents native statements from silently truncating
  an active stream at 2048 rows.

### Prepared statements

- Statements with bind values are prepared once per connection and cached
  (`prepareCacheSize`, `prepareCacheTTL`). Bindings are cleared before every
  use, so a short bind fails loudly instead of reusing old values.
- Statements without bind values are not cached. DuckDB plans a parameterless
  prepared statement once, using the table statistics of that moment, so a
  cached constant-filter query prepared on an empty table kept returning no
  rows after later inserts.
- `USE` and `SET`/`RESET schema` or `search_path` clear the connection's cache.
  On DuckDB 1.5.6 this is defensive: a statement with bind values is re-bound
  on every execution and resolves names against the current catalog and schema,
  even when the result columns change (probed). The statement that keeps its
  first catalog binding is a parameterless prepared one, which is not cached.
- SQL with several statements and no bind values runs all of them and returns
  the rows of the first statement (native `duckdb_query` behaviour), except
  `executeStream` outside a transaction, which streams the rows of the last
  statement (native `stream` runs the leading statements first). With bind
  values, the leading statements run unbound and only the last one is bound.
- `executeRaw` reports `changes` from DuckDB's `rowsChanged`, which is `0` for
  any statement that returns rows, including `INSERT/UPDATE/DELETE ...
  RETURNING`; count the returned rows instead.
- Blank SQL returns an empty result without touching DuckDB. Comment-only SQL
  with bind values, or through `executeStream`, fails with
  `Error in native callback` (`UnknownError`).

### Name transforms

Set both `transformQueryNames` and `transformResultNames`, or neither. With only
`transformQueryNames`, `withoutTransforms()` returns the same client and keeps
transforming identifiers, which affects `KeyValueStore.layerSql` and
`SqlEventLogServerUnencrypted`. The result transform is null-safe for LIST,
STRUCT and MAP values. It renames every object key in a row, so it also renames
the driver's value shapes: INTERVAL `months`/`days`/`micros`, MAP entry
`key`/`value`, and UNION `tag`/`value`. A transform that is not the identity
on those keys changes them.

### Reading values (DuckDB to JS)

| DuckDB type | JS value | With `SqlClient.SafeIntegers` |
| --- | --- | --- |
| BOOLEAN | `boolean` | same |
| TINYINT … INTEGER, unsigned up to UINTEGER, FLOAT, DOUBLE | `number` | same |
| BIGINT, UBIGINT, HUGEINT, UHUGEINT, BIGNUM | `number`, rounded silently above 2^53; use SafeIntegers for 64-bit ids | `bigint` |
| DECIMAL with width ≤ 15 | `number` | same |
| DECIMAL with width > 15 | exact `string` | same |
| VARCHAR, JSON, ENUM, UUID | `string` | same |
| BLOB | `Uint8Array` | same |
| BIT | bit `string` (`"101"`) | same |
| DATE, TIMESTAMP (all precisions), TIMESTAMPTZ | `Date` floored to the millisecond, also before 1970; `infinity`/`-infinity` as those strings at every precision; other values outside the JS `Date` range as their `string` form (TIMESTAMPTZ in UTC, `+00`, whatever the process `TZ`) | same |
| TIME, TIMETZ, TIME_NS | `string` (`"12:34:56.123456"`) | same |
| INTERVAL | `{ months, days, micros }` with `micros: number` | `micros: bigint` |
| LIST, ARRAY | array | same |
| STRUCT | object | same |
| MAP | `Array<{ key, value }>` | same |

DECIMAL widening changes the JS type. For a `DECIMAL(10,2)` column `x`, `x`
reads as a `number`, while `sum(x)`, `x * 2` and `x * x` widen past 15 digits
and read as a `string`; `avg(x)` and `x / 3` are DOUBLE and read as a `number`.
Duplicate column names come back as `a`, `a:1`.

### Binding values (JS to DuckDB)

This table describes `DuckDbClient` binds. The legacy `DuckDb` service passes
its parameters straight to `@duckdb/node-api` without bind types, which types a
`listValue` from its first item only, so `listValue([null, 7])` binds there as
a list of NULLs.

| JS value | Bound as |
| --- | --- |
| `null`, `undefined` | NULL |
| `boolean`, `string` | BOOLEAN, VARCHAR (strings cast implicitly into typed columns) |
| `number` | INTEGER, BIGINT or DOUBLE by value |
| `bigint` | HUGEINT (cast down into BIGINT columns; overflow is a conversion error) |
| valid `Date` | TIMESTAMPTZ |
| `Uint8Array`, `Buffer`, `Int8Array` | BLOB |
| a `DuckDB*Value` from `@duckdb/node-api` | as is |
| array | LIST, item type taken from the first element whose type has no NULL in it (`[null, 7]` is `INTEGER[]`); number items widen to the widest number type, INTEGER < BIGINT < DOUBLE (`[1, 2.5]` is `DOUBLE[]`, `[1, 3e9]` is `BIGINT[]`, `[[1], [2.5]]` is `DOUBLE[][]`); an all-null array is a list of NULLs; an empty array is an empty LIST that casts into any LIST column |
| plain object | JSON text (VARCHAR, casts into JSON columns) |

Limits, all failing with `UnknownError`:

- Arrays mixing kinds, such as `[1, "a"]` or `[1, true]`, fail; build a
  `listValue` with typed items. Arrays mixing number kinds widen instead.
- An integral `number` outside the int64 range (`1e20`) fails; bind a string or
  a `decimalValue`.
- An invalid `Date`, a plain object holding a `bigint` or a cycle, and
  anything else (`Map`, `Set`, class instances, symbols, functions) are refused.

Bind DECIMAL values in their unscaled `bigint` form:
`decimalValue(BigInt(12345), 5, 2)` is `123.45`. The `number` overload of
`decimalValue` converts from a double, and binding a value that overflows the
declared width crashes the Bun process.

### Errors

Every failure is a `SqlError` whose `reason` is one of the `effect/sql` reasons.
The reason's `message` names the operation; the native error is in
`reason.cause`.

| DuckDB message | Reason |
| --- | --- |
| `INTERRUPT Error` | `StatementTimeoutError` |
| duplicate key on a primary key or unique constraint | `UniqueViolation` (with `constraint`) |
| other `Constraint Error` (NOT NULL, CHECK, FOREIGN KEY) | `ConstraintError` |
| commit conflict, `Conflict on`, `Transaction conflict`, catalog write-write conflict | `SerializationError` |
| write in a read-only transaction, read-only attach, permission denied | `AuthorizationError` |
| `Could not set lock on file` | `LockTimeoutError` |
| `Connection Error`, closed instance or connection, IO error while connecting | `ConnectionError` |
| `Parser`, `Catalog`, `Binder Error` | `SqlSyntaxError` |
| anything else | `UnknownError` |

## Support matrix (effect 4.0.5)

The client reports the `"sqlite"` dialect, so effect modules pick their SQLite
DDL for it.

| Consumer | DuckDB |
| --- | --- |
| Migrator, SqlSchema (findAll, findOne, findOneOption), SqlResolver, SqlModel insert/findById, KeyValueStore.layerSql, SqlEventLogServerUnencrypted (except a caught nested rollback) | supported, tested |
| SqlModel update with a `GeneratedByDb` id | broken on every driver at 4.0.5 (a Model bug, not DuckDB) |
| SqlEventJournal | unsupported (INT32 `timestamp` overflow); DuckDB-native layer designed in #2084 |
| Persistence (both layers), PersistedQueue, cluster SqlMessageStorage/SqlRunnerStorage, SqlEventLogServerEncrypted | unsupported (`AUTOINCREMENT`, `datetime()`, partial index, INT32 columns); DuckDB-native layers designed in #2084, built when a consumer needs one |
| Nested transaction rollback that the outer body catches | refuses the outer commit (no savepoints in DuckDB 2.0) |
| `backup` | not provided (COPY FROM DATABASE fails on foreign-key order); use `exportDatabase` / `importDatabase` |
| Streams with one writer statement per row outside a transaction | supported with `readerConnections > 0`; streams on `reserve` still deadlock |
| Concurrent Migrator runs on one file (two clients) | not lock-coordinated (probed, not covered by a test): the loser fails with `SerializationError` or dies, never with `MigrationError` kind `Locked` |
| READ_ONLY beside read-write of the same file in one process, in either open order (client and legacy) | later open refused: client `ConnectionError`, legacy first statement `DuckDbError`; share the read-write service |

## Testing

`DuckDbTestLayer` is `DuckDbClient.layer({ databasePath: ":memory:" })`: it
provides the new `DuckDbClient` and the generic `SqlClient`, not the legacy
`DuckDb` service, so do not merge it with a PGlite `SqlClient` layer. Each
build of it is a fresh private database.

```ts
import { DuckDbTestLayer } from "@beep/duckdb"
import * as Effect from "effect/Effect"
import * as SqlClient from "effect/sql/SqlClient"

const program = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`SELECT 1 AS one`).pipe(
  Effect.provide(DuckDbTestLayer)
)
```

## Development

```bash
bun run check
bun run test
bun run lint
```

Design decisions, known hazards, upgrade notes and follow-ups are in
[`AGENTS.md`](./AGENTS.md).
