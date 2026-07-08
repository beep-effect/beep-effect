import { setTimeout as sleep } from "node:timers/promises";
import {
  DuckDb,
  DuckDbConnectionOptions,
  DuckDbError,
  DuckDbErrorFromUnknownOptions,
  DuckDbOperation,
  DuckDbParquetExport,
  DuckDbRow,
  DuckDbRows,
  DuckDbSqlClient,
} from "@beep/duckdb";
import { fcRuns } from "@beep/test-utils";
import { DuckDBInstance } from "@duckdb/node-api";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Exit, Fiber, FileSystem, Layer, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { DuckDBConnection } from "@duckdb/node-api";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const withNativeDuckDbConnection = <A, E, R>(
  use: (connection: DuckDBConnection) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.promise(() =>
      DuckDBInstance.create(":memory:").then((instance) =>
        instance.connect().then((connection) => ({ connection, instance }))
      )
    ),
    ({ connection }) => use(connection),
    ({ connection, instance }) =>
      Effect.sync(() => {
        connection.closeSync();
        instance.closeSync();
      })
  );

const withDuckDbInstanceCreate =
  (create: typeof DuckDBInstance.create) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const original = DuckDBInstance.create;
        DuckDBInstance.create = create;
        return original;
      }),
      () => effect,
      (original) =>
        Effect.sync(() => {
          DuckDBInstance.create = original;
        })
    );

type Latch = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const makeLatch = (): Latch => {
  const latch = Promise.withResolvers<void>();
  return { promise: latch.promise, resolve: () => latch.resolve() };
};

const awaitLatch = (latch: Latch): Effect.Effect<void> => Effect.promise(() => latch.promise);

const latchResolvesWithin = (latch: Latch, millis: number): Effect.Effect<boolean> =>
  Effect.promise(() => Promise.race([latch.promise.then(() => true), sleep(millis).then(() => false)]));

const fakeRowReader = (rows: DuckDbRows): Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>> =>
  ({ getRowObjectsJson: () => rows }) as Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>>;

const fakeRunResult = {} as Awaited<ReturnType<DuckDBConnection["run"]>>;

const encodeSchema = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): Schema["Encoded"] =>
  Effect.runSync(S.encodeEffect(schema)(value));

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: { readonly numRuns?: number }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeUnknownEffect(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Effect.runSync(encode(value));
      const decoded = Effect.runSync(decode(encoded));
      return Equal.equals(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 20)
  );
};

describe("@beep/duckdb", { concurrent: false }, () => {
  it("preserves encoded schema wire shapes", () => {
    expect(
      JSON.stringify(encodeSchema(DuckDbConnectionOptions, DuckDbConnectionOptions.make({ databasePath: ":memory:" })))
    ).toBe(JSON.stringify({ databasePath: ":memory:" }));
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbConnectionOptions,
          DuckDbConnectionOptions.make({
            databaseOptions: { access_mode: "READ_ONLY" },
            databasePath: "metrics.duckdb",
          })
        )
      )
    ).toBe(JSON.stringify({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath: "metrics.duckdb" }));
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbParquetExport,
          DuckDbParquetExport.make({ filePath: "exports/events.parquet", tableName: "events" })
        )
      )
    ).toBe(JSON.stringify({ filePath: "exports/events.parquet", tableName: "events" }));
    expect(
      JSON.stringify(encodeSchema(DuckDbRow, DuckDbRow.fromUnknown({ empty: null, id: "run-1", ok: true, value: 42 })))
    ).toBe(JSON.stringify({ empty: null, id: "run-1", ok: true, value: 42 }));
    expect(JSON.stringify(encodeSchema(DuckDbRows, DuckDbRows.fromUnknown([{ id: "run-1", value: 42 }])))).toBe(
      JSON.stringify([{ id: "run-1", value: 42 }])
    );
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbErrorFromUnknownOptions,
          DuckDbErrorFromUnknownOptions.make({
            databasePath: O.some("metrics.duckdb"),
            message: "Custom DuckDB failure.",
            statement: O.some("SELECT broken"),
          })
        )
      )
    ).toBe(
      JSON.stringify({
        databasePath: "metrics.duckdb",
        message: "Custom DuckDB failure.",
        statement: "SELECT broken",
      })
    );
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbError,
          DuckDbError.make({
            databasePath: O.some("metrics.duckdb"),
            message: "Custom DuckDB failure.",
            operation: "query",
            statement: O.some("SELECT broken"),
          })
        )
      )
    ).toBe(
      JSON.stringify({
        _tag: "DuckDbError",
        databasePath: "metrics.duckdb",
        message: "Custom DuckDB failure.",
        operation: "query",
        statement: "SELECT broken",
      })
    );
  });

  it("round-trips schema-derived DuckDB models", () => {
    assertSchemaArbitraryRoundTrips(DuckDbConnectionOptions);
    assertSchemaArbitraryRoundTrips(DuckDbParquetExport);
    assertSchemaArbitraryRoundTrips(DuckDbOperation);
    assertSchemaArbitraryRoundTrips(DuckDbRow);
    assertSchemaArbitraryRoundTrips(DuckDbRows);
    assertSchemaArbitraryRoundTrips(DuckDbErrorFromUnknownOptions);
    assertSchemaArbitraryRoundTrips(DuckDbError);
  });

  it("normalizes unknown failures into typed DuckDB errors", () => {
    const cause = new Error("native failed");
    const error = DuckDbError.fromUnknown("query", cause, {
      databasePath: "metrics.duckdb",
      message: "Custom DuckDB failure.",
      statement: "SELECT broken",
    });

    expect(error).toBeInstanceOf(DuckDbError);
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.getOrThrow(error.databasePath)).toBe("metrics.duckdb");
    expect(error.message).toBe("Custom DuckDB failure.");
    expect(error.operation).toBe("query");
    expect(O.getOrThrow(error.statement)).toBe("SELECT broken");
  });

  it("preserves existing DuckDB errors and supports the data-last normalizer form", () => {
    const existing = DuckDbError.make({
      message: "Already normalized.",
      operation: "run",
    });

    expect(DuckDbError.fromUnknown("query", existing)).toBe(existing);

    const normalizeRunFailure = DuckDbError.fromUnknown("plain failure");
    const normalized = normalizeRunFailure("run");

    expect(normalized).toBeInstanceOf(DuckDbError);
    expect(normalized.message).toBe("DuckDB operation failed.");
    expect(normalized.operation).toBe("run");
  });

  it.effect(
    "runs statements, queries rows, and exports parquet",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const databasePath = path.join(tmpDir, "metrics.duckdb");
          const parquetPath = path.join(tmpDir, "exports", "events.parquet");
          yield* fs.makeDirectory(path.dirname(parquetPath), { recursive: true });

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.withTransaction(
              Effect.fnUntraced(function* (transaction) {
                yield* transaction.run("CREATE TABLE events (id VARCHAR, value INTEGER)");
                yield* transaction.run("INSERT INTO events VALUES ($id, $value)", { id: "run-1", value: 42 });
              })
            );

            const rows = yield* duckdb.query("SELECT id, value FROM events ORDER BY id");
            expect(rows).toEqual([{ id: "run-1", value: 42 }]);

            yield* duckdb.copyTableToParquet(
              DuckDbParquetExport.make({
                filePath: parquetPath,
                tableName: "events",
              })
            );
            expect(yield* fs.exists(parquetPath)).toBe(true);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "preserves in-memory state across client operations",
    Effect.fnUntraced(function* () {
      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.run("CREATE TABLE memory_events (id VARCHAR, value INTEGER)");
        yield* duckdb.run("INSERT INTO memory_events VALUES ($id, $value)", { id: "memory-1", value: 7 });

        const rows = yield* duckdb.query("SELECT id, value FROM memory_events ORDER BY id");
        expect(rows).toEqual([{ id: "memory-1", value: 7 }]);
      }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))));
    })
  );

  it.effect("keeps legacy query permits held until interrupted native operations settle", () =>
    Effect.gen(function* () {
      const firstStarted = makeLatch();
      const releaseFirst = makeLatch();
      const secondStarted = makeLatch();
      let firstRead = true;
      const fakeConnection = {
        closeSync: () => undefined,
        run: () => Promise.resolve(fakeRunResult),
        runAndReadAll: () => {
          if (firstRead) {
            firstRead = false;
            firstStarted.resolve();
            return releaseFirst.promise.then(() => fakeRowReader([{ value: 1 }] satisfies DuckDbRows));
          }
          secondStarted.resolve();
          return Promise.resolve(fakeRowReader([{ value: 2 }] satisfies DuckDbRows));
        },
      };
      const fakeInstance = {
        closeSync: () => undefined,
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* Effect.all(
          [
            duckdb.query("SELECT 1 AS value").pipe(Effect.timeoutOption("50 millis"), Effect.ignore),
            Effect.gen(function* () {
              yield* awaitLatch(firstStarted);
              yield* Effect.promise(() => sleep(75));
              const secondFiber = yield* duckdb
                .query("SELECT 2 AS value")
                .pipe(Effect.forkChild({ startImmediately: true }));
              expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
              releaseFirst.resolve();
              expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
              expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
            }),
          ],
          { concurrency: 2, discard: true }
        );
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        withDuckDbInstanceCreate(fakeCreate)
      );
    })
  );

  it.effect("keeps legacy run permits held until interrupted native operations settle", () =>
    Effect.gen(function* () {
      const runStarted = makeLatch();
      const releaseRun = makeLatch();
      const readStarted = makeLatch();
      let firstRun = true;
      const fakeConnection = {
        closeSync: () => undefined,
        run: () => {
          if (firstRun) {
            firstRun = false;
            runStarted.resolve();
            return releaseRun.promise.then(() => fakeRunResult);
          }
          return Promise.resolve(fakeRunResult);
        },
        runAndReadAll: () => {
          readStarted.resolve();
          return Promise.resolve(fakeRowReader([{ value: 2 }] satisfies DuckDbRows));
        },
      };
      const fakeInstance = {
        closeSync: () => undefined,
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* Effect.all(
          [
            duckdb
              .run("CREATE TABLE interrupted_run (value INTEGER)")
              .pipe(Effect.timeoutOption("50 millis"), Effect.ignore),
            Effect.gen(function* () {
              yield* awaitLatch(runStarted);
              yield* Effect.promise(() => sleep(75));
              const readFiber = yield* duckdb
                .query("SELECT 2 AS value")
                .pipe(Effect.forkChild({ startImmediately: true }));
              expect(yield* latchResolvesWithin(readStarted, 50)).toBe(false);
              releaseRun.resolve();
              expect(yield* latchResolvesWithin(readStarted, 1000)).toBe(true);
              expect(yield* Fiber.join(readFiber)).toEqual([{ value: 2 }]);
            }),
          ],
          { concurrency: 2, discard: true }
        );
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        withDuckDbInstanceCreate(fakeCreate)
      );
    })
  );

  it.effect("keeps legacy parquet export permits held until interrupted native operations settle", () =>
    Effect.gen(function* () {
      const copyStarted = makeLatch();
      const releaseCopy = makeLatch();
      const readStarted = makeLatch();
      const fakeConnection = {
        closeSync: () => undefined,
        run: () => {
          copyStarted.resolve();
          return releaseCopy.promise.then(() => fakeRunResult);
        },
        runAndReadAll: () => {
          readStarted.resolve();
          return Promise.resolve(fakeRowReader([{ value: 2 }] satisfies DuckDbRows));
        },
      };
      const fakeInstance = {
        closeSync: () => undefined,
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* Effect.all(
          [
            duckdb
              .copyTableToParquet(
                DuckDbParquetExport.make({
                  filePath: "/tmp/legacy-interrupted-copy.parquet",
                  tableName: "legacy_events",
                })
              )
              .pipe(Effect.timeoutOption("50 millis"), Effect.ignore),
            Effect.gen(function* () {
              yield* awaitLatch(copyStarted);
              yield* Effect.promise(() => sleep(75));
              const readFiber = yield* duckdb
                .query("SELECT 2 AS value")
                .pipe(Effect.forkChild({ startImmediately: true }));
              expect(yield* latchResolvesWithin(readStarted, 50)).toBe(false);
              releaseCopy.resolve();
              expect(yield* latchResolvesWithin(readStarted, 1000)).toBe(true);
              expect(yield* Fiber.join(readFiber)).toEqual([{ value: 2 }]);
            }),
          ],
          { concurrency: 2, discard: true }
        );
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        withDuckDbInstanceCreate(fakeCreate)
      );
    })
  );

  it.effect("closes a legacy scoped instance when connection acquisition fails", () =>
    Effect.gen(function* () {
      const connectError = new Error("legacy connect failed");
      let instanceCloseAttempts = 0;
      const fakeInstance = {
        closeSync: () => {
          instanceCloseAttempts += 1;
        },
        connect: () => Promise.reject(connectError),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      const exit = yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.query("SELECT 1 AS value");
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        Effect.exit,
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect("closes a legacy scoped instance even when connection close fails", () =>
    Effect.gen(function* () {
      let connectionCloseAttempts = 0;
      let instanceCloseAttempts = 0;
      const fakeConnection = {
        closeSync: () => {
          connectionCloseAttempts += 1;
          throw new Error("legacy connection close failed");
        },
        run: () => Promise.resolve(fakeRunResult),
        runAndReadAll: () => Promise.resolve(fakeRowReader([] satisfies DuckDbRows)),
      };
      const fakeInstance = {
        closeSync: () => {
          instanceCloseAttempts += 1;
        },
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.run("SELECT 1 AS value");
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(connectionCloseAttempts).toBe(1);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect("registers legacy scoped cleanup when first acquisition is interrupted", () =>
    Effect.gen(function* () {
      const connectStarted = makeLatch();
      const connect = Promise.withResolvers<DuckDBConnection>();
      let connectionCloseAttempts = 0;
      let instanceCloseAttempts = 0;
      const fakeConnection = {
        closeSync: () => {
          connectionCloseAttempts += 1;
        },
        run: () => Promise.resolve(fakeRunResult),
        runAndReadAll: () => Promise.resolve(fakeRowReader([{ value: 1 }] satisfies DuckDbRows)),
      };
      const fakeInstance = {
        closeSync: () => {
          instanceCloseAttempts += 1;
        },
        connect: () => {
          connectStarted.resolve();
          return connect.promise;
        },
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* Effect.scoped(
        Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))).pipe(
          Effect.flatMap((context) =>
            Effect.gen(function* () {
              const queryFiber = yield* Effect.gen(function* () {
                const duckdb = yield* DuckDb;
                yield* duckdb.query("SELECT 1 AS value");
              }).pipe(Effect.provide(context), Effect.forkChild({ startImmediately: true }));

              yield* awaitLatch(connectStarted);
              yield* Fiber.interrupt(queryFiber).pipe(Effect.forkChild({ startImmediately: true }));
              yield* Effect.promise(() => sleep(25));
              expect(connectionCloseAttempts).toBe(0);
              expect(instanceCloseAttempts).toBe(0);
              connect.resolve(fakeConnection as unknown as DuckDBConnection);
              yield* Fiber.await(queryFiber);
            })
          )
        )
      ).pipe(withDuckDbInstanceCreate(fakeCreate));

      expect(connectionCloseAttempts).toBe(1);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect("rolls back legacy transactions interrupted after delayed begin", () =>
    Effect.gen(function* () {
      const beginStarted = makeLatch();
      const releaseBegin = makeLatch();
      const rollbackStarted = makeLatch();
      const statements: Array<string> = [];
      const fakeConnection = {
        closeSync: () => undefined,
        run: (statement: string) => {
          statements.push(statement);
          if (statement === "BEGIN TRANSACTION") {
            beginStarted.resolve();
            return releaseBegin.promise.then(() => fakeRunResult);
          }
          if (statement === "ROLLBACK") {
            rollbackStarted.resolve();
          }
          return Promise.resolve(fakeRunResult);
        },
        runAndReadAll: () => Promise.resolve(fakeRowReader([] satisfies DuckDbRows)),
      };
      const fakeInstance = {
        closeSync: () => undefined,
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      const result = yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        const transactionFiber = yield* duckdb
          .withTransaction(() => Effect.sleep("1 hour"))
          .pipe(Effect.forkChild({ startImmediately: true }));

        yield* awaitLatch(beginStarted);
        yield* Effect.promise(() => sleep(75));
        yield* Fiber.interrupt(transactionFiber).pipe(Effect.forkChild({ startImmediately: true }));
        expect(statements).toEqual(["BEGIN TRANSACTION"]);
        releaseBegin.resolve();
        expect(yield* latchResolvesWithin(rollbackStarted, 1000)).toBe(true);
        return yield* Fiber.await(transactionFiber);
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(Exit.isFailure(result)).toBe(true);
      expect(statements).toEqual(["BEGIN TRANSACTION", "ROLLBACK"]);
    })
  );

  it.effect("does not roll back legacy transactions when begin fails", () =>
    Effect.gen(function* () {
      const beginError = new Error("begin failed");
      const rollbackStarted = makeLatch();
      const statements: Array<string> = [];
      const fakeConnection = {
        closeSync: () => undefined,
        run: (statement: string) => {
          statements.push(statement);
          if (statement === "BEGIN TRANSACTION") {
            return Promise.reject(beginError);
          }
          if (statement === "ROLLBACK") {
            rollbackStarted.resolve();
          }
          return Promise.resolve(fakeRunResult);
        },
        runAndReadAll: () => Promise.resolve(fakeRowReader([] satisfies DuckDbRows)),
      };
      const fakeInstance = {
        closeSync: () => undefined,
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      const exit = yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.withTransaction(() => Effect.void);
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        Effect.exit,
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(yield* latchResolvesWithin(rollbackStarted, 50)).toBe(false);
      expect(statements).toEqual(["BEGIN TRANSACTION"]);
    })
  );

  it.effect(
    "rolls back failed nested transactions on the same connection",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const databasePath = path.join(tmpDir, "metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run("CREATE TABLE tx_events (id VARCHAR)");

            const exit = yield* Effect.exit(
              duckdb.withTransaction(
                Effect.fnUntraced(function* (transaction) {
                  yield* transaction.run("INSERT INTO tx_events VALUES ('outer')");
                  yield* transaction.withTransaction((nested) => nested.run("INSERT INTO tx_events VALUES ('inner')"));
                  return yield* DuckDbError.make({
                    message: "force rollback",
                    operation: "withTransaction",
                  });
                })
              )
            );

            expect(Exit.isFailure(exit)).toBe(true);
            const rows = yield* duckdb.query("SELECT count(*) AS count FROM tx_events");
            expect(rows).toEqual([{ count: "0" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );
});

describe("DuckDbSqlClient", { concurrent: false }, () => {
  it.effect("provides the generic SqlClient tag and executes core statement paths", () =>
    Effect.gen(function* () {
      const duckdbSql = yield* DuckDbSqlClient;
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();

      expect(duckdbSql).toBe(yield* SqlClient.SqlClient);

      yield* sql`
          CREATE TABLE sql_events (
            id VARCHAR,
            value INTEGER
          )
        `;
      yield* sql`INSERT INTO sql_events VALUES (${"sql-1"}, ${42})`;

      const taggedRows = yield* sql<{ readonly id: string; readonly value: number }>`
          SELECT id, value
          FROM sql_events
          ORDER BY id
        `;
      expect(taggedRows).toEqual([{ id: "sql-1", value: 42 }]);

      const unsafeRows = yield* sql.unsafe<{ readonly id: string }>("SELECT id FROM sql_events WHERE value = ?", [42]);
      expect(unsafeRows).toEqual([{ id: "sql-1" }]);

      const values = yield* sql<{ readonly value: number }>`SELECT value FROM sql_events ORDER BY id`.values;
      expect(values).toEqual([[42]]);

      const valuesUnprepared = yield* sql.unsafe<{ readonly value: number }>(
        "SELECT value FROM sql_events WHERE id = ?",
        ["sql-1"]
      ).valuesUnprepared;
      expect(valuesUnprepared).toEqual([[42]]);

      const unpreparedRows = yield* sql.unsafe<{ readonly value: number }>(
        "SELECT value FROM sql_events WHERE id = ?",
        ["sql-1"]
      ).unprepared;
      expect(unpreparedRows).toEqual([{ value: 42 }]);

      const streamedRows = yield* Stream.runCollect(
        sql<{ readonly id: string }>`SELECT id FROM sql_events ORDER BY id`.stream
      );
      expect(A.fromIterable(streamedRows)).toEqual([{ id: "sql-1" }]);
    }).pipe(provideScopedLayer(DuckDbSqlClient.makeLayer({ databasePath: ":memory:" })))
  );

  it.effect("builds from a caller-owned live connection", () =>
    withNativeDuckDbConnection((liveConnection) =>
      Effect.gen(function* () {
        const client = yield* DuckDbSqlClient.fromClient({
          databasePath: ":memory:",
          liveConnection,
        });
        const sql = client.withoutTransforms();

        yield* sql`
          CREATE TABLE live_connection_events (
            id VARCHAR
          )
        `;
        yield* sql`INSERT INTO live_connection_events VALUES (${"live-1"})`;

        const rows = yield* sql<{ readonly id: string }>`
          SELECT id
          FROM live_connection_events
          ORDER BY id
        `;
        expect(rows).toEqual([{ id: "live-1" }]);
      }).pipe(provideScopedLayer(Reactivity.layer))
    )
  );

  it.effect("closes a created instance when managed connection acquisition fails", () =>
    Effect.gen(function* () {
      const connectError = new Error("connect failed");
      let instanceCloseAttempts = 0;
      const fakeInstance = {
        closeSync: () => {
          instanceCloseAttempts += 1;
        },
        connect: () => Promise.reject(connectError),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      const exit = yield* DuckDbSqlClient.make({ databasePath: ":memory:" }).pipe(
        provideScopedLayer(Reactivity.layer),
        Effect.exit,
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect("closes the managed instance even when connection close fails", () =>
    Effect.gen(function* () {
      let connectionCloseAttempts = 0;
      let instanceCloseAttempts = 0;
      const fakeConnection = {
        closeSync: () => {
          connectionCloseAttempts += 1;
          throw new Error("connection close failed");
        },
      };
      const fakeInstance = {
        closeSync: () => {
          instanceCloseAttempts += 1;
        },
        connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
      };
      const fakeCreate: typeof DuckDBInstance.create = () =>
        Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);

      yield* DuckDbSqlClient.make({ databasePath: ":memory:" }).pipe(
        provideScopedLayer(Reactivity.layer),
        withDuckDbInstanceCreate(fakeCreate)
      );

      expect(connectionCloseAttempts).toBe(1);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect("serializes normal statements on the shared connection", () =>
    withNativeDuckDbConnection((liveConnection) =>
      Effect.gen(function* () {
        let activeExecutions = 0;
        let maxActiveExecutions = 0;
        const runAndReadAll = liveConnection.runAndReadAll.bind(liveConnection);
        liveConnection.runAndReadAll = (...args: Parameters<DuckDBConnection["runAndReadAll"]>) => {
          activeExecutions += 1;
          maxActiveExecutions = activeExecutions > maxActiveExecutions ? activeExecutions : maxActiveExecutions;
          return sleep(20)
            .then(() => runAndReadAll(...args))
            .finally(() => {
              activeExecutions -= 1;
            });
        };

        const client = yield* DuckDbSqlClient.fromClient({
          databasePath: ":memory:",
          liveConnection,
        });
        const sql = client.withoutTransforms();

        yield* Effect.all([sql`SELECT 1 AS value`, sql`SELECT 2 AS value`], { concurrency: 2 });

        expect(maxActiveExecutions).toBe(1);
      }).pipe(provideScopedLayer(Reactivity.layer))
    )
  );

  it.effect("keeps read permits held until interrupted native operations settle", () =>
    withNativeDuckDbConnection((liveConnection) =>
      Effect.gen(function* () {
        const firstStarted = makeLatch();
        const releaseFirst = makeLatch();
        const secondStarted = makeLatch();
        let firstRead = true;
        const runAndReadAll = liveConnection.runAndReadAll.bind(liveConnection);
        liveConnection.runAndReadAll = (...args: Parameters<DuckDBConnection["runAndReadAll"]>) => {
          if (firstRead) {
            firstRead = false;
            firstStarted.resolve();
            return releaseFirst.promise.then(() => runAndReadAll(...args));
          }
          secondStarted.resolve();
          return runAndReadAll(...args);
        };

        const client = yield* DuckDbSqlClient.fromClient({
          databasePath: ":memory:",
          liveConnection,
        });
        const sql = client.withoutTransforms();

        yield* Effect.all(
          [
            sql<{ readonly value: number }>`SELECT 1 AS value`.pipe(Effect.timeoutOption("50 millis"), Effect.ignore),
            Effect.gen(function* () {
              yield* awaitLatch(firstStarted);
              yield* Effect.promise(() => sleep(75));
              const secondFiber = yield* sql<{ readonly value: number }>`SELECT 2 AS value`.pipe(
                Effect.forkChild({ startImmediately: true })
              );
              expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
              releaseFirst.resolve();
              expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
              expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
            }),
          ],
          { concurrency: 2, discard: true }
        );
      }).pipe(provideScopedLayer(Reactivity.layer))
    )
  );

  it.effect(
    "keeps raw permits held until interrupted native operations settle",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const parquetPath = path.join(tmpDir, "raw-interrupt.parquet");

          yield* withNativeDuckDbConnection((liveConnection) =>
            Effect.gen(function* () {
              const client = yield* DuckDbSqlClient.fromClient({
                databasePath: ":memory:",
                liveConnection,
              });
              const sql = client.withoutTransforms();

              yield* sql`
                CREATE TABLE raw_interrupt_events (
                  id VARCHAR
                )
              `;
              yield* sql`INSERT INTO raw_interrupt_events VALUES (${"raw-1"})`;

              const rawStarted = makeLatch();
              const releaseRaw = makeLatch();
              const readStarted = makeLatch();
              const run = liveConnection.run.bind(liveConnection);
              const runAndReadAll = liveConnection.runAndReadAll.bind(liveConnection);
              liveConnection.run = (...args: Parameters<DuckDBConnection["run"]>) => {
                rawStarted.resolve();
                return releaseRaw.promise.then(() => run(...args));
              };
              liveConnection.runAndReadAll = (...args: Parameters<DuckDBConnection["runAndReadAll"]>) => {
                readStarted.resolve();
                return runAndReadAll(...args);
              };

              yield* Effect.all(
                [
                  client
                    .copyTableToParquet(
                      DuckDbParquetExport.make({
                        filePath: parquetPath,
                        tableName: "raw_interrupt_events",
                      })
                    )
                    .pipe(Effect.timeoutOption("50 millis"), Effect.ignore),
                  Effect.gen(function* () {
                    yield* awaitLatch(rawStarted);
                    yield* Effect.promise(() => sleep(75));
                    const readFiber = yield* sql<{ readonly id: string }>`SELECT id FROM raw_interrupt_events`.pipe(
                      Effect.forkChild({ startImmediately: true })
                    );
                    expect(yield* latchResolvesWithin(readStarted, 50)).toBe(false);
                    releaseRaw.resolve();
                    expect(yield* latchResolvesWithin(readStarted, 1000)).toBe(true);
                    expect(yield* Fiber.join(readFiber)).toEqual([{ id: "raw-1" }]);
                  }),
                ],
                { concurrency: 2, discard: true }
              );
              expect(yield* fs.exists(parquetPath)).toBe(true);
            }).pipe(provideScopedLayer(Reactivity.layer))
          );
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "exports parquet through the DuckDbSqlClient-specific method",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const databasePath = path.join(tmpDir, "sql-client.duckdb");
          const parquetPath = path.join(tmpDir, "exports", "sql_events.parquet");
          const transactionParquetPath = path.join(tmpDir, "exports", "sql_transaction_events.parquet");
          yield* fs.makeDirectory(path.dirname(parquetPath), { recursive: true });

          yield* Effect.gen(function* () {
            const client = yield* DuckDbSqlClient;
            const sql = client.withoutTransforms();

            yield* sql`
              CREATE TABLE parquet_events (
                id VARCHAR,
                value INTEGER
              )
            `;
            yield* sql`INSERT INTO parquet_events VALUES (${"parquet-1"}, ${1})`;
            yield* client.copyTableToParquet(
              DuckDbParquetExport.make({
                filePath: parquetPath,
                tableName: "parquet_events",
              })
            );

            expect(yield* fs.exists(parquetPath)).toBe(true);

            const transactionExport = yield* sql
              .withTransaction(
                Effect.gen(function* () {
                  yield* sql`
                    CREATE TABLE transaction_parquet_events (
                      id VARCHAR,
                      value INTEGER
                    )
                  `;
                  yield* sql`INSERT INTO transaction_parquet_events VALUES (${"transaction-parquet-1"}, ${1})`;
                  yield* client.copyTableToParquet(
                    DuckDbParquetExport.make({
                      filePath: transactionParquetPath,
                      tableName: "transaction_parquet_events",
                    })
                  );
                })
              )
              .pipe(Effect.timeoutOption("1 second"));

            expect(O.isSome(transactionExport)).toBe(true);
            expect(yield* fs.exists(transactionParquetPath)).toBe(true);
          }).pipe(provideScopedLayer(DuckDbSqlClient.makeLayer({ databasePath })));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect("commits, rolls back, and reuses the active transaction for nested calls", () =>
    Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      yield* sql`
          CREATE TABLE tx_events (
            id VARCHAR
          )
        `;

      const committed = yield* sql.withTransaction(
        Effect.gen(function* () {
          yield* sql`INSERT INTO tx_events VALUES (${"committed"})`;
          return "ok";
        })
      );
      expect(committed).toBe("ok");

      const rollbackExit = yield* Effect.exit(
        sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`INSERT INTO tx_events VALUES (${"rolled-back"})`;
            return yield* Effect.fail("force rollback");
          })
        )
      );
      expect(Exit.isFailure(rollbackExit)).toBe(true);

      yield* sql.withTransaction(
        Effect.gen(function* () {
          yield* sql`INSERT INTO tx_events VALUES (${"outer"})`;
          yield* sql.withTransaction(sql`INSERT INTO tx_events VALUES (${"inner"})`);
        })
      );

      const rows = yield* sql<{ readonly id: string }>`
          SELECT id
          FROM tx_events
          ORDER BY id
        `;
      expect(rows).toEqual([{ id: "committed" }, { id: "inner" }, { id: "outer" }]);
    }).pipe(provideScopedLayer(DuckDbSqlClient.makeLayer({ databasePath: ":memory:" })))
  );

  it.effect("pins nested rollback behavior when savepoints are unavailable", () =>
    Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      yield* sql`
          CREATE TABLE nested_failure_events (
            id VARCHAR
          )
        `;

      yield* sql.withTransaction(
        Effect.gen(function* () {
          yield* sql`INSERT INTO nested_failure_events VALUES (${"outer-before"})`;
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`INSERT INTO nested_failure_events VALUES (${"inner-kept"})`;
                return yield* Effect.fail("inner failure");
              })
            )
            .pipe(Effect.ignore);
          yield* sql`INSERT INTO nested_failure_events VALUES (${"outer-after"})`;
        })
      );

      const rows = yield* sql<{ readonly id: string }>`
          SELECT id
          FROM nested_failure_events
          ORDER BY id
        `;
      expect(rows).toEqual([{ id: "inner-kept" }, { id: "outer-after" }, { id: "outer-before" }]);
    }).pipe(provideScopedLayer(DuckDbSqlClient.makeLayer({ databasePath: ":memory:" })))
  );
});
