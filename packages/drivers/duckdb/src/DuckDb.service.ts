/**
 * Product-neutral DuckDB execution service and native Node API layer builders.
 *
 * **Details**
 *
 * The service boundary exposes SQL execution, read queries, transactions, and
 * table-to-Parquet export without leaking `@duckdb/node-api` connection types
 * into domain packages. The native implementation uses a shared connection and
 * serializes access so in-memory databases preserve state across operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import { quotedIdentifier, quotedString } from "@duckdb/node-api";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import { isSqlError } from "effect/sql/SqlError";
import { DuckDbError } from "./DuckDb.errors.ts";
import { DuckDbRows } from "./DuckDb.models.ts";
import { NativeGate } from "./internal/gate.ts";
import { ignoreNativeClose, openLegacyInstance, releaseNativeConnection } from "./internal/native.ts";
import { ABORT_PROBE_SQL, isAbortedTransactionError } from "./internal/transaction.ts";
import type { DuckDBConnection, DuckDBInstance, DuckDBValue } from "@duckdb/node-api";
import type { DuckDbOperation } from "./DuckDb.errors.ts";
import type { DuckDbConnectionOptions, DuckDbParquetExport } from "./DuckDb.models.ts";

const decodeDuckDbRows = S.decodeEffect(DuckDbRows);

const $I = $DuckdbId.create("DuckDb.service");

/**
 * Positional or named parameters accepted by DuckDB statements.
 *
 * **Example** (Positional and named parameters)
 *
 * ```ts
 * import type { DuckDbQueryParameters } from "@beep/duckdb"
 *
 * const positional = ["run-1", 42] satisfies DuckDbQueryParameters
 * const named = { id: "run-1", value: 42 } satisfies DuckDbQueryParameters
 *
 * console.log([positional.length, named.id]) // [2, "run-1"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbQueryParameters = Array<DuckDBValue> | Record<string, DuckDBValue>;

/**
 * Adapter contract accepted by {@link DuckDb.makeLayer}.
 *
 * **Details**
 *
 * Use this interface when a test, host application, or alternate runtime wants
 * to provide DuckDB behavior without depending on the native Node API
 * implementation exported by this package. Implementations should normalize
 * recoverable failures into {@link DuckDbError}.
 *
 * **Example** (Stub client for tests)
 *
 * ```ts
 * import type { DuckDbAdapter, DuckDbRows } from "@beep/duckdb"
 * import * as Effect from "effect/Effect";
 * const client: DuckDbAdapter = {
 *   copyTableToParquet: () => Effect.void,
 *   query: (statement) => Effect.succeed([{ statement }] satisfies DuckDbRows),
 *   run: () => Effect.void,
 *   runMany: () => Effect.void,
 *   withTransaction: (use) => use(client)
 * }
 *
 * const program = Effect.gen(function* () {
 *   yield* client.runMany(["create table events (id varchar)"])
 *   return yield* client.query("select 1")
 * })
 *
 * Effect.runPromise(program).then((rows) => console.log(rows[0]?.statement)) // "select 1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface DuckDbAdapter {
  /**
   * Export a table through DuckDB's Parquet writer.
   *
   * **Gotchas**
   *
   * Native implementations reject calls made from a transaction-scoped client
   * because DuckDB writes the Parquet file outside the database transaction and
   * cannot roll that filesystem side effect back.
   *
   * @effects
   * Requests DuckDB to write a Parquet file at `request.filePath`.
   * @since 0.0.0
   */
  readonly copyTableToParquet: (request: DuckDbParquetExport) => Effect.Effect<void, DuckDbError>;
  /**
   * Run a SQL statement that returns JSON-compatible rows.
   *
   * @since 0.0.0
   */
  readonly query: (
    statement: string,
    parameters?: DuckDbQueryParameters | undefined
  ) => Effect.Effect<DuckDbRows, DuckDbError>;
  /**
   * Run a SQL statement for its side effects.
   *
   * @effects
   * Executes the supplied SQL against the backing DuckDB connection; mutation
   * semantics come from the statement itself.
   *
   * @since 0.0.0
   */
  readonly run: (statement: string, parameters?: DuckDbQueryParameters | undefined) => Effect.Effect<void, DuckDbError>;
  /**
   * Run statements in input order, stopping at the first failure.
   *
   * @effects
   * Applies each statement to the backing DuckDB connection sequentially.
   *
   * @since 0.0.0
   */
  readonly runMany: (statements: ReadonlyArray<string>) => Effect.Effect<void, DuckDbError>;
  /**
   * Execute work inside a DuckDB transaction.
   *
   * **Details**
   *
   * Native implementations begin a transaction for the outer call, commit on
   * success, and roll back on failure. Calls made on an already transactional
   * client reuse the active transaction client instead of opening a nested
   * DuckDB transaction.
   *
   * **Gotchas**
   *
   * When a statement failed inside the transaction, even one whose failure
   * `use` swallowed, native implementations probe the transaction before
   * `COMMIT`. If DuckDB already aborted it, they roll back and fail with
   * {@link DuckDbError} instead of letting `COMMIT` discard the work silently.
   *
   * @effects
   * Mutates transaction state on the backing connection with `BEGIN`,
   * `COMMIT`, or `ROLLBACK`.
   * @since 0.0.0
   */
  readonly withTransaction: <A, R>(
    use: (transaction: DuckDbAdapter) => Effect.Effect<A, DuckDbError, R>
  ) => Effect.Effect<A, DuckDbError, R>;
}

/**
 * Runtime shape exposed by the {@link DuckDb} service tag.
 *
 * **Details**
 *
 * Application code depends on this service shape rather than on native
 * `@duckdb/node-api` connection objects. The shape mirrors {@link DuckDbAdapter}
 * so production layers, host adapters, and tests can share the same boundary.
 *
 * **Example** (Service shape stub)
 *
 * ```ts
 * import type { DuckDbRows, DuckDbShape } from "@beep/duckdb"
 * import * as Effect from "effect/Effect";
 * const service: DuckDbShape = {
 *   copyTableToParquet: () => Effect.void,
 *   query: () => Effect.succeed([{ count: 1 }] satisfies DuckDbRows),
 *   run: () => Effect.void,
 *   runMany: () => Effect.void,
 *   withTransaction: (use) => use(service)
 * }
 *
 * Effect.runPromise(service.query("select count(*) as count")).then((rows) =>
 *   console.log(rows[0]?.count)
 * ) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DuckDbShape extends DuckDbAdapter {}

interface NativeConnection {
  readonly connection: DuckDBConnection;
  readonly gate: NativeGate;
  readonly instance: DuckDBInstance;
}

type NativeUse<A, R = never> = (native: NativeConnection) => Effect.Effect<A, DuckDbError, R>;

const ABORTED_TRANSACTION_MESSAGE =
  "DuckDB aborted this transaction after an earlier statement failed; COMMIT refused because DuckDB would roll it back silently";

// The native DuckDB diagnostic of a classified failure, so legacy
// `DuckDbError.message` names the real problem instead of the generic default.
const nativeFailureMessage = (cause: unknown): O.Option<string> =>
  O.liftPredicate(cause, isSqlError).pipe(
    O.map((error) => error.reason.cause),
    O.filter(P.hasProperty("message")),
    O.map((native) => native.message),
    O.filter(P.isString)
  );

const connectionFailure =
  (
    operation: DuckDbOperation,
    options: DuckDbConnectionOptions,
    statement?: string | undefined,
    message?: string | undefined
  ) =>
  (cause: unknown): DuckDbError =>
    DuckDbError.fromUnknown(operation, cause, {
      databasePath: options.databasePath,
      ...O.getSomesStruct({
        message: O.orElse(O.fromUndefinedOr(message), () => nativeFailureMessage(cause)),
        statement: O.fromUndefinedOr(statement),
      }),
    });

const runOnConnection = Effect.fn("DuckDb.runOnConnection")(
  (
    operation: DuckDbOperation,
    options: DuckDbConnectionOptions,
    native: NativeConnection,
    statement: string,
    parameters?: DuckDbQueryParameters | undefined
  ): Effect.Effect<void, DuckDbError> =>
    native.gate
      .run(operation, () =>
        native.connection.run(statement, parameters).then((result) => ignoreNativeClose(() => result.closeSync()))
      )
      .pipe(Effect.mapError(connectionFailure(operation, options, statement)), Effect.asVoid)
);

const queryOnConnection = Effect.fn("DuckDb.queryOnConnection")(function* (
  options: DuckDbConnectionOptions,
  native: NativeConnection,
  statement: string,
  parameters?: DuckDbQueryParameters | undefined
) {
  const rows = yield* native.gate
    .run("query", () =>
      native.connection.runAndReadAll(statement, parameters).then((reader) => {
        try {
          return reader.getRowObjectsJson();
        } finally {
          ignoreNativeClose(() => reader.closeSync());
        }
      })
    )
    .pipe(Effect.mapError(connectionFailure("query", options, statement)));
  return yield* decodeDuckDbRows(rows).pipe(
    Effect.mapError((cause) =>
      DuckDbError.fromUnknown("query", cause, {
        databasePath: options.databasePath,
        message: "DuckDB query returned a non-JSON-compatible row shape.",
        statement,
      })
    )
  );
});

const probeAborted = Effect.fn("DuckDb.probeAborted")(
  (options: DuckDbConnectionOptions, native: NativeConnection): Effect.Effect<boolean, DuckDbError> =>
    native.gate
      .run("withTransaction", () =>
        native.connection.run(ABORT_PROBE_SQL).then((result) => ignoreNativeClose(() => result.closeSync()))
      )
      .pipe(
        Effect.as(false),
        Effect.catchIf(isAbortedTransactionError, () => Effect.succeed(true)),
        Effect.mapError(connectionFailure("withTransaction", options, ABORT_PROBE_SQL))
      )
);

const acquireSharedConnection = (options: DuckDbConnectionOptions) => {
  let nativePromise: Promise<NativeConnection> | undefined;

  return Effect.fn("DuckDb.acquireSharedConnection")(
    (operation: DuckDbOperation): Effect.Effect<NativeConnection, DuckDbError> =>
      Effect.tryPromise({
        try: () => {
          nativePromise ??= openLegacyInstance({
            databasePath: options.databasePath,
            databaseOptions: options.databaseOptions,
          })
            .then((instance) =>
              instance.connect().then(
                (connection) => ({ connection, gate: new NativeGate(connection), instance }),
                (cause) => {
                  ignoreNativeClose(() => instance.closeSync());
                  throw cause;
                }
              )
            )
            .catch((cause) => {
              nativePromise = undefined;
              throw cause;
            });
          return nativePromise;
        },
        catch: connectionFailure(operation, options, undefined, "Failed to open DuckDB connection."),
      })
  );
};

const acquireScopedSharedConnection = (options: DuckDbConnectionOptions, scope: Scope.Scope) => {
  const getConnection = acquireSharedConnection(options);
  let finalizerRegistered = false;

  return Effect.fn("DuckDb.acquireScopedSharedConnection")(function* (operation: DuckDbOperation) {
    return yield* Effect.uninterruptible(
      Effect.gen(function* () {
        const native = yield* getConnection(operation);
        if (!finalizerRegistered) {
          finalizerRegistered = true;
          // Close under the op lock so a statement still running at teardown
          // settles first; closing mid-statement leaves its promise pending.
          // The closed gate then refuses statements queued behind teardown.
          yield* Scope.addFinalizer(scope, native.gate.close(releaseNativeConnection(native)));
        }
        return native;
      })
    );
  });
};

const copyStatement = (request: DuckDbParquetExport): string =>
  `COPY ${quotedIdentifier(request.tableName)} TO ${quotedString(request.filePath)} (FORMAT parquet)`;

const makeConnectionClient = (
  options: DuckDbConnectionOptions,
  useConnection: <A, R>(operation: DuckDbOperation, use: NativeUse<A, R>) => Effect.Effect<A, DuckDbError, R>,
  transactionScoped = false
): DuckDbAdapter => {
  const run = Effect.fn("DuckDb.run")(
    (statement: string, parameters?: DuckDbQueryParameters | undefined): Effect.Effect<void, DuckDbError> =>
      useConnection("run", (native) => runOnConnection("run", options, native, statement, parameters)).pipe(
        Effect.withSpan("db.query", {
          attributes: {
            "db.operation": "run",
            "db.system": "duckdb",
          },
        })
      )
  );

  const query = Effect.fn("DuckDb.query")(
    (statement: string, parameters?: DuckDbQueryParameters | undefined): Effect.Effect<DuckDbRows, DuckDbError> =>
      useConnection("query", (native) => queryOnConnection(options, native, statement, parameters)).pipe(
        Effect.withSpan("db.query", {
          attributes: {
            "db.operation": "query",
            "db.system": "duckdb",
          },
        })
      )
  );

  const runMany = Effect.fn("DuckDb.runMany")(
    (statements: ReadonlyArray<string>): Effect.Effect<void, DuckDbError> =>
      Effect.forEach(statements, (statement) => run(statement), { discard: true }).pipe(
        Effect.withSpan("db.query", {
          attributes: {
            "db.operation": "run_many",
            "db.statement_count": A.length(statements),
            "db.system": "duckdb",
          },
        })
      )
  );

  const copyTableToParquet = Effect.fn("DuckDb.copyTableToParquet")(
    (request: DuckDbParquetExport): Effect.Effect<void, DuckDbError> =>
      (transactionScoped
        ? Effect.fail(
            DuckDbError.make({
              databasePath: O.some(options.databasePath),
              message:
                "DuckDB Parquet export cannot run inside an active transaction because filesystem writes are not rolled back with database changes.",
              operation: "copyTableToParquet",
              statement: O.some(copyStatement(request)),
            })
          )
        : run(copyStatement(request))
      ).pipe(
        Effect.withSpan("db.export", {
          attributes: {
            "db.operation": "copy_table_to_parquet",
            "db.system": "duckdb",
            "db.table": request.tableName,
          },
        })
      )
  );
  let client: DuckDbAdapter;
  const withTransaction = Effect.fn("DuckDb.withTransaction")(function* <A, R>(
    use: (transaction: DuckDbAdapter) => Effect.Effect<A, DuckDbError, R>
  ): Effect.fn.Return<A, DuckDbError, R> {
    return yield* transactionScoped
      ? use(client)
      : useConnection(
          "withTransaction",
          Effect.fn("DuckDb.withTransactionOnConnection")((native: NativeConnection) => {
            let failed = O.none<DuckDbError>();
            const transaction = makeConnectionClient(
              options,
              Effect.fn("DuckDb.useTransactionConnection")(function* <A, R>(
                operation: DuckDbOperation,
                useNative: NativeUse<A, R>
              ): Effect.fn.Return<A, DuckDbError, R> {
                // An interrupted statement is recorded as well: the gate sends
                // DuckDB an INTERRUPT, which aborts the open transaction, and a
                // caller that swallows the interruption (timeoutOption, race)
                // would otherwise reach a COMMIT that DuckDB silently rolls back.
                return yield* useNative(native).pipe(
                  Effect.tapError((error) =>
                    Effect.sync(() => {
                      failed = O.orElse(failed, () => O.some(error));
                    })
                  ),
                  Effect.onInterrupt(() =>
                    Effect.sync(() => {
                      failed = O.orElse(failed, () =>
                        O.some(
                          DuckDbError.make({
                            databasePath: O.some(options.databasePath),
                            message: "DuckDB statement interrupted inside a transaction",
                            operation,
                          })
                        )
                      );
                    })
                  )
                );
              }),
              true
            );
            return Effect.suspend(() => {
              let began = false;
              let closed = false;
              const rollbackIfOpen = Effect.suspend(() =>
                began && !closed
                  ? runOnConnection("withTransaction", options, native, "ROLLBACK").pipe(Effect.ignore)
                  : Effect.void
              );
              return Effect.uninterruptibleMask((restore) =>
                Effect.gen(function* () {
                  yield* runOnConnection("withTransaction", options, native, "BEGIN TRANSACTION");
                  began = true;
                  const exit = yield* Effect.exit(restore(use(transaction)));
                  if (Exit.isSuccess(exit)) {
                    if (O.isSome(failed) && (yield* probeAborted(options, native))) {
                      yield* runOnConnection("withTransaction", options, native, "ROLLBACK").pipe(Effect.ignore);
                      closed = true;
                      return yield* DuckDbError.make({
                        cause: failed,
                        databasePath: O.some(options.databasePath),
                        message: ABORTED_TRANSACTION_MESSAGE,
                        operation: "withTransaction",
                      });
                    }
                    yield* runOnConnection("withTransaction", options, native, "COMMIT");
                    closed = true;
                    return exit.value;
                  }

                  yield* runOnConnection("withTransaction", options, native, "ROLLBACK").pipe(Effect.ignore);
                  closed = true;
                  return yield* Effect.failCause(exit.cause);
                }).pipe(Effect.ensuring(rollbackIfOpen))
              );
            });
          })
        ).pipe(
          Effect.withSpan("db.transaction", {
            attributes: {
              "db.system": "duckdb",
            },
          })
        );
  });

  client = {
    copyTableToParquet,
    query,
    run,
    runMany,
    withTransaction,
  };
  return client;
};

const makeNodeLayer = (options: DuckDbConnectionOptions): Layer.Layer<DuckDb> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const getConnection = acquireScopedSharedConnection(options, scope);
      const connectionLock = yield* Semaphore.make(1);
      const useLayerConnection = Effect.fn("DuckDb.useLayerConnection")(function* <A, R>(
        operation: DuckDbOperation,
        useNative: NativeUse<A, R>
      ): Effect.fn.Return<A, DuckDbError, R> {
        return yield* connectionLock.withPermit(
          Effect.gen(function* () {
            return yield* useNative(yield* getConnection(operation));
          })
        );
      });
      return Context.make(DuckDb, DuckDb.of(makeConnectionClient(options, useLayerConnection)));
    })
  );

/**
 * Effect service for product-neutral DuckDB execution.
 *
 * **Details**
 *
 * Yield this service from Effect programs that need DuckDB execution. Use
 * {@link DuckDb.makeNodeLayer} for managed native connection lifetime, or
 * {@link DuckDb.makeLayer} when tests or host code provide a compatible
 * adapter.
 *
 * **Example** (Provide adapter via layer)
 *
 * ```ts
 * import { DuckDb, type DuckDbAdapter, type DuckDbRows } from "@beep/duckdb"
 * import * as Effect from "effect/Effect";
 * const client: DuckDbAdapter = {
 *   copyTableToParquet: () => Effect.void,
 *   query: () => Effect.succeed([{ ok: true }] satisfies DuckDbRows),
 *   run: () => Effect.void,
 *   runMany: () => Effect.void,
 *   withTransaction: (use) => use(client)
 * }
 *
 * const program = Effect.gen(function* () {
 *   const duckdb = yield* DuckDb
 *   return yield* duckdb.query("select true as ok")
 * }).pipe(Effect.provide(DuckDb.makeLayer(client)))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows[0]?.ok)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DuckDb extends Context.Service<DuckDb, DuckDbShape>()($I`DuckDb`) {
  /**
   * Build a Layer from a narrow product-neutral DuckDB adapter.
   *
   * **Details**
   *
   * This constructor does not acquire a native DuckDB connection. It only
   * installs the supplied adapter under the {@link DuckDb} service key, which
   * is useful for tests and host-owned database runtimes.
   *
   * **Example** (Layer from adapter client)
   *
   * ```ts
   * import { DuckDb, type DuckDbAdapter, type DuckDbRows } from "@beep/duckdb"
   * import * as Effect from "effect/Effect";
   * const client: DuckDbAdapter = {
   *   copyTableToParquet: () => Effect.void,
   *   query: () => Effect.succeed([{ id: "run-1" }] satisfies DuckDbRows),
   *   run: () => Effect.void,
   *   runMany: () => Effect.void,
   *   withTransaction: (use) => use(client)
   * }
   *
   * const program = Effect.gen(function* () {
   *   const duckdb = yield* DuckDb
   *   return yield* duckdb.query("select 'run-1' as id")
   * }).pipe(Effect.provide(DuckDb.makeLayer(client)))
   *
   * Effect.runPromise(program).then((rows) => console.log(rows[0]?.id)) // "run-1"
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (client: DuckDbAdapter): Layer.Layer<DuckDb> => Layer.succeed(DuckDb, DuckDb.of(client));

  /**
   * Build the native DuckDB Node API service layer.
   *
   * **Details**
   *
   * The layer registers a scope finalizer that closes both the shared
   * connection and DuckDB instance. Use this constructor for application code
   * that wants native resources tied to an Effect scope.
   *
   * **Example** (Scoped native service layer)
   *
   * ```ts
   * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
   * import * as Effect from "effect/Effect";
   * const layer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({
   *   databasePath: ":memory:"
   * }))
   *
   * const program = Effect.gen(function* () {
   *   const duckdb = yield* DuckDb
   *   yield* duckdb.run("create table events (id varchar)")
   *   return yield* duckdb.query("select count(*) as count from events")
   * }).pipe(Effect.provide(layer))
   *
   * Effect.runPromise(program).then((rows) => console.log(rows.length)) // 1
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeNodeLayer = makeNodeLayer;
}
