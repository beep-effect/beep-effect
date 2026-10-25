/**
 * `effect/sql` connection over one native DuckDB connection.
 *
 * **Details**
 *
 * Every native call runs under the connection's {@link NativeGate} op lock and
 * is cancelled settle-aware. Statements on the prepared path go through a
 * per-connection `ScopedCache` of prepared statements whose bindings are
 * cleared before every bind; `USE` and `SET`/`RESET schema|search_path`
 * invalidate that cache. The connection tracks the DuckDB transaction phase,
 * emulates the `SAVEPOINT` pair `SqlClient.make` generates for nested
 * transactions, and guards every `COMMIT` (the one `withTransaction` issues and
 * raw `COMMIT`/`END` text sent inside a transaction) so it is refused when
 * DuckDB already aborted the transaction or it lost a nested rollback.
 * Multi-statement text that contains transaction control is refused before
 * it reaches DuckDB (D59).
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { ResultReturnType } from "@duckdb/node-api";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as ScopedCache from "effect/ScopedCache";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { AuthorizationError, SqlError } from "effect/sql/SqlError";
import { toSqlError } from "./classify.ts";
import { converterFor } from "./convert.ts";
import { NativeGate } from "./gate.ts";
import { ignoreNative } from "./native.ts";
import { bindTypes, normalizeParameters } from "./parameters.ts";
import {
  ABORT_PROBE_SQL,
  afterFailure,
  afterInterrupt,
  afterSuccess,
  CommitDecision,
  classifyControl,
  decideCommit,
  isAbortedTransactionError,
  refusedCommit,
  refusedMultiStatementControl,
  splitStatements,
  TransactionPhase,
} from "./transaction.ts";
import type {
  DuckDBConnection,
  DuckDBPreparedStatement,
  DuckDBResult,
  DuckDBValue,
  DuckDBValueConverter,
} from "@duckdb/node-api";
import type * as SqlConnection from "effect/sql/SqlConnection";
import type { DuckDbAppendRows } from "../DuckDb.models.ts";

const $I = $DuckdbId.create("internal/connection");
class SessionSnapshot extends S.Opaque<SessionSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    database: S.String,
    searchPath: S.String,
    timeZone: S.String,
    calendar: S.String,
  }).pipe($I.annoteSchema("SessionSnapshot", { description: "Resolved writer session settings mirrored to readers." }))
) {}
const decodeSessionSnapshot = S.decodeUnknownEffect(SessionSnapshot);
const decodeSessionSchemas = S.decodeUnknownEffect(S.Array(S.Struct({ catalog: S.String, schema: S.String })));
const SESSION_QUERY =
  "SELECT current_database() AS database, current_setting('search_path') AS searchPath, current_setting('TimeZone') AS timeZone, current_setting('Calendar') AS calendar";

// DuckDB retains dangling qualified entries after DROP SCHEMA. Tokenize only
// outside quoted identifiers, retaining each surviving entry verbatim.
const searchPathEntries = (path: string): ReadonlyArray<string> =>
  pipe(
    path,
    Str.matchAll(/(?:"(?:[^"]|"")*"|[^,])+/g),
    A.fromIterable,
    A.map((match) => match[0])
  );
const searchPathIdentifiers = (entry: string): ReadonlyArray<string> =>
  pipe(
    entry,
    Str.matchAll(/"(?:[^"]|"")*"|[^.]+/g),
    A.fromIterable,
    A.map((match) =>
      pipe(
        match[0],
        (part) => (Str.startsWith('"')(part) ? pipe(part, Str.slice(1, -1), Str.replaceAll('""', '"')) : part),
        Str.toLowerCase
      )
    )
  );
const changesSession = (sql: string): boolean =>
  A.some(splitStatements(sql), (text) => /^\s*(?:USE|SET|RESET|PRAGMA)\b/i.test(text));

const changesWriterSession = (sql: string): boolean =>
  changesSession(sql) ||
  A.some(splitStatements(sql), (text) =>
    /^\s*(?:(?:CREATE(?:\s+OR\s+REPLACE)?|DROP)\s+SCHEMA|ATTACH|DETACH)\b/i.test(text)
  );

const readerStreamRefusal = (
  reader: boolean,
  sql: string,
  control: ReturnType<typeof classifyControl>
): O.Option<SqlError> => {
  if (!reader) return O.none();
  return changesSession(sql) || (control !== "statement" && control !== "catalogContext")
    ? O.some(
        SqlError.make({
          reason: AuthorizationError.make({
            cause: sql,
            message: "Reader streams cannot change session settings or transaction control",
            operation: "executeStream",
          }),
        })
      )
    : O.none();
};

const ConnectionTypeId = "~@beep/duckdb/internal/connection";

const RUN_DIRECT_PATTERN =
  /^Invalid Input Error: (?:Cannot prepare multiple statements at once|No statement to prepare)/;

const CONTROL_OPERATIONS: Readonly<Record<string, string>> = {
  begin: "beginTransaction",
  commit: "commitTransaction",
  rollback: "rollbackTransaction",
};

type Row = Record<string, unknown>;

type RowsTransform = (<A extends object>(rows: ReadonlyArray<A>) => ReadonlyArray<A>) | undefined;

type Reader<A> = (result: DuckDBResult, converter: DuckDBValueConverter<unknown>) => Promise<A>;

type CachedStatement = Data.TaggedEnum<{
  Prepared: { readonly statement: DuckDBPreparedStatement };
  RunDirect: {};
}>;

const CachedStatement = Data.taggedEnum<CachedStatement>();

/**
 * Native driver connection contract shared by the extras.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type DuckDbConnection = SqlConnection.Connection & {
  readonly [ConnectionTypeId]: typeof ConnectionTypeId;
  readonly native: DuckDBConnection;
  readonly gate: NativeGate;
  readonly isTransaction: () => boolean;
  readonly commit: Effect.Effect<void, SqlError>;
  readonly appendRows: (request: typeof DuckDbAppendRows.Encoded) => Effect.Effect<void, SqlError>;
  readonly sessionSnapshot: Effect.Effect<SessionSnapshot, SqlError>;
  readonly normalizeSessionSnapshot: (snapshot: SessionSnapshot) => Effect.Effect<SessionSnapshot, SqlError>;
  readonly runDriverStatement: (sql: string, operation: string) => Effect.Effect<void, SqlError>;
};

type ConnectionOptions = {
  readonly native: DuckDBConnection;
  readonly trackSession?: boolean;
  readonly readOnlyReader?: boolean;
  readonly prepareCacheSize: number;
  readonly prepareCacheTTL: Duration.Input;
};

const isQueryResult = (result: DuckDBResult): boolean => result.returnType === ResultReturnType.QUERY_RESULT;

const readRows: Reader<ReadonlyArray<Row>> = (result, converter) =>
  (isQueryResult(result) ? result.convertRowObjects(converter) : Promise.resolve([])).finally(() =>
    ignoreNative(() => result.closeSync())
  );

const readValues: Reader<ReadonlyArray<ReadonlyArray<unknown>>> = (result, converter) =>
  (isQueryResult(result) ? result.convertRows(converter) : Promise.resolve([])).finally(() =>
    ignoreNative(() => result.closeSync())
  );

const readRaw: Reader<{ readonly changes: number; readonly rows: ReadonlyArray<Row> }> = (result, converter) =>
  readRows(result, converter).then((rows) => ({ changes: result.rowsChanged, rows }));

const EMPTY_RAW = { changes: 0, rows: [] };

const isRunDirectError = (error: SqlError): boolean =>
  P.hasProperty(error.reason.cause, "message") &&
  P.isString(error.reason.cause.message) &&
  RUN_DIRECT_PATTERN.test(error.reason.cause.message);

const isBlank = (sql: string): boolean => Str.isEmpty(Str.trim(sql));

const nativeBinds = (binds: Array<DuckDBValue>): Array<DuckDBValue> | undefined =>
  binds.length > 0 ? binds : undefined;

const applyTransform = <A extends object>(rows: ReadonlyArray<A>, transformRows: RowsTransform): ReadonlyArray<A> =>
  transformRows === undefined ? rows : transformRows(rows);

const currentConverter: Effect.Effect<DuckDBValueConverter<unknown>> = Effect.withFiber((fiber) =>
  Effect.succeed(fiber.context.pipe(Context.get(SqlClient.SafeIntegers), converterFor))
);

/**
 * Returns `true` when a `SqlConnection.Connection` is a DuckDB connection made
 * by {@link makeConnection}.
 *
 * **Example** (Narrow a generic connection)
 *
 * ```ts
 * import { isDuckDbConnection } from "./connection.ts"
 *
 * console.log(isDuckDbConnection({})) // false
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isDuckDbConnection = (u: unknown): u is DuckDbConnection => P.hasProperty(u, ConnectionTypeId);

/**
 * Build the `effect/sql` connection over one native DuckDB connection.
 *
 * **Details**
 *
 * The prepared-statement cache lives in its own scope, which the connection
 * scope closes under the op lock, so every cached statement is destroyed while
 * no other native operation runs on the connection. A `prepareCacheSize` of 0
 * or less disables the cache; every statement then runs through
 * `connection.run`. Statements without bind values always run through
 * `connection.run` as well: DuckDB plans a parameterless prepared statement
 * once against the table statistics of that moment, so a cached copy can keep
 * returning stale results after later writes. The native connection itself is
 * never closed here; once the connection scope closes, every later statement
 * fails with `ConnectionError` without reaching it.
 *
 * **Example** (Wrap a native connection)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { acquireConnection, acquireInstance } from "./native.ts"
 * import { makeConnection } from "./connection.ts"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const native = yield* Effect.flatMap(acquireInstance({ databasePath: ":memory:" }), acquireConnection)
 *     const connection = yield* makeConnection({ native, prepareCacheSize: 200, prepareCacheTTL: "10 minutes" })
 *     return yield* connection.execute("select 1 as n", [], undefined)
 *   })
 * )
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeConnection = Effect.fnUntraced(function* (options: ConnectionOptions) {
  const { native } = options;
  const gate = new NativeGate(native);
  const state = MutableRef.make<TransactionPhase>(TransactionPhase.Idle());
  const snapshot = MutableRef.make<O.Option<Exit.Exit<SessionSnapshot, SqlError>>>(O.none());
  const refreshSession = gate
    .runUnlocked("execute", () =>
      native.runAndReadAll(SESSION_QUERY).then((result) => {
        try {
          return result.getRowObjects();
        } finally {
          ignoreNative(() => result.closeSync());
        }
      })
    )
    .pipe(
      Effect.flatMap((rows) =>
        decodeSessionSnapshot(rows[0]).pipe(Effect.mapError((cause) => toSqlError(cause, "execute")))
      ),
      Effect.exit,
      Effect.tap((result) => Effect.sync(() => MutableRef.set(snapshot, O.some(result)))),
      Effect.asVoid
    );
  const sessionSnapshot = gate.withLock(
    Effect.gen(function* () {
      if (snapshot.pipe(MutableRef.get, O.isNone)) yield* refreshSession;
      return yield* O.match(MutableRef.get(snapshot), {
        onNone: () => Effect.die("Missing session snapshot"),
        onSome: (exit) => (Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause)),
      });
    })
  );
  const isTransaction = (): boolean => state.pipe(MutableRef.get, TransactionPhase.$is("Active"));

  const lookup = (sql: string): Effect.Effect<CachedStatement, SqlError, Scope.Scope> =>
    Effect.uninterruptibleMask((restore) =>
      restore(
        gate.runUnlocked(
          "prepare",
          () => native.prepare(sql),
          (late) => late.destroySync()
        )
      ).pipe(
        Effect.tap((statement) =>
          Effect.addFinalizer(() => Effect.sync(() => ignoreNative(() => statement.destroySync())))
        ),
        Effect.map((statement) => CachedStatement.Prepared({ statement }))
      )
    ).pipe(Effect.catchIf(isRunDirectError, () => Effect.succeed(CachedStatement.RunDirect())));

  const connectionScope = yield* Effect.scope;
  const cacheScope = yield* Scope.make();
  const prepareCacheTTL = options.prepareCacheTTL;
  const cache =
    options.prepareCacheSize > 0
      ? O.some(
          yield* ScopedCache.makeWith({
            lookup,
            capacity: options.prepareCacheSize,
            timeToLive: (exit) => (Exit.isSuccess(exit) ? prepareCacheTTL : Duration.zero),
          }).pipe(Scope.provide(cacheScope))
        )
      : O.none();
  // Once closed, `ScopedCache.get` interrupts its caller, so a statement that
  // outlives the client scope skips the cache; the closed gate then fails it
  // with `ConnectionError` before it reaches the native connection, which the
  // owner may be closing at that moment.
  const cacheClosed = MutableRef.make(false);
  yield* Scope.addFinalizer(
    connectionScope,
    gate.close(
      Effect.sync(() => MutableRef.set(cacheClosed, true)).pipe(Effect.andThen(Scope.close(cacheScope, Exit.void)))
    )
  );

  const runLocked = <A>(
    sql: string,
    binds: Array<DuckDBValue>,
    prepared: boolean,
    control: ReturnType<typeof classifyControl>,
    operation: string,
    read: Reader<A>,
    converter: DuckDBValueConverter<unknown>
  ): Effect.Effect<A, SqlError> => {
    const op = O.getOrElse(R.get(CONTROL_OPERATIONS, control), () => operation);
    const direct = gate.runUnlocked(op, () =>
      native.run(sql, nativeBinds(binds), bindTypes(binds)).then((r) => read(r, converter))
    );
    // DuckDB plans a parameterless prepared statement once, with the table
    // statistics of that moment, so a constant filter pruned on an empty table
    // stays empty after later writes. Only statements with binds are re-planned
    // per execution, so only those use the cache.
    const viaCache = O.filter(
      cache,
      () => prepared && control === "statement" && binds.length > 0 && !MutableRef.get(cacheClosed)
    );
    const run = O.match(viaCache, {
      onNone: () => direct,
      onSome: (statements) =>
        Effect.flatMap(ScopedCache.get(statements, sql), (entry) =>
          CachedStatement.$match(entry, {
            Prepared: ({ statement }) =>
              gate.runUnlocked(op, () => {
                statement.clearBindings();
                statement.bind(binds, bindTypes(binds));
                return statement.run().then((r) => read(r, converter));
              }),
            RunDirect: () => direct,
          })
        ),
    });
    const invalidate = O.match(
      O.filter(cache, () => control === "catalogContext" && !MutableRef.get(cacheClosed)),
      {
        onNone: () => Effect.void,
        onSome: ScopedCache.invalidateAll,
      }
    );
    return gate.withLock(
      run.pipe(
        Effect.onExit(
          Effect.fnUntraced(function* () {
            // A later statement can fail after USE/SET has already changed the session.
            // Invalidate on failure too, and retain a failed snapshot read until a
            // subsequent rollback/control statement makes the session readable again.
            yield* invalidate;
            if (
              options.trackSession === true &&
              (changesWriterSession(sql) || control === "rollback" || control === "commit")
            ) {
              yield* refreshSession;
            }
          })
        )
      )
    );
  };

  const setIdle = Effect.sync(() => MutableRef.set(state, TransactionPhase.Idle()));

  // Applies the commit decision of the current phase (D3): `commitNow` runs
  // only when no failure was recorded, or the abort probe shows DuckDB still
  // holds a healthy transaction; a refusal goes to `refuse`.
  const guardedCommit = <A>(
    commitNow: Effect.Effect<A, SqlError>,
    refuse: (error: SqlError) => Effect.Effect<never, SqlError>
  ): Effect.Effect<A, SqlError> =>
    Effect.suspend(() =>
      CommitDecision.$match(state.pipe(MutableRef.get, decideCommit), {
        Refuse: ({ error }) => refuse(error),
        ProbeThenCommit: ({ failure }) =>
          gate
            .run("commitTransaction", () =>
              native.run(ABORT_PROBE_SQL).then((result) => ignoreNative(() => result.closeSync()))
            )
            .pipe(
              Effect.matchEffect({
                onFailure: (probeError) =>
                  isAbortedTransactionError(probeError)
                    ? refuse(refusedCommit("aborted", failure))
                    : Effect.fail(probeError),
                onSuccess: () => commitNow,
              })
            ),
        Commit: () => commitNow,
      })
    );

  // A raw `COMMIT` has no `onCommitFailure` to clean up after a refusal, so the
  // driver rolls the transaction back itself before failing.
  const rollBackThenFail = (error: SqlError): Effect.Effect<never, SqlError> =>
    runStatement("ROLLBACK", [], "rollbackTransaction", false, readRows, []).pipe(
      Effect.ensuring(setIdle),
      Effect.ignore,
      Effect.andThen(Effect.fail(error))
    );

  const runStatement = <A>(
    sql: string,
    params: ReadonlyArray<unknown>,
    operation: string,
    prepared: boolean,
    read: Reader<A>,
    empty: A
  ): Effect.Effect<A, SqlError> =>
    Effect.suspend(() => {
      const control = classifyControl(sql);
      const active = isTransaction();
      if (control === "multiStatementControl") {
        return Effect.fail(refusedMultiStatementControl(operation));
      }
      if (active && control === "savepoint") {
        return Effect.succeed(empty);
      }
      if (active && control === "rollbackSavepoint") {
        return Effect.sync(() => {
          MutableRef.update(state, afterSuccess(control, sql));
          return empty;
        });
      }
      if (isBlank(sql)) {
        return Effect.succeed(empty);
      }
      const run = Effect.fromResult(normalizeParameters(params, operation)).pipe(
        Effect.flatMap((binds) =>
          Effect.flatMap(currentConverter, (converter) =>
            runLocked(sql, binds, prepared, control, operation, read, converter)
          )
        ),
        Effect.tap(() => Effect.sync(() => MutableRef.update(state, afterSuccess(control, sql)))),
        Effect.tapError((error) => Effect.sync(() => MutableRef.update(state, afterFailure(control, error)))),
        Effect.onInterrupt(() => Effect.sync(() => MutableRef.update(state, afterInterrupt(control, operation))))
      );
      return active && control === "commit" ? guardedCommit(run, rollBackThenFail) : run;
    });

  const runRows = (
    sql: string,
    params: ReadonlyArray<unknown>,
    operation: string,
    prepared: boolean,
    transformRows: RowsTransform
  ): Effect.Effect<ReadonlyArray<Row>, SqlError> =>
    Effect.map(runStatement(sql, params, operation, prepared, readRows, []), (rows) =>
      applyTransform(rows, transformRows)
    );

  const incrementalStream = (
    sql: string,
    params: ReadonlyArray<unknown>,
    transformRows: RowsTransform
  ): Effect.Effect<Stream.Stream<Row, SqlError>, SqlError, Scope.Scope> =>
    Effect.fromResult(normalizeParameters(params, "executeStream")).pipe(
      Effect.flatMap((binds) =>
        Effect.flatMap(currentConverter, (converter) =>
          gate.holdLock.pipe(
            Effect.andThen(
              options.trackSession === true && changesWriterSession(sql)
                ? Effect.addFinalizer(() => refreshSession)
                : Effect.void
            ),
            Effect.andThen(
              Effect.uninterruptibleMask((restore) =>
                restore(
                  gate.runUnlocked(
                    "executeStream",
                    () => native.stream(sql, nativeBinds(binds), bindTypes(binds)),
                    (late) => late.closeSync()
                  )
                ).pipe(
                  Effect.tap((result) =>
                    Effect.addFinalizer(() => Effect.sync(() => ignoreNative(() => result.closeSync())))
                  )
                )
              )
            ),
            Effect.tap(() =>
              classifyControl(sql) === "catalogContext"
                ? O.match(cache, { onNone: () => Effect.void, onSome: ScopedCache.invalidateAll })
                : Effect.void
            ),
            Effect.map((result) => {
              const iterator = result.yieldConvertedRowObjects(converter);
              return Stream.paginate(undefined, () =>
                Effect.map(
                  gate.runUnlocked("executeStream", () => iterator.next()),
                  (next): readonly [ReadonlyArray<Row>, O.Option<undefined>] =>
                    next.done === true ? [[], O.none()] : [applyTransform(next.value, transformRows), O.some(undefined)]
                )
              );
            })
          )
        )
      )
    );

  const commit: Effect.Effect<void, SqlError> = guardedCommit(
    gate
      .run("commitTransaction", () => native.run("COMMIT").then((result) => ignoreNative(() => result.closeSync())))
      .pipe(Effect.ensuring(setIdle), Effect.asVoid),
    Effect.fail
  );

  const connection: DuckDbConnection = {
    [ConnectionTypeId]: ConnectionTypeId,
    native,
    gate,
    isTransaction,
    commit,
    appendRows: (request) =>
      gate.withLock(
        Effect.acquireUseRelease(
          gate.runUnlocked(
            "appendRows",
            () => native.createAppender(request.table, request.schema),
            (late) => late.closeSync()
          ),
          Effect.fnUntraced(function* (appender) {
            const types = yield* gate.runUnlocked("appendRows", () =>
              Promise.resolve(A.makeBy(appender.columnCount, (i) => appender.columnType(i)))
            );
            for (const row of request.rows) {
              const values = yield* Effect.fromResult(normalizeParameters(row, "appendRows"));
              yield* gate.runUnlocked("appendRows", () => {
                if (values.length !== types.length) {
                  return Promise.reject("Appender rows must contain every table column");
                }
                for (let i = 0; i < values.length; i++) {
                  appender.appendValue(values[i] ?? null, types[i]);
                }
                appender.endRow();
                return Promise.resolve();
              });
            }
            yield* gate.runUnlocked("appendRows", () => {
              appender.flushSync();
              appender.closeSync();
              return Promise.resolve();
            });
          }),
          (appender, exit) =>
            Effect.sync(() => {
              if (Exit.isFailure(exit)) {
                ignoreNative(() => appender.clear());
              }
              ignoreNative(() => appender.closeSync());
            })
        ).pipe(
          Effect.tapError((error) => Effect.sync(() => MutableRef.update(state, afterFailure("statement", error)))),
          Effect.onInterrupt(() =>
            Effect.sync(() => MutableRef.update(state, afterInterrupt("statement", "appendRows")))
          )
        )
      ),
    sessionSnapshot,
    normalizeSessionSnapshot: Effect.fnUntraced(function* (current) {
      const rows = yield* gate.run("executeStream", () =>
        native
          .runAndReadAll("SELECT database_name AS catalog, schema_name AS schema FROM duckdb_schemas()")
          .then((result) => {
            try {
              return result.getRowObjects();
            } finally {
              ignoreNative(() => result.closeSync());
            }
          })
      );
      const schemas = yield* decodeSessionSchemas(rows).pipe(
        Effect.mapError((cause) => toSqlError(cause, "executeStream"))
      );
      const searchPath = pipe(
        searchPathEntries(current.searchPath),
        A.filter((entry) => {
          const identifiers = searchPathIdentifiers(entry);
          return A.some(schemas, ({ catalog, schema }) =>
            identifiers.length === 2
              ? Str.toLowerCase(catalog) === identifiers[0] && Str.toLowerCase(schema) === identifiers[1]
              : (catalog === current.database || catalog === "system" || catalog === "temp") &&
                Str.toLowerCase(schema) === identifiers[0]
          );
        }),
        A.join(",")
      );
      return SessionSnapshot.make({ ...current, searchPath });
    }),
    runDriverStatement: (sql, operation) => Effect.asVoid(runStatement(sql, [], operation, false, readRows, [])),
    execute: (sql, params, transformRows) => runRows(sql, params, "execute", true, transformRows),
    executeUnprepared: (sql, params, transformRows) => runRows(sql, params, "executeUnprepared", false, transformRows),
    executeRaw: (sql, params) => runStatement(sql, params, "executeRaw", true, readRaw, EMPTY_RAW),
    executeValues: (sql, params) => runStatement(sql, params, "executeValues", true, readValues, []),
    executeValuesUnprepared: (sql, params) =>
      runStatement(sql, params, "executeValuesUnprepared", false, readValues, []),
    executeStream: (sql, params, transformRows) =>
      Stream.unwrap(
        Effect.suspend((): Effect.Effect<Stream.Stream<Row, SqlError>, SqlError, Scope.Scope> => {
          const control = classifyControl(sql);
          const refusal = readerStreamRefusal(options.readOnlyReader === true, sql, control);
          if (O.isSome(refusal)) return Effect.fail(refusal.value);
          // Multi-statement catalog-context streams keep native.stream's last
          // result while invalidating the prepared cache under its op lock.
          const incremental =
            control === "statement" || (control === "catalogContext" && splitStatements(sql).length > 1);
          if ((isTransaction() && options.readOnlyReader !== true) || !incremental) {
            return Effect.succeed(
              runRows(sql, params, "executeStream", false, transformRows).pipe(Stream.fromIterableEffect)
            );
          }
          if (isBlank(sql)) return Effect.succeed(Stream.empty);
          return incrementalStream(sql, params, transformRows);
        })
      ),
  };
  return connection;
});
