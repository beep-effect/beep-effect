/**
 * DuckDB client for the generic `effect/sql` `SqlClient`.
 *
 * **Details**
 *
 * One serialized writer connection per client, with optional read-only readers.
 * The client reports the `"sqlite"` dialect and uses a DuckDB compiler that supports `updateValues`.
 * DuckDB has no savepoints: a nested `withTransaction` that rolls back refuses
 * the outer `COMMIT` and the whole transaction rolls back. `COMMIT` is safe:
 * when DuckDB already aborted the transaction after a failed statement, the
 * commit is refused instead of silently discarding the writes. The session
 * TimeZone is `UTC` by default (not set on an adopted connection unless
 * `timeZone` is given). `executeStream` materializes inside a transaction and
 * streams incrementally outside one.
 *
 * **Gotchas**
 *
 * - With `readerConnections: 0` (default), a stream consumer that issues a
 *   statement per row outside a transaction deadlocks. Enable readers or
 *   collect first. Streams on a `reserve`d connection still deadlock.
 * - Readers mirror the writer's catalog, search path, TimeZone and Calendar.
 *   Other raw session settings, temporary tables and macros stay writer-only.
 *   Reader streams refuse session changes and run in read-only transactions.
 * - A `readOnly` open shares the process-wide instance of its file and is
 *   refused with a `ConnectionError` while this process holds the same file
 *   read-write.
 * - `ATTACH` and `LOAD` act on the database instance: they are visible to every
 *   client of the same database.
 * - Set both `transformQueryNames` and `transformResultNames`, or neither:
 *   `withoutTransforms()` returns the same client when only query names are
 *   transformed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { quotedIdentifier, quotedString } from "@duckdb/node-api";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Pool from "effect/Pool";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { makeCompiler as internalMakeCompiler, makeRowTransform } from "./internal/compiler.ts";
import { makeConnection } from "./internal/connection.ts";
import { attachExtras, makeExtras } from "./internal/extras.ts";
import { acquireConnection, acquireInstance } from "./internal/native.ts";
import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import type * as Scope from "effect/Scope";
import type { SqlError } from "effect/sql/SqlError";
import type * as Statement from "effect/sql/Statement";
import type {
  DuckDbAppendRows,
  DuckDbClientConfigData,
  DuckDbDatabaseExport,
  DuckDbDatabaseImport,
  DuckDbParquetExport,
} from "./DuckDb.models.ts";

const $I = $DuckdbId.create("DuckDbClient.service");

const DEFAULT_PREPARE_CACHE_SIZE = 200;
const DEFAULT_TIME_ZONE = "UTC";
const MEMORY_PATH = ":memory:";
const DATABASE_QUERY = "SELECT database_name, path FROM duckdb_databases() WHERE database_name = current_database()";

/**
 * Runtime type identifier of DuckDB `effect/sql` clients.
 *
 * **Example** (Check the client marker)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* DuckDbClient.DuckDbClient
 *   console.log(client[DuckDbClient.TypeId] === DuckDbClient.TypeId) // true
 * }).pipe(Effect.provide(DuckDbClient.layerClient({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program)
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export const TypeId: TypeId = "~@beep/duckdb/DuckDbClient";

/**
 * Type-level identifier of DuckDB `effect/sql` clients.
 *
 * **Example** (Name the type identifier)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 *
 * const typeId: DuckDbClient.TypeId = "~@beep/duckdb/DuckDbClient"
 * console.log(typeId === DuckDbClient.TypeId) // true
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export type TypeId = "~@beep/duckdb/DuckDbClient";

/**
 * Configuration of `make`, `layer`, `layerClient`, `layerConfig`, and
 * `layerClientConfig`.
 *
 * **Details**
 *
 * The serializable fields come from `DuckDbClientConfigData`; the runtime
 * fields are the prepared-statement TTL (default 10 minutes, counted from
 * when the statement was prepared, not from its last use), extra span
 * attributes, and the query/result name transforms. Set both transforms or
 * neither.
 *
 * **Example** (File-backed configuration)
 *
 * ```ts
 * import type { DuckDbClient } from "@beep/duckdb"
 *
 * const config: DuckDbClient.DuckDbClientConfig = {
 *   databasePath: "analytics.duckdb",
 *   databaseOptions: { threads: "2" },
 *   prepareCacheTTL: "5 minutes"
 * }
 * console.log(config.databasePath) // "analytics.duckdb"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbClientConfig = typeof DuckDbClientConfigData.Encoded & {
  readonly prepareCacheTTL?: Duration.Input | undefined;
  readonly spanAttributes?: Record<string, unknown> | undefined;
  readonly transformQueryNames?: ((str: string) => string) | undefined;
  readonly transformResultNames?: ((str: string) => string) | undefined;
};

/**
 * Options of `fromInstance`: adopt a caller-owned DuckDB instance.
 *
 * **Details**
 *
 * `databasePath` is informational; it defaults to the path of the attached
 * catalog, or `":memory:"` when that has no path.
 *
 * **Example** (Adopt an instance)
 *
 * ```ts
 * import type { DuckDbClient } from "@beep/duckdb"
 * import { DuckDBInstance } from "@duckdb/node-api"
 *
 * DuckDBInstance.create(":memory:").then((instance) => {
 *   const options: DuckDbClient.DuckDbClientFromInstanceOptions = { instance, timeZone: "UTC" }
 *   console.log(options.timeZone) // "UTC"
 *   instance.closeSync()
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbClientFromInstanceOptions = Omit<
  DuckDbClientConfig,
  "databaseOptions" | "databasePath" | "readOnly"
> & {
  readonly databasePath?: string | undefined;
  readonly instance: DuckDBInstance;
};

/**
 * Options of `fromConnection`: adopt a caller-owned DuckDB connection.
 *
 * **Example** (Adopt a connection)
 *
 * ```ts
 * import type { DuckDbClient } from "@beep/duckdb"
 * import { DuckDBInstance } from "@duckdb/node-api"
 *
 * DuckDBInstance.create(":memory:").then(async (instance) => {
 *   const connection = await instance.connect()
 *   const options: DuckDbClient.DuckDbClientFromConnectionOptions = { connection, databasePath: "shared" }
 *   console.log(options.databasePath) // "shared"
 *   connection.closeSync()
 *   instance.closeSync()
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbClientFromConnectionOptions = Omit<
  DuckDbClientConfig,
  "databaseOptions" | "databasePath" | "readOnly" | "readerConnections"
> & {
  readonly connection: DuckDBConnection;
  readonly databasePath?: string | undefined;
};

/**
 * DuckDB `effect/sql` client: the generic `SqlClient` plus driver extras.
 *
 * **Details**
 *
 * `updateValues` is supported (`(values ...) AS alias(cols)`). The extras run
 * on the transaction connection inside `withTransaction`, except
 * `copyTableToParquet`, `exportDatabase` and `checkpoint`, which refuse there.
 *
 * **Example** (Read the client configuration)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 *
 * const pathOf = (client: DuckDbClient.DuckDbClientValue) => client.config.databasePath
 * const program = Effect.gen(function* () {
 *   console.log(pathOf(yield* DuckDbClient.DuckDbClient)) // ":memory:"
 * }).pipe(Effect.provide(DuckDbClient.layerClient({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbClientValue = SqlClient.SqlClient & {
  readonly [TypeId]: TypeId;
  readonly config: DuckDbClientConfig;
  readonly exportDatabase: (request: typeof DuckDbDatabaseExport.Encoded) => Effect.Effect<void, SqlError>;
  readonly importDatabase: (request: typeof DuckDbDatabaseImport.Encoded) => Effect.Effect<void, SqlError>;
  readonly appendRows: (request: typeof DuckDbAppendRows.Encoded) => Effect.Effect<void, SqlError>;
  readonly copyTableToParquet: (request: DuckDbParquetExport) => Effect.Effect<void, SqlError>;
  readonly checkpoint: (
    options?: { readonly force?: boolean | undefined } | undefined
  ) => Effect.Effect<void, SqlError>;
  readonly loadExtension: (name: string) => Effect.Effect<void, SqlError>;
  readonly installExtension: (name: string) => Effect.Effect<void, SqlError>;
  readonly attach: (
    path: string,
    alias: string,
    options?: { readonly readOnly?: boolean | undefined } | undefined
  ) => Effect.Effect<void, SqlError>;
  readonly detach: (alias: string) => Effect.Effect<void, SqlError>;
};

/**
 * Service key of the DuckDB `effect/sql` client.
 *
 * **Example** (Use the driver extras)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* DuckDbClient.DuckDbClient
 *   yield* client.checkpoint()
 * }).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DuckDbClient extends Context.Service<DuckDbClient, DuckDbClientValue>()($I`DuckDbClient`) {}

type CoreOptions = Omit<DuckDbClientConfig, "databasePath"> & {
  readonly databasePath?: string | undefined;
};

const hasTimeZoneKey = (options: Record<string, string> | undefined): boolean =>
  R.some(options ?? {}, (_, key) => Str.toLowerCase(key) === "timezone");

const stringField = (row: unknown, key: string): O.Option<string> =>
  P.hasProperty(row, key) && P.isString(row[key]) ? O.some(row[key]) : O.none();

const makeAcquirers = Effect.fnUntraced(function* (
  instance: DuckDBInstance | undefined,
  connection: Effect.Success<ReturnType<typeof makeConnection>>,
  readerConnections: number
) {
  const acquirers = SqlClient.makeSqliteAcquirers({
    connection: Effect.succeed(connection),
    semaphore: yield* Semaphore.make(1),
  });
  if (instance === undefined || readerConnections <= 0) {
    return { ...acquirers, streamAcquirer: acquirers.acquirer };
  }
  yield* connection.sessionSnapshot;
  const readerPool = yield* Pool.make({
    size: readerConnections,
    acquire: Effect.gen(function* () {
      const readerNative = yield* acquireConnection(instance);
      const reader = yield* makeConnection({
        native: readerNative,
        prepareCacheSize: 0,
        prepareCacheTTL: Duration.zero,
        readOnlyReader: true,
      });
      // Normalize on every lease: committed schema changes can alter the
      // effective path even when the writer session settings stay the same.
      return {
        reader,
        synchronize: Effect.fnUntraced(function* () {
          const snapshot = yield* connection.sessionSnapshot.pipe(Effect.flatMap(reader.normalizeSessionSnapshot));
          yield* reader.runDriverStatement(`USE ${quotedIdentifier(snapshot.database)}`, "executeStream");
          yield* reader.runDriverStatement(`SET search_path = ${quotedString(snapshot.searchPath)}`, "executeStream");
          yield* reader.runDriverStatement(`SET TimeZone = ${quotedString(snapshot.timeZone)}`, "executeStream");
          yield* reader.runDriverStatement(`SET Calendar = ${quotedString(snapshot.calendar)}`, "executeStream");
        }),
      };
    }),
  });
  const streamAcquirer = Effect.gen(function* () {
    const lease = yield* Pool.get(readerPool);
    // Clear a previous lease's path before BEGIN: a detached catalog can
    // prevent even transaction control from binding on DuckDB 1.5.6.
    yield* lease.reader.runDriverStatement("RESET search_path", "executeStream");
    yield* Effect.acquireRelease(
      lease.reader.runDriverStatement("BEGIN TRANSACTION READ ONLY", "beginTransaction"),
      () => lease.reader.runDriverStatement("ROLLBACK", "rollbackTransaction").pipe(Effect.orDie)
    );
    yield* lease.synchronize();
    return lease.reader;
  });
  return { ...acquirers, streamAcquirer };
});

const configureTimeZone = Effect.fnUntraced(function* (
  connection: Effect.Success<ReturnType<typeof makeConnection>>,
  timeZone: string | undefined,
  skipDefault: boolean
) {
  if (timeZone === undefined && skipDefault) return;
  yield* connection.runDriverStatement(`SET TimeZone = ${quotedString(timeZone ?? DEFAULT_TIME_ZONE)}`, "connect");
});

const makeFromNative = Effect.fnUntraced(function* (
  native: DuckDBConnection,
  options: CoreOptions,
  skipDefaultTimeZone: boolean,
  instance?: DuckDBInstance
) {
  const readerConnections = options.readerConnections ?? 0;
  const connection = yield* makeConnection({
    native,
    trackSession: readerConnections > 0,
    prepareCacheSize: options.prepareCacheSize ?? DEFAULT_PREPARE_CACHE_SIZE,
    prepareCacheTTL: options.prepareCacheTTL ?? Duration.minutes(10),
  });
  yield* configureTimeZone(connection, options.timeZone, skipDefaultTimeZone);
  const database = A.head(yield* connection.executeUnprepared(DATABASE_QUERY, [], undefined));
  const databaseName = O.getOrElse(
    O.flatMap(database, (row) => stringField(row, "database_name")),
    () => "memory"
  );
  const databasePath = O.flatMap(database, (row) => stringField(row, "path"));
  const acquirers = yield* makeAcquirers(instance, connection, readerConnections);
  const client = yield* SqlClient.make({
    driver: "duckdb",
    acquirer: acquirers.streamAcquirer,
    borrower: acquirers.borrower,
    transactionAcquirer: acquirers.transactionAcquirer,
    onCommitFailure: acquirers.onCommitFailure,
    compiler: internalMakeCompiler(options.transformQueryNames),
    spanAttributes: [
      ...R.toEntries(options.spanAttributes ?? {}),
      ["db.system.name", "duckdb"],
      ["db.namespace", databaseName],
    ],
    beginTransaction: "BEGIN TRANSACTION",
    commit: () => connection.commit,
    transformRows:
      options.transformResultNames === undefined ? undefined : makeRowTransform(options.transformResultNames),
  });
  const config: DuckDbClientConfig = {
    ...options,
    databasePath: options.databasePath ?? O.getOrElse(databasePath, () => MEMORY_PATH),
  };
  const value: DuckDbClientValue = attachExtras(client, {
    [TypeId]: TypeId,
    config,
    ...makeExtras({ client, acquirer: acquirers.acquirer }),
  });
  return value;
});

/**
 * Open a DuckDB database and build a client over its own connection.
 *
 * **Details**
 *
 * File-backed databases go through DuckDB's process-wide instance cache, so
 * every client (and the legacy `DuckDb` service) of one file shares one
 * database; `":memory:"` always opens a private database. The connection and
 * the instance wrapper close with the scope. The session TimeZone is set to
 * `timeZone` (default `UTC`) unless `databaseOptions` already carries a
 * `TimeZone` key and `timeZone` is absent.
 *
 * **Example** (Scoped in-memory client)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 * import * as Reactivity from "effect/reactivity/Reactivity"
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* DuckDbClient.make({ databasePath: ":memory:" })
 *   return yield* sql<{ readonly n: number }>`select 1 as n`
 * }).pipe(Effect.scoped, Effect.provide(Reactivity.layer))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ n: 1 }]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn("DuckDbClient.make")(function* (
  options: DuckDbClientConfig
): Effect.fn.Return<DuckDbClientValue, SqlError, Scope.Scope | Reactivity.Reactivity> {
  const instance = yield* acquireInstance(options);
  const native = yield* acquireConnection(instance);
  return yield* makeFromNative(native, options, hasTimeZoneKey(options.databaseOptions), instance);
});

/**
 * Build a client over a caller-owned DuckDB instance.
 *
 * **Details**
 *
 * Opens its own connection on the instance and closes it with the scope; the
 * instance itself is never closed. The session TimeZone defaults to `UTC`.
 *
 * **Example** (Adopt an instance)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import { DuckDBInstance } from "@duckdb/node-api"
 * import * as Effect from "effect/Effect"
 * import * as Reactivity from "effect/reactivity/Reactivity"
 *
 * const program = Effect.gen(function* () {
 *   const instance = yield* Effect.promise(() => DuckDBInstance.create(":memory:"))
 *   const sql = yield* DuckDbClient.fromInstance({ instance })
 *   return yield* sql`select 42 as answer`
 * }).pipe(Effect.scoped, Effect.provide(Reactivity.layer))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ answer: 42 }]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromInstance = Effect.fn("DuckDbClient.fromInstance")(function* (
  options: DuckDbClientFromInstanceOptions
): Effect.fn.Return<DuckDbClientValue, SqlError, Scope.Scope | Reactivity.Reactivity> {
  const { instance, ...config } = options;
  const native = yield* acquireConnection(instance);
  return yield* makeFromNative(native, config, false, instance);
});

/**
 * Build a client over a caller-owned DuckDB connection.
 *
 * **Details**
 *
 * The connection is never closed. Its session TimeZone is set only when
 * `timeZone` is given, because `SET` is session-scoped and the connection
 * belongs to the caller.
 *
 * **Gotchas**
 *
 * - Without `timeZone`, `Date` binds into naive `TIMESTAMP` columns follow the
 *   caller's session zone.
 * - Cancelling a statement calls `connection.interrupt()`, which is
 *   connection-wide: it can cancel a query the caller runs on the same
 *   connection outside the client.
 *
 * **Example** (Adopt a connection)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import { DuckDBInstance } from "@duckdb/node-api"
 * import * as Effect from "effect/Effect"
 * import * as Reactivity from "effect/reactivity/Reactivity"
 *
 * const program = Effect.gen(function* () {
 *   const instance = yield* Effect.promise(() => DuckDBInstance.create(":memory:"))
 *   const connection = yield* Effect.promise(() => instance.connect())
 *   const sql = yield* DuckDbClient.fromConnection({ connection, timeZone: "UTC" })
 *   return yield* sql`select 42 as answer`
 * }).pipe(Effect.scoped, Effect.provide(Reactivity.layer))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ answer: 42 }]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromConnection = Effect.fn("DuckDbClient.fromConnection")(function* (
  options: DuckDbClientFromConnectionOptions
): Effect.fn.Return<DuckDbClientValue, SqlError, Scope.Scope | Reactivity.Reactivity> {
  const { connection, ...config } = options;
  return yield* makeFromNative(connection, config, true);
});

/**
 * Layer providing `DuckDbClient` and the generic `SqlClient`.
 *
 * **Details**
 *
 * Provides its own `Reactivity`. Each build opens the database anew; the
 * client closes with the layer scope.
 *
 * **Example** (Query through the generic SqlClient)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   return yield* sql`select 1 as n`
 * }).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ n: 1 }]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (config: DuckDbClientConfig): Layer.Layer<DuckDbClient | SqlClient.SqlClient, SqlError> =>
  Layer.effectContext(
    Effect.map(make(config), (client) =>
      Context.make(DuckDbClient, client).pipe(Context.add(SqlClient.SqlClient, client))
    )
  ).pipe(Layer.provide(Reactivity.layer));

/**
 * Layer providing only `DuckDbClient`, never the generic `SqlClient`.
 *
 * **Details**
 *
 * For contexts whose `SqlClient` is another database (for example PGlite).
 * Code that reads the generic `SqlClient`, such as `DuckDbMigrator.run`, needs
 * it provided explicitly from `DuckDbClient`.
 *
 * **Example** (DuckDB beside another SqlClient)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const duckdb = yield* DuckDbClient.DuckDbClient
 *   return yield* duckdb`select 1 as n`
 * }).pipe(Effect.provide(DuckDbClient.layerClient({ databasePath: ":memory:" })))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ n: 1 }]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerClient = (config: DuckDbClientConfig): Layer.Layer<DuckDbClient, SqlError> =>
  Layer.effect(DuckDbClient, make(config)).pipe(Layer.provide(Reactivity.layer));

/**
 * `layer` built from an Effect `Config`, as a record of configs or a single
 * `Config`.
 *
 * **Example** (Configure the database path from the environment)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Config from "effect/Config"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const DuckDbLive = DuckDbClient.layerConfig({
 *   databasePath: Config.String("DUCKDB_PATH"),
 *   readOnly: Config.Boolean("DUCKDB_READ_ONLY").pipe(Config.withDefault(false))
 * }).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ DUCKDB_PATH: ":memory:" }))))
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* DuckDbClient.DuckDbClient
 *   const sql = yield* SqlClient.SqlClient
 *   const rows = yield* sql`select 1 as n`
 *   return [client.config.databasePath, rows]
 * }).pipe(Effect.provide(DuckDbLive))
 *
 * Effect.runPromise(program).then(console.log) // [":memory:", [{ n: 1 }]]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerConfig = (
  config: Config.Wrap<DuckDbClientConfig>
): Layer.Layer<DuckDbClient | SqlClient.SqlClient, Config.ConfigError | SqlError> =>
  Layer.effectContext(
    Config.unwrap(config).pipe(
      Effect.flatMap(make),
      Effect.map((client) => Context.make(DuckDbClient, client).pipe(Context.add(SqlClient.SqlClient, client)))
    )
  ).pipe(Layer.provide(Reactivity.layer));

/**
 * `layerClient` built from an Effect `Config`: provides only `DuckDbClient`.
 *
 * **Details**
 *
 * The Config-driven form for contexts whose `SqlClient` is another database
 * (for example PGlite), so the generic `SqlClient` is never shadowed by layer
 * merge order.
 *
 * **Example** (Configure a client-only layer from the environment)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 * import * as Config from "effect/Config"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const DuckDbLive = DuckDbClient.layerClientConfig({
 *   databasePath: Config.String("DUCKDB_PATH")
 * }).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ DUCKDB_PATH: ":memory:" }))))
 *
 * const program = Effect.flatMap(DuckDbClient.DuckDbClient, (duckdb) => duckdb`select 1 as n`).pipe(
 *   Effect.provide(DuckDbLive)
 * )
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ n: 1 }]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerClientConfig = (
  config: Config.Wrap<DuckDbClientConfig>
): Layer.Layer<DuckDbClient, Config.ConfigError | SqlError> =>
  Layer.effect(DuckDbClient, Effect.flatMap(Config.unwrap(config), make)).pipe(Layer.provide(Reactivity.layer));

/**
 * The DuckDB statement compiler: dialect `"sqlite"`, `?` placeholders,
 * double-quoted identifiers, and pg-style `updateValues`.
 *
 * **Example** (Compile a statement)
 *
 * ```ts
 * import { DuckDbClient } from "@beep/duckdb"
 *
 * const compiler = DuckDbClient.makeCompiler()
 * console.log(compiler.dialect) // "sqlite"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCompiler: (transform?: ((name: string) => string) | undefined) => Statement.Compiler =
  internalMakeCompiler;
