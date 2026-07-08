/**
 * Effect SQL client implementation backed by DuckDB's native Node API.
 *
 * @remarks
 * This module adapts `@duckdb/node-api` to the generic Effect SQL
 * `SqlClient.SqlClient` service. The v1 compiler intentionally uses Effect
 * SQL's SQLite compiler because DuckDB accepts positional `?` placeholders and
 * double-quoted identifiers, while Effect's dialect union does not yet include
 * DuckDB. DuckDB-specific capabilities such as Parquet export remain on this
 * driver-specific client and are not added to the generic SQL tag.
 *
 * Nested `sql.withTransaction(...)` calls reuse the active DuckDB transaction
 * and do not provide savepoint isolation because DuckDB rejects `SAVEPOINT` in
 * the native Node API path used by this package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { DuckDBInstance, quotedIdentifier, quotedString } from "@duckdb/node-api";
import { Context, Effect, Layer, Scope, Semaphore, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { ConnectionError, SqlError, UnknownError } from "effect/unstable/sql/SqlError";
import * as Statement from "effect/unstable/sql/Statement";
import { ignoreNativeClose, releaseNativeConnection } from "./DuckDbNative.ts";
import type { DuckDBConnection, DuckDBValue, Json } from "@duckdb/node-api";
import type * as SqlConnection from "effect/unstable/sql/SqlConnection";
import type { DuckDbConnectionOptions, DuckDbParquetExport } from "./DuckDb.models.ts";

const { $DuckdbId } = makeIdentity("duckdb");
const $I = $DuckdbId.create("DuckDbSqlClient.service");
const ATTR_DB_SYSTEM_NAME = "db.system.name";
const noopTransactionSql = "SELECT 1";

/**
 * Runtime type identifier for DuckDB-backed Effect SQL clients.
 *
 * @example
 * ```ts
 * import { DuckDbSqlClientTypeId } from "@beep/duckdb"
 *
 * const hasDuckDbSqlClientMarker = (
 *   value: { readonly [DuckDbSqlClientTypeId]?: DuckDbSqlClientTypeId }
 * ) => value[DuckDbSqlClientTypeId] === DuckDbSqlClientTypeId
 *
 * console.log(hasDuckDbSqlClientMarker({
 *   [DuckDbSqlClientTypeId]: DuckDbSqlClientTypeId
 * })) // true
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export const DuckDbSqlClientTypeId: DuckDbSqlClientTypeId = "~@beep/duckdb/DuckDbSqlClient";

/**
 * Type-level identifier for DuckDB-backed Effect SQL clients.
 *
 * @example
 * ```ts
 * import type { DuckDbSqlClientTypeId } from "@beep/duckdb"
 *
 * const typeId: DuckDbSqlClientTypeId = "~@beep/duckdb/DuckDbSqlClient"
 * console.log(typeId)
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export type DuckDbSqlClientTypeId = "~@beep/duckdb/DuckDbSqlClient";

/**
 * Options for creating a DuckDB-backed Effect SQL client.
 *
 * @example
 * ```ts
 * import type { DuckDbSqlClientOptions } from "@beep/duckdb"
 *
 * const options: DuckDbSqlClientOptions = { databasePath: ":memory:" }
 * console.log(options.databasePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbSqlClientOptions = Pick<DuckDbConnectionOptions, "databaseOptions" | "databasePath"> & {
  readonly databaseOptions?: DuckDbConnectionOptions["databaseOptions"] | undefined;
  readonly databasePath: DuckDbConnectionOptions["databasePath"];
  readonly spanAttributes?: Record<string, unknown> | undefined;
  readonly transformQueryNames?: ((name: string) => string) | undefined;
  readonly transformResultNames?: ((name: string) => string) | undefined;
};

/**
 * DuckDB-backed Effect SQL client value.
 *
 * @example
 * ```ts
 * import type { DuckDbSqlClientValue } from "@beep/duckdb"
 *
 * const readConfig = (client: DuckDbSqlClientValue) => client.config
 * console.log(readConfig)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbSqlClientValue = SqlClient.SqlClient & {
  readonly config: DuckDbSqlClientOptions;
  readonly copyTableToParquet: (request: DuckDbParquetExport) => Effect.Effect<void, SqlError>;
  readonly [DuckDbSqlClientTypeId]: DuckDbSqlClientTypeId;
};

type DuckDbSqlRow = Readonly<Record<string, Json>>;
type DuckDbSqlRows = ReadonlyArray<DuckDbSqlRow>;
type DuckDbRowReader = Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>>;

interface NativeConnection {
  readonly connection: DuckDBConnection;
  readonly instance: DuckDBInstance;
}

const sqlUnknownError = (operation: string, message: string, cause: unknown): SqlError =>
  SqlError.make({ reason: UnknownError.make({ cause, message, operation }) });

const sqlConnectionError = (operation: string, message: string, cause: unknown): SqlError =>
  SqlError.make({ reason: ConnectionError.make({ cause, message, operation }) });

const classifyExecutionError = (operation: string, cause: unknown): SqlError =>
  sqlUnknownError(operation, "DuckDB SQL operation failed.", cause);

const normalizeParameter = Effect.fn("DuckDbSqlClient.normalizeParameter")(
  (value: unknown): Effect.Effect<DuckDBValue, SqlError> =>
    P.isNullish(value)
      ? Effect.succeed(null)
      : P.isString(value) || P.isNumber(value) || P.isBoolean(value) || P.isBigInt(value)
        ? Effect.succeed(value)
        : Effect.fail(sqlUnknownError("bind", "DuckDB SQL parameters must be primitive scalar values.", value))
);

const normalizeParameters = Effect.fn("DuckDbSqlClient.normalizeParameters")(function* (
  parameters: ReadonlyArray<unknown>
) {
  const normalized = yield* Effect.forEach(parameters, normalizeParameter);
  return A.fromIterable(normalized);
});

const copyStatement = (request: DuckDbParquetExport): string =>
  `COPY ${quotedIdentifier(request.tableName)} TO ${quotedString(request.filePath)} (FORMAT parquet)`;

const acquireNativeConnection = Effect.fn("DuckDbSqlClient.acquireNativeConnection")(function* (
  options: DuckDbSqlClientOptions
): Effect.fn.Return<NativeConnection, SqlError> {
  const instance = yield* Effect.tryPromise({
    try: () => DuckDBInstance.create(options.databasePath, options.databaseOptions),
    catch: (cause) => sqlConnectionError("connect", "DuckDbSqlClient: Failed to connect.", cause),
  });
  const connection = yield* Effect.tryPromise({
    try: () => instance.connect(),
    catch: (cause) => {
      ignoreNativeClose(() => instance.closeSync());
      return sqlConnectionError("connect", "DuckDbSqlClient: Failed to connect.", cause);
    },
  });
  return { connection, instance };
});

class DuckDbSqlConnection implements SqlConnection.Connection {
  readonly connection: DuckDBConnection;

  constructor(connection: DuckDBConnection) {
    this.connection = connection;
  }

  private runRows(
    sql: string,
    params: ReadonlyArray<unknown>,
    operation: string
  ): Effect.Effect<DuckDbSqlRows, SqlError> {
    return Effect.map(this.runAndReadAll(sql, params, operation), (reader) => reader.getRowObjectsJson());
  }

  private runValues(
    sql: string,
    params: ReadonlyArray<unknown>,
    operation: string
  ): Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError> {
    return Effect.map(this.runAndReadAll(sql, params, operation), (reader) => reader.getRowsJson());
  }

  private runAndReadAll(
    sql: string,
    params: ReadonlyArray<unknown>,
    operation: string
  ): Effect.Effect<DuckDbRowReader, SqlError> {
    const connection = this.connection;
    return Effect.flatMap(normalizeParameters(params), (duckDbParams) =>
      Effect.uninterruptible(
        Effect.tryPromise({
          try: () => connection.runAndReadAll(sql, duckDbParams),
          catch: (cause) => classifyExecutionError(operation, cause),
        })
      )
    );
  }

  execute(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(rows: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ): Effect.Effect<DuckDbSqlRows, SqlError> {
    const rows = this.runRows(sql, params, "execute");
    return P.isUndefined(transformRows) ? rows : Effect.map(rows, (resultRows) => transformRows(resultRows));
  }

  executeRaw(sql: string, params: ReadonlyArray<unknown>): Effect.Effect<unknown, SqlError> {
    return Effect.flatMap(normalizeParameters(params), (duckDbParams) =>
      Effect.uninterruptible(
        Effect.tryPromise({
          try: () => this.connection.run(sql, duckDbParams),
          catch: (cause) => classifyExecutionError("executeRaw", cause),
        })
      )
    );
  }

  executeStream(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(rows: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ): Stream.Stream<DuckDbSqlRow, SqlError> {
    return Stream.fromArrayEffect(this.execute(sql, params, transformRows));
  }

  executeUnprepared(
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: (<A extends object>(rows: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined
  ): Effect.Effect<DuckDbSqlRows, SqlError> {
    const rows = this.runRows(sql, params, "executeUnprepared");
    return P.isUndefined(transformRows) ? rows : Effect.map(rows, (resultRows) => transformRows(resultRows));
  }

  executeValues(
    sql: string,
    params: ReadonlyArray<unknown>
  ): Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError> {
    return this.runValues(sql, params, "executeValues");
  }

  executeValuesUnprepared(
    sql: string,
    params: ReadonlyArray<unknown>
  ): Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError> {
    return this.runValues(sql, params, "executeValuesUnprepared");
  }
}

const makeClientFromConnection = Effect.fn("DuckDbSqlClient.makeClientFromConnection")(function* (
  options: DuckDbSqlClientOptions,
  nativeConnection: DuckDBConnection
) {
  const compiler = Statement.makeCompilerSqlite(options.transformQueryNames);
  const transformRows = P.isUndefined(options.transformResultNames)
    ? undefined
    : Statement.defaultTransforms(options.transformResultNames).array;
  const spanAttributes: ReadonlyArray<readonly [string, unknown]> = [
    ...(P.isUndefined(options.spanAttributes) ? [] : R.toEntries(options.spanAttributes)),
    [ATTR_DB_SYSTEM_NAME, "duckdb"],
  ];
  const connection = new DuckDbSqlConnection(nativeConnection);
  const semaphore = yield* Semaphore.make(1);
  const scopedAcquirer: SqlConnection.Acquirer = Effect.uninterruptibleMask(
    Effect.fnUntraced(function* (restore) {
      const scope = yield* Scope.Scope;
      yield* restore(semaphore.take(1));
      yield* Scope.addFinalizer(scope, semaphore.release(1));
      return connection;
    })
  );
  const acquirer = scopedAcquirer;
  const transactionAcquirer = scopedAcquirer;

  const sqlClient = yield* SqlClient.make({
    acquirer,
    beginTransaction: "BEGIN",
    commit: "COMMIT",
    compiler,
    rollback: "ROLLBACK",
    rollbackSavepoint: () => noopTransactionSql,
    savepoint: () => noopTransactionSql,
    spanAttributes,
    transactionAcquirer,
    transformRows,
  });
  const copyAcquirer: SqlConnection.Acquirer = Effect.flatMap(
    Effect.serviceOption(sqlClient.transactionService),
    (activeTransaction) =>
      O.match(activeTransaction, {
        onNone: () => acquirer,
        onSome: ([activeConnection]) => Effect.succeed(activeConnection),
      })
  );

  const copyTableToParquet = Effect.fn("DuckDbSqlClient.copyTableToParquet")(
    (request: DuckDbParquetExport): Effect.Effect<void, SqlError> =>
      Effect.scoped(
        Effect.flatMap(copyAcquirer, (connection) => connection.executeRaw(copyStatement(request), []))
      ).pipe(
        Effect.asVoid,
        Effect.withSpan("db.export", {
          attributes: {
            "db.collection.name": request.tableName,
            "db.operation.name": "copy_table_to_parquet",
            [ATTR_DB_SYSTEM_NAME]: "duckdb",
          },
        })
      )
  );

  const client = sqlClient as SqlClient.SqlClient & {
    [DuckDbSqlClientTypeId]: DuckDbSqlClientTypeId;
    config: DuckDbSqlClientOptions;
    copyTableToParquet: (request: DuckDbParquetExport) => Effect.Effect<void, SqlError>;
  };
  client[DuckDbSqlClientTypeId] = DuckDbSqlClientTypeId;
  client.config = options;
  client.copyTableToParquet = copyTableToParquet;

  return client;
});

/**
 * Build a DuckDB-backed Effect SQL client from a caller-owned live connection.
 *
 * @example
 * ```ts
 * import { DuckDbSqlClient } from "@beep/duckdb"
 * import type { DuckDBConnection } from "@duckdb/node-api"
 *
 * const makeClient = (liveConnection: DuckDBConnection) =>
 *   DuckDbSqlClient.fromClient({
 *     databasePath: ":memory:",
 *     liveConnection
 *   })
 *
 * console.log(makeClient)
 * ```
 *
 * @effects
 * Builds SQL client state over the supplied live connection without taking
 * ownership of its close lifecycle.
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromClient = Effect.fn("DuckDbSqlClient.fromClient")(function* (
  options: DuckDbSqlClientOptions & { readonly liveConnection: DuckDBConnection }
): Effect.fn.Return<DuckDbSqlClientValue, SqlError, Reactivity.Reactivity> {
  return yield* makeClientFromConnection(options, options.liveConnection);
});

/**
 * Acquire a managed DuckDB-backed Effect SQL client.
 *
 * @example
 * ```ts
 * import { DuckDbSqlClient } from "@beep/duckdb"
 *
 * const effect = DuckDbSqlClient.make({ databasePath: ":memory:" })
 * console.log(effect)
 * ```
 *
 * @effects
 * Opens a native DuckDB instance and connection, then registers scope
 * finalizers that close both resources.
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn("DuckDbSqlClient.make")(function* (
  options: DuckDbSqlClientOptions
): Effect.fn.Return<DuckDbSqlClientValue, SqlError, Scope.Scope | Reactivity.Reactivity> {
  const native = yield* Effect.acquireRelease(acquireNativeConnection(options), releaseNativeConnection);
  return yield* makeClientFromConnection(options, native.connection);
});

/**
 * Build a Layer that provides both the DuckDB-specific client and generic SQL client.
 *
 * @example
 * ```ts
 * import { DuckDbSqlClient } from "@beep/duckdb"
 *
 * const layer = DuckDbSqlClient.makeLayer({ databasePath: ":memory:" })
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeLayer = (
  options: DuckDbSqlClientOptions
): Layer.Layer<DuckDbSqlClient | SqlClient.SqlClient, SqlError> =>
  Layer.effectContext(
    Effect.map(make(options), (client) =>
      Context.make(DuckDbSqlClient, client).pipe(Context.add(SqlClient.SqlClient, client))
    )
  ).pipe(Layer.provide(Reactivity.layer));

/**
 * Service key for DuckDB-backed Effect SQL clients.
 *
 * @example
 * ```ts
 * import { DuckDbSqlClient } from "@beep/duckdb"
 *
 * const service = DuckDbSqlClient
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DuckDbSqlClient extends Context.Service<DuckDbSqlClient, DuckDbSqlClientValue>()($I`DuckDbSqlClient`) {
  /**
   * Build a DuckDB-backed Effect SQL client from a caller-owned live connection.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromClient = fromClient;

  /**
   * Acquire a managed DuckDB-backed Effect SQL client.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = make;

  /**
   * Build a Layer that provides both the DuckDB-specific client and generic SQL client.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = makeLayer;
}
