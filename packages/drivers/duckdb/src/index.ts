/**
 * DuckDB driver package: an `effect/sql` client, its Migrator, and the legacy
 * product-neutral `DuckDb` service.
 *
 * **Details**
 *
 * `DuckDbClient` implements the generic `effect/sql` `SqlClient` over
 * `@duckdb/node-api` and reports the `"sqlite"` dialect. `DuckDbMigrator`
 * re-exports the `effect/sql/Migrator` loaders and binds `run`/`layer`. The
 * flat exports keep the legacy `DuckDb` service (JSON rows, named `$param`
 * records), which never provides `SqlClient`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public DuckDB driver error models and normalization helpers.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./DuckDb.errors.ts";
/**
 * Public DuckDB driver request, row, and client configuration schemas.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./DuckDb.models.ts";
/**
 * Legacy DuckDB service, adapter contract, and layers.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./DuckDb.service.ts";
/**
 * In-memory DuckDB client layer for tests.
 *
 * @since 0.0.0
 * @category testing
 */
export * from "./DuckDb.test-layer.ts";
/**
 * The DuckDB `effect/sql` client module.
 *
 * **Example** (Query through the client layer)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* DuckDbClient.DuckDbClient
 *   return yield* sql<{ readonly n: number }>`select 1 as n`
 * }).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ n: 1 }]
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export * as DuckDbClient from "./DuckDbClient.service.ts";
/**
 * DuckDB event journal: the upstream `SqlEventJournal` over BIGINT tables.
 *
 * **Example** (Provide a DuckDB event journal)
 *
 * ```ts
 * import { DuckDbClient, DuckDbEventJournal } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const JournalLive = DuckDbEventJournal.layer().pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbEventJournal from "./DuckDbEventJournal.service.ts";
/**
 * DuckDB encrypted event-log server storage with 64-bit sequences.
 *
 * **Example** (Provide encrypted event-log storage)
 *
 * ```ts
 * import { DuckDbClient, DuckDbEventLogServerEncrypted } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const StorageLive = DuckDbEventLogServerEncrypted.layerStorageSubtle().pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbEventLogServerEncrypted from "./DuckDbEventLogServerEncrypted.service.ts";
/**
 * DuckDB cluster message storage for single-process (`SingleRunner`) deployments.
 *
 * **Example** (Provide cluster message storage)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMessageStorage } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const StorageLive = DuckDbMessageStorage.layer.pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbMessageStorage from "./DuckDbMessageStorage.service.ts";
/**
 * The DuckDB Migrator module.
 *
 * **Example** (Run record migrations)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMigrator } from "@beep/duckdb"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const program = DuckDbMigrator.run({
 *   loader: DuckDbMigrator.fromRecord({
 *     "1_create": Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table t (id integer primary key)`)
 *   })
 * }).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })), Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((applied) => console.log(applied)) // [[1, "create"]]
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbMigrator from "./DuckDbMigrator.service.ts";
/**
 * DuckDB `PersistedQueue` store; it also requires `Crypto` for claim ids.
 *
 * **Example** (Provide a persisted queue store)
 *
 * ```ts
 * import { DuckDbClient, DuckDbPersistedQueue } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const StoreLive = DuckDbPersistedQueue.layerStoreSql().pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbPersistedQueue from "./DuckDbPersistedQueue.service.ts";
/**
 * DuckDB `Persistence` backings, shared-table and table-per-store.
 *
 * **Example** (Provide SQL-backed persistence)
 *
 * ```ts
 * import { DuckDbClient, DuckDbPersistence } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const PersistenceLive = DuckDbPersistence.layerSql.pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbPersistence from "./DuckDbPersistence.service.ts";
/**
 * DuckDB cluster runner storage for single-process (`SingleRunner`) deployments.
 *
 * **Example** (Provide cluster runner storage)
 *
 * ```ts
 * import { DuckDbClient, DuckDbRunnerStorage } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const StorageLive = DuckDbRunnerStorage.layer.pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export * as DuckDbRunnerStorage from "./DuckDbRunnerStorage.service.ts";
