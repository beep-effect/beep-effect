# Agent Guide

`@beep/duckdb` is the driver-level DuckDB runtime over `@duckdb/node-api`. Its
main surface is `DuckDbClient`, an `effect/sql` `SqlClient` that reports the
`"sqlite"` dialect, plus `DuckDbMigrator` (the shared `effect/sql/Migrator`
bound to that client) and the in-memory `DuckDbTestLayer`. The legacy `DuckDb`
service (JSON rows, named `$param` records, `DuckDbAdapter` contract) stays for
existing consumers, runs on the same internals, and never provides
`SqlClient`.

It owns technical DuckDB failures (`SqlError` reasons for the client,
`DuckDbError` for the legacy service), connection and instance lifecycle,
statement compilation and value conversion. It does not own product schemas,
retention rules or projections.

Layout: public modules in `src/*.ts`; everything else in `src/internal/`
(`classify`, `convert`, `parameters`, `compiler`, `native`, `gate`,
`transaction`, `connection`, `extras`), which is not exported
(`"./internal/*": null`). An internal module exports only what another `src/`
module imports (D42): fallow dead-code is a blocking lane with a zero baseline.

User-facing semantics, the bind/read tables and the consumer support matrix
are in `README.md`. Keep the two files in step.

## Design decisions

D1 to D12 come from the gap-map critique; D13 to D43 from the implementation
SPEC; D44 to D59 record what implementation changed or learned. D60 onward are
designs settled by `/grill-with-docs` for open issues: each names its issue
and describes code that does not exist until that issue closes.

| id | decision | reason | reversal |
| --- | --- | --- | --- |
| D1 | `dialect: "sqlite"` with a DuckDB `makeCompiler` (`?` placeholders, `defaultEscape('"')`, Postgres-style `onRecordUpdate`, empty `onCustom`) | `Dialect` is a closed union at 4.0.5 with no `"duckdb"`; `"pg"` breaks the Migrator (`to_regclass`, `LOCK TABLE`); the sqlite branch of every tested consumer works on DuckDB, and pg-style `updateValues` works with `?` | swap the compiler module |
| D2 | Savepoints emulated inside the connection with the stock `withTransaction`: `SAVEPOINT effect_sql_n` is a no-op, `ROLLBACK TO SAVEPOINT effect_sql_n` marks the transaction rollback-only | DuckDB 1.5.6 rejects every savepoint statement with a Parser Error; routing through the connection avoids a hand-copied `makeWithTransaction` and survives HEAD's signature change | override `makeWithTransaction` |
| D3 | Safe COMMIT: refuse after a nested rollback, or when the abort probe fails after any in-transaction failure | after constraint, conversion, out-of-range or interrupt errors DuckDB aborts the transaction, and COMMIT then reports success while writing nothing | drop the probe and accept DuckDB's behaviour |
| D4 | Error reasons from DuckDB message prefixes (table in `README.md` and `src/internal/classify.ts`); raw native error kept in `reason.cause` | grounded in observed messages; `makeSqliteAcquirers`' `isNoTransactionError` reads `reason.cause.message` | change the table in `classify.ts` |
| D5 | SafeIntegers-aware converter; DECIMAL width ≤ 15 → `number`, wider → exact `string`; TIME and BIT → string; BLOB → plain `Uint8Array`; 64-bit and wider integers → `number` without SafeIntegers (rounded above 2^53, documented and pinned by a test) | DECIMAL never silently lossy, fixed per column type; Bun returns `Buffer` for BLOB and BIT; the integer rounding is the SPEC's sqlite-node-style default (node:sqlite itself throws `ERR_OUT_OF_RANGE`), kept so a column's JS type never depends on its value | change the converter, or fail out-of-range integers like node:sqlite |
| D6 | `Date` binds as `timestampTZValue`; UTC by default (the "instance option" half is replaced by D13) | the only `Date` encoding correct for both TIMESTAMP and TIMESTAMPTZ columns under UTC that still types as a timestamp in untyped contexts | config knob |
| D7 | Instance policy: read-write files → `DuckDBInstance.fromCache`; `:memory:` → own instance; READ_ONLY as amended by D35 | one process-wide database per file; two RW instances of one file in one process lose writes | policy function in `native.ts` |
| D8 | `executeStream` materializes inside a transaction and streams incrementally outside one | a per-row statement on the transaction connection silently truncates a native stream at 2048 rows | flag |
| D9 | One serialized writer (`makeSqliteAcquirers`), plus optional read-only readers for streams (D60–D62, #2083) | keeps writes and transactions on one session while allowing stream consumers to issue writer statements | set `readerConnections: 0` |
| D10 | Legacy `DuckDb` keeps its API, runs on the shared internals, never provides `SqlClient` | existing consumers (ai-metrics, law-practice, labs) depend on JSON rows and `$param` records; providing `SqlClient` would shadow PGlite in mixed layers | keep the old implementation |
| D11 | Persistence, PersistedQueue, cluster storages and the encrypted event log are declared unsupported at 4.0.5 (documented, not guarded) | their sqlite DDL uses `AUTOINCREMENT`, `datetime()`, partial indexes and INT32 columns DuckDB rejects or overflows (per-consumer failures probed in #2084) | DuckDB-native storages, designed in D63–D65 (#2084) |
| D12 | Private package: no changeset; consumers migrate in the same PR | repo convention for private packages | n/a |
| D13 | TimeZone is a session `SET TimeZone` on the client's connection (default `UTC`), never an instance option | instance options are part of the cached configuration: `{}` vs `{TimeZone:"UTC"}` on one file fails with `Connection Error` and would break sharing with legacy opens | instance option for `:memory:` only |
| D14 | `db.namespace` = `current_database()` name; `config.databasePath` for adopters = attached path or `:memory:` | OTel semconv names the database; the query is exact for every constructor | use the path |
| D15 | Per-connection op lock plus a settle-aware interrupt canceller around every native call | `interrupt()` is connection-wide and a late interrupt hits the next statement; a shared prepared statement races | none (correctness) |
| D16 | Prepared cache = `ScopedCache` per connection (200 entries, 10 minutes); `get`, `invalidateAll` and the cache-scope close run only under the op lock; entry finalizers `destroySync` directly; the lookup is settle-aware and destroys a late result; multi-statement and no-statement SQL cached as `RunDirect` (scope narrowed by D44) | ScopedCache joins every eviction close before the evicting call returns; an abandoned lookup used to release the lock early and leak the statement | `prepareCacheSize: 0` |
| D17 | `exportDatabase` / `importDatabase` use EXPORT / IMPORT DATABASE; CSV or Parquet, import into an empty target; export refuses inside transactions (implemented #2082). No `backup` extra | `ATTACH` + `COPY FROM DATABASE` fails on foreign-key order (`Constraint Error: Violates foreign key constraint`) and leaves the attached target file behind with no tables; `EXPORT DATABASE` writes FK-ordered `schema.sql`/`load.sql` and `IMPORT DATABASE` restores rows and sequence state (probed, #2082) | topologically ordered per-table copy |
| D18 | Extras in a transaction: parquet export and checkpoint refuse; LOAD, INSTALL, ATTACH, DETACH run on the transaction connection | filesystem and database-level effects are not transactional; ATTACH is | change per extra |
| D19 | No class statics on the `DuckDbClient` tag | the namespace export already gives `DuckDbClient.make/layer/...` | add statics |
| D20 | Config = `typeof DuckDbClientConfigData.Encoded & { runtime and function fields }` | unbranded, accepts plain literals, works with the `Config.Wrap` record form and `Config.schema` | — |
| D21 | Reason `message` = human operation message; native text stays in `reason.cause` | upstream convention; `isNoTransactionError` needs the raw cause | put native text in `message` |
| D22 | Refused commit = `UnknownError` (`commitTransaction`), cause = original failure or the nested marker | not retryable: the caller swallowed an error | reuse the original reason |
| D23 | The commit effect refuses without issuing ROLLBACK; `onCommitFailure` rolls back | one rollback path, upstream poisoning semantics | roll back inside commit |
| D24 | File-backed tests live in `test/DuckDb.service.test.ts` | any other file would add an EV010 effect-vitest row (S31) | new file plus an accepted row |
| D25 | Legacy `DuckDb.makeNodeClient` deleted (#2087); `makeNodeLayer` is the managed constructor | it was unscoped and never closed its shared connection, and nothing in the repo called it | restore `makeNodeClient` from `src/DuckDb.service.ts` at `61dcdbad9d` |
| D26 | Legacy `DuckDbError.cause` = classified `SqlError` | classifier reuse; still an `Error` with the native error one level down | keep the raw error |
| D27 | `threads`, `memory_limit`, `temp_directory` stay in `databaseOptions`; no default temp directory | minimal typed surface; a default needs a path policy the driver does not own | typed fields later |
| D28 | `appendRows` uses the native Appender under the writer op lock, with complete rows normalized by the bind converter and typed by `columnType`; flush failures and interruption feed the D3 tracker; exit-aware cleanup clears buffered rows on failure/interruption before closing, closes even a late appender and preserves the first error (#2081) | a failed flush aborts a transaction, whose COMMIT would otherwise silently discard earlier writes; closing without clearing would commit earlier buffered rows under autocommit; native append/flush calls are synchronous | remove the extra |
| D29 | An empty array binds as an empty LIST typed `LIST(SQLNULL)` through `bindTypes` (R2-DF-1); it casts into `INTEGER[]`, `VARCHAR[]` and nested LIST columns, and `SELECT ?` reads it as `INTEGER[]` | the untyped native bind refuses an empty `listValue` ("Cannot create lists with item type of ANY") but accepts it with the explicit `LIST(SQLNULL)` type the driver already passes | reject empty arrays |
| D30 | DuckDB `infinity`/`-infinity` read as those strings at every DATE/TIMESTAMP precision (sentinels checked before conversion); other values outside the JS `Date` range read as `String(value)`, TIMESTAMPTZ rendered in UTC (`+00`) instead of the upstream module-load host offset (R2-DF-3); in-range values are floored to the millisecond | the JS reader throws on out-of-range values and would fail the whole query; DATE and TIMESTAMP_S/MS `toString` print the sentinels as huge finite dates and ±infinity TIMESTAMP_NS fits the `Date` range; the upstream reader truncates toward zero and moved pre-epoch instants forward | `Date(NaN)` |
| D31 | INTERVAL `micros` follows SafeIntegers | consistency with integer columns | keep `bigint` |
| D32 | Blank SQL returns the empty result without a native call | `run("")` is a native no-op while `prepare("")` and `extractStatements("")` fail | fail |
| D33 | B1 (rename plus legacy instance policy) between A1 and A2; B2 (re-base) after A2 | barrel name collision; the legacy test fakes constrain the re-base; the instance policy must not be droppable | — |
| D34 | `makeSqliteAcquirers` without `isTransaction` (the option exists at 4.0.5) | its only use is the cleanup ROLLBACK after a failed commit or poisoning; an unconditional ROLLBACK plus the raw-cause `no transaction is active` check cannot drift from DuckDB's real state | pass `(conn) => conn.isTransaction()` |
| D35 | Client and legacy file opens, READ_ONLY included, go through `fromCache` (#2086); `:memory:` stays private | a private RO instance beside RW reads wrong blocks after a checkpoint and drops the process file lock on close; law-practice projection steps share one RW connection and claims lookups reuse the contextual RW service or a cached RO connection when standalone | restore private RO instances only after proving block and lock safety |
| D36 | Result-name transform = local null-safe `makeRowTransform`, not `Statement.defaultTransforms(...).array` | upstream throws on LIST values with a leading `NULL` and on `null` elements in arrays of objects | upstream helper once fixed |
| D37 | `clearBindings()` before every bind of a cached statement | stale bindings survive a short or empty bind | — (correctness) |
| D38 | `USE` and `SET`/`RESET schema\|search_path` invalidate the connection's prepared cache | defensive on DuckDB 1.5.6: a statement with binds is re-bound per execution against the current catalog and schema, result-shape changes included (probed); only parameterless prepared statements keep their first binding, and D44 keeps those out of the cache. The clear keeps that true if a DuckDB release stops re-binding; test in `test/DuckDbClient.test.ts` | drop the invalidation |
| D39 | Internal runtime state (`TransactionPhase`, `CommitDecision`, `CachedStatement`, `ResolvedInstance`) uses `Data.*`, not schema unions | payloads hold `SqlError` instances and native handles, never wire data | schema unions |
| D40 | `attachExtras` uses `Reflect.ownKeys` / `Reflect.set` | parity with upstream `Object.assign(client, ...)` (own enumerable props survive `withoutTransforms()`), and `Object.assign` is banned | one typed `as unknown as` helper |
| D41 | `fromConnection` sets no session TimeZone unless `timeZone` is given | `SET` is session-scoped and the connection belongs to the caller | always set UTC |
| D42 | Internal modules export only what another `src/` module imports | fallow dead-code is blocking with a zero baseline and `src/internal/*` are not fallow entries | add the modules as fallow entries |
| D43 | Plain-object binds use a hoisted `S.fromJsonString(S.Unknown)` encoder | EF-3/EF-19 forbid `JSON.stringify`; bigint and cyclic values become a typed failure | — |
| D44 | Only statements with bind values use the prepared cache (`runLocked` in `src/internal/connection.ts` requires `binds.length > 0`); parameterless statements always run through `connection.run` | DuckDB 1.5.6 plans a parameterless prepared statement once with statistics propagation, so a cached constant-filter query prepared on an empty table kept returning `[]` after inserts (found by the vendored event-log suite; regression test in `test/DuckDbClient.test.ts`) | cache parameterless statements again once DuckDB re-plans them, or invalidate on write |
| D45 | Multi-statement SQL without bind values returns the rows of the first statement, except `executeStream` outside a transaction, which streams the last statement's rows | native `runAndReadAll`/`duckdb_query` behaviour, while native `stream` runs the leading statements first; splitting statements would need a tokenizer | split and return the last statement's rows |
| D46 | DECIMAL binds are documented and tested in the unscaled `bigint` form, `decimalValue(BigInt(12345), 5, 2)` | the `number` overload is `fromDouble`, and binding an overflowing value segfaults Bun | none on the driver side; it passes `DuckDB*Value` through unchanged |
| D47 | The vendored `SqlEventLogServerUnencrypted` suite takes `{ savepoints: false }`, which skips its caught-nested-rollback case; a DuckDB test in `test/DuckDbClient.eventLog.test.ts` pins the refused outer commit instead | no savepoints (D2), and at 4.0.5 the storage's `withTransaction` runs `catchIf(isSqlError, die)`, so the refusal reaches callers as a defect | drop the option when DuckDB gains savepoints |
| D48 | Vendored suites (`test/shared/*`) are adapted only where repo rules require it (`dual`-built helpers, `Entry.make`, the `@beep/test-runner` `it`), each change marked `// beep:` | tsgo rules `missingPipeableSignature` and `newSchemaClass` apply to tests; the markers keep a re-vendor diff readable | re-vendor verbatim if the rules are relaxed |
| D49 | Test plan deviations: the stream-in-transaction test uses `range(10000)`; the concurrent nested-transaction test uses two successes; resolver tests use one table per test | 10000 rows with a per-row statement is well past the 2048-row native chunk where a non-materialized stream truncates; without savepoints a failing nested branch refuses the outer commit (D2), so only the serialization of successful branches is testable; vitest runs tests concurrently (`vitest.shared.ts` `sequence.concurrent`), so shared tables collide | follow the SPEC wording |
| D50 | B2 landed: the legacy service runs every native call through `NativeGate`, and its transaction client records statement failures and interruptions and runs `ABORT_PROBE_SQL` before COMMIT; the shared connection closes under the gate lock, after a running statement settles; on an aborted transaction it runs ROLLBACK and fails with `DuckDbError` (operation `withTransaction`, cause the recorded error) | same lost-write bug as D3; one classifier and one interrupt path for both surfaces; the legacy suite stayed unchanged and green | revert `src/DuckDb.service.ts` to its B1 state (commit `017f13c4fe`) |
| D51 | The legacy re-base adds only the span `DuckDb.probeAborted`, under the legacy `DuckDb.*` namespace (`DuckDb.withTransactionOnConnection` predates the re-base) | `Effect.fn` names follow `Concept.action`; keeping the legacy concept name separates them from `DuckDbClient.*` spans | rename and re-generate the instrumentation catalog |
| D52 | A bound LIST is typed from its first item whose type has no `NULL` leaf (`bindTypes` in `src/internal/parameters.ts`, passed to every `DuckDbClient` native bind; the legacy `DuckDb` service passes its positional arrays and named `$param` records straight to node-api without bind types, so a `listValue` there is still typed from `items[0]`); an all-null list stays `LIST(SQLNULL)` | node-api `typeForValue` types a list from `items[0]` only, so `[null, 7]` bound as `LIST(SQLNULL)` and stored every item as NULL without an error; `typeForValue` is not re-exported, so the driver imports `@duckdb/node-api/lib/typeForValue.js` (the package has no `exports` map) | reject lists with a leading null |
| D53 | After the client scope closes, every statement skips the closed prepared cache and the closed native gate fails it with `ConnectionError` before it reaches the native connection (also for `fromConnection`, whose caller-owned connection stays usable); the classifier still matches the unwrapped `connection disconnected`/`instance closed` text | a closed `ScopedCache.get` interrupts its caller, which typed error handling cannot catch, and a statement queued behind teardown could otherwise start on a connection its owner is closing | let post-close statements reach the native connection |
| D54 | `layerClientConfig` is the Config-driven `layerClient` | Config-driven programs beside PGlite otherwise have to choose `layerConfig` and its `SqlClient` | hand-roll `Config.unwrap` + `layerClient` |
| D55 | Raw `COMMIT`/`END` text run inside a transaction goes through the same commit decision as `withTransaction`'s commit; on a refusal the driver runs `ROLLBACK` and fails with the refused-commit `UnknownError` (`guardedCommit` in `src/internal/connection.ts`); D59 states which raw texts count as control | a raw `BEGIN` / swallowed constraint error / raw `COMMIT` reported success and wrote nothing although the tracker had recorded the failure (review round 2); the raw caller has no `onCommitFailure`, so the driver cleans up | send raw COMMIT straight to DuckDB and document the gap |
| D56 | Legacy `DuckDbError.message` carries the native DuckDB diagnostic of a classified statement failure when no explicit message is given | the cause moved to a `SqlError` in B2, which put the native text two levels down | keep the generic default message |
| D57 | A list whose number items bind as different types takes the widest, INTEGER < BIGINT < DOUBLE, recursively through nested lists (`[1, 2.5]` is `DOUBLE[]`, `[1, 3e9]` is `BIGINT[]`) in `bindTypes` (R2-05) | upstream `typeForValue` types a list from its first item, so `[1, 2.5]` bound as `INTEGER[]` and failed with "number is not an integer"; every JS number is a double, so widening loses nothing the caller had | keep failing and point at a typed `listValue` |
| D58 | Mixed READ_ONLY/read-write opens of one file in one process are refused in either order: `DuckDbClient` fails with `ConnectionError`, the legacy service fails its first statement with `DuckDbError` (tests in `test/DuckDb.service.test.ts`) | both surfaces use `fromCache`, which refuses conflicting configurations; standalone READ_ONLY opens share the cache and remain supported | close every reader first, or share the read-write connection |
| D59 | Raw transaction control is tracked only as the single statement of a text, after stripping line and nested block comments (`classifyControl` / `splitStatements` in `src/internal/transaction.ts`); multi-statement text containing `BEGIN`/`COMMIT`/`ROLLBACK`/a savepoint is refused with an `UnknownError` before it reaches DuckDB, on every execute path including streams (PR-T1, #1963) | `/* tx */ BEGIN` or `COMMIT; SELECT 1` classified as a plain statement, so a swallowed constraint error followed by raw COMMIT skipped the D55 guard and DuckDB discarded the writes; a probe showed a multi-statement failure leaves an undecidable state (a parser error runs nothing, a binder error after `BEGIN` leaves a healthy transaction, a constraint error leaves an aborted one, a failure after `COMMIT` leaves none) | classify by the first or last control statement and fold the phase, guessing the state after a part-way failure |
| D60 | Reader connections (implemented, #2083): one writer connection plus `readerConnections` read-only connections (`NonNegativeInt`, default `0` = today's behaviour). The readers are `SqlClient.make`'s `acquirer`; `borrower` and `transactionAcquirer` stay on the writer, so only `executeStream` outside a transaction reaches a reader | at effect 4.0.5 (unchanged at HEAD) `stream` alone uses `acquirer`; a statement on the streaming connection ends the stream after 2048 rows, while a second connection streams a full snapshot beside writes (probed); a symmetric `maxConnections` pool would make writes conflict optimistically (`Conflict on update!`) and scatter temp tables, `USE`, `search_path` and the tracked transaction phase across connections; always materializing costs unbounded memory | symmetric pool under `maxConnections`, or keep D9 |
| D61 | Each reader lease runs inside `BEGIN TRANSACTION READ ONLY` … `ROLLBACK` (implemented, #2083) | a write streamed through a reader (`INSERT … RETURNING`) would bypass the writer's serialization and the D3/D55 commit guard; DuckDB 1.5.6 refuses writes in a read-only transaction with a message `classify.ts` already maps to `AuthorizationError` (probed) | trust callers and document |
| D62 | Reader state (implemented, #2083): the writer keeps a resolved session snapshot (`current_database()`, `current_setting('search_path')`, `TimeZone`, `Calendar`), read with one query at connect and again after any executed text that contains a `USE`, `SET`, `RESET`, `PRAGMA`, `CREATE`/`CREATE OR REPLACE`/`DROP SCHEMA`, `ATTACH` or `DETACH` statement, on success or failure (split as in D59); the snapshot retains the raw writer search path; every lease normalizes it against `duckdb_schemas()` on the reader inside its read-only transaction, preserving valid order and quoting without changing the writer (#2117); checking the reader catalog avoids observing uncommitted writer schema drops and sees recreated schemas even when the raw path is unchanged; a dangling qualified schema after `USE` falls back to `main` on readers as on the writer. Refresh is not a native path reset: on 1.5.6 a detached catalog retained in the path can prevent binding the snapshot query, and readers retain that native failure until the writer reattaches the catalog or repairs its path; reader streams conservatively refuse all `PRAGMA` text, the other session changes and transaction control with `AuthorizationError` before execution, preventing state leaks across leases; each reader lease resets its previous path before BEGIN (so a detached catalog cannot prevent transaction control from binding), then runs `USE`, `SET search_path`, `SET TimeZone` and `SET Calendar` to match before the stream. Other session settings set by raw SQL on the writer are not mirrored, and temp tables and temp macros stay writer-only (a reader stream that reads one fails with a Catalog Error); both documented. Readers come from `effect/Pool.make({ size: readerConnections })`, each a full driver connection with its own `NativeGate` (D15) and the prepared cache off; `fromConnection` has no `readerConnections`; the legacy `DuckDb` service is unchanged (D10) | `USE`, `search_path` and session settings are connection-local, so a reader at defaults silently reads the wrong catalog or zone; replaying the writer's last statement text is not enough (#2096 review): after `USE a; SET search_path = 's'` a reader replaying `SET search_path = 's'` read `memory.s.t` (1) instead of `a.s.t` (42), while restoring `USE "a"` plus the already catalog-qualified `current_setting('search_path')` (`a.s`) read 42, and restoring `TimeZone` made `date_trunc('day', …)` agree (probed); routing such streams back to the writer would silently bring back the deadlock; plain `SET TimeZone` is session-scoped (probed with a non-host zone; `duckdb_settings()` reports scope `GLOBAL`, which only `SET GLOBAL` honours); streams call `native.stream` without the cache | readers at defaults, documented |
| D63 | DuckDB-native storages are demand-gated (designed, #2084): one is built when a consumer needs it on DuckDB, against the effect version in use then, as a `@beep/duckdb` subpath module (`DuckDbEventJournal`, `DuckDbPersistence`, `DuckDbPersistedQueue`, `DuckDbMessageStorage`, `DuckDbRunnerStorage`, `DuckDbEventLogServerEncrypted`) | no repo package imports any of the six effect modules with any driver; effect HEAD reworks persistence, queue and eventlog (upgrade note 5), so a 4.0.5 port would be redone on the bump; the storages are product-neutral technical capability (driver doctrine) | port all six now |
| D64 | Tiered by the probed failure (designed, #2084). Tier A, where only INT32 columns are wrong (`SqlEventJournal`, `Persistence.layerBackingSqlMultiTable`): DuckDB DDL with `BIGINT` first, then the unchanged upstream layer. Tier B, where DDL does not parse or queries call SQLite functions (`Persistence.layerBackingSql`, `PersistedQueue`, `SqlMessageStorage`, `SqlRunnerStorage`, `SqlEventLogServerEncrypted`): a DuckDB port of the upstream service contract from its SQLite branch, marked `// beep:` (D48). Both proven by the vendored upstream shared suite | pre-created tables turn the upstream `CREATE TABLE IF NOT EXISTS` into a no-op, and the journal and multi-table store then pass (probed); `AUTOINCREMENT` fails to parse before the existence check, `CREATE INDEX IF NOT EXISTS … WHERE` is refused even when the index exists, and DuckDB has no `datetime()` or SQLite-order `strftime('%s', …)`; rewriting SQL text needs a tokenizer (the D45/D59 stance), `datetime` macros cannot fix the DDL, `"pg"` breaks the Migrator (D1), and an upstream `"duckdb"` dialect alone changes nothing (HEAD added `clickhouse` without storage branches) | upstream DuckDB branches (re-evaluate at the effect bump, then delete the Tier B ports) |
| D65 | Cluster storages on DuckDB serve single-process deployments (`SingleRunner`) only (designed, #2084) | DuckDB holds a per-process file lock, so runners in other processes cannot share the file | none on DuckDB; use a server database |

| D66 | `DuckDbMigrator.dumpSchema` emits user enums, sequences, scalar/table macros, tables and views in one global catalog OID stream, then indexes and migration rows; group macro overloads by OID/schema/name into one CREATE statement (catalog parameter types preserved; parenthesized TABLE bodies); restrict to the current database and non-internal, non-temporary objects (#2085, S44 amendment) | table macros bind eagerly and views bind against macros, so no category order restores both dependency directions; creation OIDs preserve the order originally accepted by DuckDB. ALTER can introduce dependencies on higher OIDs without renewing the table OID, so such dumps can fail to restore (pinned by a test); CREATE OR REPLACE renews view/macro OIDs on 1.5.6. Macro default argument expressions are not exposed by `duckdb_functions()` and are not preserved | replace the catalog stream with a dependency-aware schema-only API once DuckDB exposes one; revert the migrator callback and tests to disable dumping |
| D67 | `@duckdb/node-api` 2.0 (2.0.0-r.1): every native result is closed (`closeSync`, through `ignoreNative`) inside its gated operation, stream results through a scope finalizer registered uninterruptibly; the parser-error transaction tests assert the safe-COMMIT refusal; the D62 reader tests assert that dropping a schema in the writer's path resets it to `memory.main` | 2.0 keeps a connection busy while any result is open ("connection has an open result"); a parser error now aborts the transaction, so COMMIT silently rolls back (D3 guard); dropping a schema in the session path resets the whole path, even uncommitted, and ROLLBACK does not restore it, so D62's dangling-path normalization now matters only for DETACH (all probed on 2.0.0-r.1) | pin `@duckdb/node-api` 1.5.6-r.2 and revert the tests |

## Known hazards

- **Legacy READ_ONLY beside a read-write open of the same file is refused.**
  Both surfaces use `DuckDBInstance.fromCache` (D35, D58). The legacy service
  fails its first statement with `DuckDbError`; it never creates a private RO
  instance that could read reused blocks or release a writer's file lock.
  In-process readers must share the read-write service. Law-practice does this
  for projection scans, email headers and contextual claims lookups (#2086).
- **A `readOnly` client opened first blocks read-write opens of the file.**
  While it is open, a read-write `DuckDbClient` of the same file in the same
  process fails with `ConnectionError` and the legacy service fails its first
  statement with `DuckDbError` (D58). Open order matters: a process that opens
  a reader before its writer cannot write until every reader closes.
- **Two legacy RW opens of one file with different `databaseOptions`** now
  fail with `Connection Error ... different configuration` instead of silently
  splitting the database (B1 moved legacy RW to `fromCache`). None was found in
  the repo.
- **Caught nested rollback.** Catching a failed nested `withTransaction` and
  continuing refuses the outer COMMIT (D2, D22). Through
  `SqlEventLogServerUnencrypted` this is a defect, not a typed error (D47).
- **Stream deadlocks.** With `readerConnections: 0` (default), a stream
  consumer that issues a statement per row outside a transaction deadlocks on
  the client semaphore. Opt-in readers (D60–D62, #2083) remove this case.
  Streams on a `reserve`d connection still deadlock on the operation lock;
  collect first or run per-row work inside `withTransaction`. The lock
  prevents native 2048-row stream truncation.
- **`fromConnection` interrupts are connection-wide.** Cancelling a client
  statement calls `connection.interrupt()`, which can cancel a query the caller
  runs on the same connection outside the client.
- **`decimalValue(number, w, s)` that overflows** crashes Bun when bound (D46).
- **Raw `BEGIN` interrupted after DuckDB started the transaction** leaves the
  tracked phase `Idle` while DuckDB is inside a transaction, so the next
  `withTransaction` fails its BEGIN. Theoretical (BEGIN is instant) and outside
  `withTransaction`, whose BEGIN is uninterruptible.
- **Comment-only SQL** with bind values, or through `executeStream`, fails
  natively with `Error in native callback` (`UnknownError`). Not special-cased:
  detecting it needs a tokenizer and binding values to it has no meaning.
- **Number and array bind gaps.** Integral numbers outside int64 and
  arrays mixing kinds (`[1, "a"]`) fail with `UnknownError`; arrays mixing
  number kinds widen (D57). `@duckdb/node-api` 1.5.6 has no `doubleValue`
  helper and `listValue(items)` takes no item type, so the fix is the typed
  `DuckDB*Value` pass-through.

## Upgrade notes (effect > 4.0.5)

1. Done at 4.0.6: `makeFromNative` (`src/DuckDbClient.service.ts`) passes
   `driver: "duckdb"` to `SqlClient.make`, which 4.0.6 requires.
2. Pass `isTransaction: (conn) => isDuckDbConnection(conn) && conn.isTransaction()`
   to `MakeOptions.isTransaction` (HEAD `packages/effect/src/sql/SqlClient.ts`),
   relying on the phase tracking (a commit-time conflict already sets `Idle`).
   `makeSqliteAcquirers` already accepts `isTransaction` at 4.0.5 and stays
   without it (D34) unless the HEAD contract requires both to agree.
3. Done at 4.0.6: failed migrations are typed `MigrationError` failures
   instead of defects (HEAD `88bc68001c`); `test/DuckDbMigrator.test.ts` reads
   `Exit.findError`.
4. Savepoint emulation is unaffected by HEAD's `makeWithTransaction` signature
   change because the driver never calls it.
5. Re-run the consumer support matrix in `README.md`: the eventlog,
   persistence and queue modules are heavily reworked at HEAD. Re-check D47
   (`catchIf(isSqlError, die)` in the event-log storage).
6. Tests read `reason.isRetryable`, the 4.0.5 getter name. Check it on the bump.
7. `@duckdb/node-api` bumps: re-run the prepared-statement probe behind D44
   (stale result of a cached parameterless statement) and the classifier
   strings in `test/DuckDbClient.classification.test.ts`.

## Follow-ups

Tracked in #2088. Each sub-issue carries the constraint probed on DuckDB 1.5.6
and its acceptance criteria:

- #2083 Reader connections for streams (D60–D62).
- #2084 DuckDB-native storages for the unsupported consumers, demand-gated
  (D11, D63–D65).
