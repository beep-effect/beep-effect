/**
 * Effect SQL client implementation backed by DuckDB's native Node API.
 *
 * **Gotchas**
 *
 * This module adapts `@duckdb/node-api` to the generic Effect SQL
 * `SqlClient.SqlClient` service. The v1 compiler intentionally uses Effect
 * SQL's SQLite compiler because DuckDB accepts positional `?` placeholders and
 * double-quoted identifiers, while Effect's dialect union does not yet include
 * DuckDB. DuckDB-specific capabilities such as Parquet export remain on this
 * driver-specific client and are not added to the generic SQL tag.
 *
 * Nested `sql.withTransaction(...)` calls reuse the active DuckDB transaction.
 * DuckDB rejects `SAVEPOINT` in the native Node API path used by this package,
 * so a failed nested transaction marks the outer transaction rollback-only
 * instead of pretending savepoint isolation exists.
 *
 * `copyTableToParquet` is intentionally rejected inside active transactions
 * because DuckDB writes the Parquet file outside the database transaction and
 * cannot roll that filesystem side effect back.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { blobValue, DuckDBInstance, quotedIdentifier, quotedString, timestampMillisValue } from "@duckdb/node-api";
import { Clock, Context, Effect, Exit, Layer, Scope, Semaphore, Stream, Tracer } from "effect";
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

const $I = $DuckdbId.create("DuckDbSqlClient.service");
const ATTR_DB_SYSTEM_NAME = "db.system.name";

/**
 * Runtime type identifier for DuckDB-backed Effect SQL clients.
 *
 * **Example** (Checking type id marker)
 *
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
 * **Example** (Assigning type-level identifier)
 *
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
 * **Example** (In-memory database options)
 *
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
 * **Example** (Reading client config)
 *
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
type DuckDbTransactionAcquirer = Effect.Effect<readonly [Scope.Closeable | undefined, DuckDbSqlConnection], SqlError>;

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

const transactionalParquetExportError = (): SqlError =>
  sqlUnknownError(
    "copyTableToParquet",
    "DuckDB Parquet export cannot run inside an active transaction because filesystem writes are not rolled back with database changes.",
    "active transaction"
  );

const toBlobValue = (value: Int8Array | Uint8Array): DuckDBValue =>
  blobValue(value instanceof Uint8Array ? value : new Uint8Array(value.buffer, value.byteOffset, value.byteLength));

const normalizeParameter = Effect.fn("DuckDbSqlClient.normalizeParameter")(
  (value: unknown): Effect.Effect<DuckDBValue, SqlError> =>
    P.isNullish(value)
      ? Effect.succeed(null)
      : P.isDate(value)
        ? Effect.succeed(timestampMillisValue(BigInt(value.getTime())))
        : P.isUint8Array(value) || value instanceof Int8Array
          ? Effect.succeed(toBlobValue(value))
          : Effect.succeed(value as DuckDBValue)
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
  private rollbackOnly = false;

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

  beginTransaction(): Effect.Effect<void, SqlError> {
    this.rollbackOnly = false;
    return Effect.asVoid(this.executeUnprepared("BEGIN", [], undefined));
  }

  commitTransaction(): Effect.Effect<void, SqlError> {
    return commitDuckDbTransaction(this);
  }

  isRollbackOnly(): boolean {
    return this.rollbackOnly;
  }

  markRollbackOnly(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rollbackOnly = true;
    });
  }

  rollbackTransaction(): Effect.Effect<void, SqlError> {
    this.rollbackOnly = false;
    return Effect.asVoid(this.executeUnprepared("ROLLBACK", [], undefined));
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
    const connection = this.connection;
    const stream = Effect.flatMap(normalizeParameters(params), (duckDbParams) =>
      Effect.tryPromise({
        try: () => connection.stream(sql, duckDbParams),
        catch: (cause) => classifyExecutionError("executeStream", cause),
      })
    );

    return Stream.unwrap(
      Effect.map(stream, (result) =>
        Stream.fromAsyncIterable(result.yieldRowObjectJson(), (cause) =>
          classifyExecutionError("executeStream", cause)
        ).pipe(
          Stream.map((rows) => (P.isUndefined(transformRows) ? rows : transformRows(rows))),
          Stream.flattenIterable
        )
      )
    );
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

const commitDuckDbTransaction = Effect.fn("DuckDbSqlConnection.commitTransaction")(function* (
  connection: DuckDbSqlConnection
) {
  if (connection.isRollbackOnly()) {
    yield* connection.rollbackTransaction();
    return yield* sqlUnknownError(
      "commit",
      "DuckDB transaction rolled back because a nested transaction failed and savepoints are unavailable.",
      "nested transaction failed"
    );
  }
  yield* connection.executeUnprepared("COMMIT", [], undefined);
});

const makeDuckDbWithTransaction =
  (options: {
    readonly transactionService: DuckDbSqlClientValue["transactionService"];
    readonly spanAttributes: ReadonlyArray<readonly [string, unknown]>;
    readonly acquireConnection: DuckDbTransactionAcquirer;
  }): DuckDbSqlClientValue["withTransaction"] =>
  <R, E, A>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | SqlError, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.useSpan("sql.transaction", { kind: "client" }, (span) =>
        Effect.withFiber<A, E | SqlError, R>((fiber) => {
          for (const [key, value] of options.spanAttributes) {
            span.attribute(key, value);
          }
          const services = fiber.context;
          const clock = fiber.getRef(Clock.Clock);
          const activeTransaction = Context.getOption(services, options.transactionService);
          const activeConnection =
            activeTransaction._tag === "Some"
              ? Effect.succeed([undefined, activeTransaction.value[0] as DuckDbSqlConnection] as const)
              : options.acquireConnection;
          const id = activeTransaction._tag === "Some" ? activeTransaction.value[1] + 1 : 0;

          return Effect.flatMap(activeConnection, ([scope, connection]) =>
            (id === 0 ? connection.beginTransaction() : Effect.void).pipe(
              Effect.flatMap(() =>
                Effect.provideContext(
                  restore(effect),
                  services.pipe(
                    Context.add(options.transactionService, [connection, id]),
                    Context.add(Tracer.ParentSpan, span)
                  )
                )
              ),
              Effect.exit,
              Effect.flatMap((exit) => {
                let finalize: Effect.Effect<void, SqlError>;
                if (Exit.isSuccess(exit)) {
                  if (id === 0) {
                    span.event("db.transaction.commit", clock.currentTimeNanosUnsafe());
                    finalize = connection.commitTransaction();
                  } else {
                    span.event("db.transaction.nested", clock.currentTimeNanosUnsafe());
                    finalize = Effect.void;
                  }
                } else {
                  span.event("db.transaction.rollback", clock.currentTimeNanosUnsafe());
                  finalize = id > 0 ? connection.markRollbackOnly() : connection.rollbackTransaction();
                }
                const finalizeWithScope =
                  scope === undefined ? finalize : Effect.ensuring(finalize, Scope.close(scope, exit));
                return Effect.flatMap(finalizeWithScope, () => exit);
              })
            )
          );
        })
      )
    );

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
  const duckDbTransactionAcquirer: DuckDbTransactionAcquirer = Effect.flatMap(Scope.make(), (scope) =>
    Effect.map(
      Scope.provide(transactionAcquirer, scope),
      (connection) => [scope, connection as DuckDbSqlConnection] as const
    )
  );

  const sqlClient = yield* SqlClient.make({
    acquirer,
    compiler,
    spanAttributes,
    transactionAcquirer,
    transformRows,
  });
  const withTransaction = makeDuckDbWithTransaction({
    acquireConnection: duckDbTransactionAcquirer,
    spanAttributes,
    transactionService: sqlClient.transactionService,
  });
  const copyAcquirer: SqlConnection.Acquirer = Effect.flatMap(
    Effect.serviceOption(sqlClient.transactionService),
    (activeTransaction) =>
      O.match(activeTransaction, {
        onNone: () => acquirer,
        onSome: () => Effect.fail(transactionalParquetExportError()),
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

  const client = sqlClient as unknown as SqlClient.SqlClient & {
    [DuckDbSqlClientTypeId]: DuckDbSqlClientTypeId;
    config: DuckDbSqlClientOptions;
    copyTableToParquet: (request: DuckDbParquetExport) => Effect.Effect<void, SqlError>;
  };
  client[DuckDbSqlClientTypeId] = DuckDbSqlClientTypeId;
  client.config = options;
  client.copyTableToParquet = copyTableToParquet;
  (client as unknown as { withTransaction: DuckDbSqlClientValue["withTransaction"] }).withTransaction = withTransaction;

  return client;
});

/**
 * Build a DuckDB-backed Effect SQL client from a caller-owned live connection.
 *
 * **Example** (Client from live connection)
 *
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
 * **Example** (Managed in-memory client)
 *
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
 * **Example** (Layer for in-memory client)
 *
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
 * **Example** (Service key reference)
 *
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
