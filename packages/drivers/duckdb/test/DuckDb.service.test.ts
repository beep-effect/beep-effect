import {
  DuckDb,
  DuckDbClient,
  DuckDbConnectionOptions,
  DuckDbError,
  DuckDbErrorFromUnknownOptions,
  DuckDbMigrator,
  DuckDbOperation,
  DuckDbParquetExport,
  DuckDbRow,
  DuckDbRows,
} from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { DuckDBInstance } from "@duckdb/node-api";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import type { DuckDBConnection } from "@duckdb/node-api";

// These two uses deliberately close the production layer before close-count assertions.
// Suite teardown would occur after the oracle and change the lifecycle subject.
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );

class NativeTestDirectory extends Context.Service<NativeTestDirectory, string>()(
  "@beep/duckdb/test/DuckDb.service.test/NativeTestDirectory"
) {}

const nativeDirectoryLayer = Layer.effect(
  NativeTestDirectory,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.makeTempDirectoryScoped();
  })
).pipe(Layer.provideMerge(NodeServices.layer));

const acquireNativeDuckDbConnection = Effect.gen(function* () {
  const instance = yield* Effect.acquireRelease(
    Effect.promise(() => DuckDBInstance.create(":memory:")),
    (instance) => Effect.sync(() => instance.closeSync())
  );
  return yield* Effect.acquireRelease(
    Effect.promise(() => instance.connect()),
    (connection) => Effect.sync(() => connection.closeSync())
  );
});

const patchDuckDbInstanceCreate = (create: typeof DuckDBInstance.create) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const original = DuckDBInstance.create;
      DuckDBInstance.create = create;
      return original;
    }),
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

// Wall-clock waits: these tests coordinate with native promises, and `it.effect`
// installs TestClock, so a bare `Effect.sleep` would never elapse.
const liveSleep = (millis: number): Effect.Effect<void> =>
  Effect.sleep(Duration.millis(millis)).pipe(TestClock.withLive);

const latchResolvesWithin = (latch: Latch, millis: number): Effect.Effect<boolean> =>
  Effect.raceFirst(awaitLatch(latch).pipe(Effect.as(true)), liveSleep(millis).pipe(Effect.as(false)));

const fakeRowReader = (rows: DuckDbRows): Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>> =>
  ({ getRowObjectsJson: () => rows }) as Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>>;

const fakeRunResult = {} as Awaited<ReturnType<DuckDBConnection["run"]>>;

const encodeDuckDbErrorFromUnknownOptions = S.encodeEffect(DuckDbErrorFromUnknownOptions);
const decodeDuckDbErrorFromUnknownOptionsJson = S.decodeEffect(S.fromJsonString(DuckDbErrorFromUnknownOptions));
const encodeDuckDbError = S.encodeEffect(DuckDbError);
const decodeDuckDbErrorJson = S.decodeEffect(S.fromJsonString(DuckDbError));

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const encodeSchema = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]) =>
  S.encodeEffect(schema)(value);

const DuckDbErrorFromUnknownOptionsArbitrary = Arbitrary.schema(DuckDbErrorFromUnknownOptions).pipe(
  Arbitrary.filter((options) => O.isNone(options.cause))
);
const DuckDbErrorArbitrary = Arbitrary.schema(DuckDbError).pipe(Arbitrary.filter((error) => O.isNone(error.cause)));

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <Schema extends S.Codec<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  return S.toEquivalence(schema)(decoded, value);
});

describe("@beep/duckdb", { concurrent: false }, () => {
  it.effect("preserves encoded schema wire shapes", () =>
    Effect.gen(function* () {
      expect(
        yield* encodeJson(
          yield* encodeSchema(DuckDbConnectionOptions, DuckDbConnectionOptions.make({ databasePath: ":memory:" }))
        )
      ).toBe(yield* encodeJson({ databasePath: ":memory:" }));
      expect(
        yield* encodeJson(
          yield* encodeSchema(
            DuckDbConnectionOptions,
            DuckDbConnectionOptions.make({
              databaseOptions: { access_mode: "READ_ONLY" },
              databasePath: "metrics.duckdb",
            })
          )
        )
      ).toBe(yield* encodeJson({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath: "metrics.duckdb" }));
      expect(
        yield* encodeJson(
          yield* encodeSchema(
            DuckDbParquetExport,
            DuckDbParquetExport.make({ filePath: "exports/events.parquet", tableName: "events" })
          )
        )
      ).toBe(yield* encodeJson({ filePath: "exports/events.parquet", tableName: "events" }));
      expect(
        yield* encodeJson(
          yield* encodeSchema(
            DuckDbRow,
            Result.getOrThrow(S.decodeResult(DuckDbRow)({ empty: null, id: "run-1", ok: true, value: 42 }))
          )
        )
      ).toBe(yield* encodeJson({ empty: null, id: "run-1", ok: true, value: 42 }));
      expect(
        yield* encodeJson(
          yield* encodeSchema(DuckDbRows, Result.getOrThrow(S.decodeResult(DuckDbRows)([{ id: "run-1", value: 42 }])))
        )
      ).toBe(yield* encodeJson([{ id: "run-1", value: 42 }]));
      expect(
        yield* encodeJson(
          yield* encodeSchema(
            DuckDbErrorFromUnknownOptions,
            DuckDbErrorFromUnknownOptions.make({
              databasePath: O.some("metrics.duckdb"),
              message: "Custom DuckDB failure.",
              statement: O.some("SELECT broken"),
            })
          )
        )
      ).toBe(
        yield* encodeJson({
          databasePath: "metrics.duckdb",
          message: "Custom DuckDB failure.",
          statement: "SELECT broken",
        })
      );
      expect(
        yield* encodeJson(
          yield* encodeSchema(
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
        yield* encodeJson({
          _tag: "DuckDbError",
          databasePath: "metrics.duckdb",
          message: "Custom DuckDB failure.",
          operation: "query",
          statement: "SELECT broken",
        })
      );
    })
  );

  it.effect.prop(
    "round-trips DuckDbConnectionOptions through encoded form",
    [DuckDbConnectionOptions],
    ([value]) => assertSchemaRoundTrip(DuckDbConnectionOptions, DuckDbConnectionOptions.make(value)),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbParquetExport through encoded form",
    [DuckDbParquetExport],
    ([value]) => assertSchemaRoundTrip(DuckDbParquetExport, DuckDbParquetExport.make(value)),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbOperation through encoded form",
    [DuckDbOperation],
    ([value]) => assertSchemaRoundTrip(DuckDbOperation, value),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbRow through encoded form",
    [DuckDbRow],
    ([value]) => assertSchemaRoundTrip(DuckDbRow, value),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbRows through encoded form",
    [DuckDbRows],
    ([value]) => assertSchemaRoundTrip(DuckDbRows, value),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbErrorFromUnknownOptions through encoded form",
    [DuckDbErrorFromUnknownOptionsArbitrary],
    ([value]) => assertSchemaRoundTrip(DuckDbErrorFromUnknownOptions, value),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbError through encoded form",
    [DuckDbErrorArbitrary],
    ([value]) => assertSchemaRoundTrip(DuckDbError, value),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbErrorFromUnknownOptions with representable Some causes",
    [S.String, S.String, S.String, S.String, S.String, S.String],
    ([name, causeMessage, stack, databasePath, message, statement]) =>
      Effect.gen(function* () {
        const cause = { name, message: causeMessage, stack };
        const options = DuckDbErrorFromUnknownOptions.make({
          cause: O.some(cause),
          databasePath: O.some(databasePath),
          message,
          statement: O.some(statement),
        });
        const expectedWire = { cause: { name, message: causeMessage, stack }, databasePath, message, statement };
        const encoded = yield* encodeDuckDbErrorFromUnknownOptions(options);
        expect(encoded).toEqual(expectedWire);
        const json = yield* encodeJson(encoded);
        expect(json).toBe(yield* encodeJson(expectedWire));
        const decoded = yield* decodeDuckDbErrorFromUnknownOptionsJson(json);
        assertSome(decoded.cause, { name, message: causeMessage, stack });
        pipe(S.toEquivalence(DuckDbErrorFromUnknownOptions)(decoded, options), assertTrue);
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips DuckDbError with representable Some causes and preserves raw normalization",
    [DuckDbOperation, S.String, S.String, S.String, S.String, S.String, S.String],
    ([operation, name, causeMessage, stack, databasePath, message, statement]) =>
      Effect.gen(function* () {
        const cause = { name, message: causeMessage, stack };
        const error = DuckDbError.fromUnknown(operation, cause, { databasePath, message, statement });
        expect(O.getOrThrow(error.cause)).toBe(cause);
        const made = DuckDbError.make({
          cause: O.some(cause),
          databasePath: O.some(databasePath),
          message,
          operation,
          statement: O.some(statement),
        });
        pipe(S.toEquivalence(DuckDbError)(error, made), assertTrue);
        const expectedWire = {
          _tag: "DuckDbError",
          cause: { name, message: causeMessage, stack },
          databasePath,
          message,
          operation,
          statement,
        };
        const encoded = yield* encodeDuckDbError(error);
        expect(encoded).toEqual(expectedWire);
        expect(yield* encodeDuckDbError(made)).toEqual(expectedWire);
        const json = yield* encodeJson(encoded);
        expect(json).toBe(yield* encodeJson(expectedWire));
        const decoded = yield* decodeDuckDbErrorJson(json);
        assertSome(decoded.cause, { name, message: causeMessage, stack });
        pipe(S.toEquivalence(DuckDbError)(decoded, error), assertTrue);
      }),
    { arbitrary: fcRuns(20) }
  );

  it("normalizes unknown failures into typed DuckDB errors", () => {
    const cause = new Error("native failed");
    const error = DuckDbError.fromUnknown("query", cause, {
      databasePath: "metrics.duckdb",
      message: "Custom DuckDB failure.",
      statement: "SELECT broken",
    });

    expect(error).toBeInstanceOf(DuckDbError);
    expect(O.getOrThrow(error.cause)).toBe(cause);
    assertSome(error.databasePath, "metrics.duckdb");
    expect(error.message).toBe("Custom DuckDB failure.");
    expect(error.operation).toBe("query");
    assertSome(error.statement, "SELECT broken");
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

  it.layer(
    Layer.unwrap(
      Effect.gen(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "metrics.duckdb");
        return DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));
      })
    ).pipe(Layer.provideMerge(nativeDirectoryLayer)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "runs statements, queries rows, and exports parquet",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;

        const parquetPath = path.join(tmpDir, "exports", "events.parquet");
        yield* fs.makeDirectory(path.dirname(parquetPath), { recursive: true });

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
      })
    );
  });

  it.layer(
    Layer.unwrap(
      Effect.gen(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "legacy-transaction-export.duckdb");
        return DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));
      })
    ).pipe(Layer.provideMerge(nativeDirectoryLayer)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "rejects legacy parquet export inside transactions",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;

        const parquetPath = path.join(tmpDir, "exports", "transaction_events.parquet");
        yield* fs.makeDirectory(path.dirname(parquetPath), { recursive: true });

        const duckdb = yield* DuckDb;
        yield* duckdb.run("CREATE TABLE transaction_export_events (id VARCHAR)");

        const exit = yield* duckdb
          .withTransaction(
            Effect.fnUntraced(function* (transaction) {
              yield* transaction.run("INSERT INTO transaction_export_events VALUES ('rolled-back')");
              yield* transaction.copyTableToParquet(
                DuckDbParquetExport.make({
                  filePath: parquetPath,
                  tableName: "transaction_export_events",
                })
              );
            })
          )
          .pipe(Effect.exit);

        pipe(exit, Exit.isFailure, assertTrue);
        expect(yield* fs.exists(parquetPath)).toBe(false);

        const rows = yield* duckdb.query("SELECT id FROM transaction_export_events ORDER BY id");
        expect(rows).toEqual([]);
      })
    );
  });

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "preserves in-memory state across client operations",
        Effect.fnUntraced(function* () {
          const duckdb = yield* DuckDb;
          yield* duckdb.run("CREATE TABLE memory_events (id VARCHAR, value INTEGER)");
          yield* duckdb.run("INSERT INTO memory_events VALUES ($id, $value)", { id: "memory-1", value: 7 });

          const rows = yield* duckdb.query("SELECT id, value FROM memory_events ORDER BY id");
          expect(rows).toEqual([{ id: "memory-1", value: 7 }]);
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "keeps legacy query permits held until interrupted native operations settle",
        Effect.fnUntraced(function* () {
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
          yield* patchDuckDbInstanceCreate(fakeCreate);

          const duckdb = yield* DuckDb;
          yield* Effect.gen(function* () {
            const firstFiber = yield* duckdb
              .query("SELECT 1 AS value")
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* awaitLatch(firstStarted);
            const interruption = yield* Fiber.interrupt(firstFiber).pipe(Effect.forkChild({ startImmediately: true }));
            const secondFiber = yield* duckdb
              .query("SELECT 2 AS value")
              .pipe(Effect.forkChild({ startImmediately: true }));
            expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
            releaseFirst.resolve();
            expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
            expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
            yield* Fiber.join(interruption);
            pipe(yield* Fiber.await(firstFiber), Exit.hasInterrupts, assertTrue);
          }).pipe(Effect.ensuring(Effect.sync(() => releaseFirst.resolve())));
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "keeps legacy run permits held until interrupted native operations settle",
        Effect.fnUntraced(function* () {
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
          yield* patchDuckDbInstanceCreate(fakeCreate);

          const duckdb = yield* DuckDb;
          yield* Effect.gen(function* () {
            const firstFiber = yield* duckdb
              .run("CREATE TABLE interrupted_run (value INTEGER)")
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* awaitLatch(runStarted);
            const interruption = yield* Fiber.interrupt(firstFiber).pipe(Effect.forkChild({ startImmediately: true }));
            const readFiber = yield* duckdb
              .query("SELECT 2 AS value")
              .pipe(Effect.forkChild({ startImmediately: true }));
            expect(yield* latchResolvesWithin(readStarted, 50)).toBe(false);
            releaseRun.resolve();
            expect(yield* latchResolvesWithin(readStarted, 1000)).toBe(true);
            expect(yield* Fiber.join(readFiber)).toEqual([{ value: 2 }]);
            yield* Fiber.join(interruption);
            pipe(yield* Fiber.await(firstFiber), Exit.hasInterrupts, assertTrue);
          }).pipe(Effect.ensuring(Effect.sync(() => releaseRun.resolve())));
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "keeps legacy parquet export permits held until interrupted native operations settle",
        Effect.fnUntraced(function* () {
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
          yield* patchDuckDbInstanceCreate(fakeCreate);

          const duckdb = yield* DuckDb;
          yield* Effect.gen(function* () {
            const firstFiber = yield* duckdb
              .copyTableToParquet(
                DuckDbParquetExport.make({
                  filePath: "/tmp/legacy-interrupted-copy.parquet",
                  tableName: "legacy_events",
                })
              )
              .pipe(Effect.forkChild({ startImmediately: true }));
            yield* awaitLatch(copyStarted);
            const interruption = yield* Fiber.interrupt(firstFiber).pipe(Effect.forkChild({ startImmediately: true }));
            const readFiber = yield* duckdb
              .query("SELECT 2 AS value")
              .pipe(Effect.forkChild({ startImmediately: true }));
            expect(yield* latchResolvesWithin(readStarted, 50)).toBe(false);
            releaseCopy.resolve();
            expect(yield* latchResolvesWithin(readStarted, 1000)).toBe(true);
            expect(yield* Fiber.join(readFiber)).toEqual([{ value: 2 }]);
            yield* Fiber.join(interruption);
            pipe(yield* Fiber.await(firstFiber), Exit.hasInterrupts, assertTrue);
          }).pipe(Effect.ensuring(Effect.sync(() => releaseCopy.resolve())));
        })
      );
    }
  );

  it.effect(
    "closes a legacy scoped instance when connection acquisition fails",
    Effect.fnUntraced(function* () {
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
      yield* patchDuckDbInstanceCreate(fakeCreate);

      const exit = yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.query("SELECT 1 AS value");
      }).pipe(
        provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
        Effect.exit
      );

      pipe(exit, Exit.isFailure, assertTrue);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect(
    "closes a legacy scoped instance even when connection close fails",
    Effect.fnUntraced(function* () {
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
      yield* patchDuckDbInstanceCreate(fakeCreate);

      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.run("SELECT 1 AS value");
      }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))));

      expect(connectionCloseAttempts).toBe(1);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.effect(
    "registers legacy scoped cleanup when first acquisition is interrupted",
    Effect.fnUntraced(function* () {
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
      yield* patchDuckDbInstanceCreate(fakeCreate);

      yield* Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))).pipe(
        Effect.flatMap((context) =>
          Effect.gen(function* () {
            const queryFiber = yield* Effect.gen(function* () {
              const duckdb = yield* DuckDb;
              yield* duckdb.query("SELECT 1 AS value");
            }).pipe(Effect.provide(context), Effect.forkChild({ startImmediately: true }));

            yield* awaitLatch(connectStarted);
            yield* Fiber.interrupt(queryFiber).pipe(Effect.forkChild({ startImmediately: true }));
            yield* liveSleep(25);
            expect(connectionCloseAttempts).toBe(0);
            expect(instanceCloseAttempts).toBe(0);
            connect.resolve(fakeConnection as unknown as DuckDBConnection);
            yield* Fiber.await(queryFiber);
          }).pipe(Effect.ensuring(Effect.sync(() => connect.resolve(fakeConnection as unknown as DuckDBConnection))))
        ),
        Effect.scoped
      );

      expect(connectionCloseAttempts).toBe(1);
      expect(instanceCloseAttempts).toBe(1);
    })
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "rolls back legacy transactions interrupted after delayed begin",
        Effect.fnUntraced(function* () {
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
          yield* patchDuckDbInstanceCreate(fakeCreate);

          const result = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const transactionFiber = yield* duckdb
              .withTransaction(() => Effect.sleep("1 hour"))
              .pipe(Effect.forkChild({ startImmediately: true }));

            yield* awaitLatch(beginStarted);
            yield* liveSleep(75);
            yield* Fiber.interrupt(transactionFiber).pipe(Effect.forkChild({ startImmediately: true }));
            expect(statements).toEqual(["BEGIN TRANSACTION"]);
            releaseBegin.resolve();
            expect(yield* latchResolvesWithin(rollbackStarted, 1000)).toBe(true);
            return yield* Fiber.await(transactionFiber);
          }).pipe(Effect.ensuring(Effect.sync(() => releaseBegin.resolve())));

          pipe(result, Exit.isFailure, assertTrue);
          expect(statements).toEqual(["BEGIN TRANSACTION", "ROLLBACK"]);
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "does not roll back legacy transactions when begin fails",
        Effect.fnUntraced(function* () {
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
          yield* patchDuckDbInstanceCreate(fakeCreate);

          const exit = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.withTransaction(() => Effect.void);
          }).pipe(Effect.exit);

          pipe(exit, Exit.isFailure, assertTrue);
          expect(yield* latchResolvesWithin(rollbackStarted, 50)).toBe(false);
          expect(statements).toEqual(["BEGIN TRANSACTION"]);
        })
      );
    }
  );

  it.layer(
    Layer.unwrap(
      Effect.gen(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "metrics.duckdb");
        return DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));
      })
    ).pipe(Layer.provideMerge(nativeDirectoryLayer)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "rolls back failed nested transactions on the same connection",
      Effect.fnUntraced(function* () {
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

        pipe(exit, Exit.isFailure, assertTrue);
        const rows = yield* duckdb.query("SELECT count(*) AS count FROM tx_events");
        expect(rows).toEqual([{ count: "0" }]);
      })
    );
  });
});

const setupResult = {
  closeSync: () => undefined,
  returnType: 3,
  rowsChanged: 0,
  convertRowObjects: () => Promise.resolve([{ database_name: "memory", path: null }]),
  convertRows: () => Promise.resolve([]),
};

const isSetupStatement = (sql: string): boolean => /^SET TimeZone|duckdb_databases/.test(sql);

const fakeQueryResult = (rows: ReadonlyArray<Record<string, unknown>>) => ({
  closeSync: () => undefined,
  returnType: 3,
  rowsChanged: 0,
  convertRowObjects: () => Promise.resolve(rows),
  convertRows: () => Promise.resolve([]),
});

const reasonTagOf = (error: { readonly reason: { readonly _tag: string } }): string => error.reason._tag;

describe("DuckDbClient native lifecycle", { concurrent: false }, () => {
  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "adopts a caller-owned live connection without closing it",
      Effect.fnUntraced(function* () {
        const liveConnection = yield* acquireNativeDuckDbConnection;
        const clientScope = yield* Scope.make();
        const client = yield* DuckDbClient.fromConnection({ connection: liveConnection }).pipe(
          Scope.provide(clientScope)
        );
        const sql = client.withoutTransforms();

        yield* sql`CREATE TABLE live_connection_events (id VARCHAR)`;
        yield* sql`INSERT INTO live_connection_events VALUES (${"live-1"})`;
        const rows = yield* sql<{ readonly id: string }>`SELECT id FROM live_connection_events ORDER BY id`;
        expect(rows).toEqual([{ id: "live-1" }]);

        yield* Scope.close(clientScope, Exit.void);
        const closed = yield* Effect.flip(sql`SELECT 1 AS n`);
        expect(reasonTagOf(closed)).toBe("ConnectionError");
        const after = yield* Effect.promise(() =>
          liveConnection.runAndReadAll("SELECT count(*)::INTEGER AS n FROM live_connection_events")
        );
        expect(after.getRowObjectsJson()).toEqual([{ n: 1 }]);
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "fails a catalog-context statement after the client scope closes with ConnectionError",
      Effect.fnUntraced(function* () {
        const liveConnection = yield* acquireNativeDuckDbConnection;
        const clientScope = yield* Scope.make();
        const client = yield* DuckDbClient.fromConnection({ connection: liveConnection }).pipe(
          Scope.provide(clientScope)
        );
        const sql = client.withoutTransforms();

        // A bound statement fills the prepared cache, so a later `USE` would
        // reach `invalidateAll` on the closed cache if invalidation ran.
        yield* sql`SELECT ${1} AS n`;
        yield* Scope.close(clientScope, Exit.void);

        const exit = yield* Effect.exit(sql.unsafe("USE memory"));
        expect(Exit.hasInterrupts(exit)).toBe(false);
        assertSome(exit.pipe(Exit.findErrorOption, O.map(reasonTagOf)), "ConnectionError");
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "closes a created instance when connection acquisition fails",
      Effect.fnUntraced(function* () {
        let instanceCloseAttempts = 0;
        const fakeInstance = {
          closeSync: () => {
            instanceCloseAttempts += 1;
          },
          connect: () => Promise.reject(new Error("connect failed")),
        };
        const fakeCreate: typeof DuckDBInstance.create = () =>
          Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);
        yield* patchDuckDbInstanceCreate(fakeCreate);

        const clientScope = yield* Scope.make();
        const exit = yield* DuckDbClient.make({ databasePath: ":memory:" }).pipe(
          Scope.provide(clientScope),
          Effect.exit
        );
        yield* Scope.close(clientScope, Exit.void);

        pipe(exit, Exit.isFailure, assertTrue);
        expect(instanceCloseAttempts).toBe(1);
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "closes the managed instance even when connection close fails",
      Effect.fnUntraced(function* () {
        let connectionCloseAttempts = 0;
        let instanceCloseAttempts = 0;
        const fakeConnection = {
          closeSync: () => {
            connectionCloseAttempts += 1;
            throw new Error("connection close failed");
          },
          interrupt: () => undefined,
          prepare: () => Promise.reject(new Error("prepare unavailable")),
          run: () => Promise.resolve(setupResult),
        };
        const fakeInstance = {
          closeSync: () => {
            instanceCloseAttempts += 1;
          },
          connect: () => Promise.resolve(fakeConnection as unknown as DuckDBConnection),
        };
        const fakeCreate: typeof DuckDBInstance.create = () =>
          Promise.resolve(fakeInstance as unknown as Awaited<ReturnType<typeof DuckDBInstance.create>>);
        yield* patchDuckDbInstanceCreate(fakeCreate);

        const clientScope = yield* Scope.make();
        yield* DuckDbClient.make({ databasePath: ":memory:" }).pipe(Scope.provide(clientScope));
        yield* Scope.close(clientScope, Exit.void);

        expect(connectionCloseAttempts).toBe(1);
        expect(instanceCloseAttempts).toBe(1);
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect("closes an appender acquired after interruption before reusing the connection", () =>
      Effect.gen(function* () {
        const native = yield* acquireNativeDuckDbConnection;
        const client = yield* DuckDbClient.fromConnection({ connection: native });
        yield* client`CREATE TABLE append_cancel (id INTEGER)`;
        const started = makeLatch();
        const release = makeLatch();
        const original = native.createAppender.bind(native);
        let closed = 0;
        native.createAppender = (...args) =>
          original(...args).then((appender) => {
            const close = appender.closeSync.bind(appender);
            appender.closeSync = () => {
              closed += 1;
              close();
            };
            started.resolve();
            return release.promise.then(() => appender);
          });
        const fiber = yield* client
          .appendRows({ table: "append_cancel", rows: [[1]] })
          .pipe(Effect.forkChild({ startImmediately: true }));
        yield* awaitLatch(started);
        const interrupted = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild({ startImmediately: true }));
        release.resolve();
        yield* Fiber.join(interrupted);
        expect(closed).toBe(1);
        expect(yield* client`SELECT count(*) AS n FROM append_cancel`).toEqual([{ n: 0 }]);
      })
    );

    it.effect("discards buffered rows when interrupted between appender rows", () =>
      Effect.gen(function* () {
        const native = yield* acquireNativeDuckDbConnection;
        const client = yield* DuckDbClient.fromConnection({ connection: native });
        yield* client`CREATE TABLE append_cancel_buffer (id INTEGER)`;
        const original = native.createAppender.bind(native);
        let interruptAppend = () => {};
        let endedRows = 0;
        let closed = 0;
        native.createAppender = (...args) =>
          original(...args).then((appender) => {
            const endRow = appender.endRow.bind(appender);
            const close = appender.closeSync.bind(appender);
            appender.endRow = () => {
              endRow();
              endedRows += 1;
              interruptAppend();
            };
            appender.closeSync = () => {
              closed += 1;
              close();
            };
            return appender;
          });
        const fiber = yield* client
          .appendRows({ table: "append_cancel_buffer", rows: [[1], [2]] })
          .pipe(Effect.forkChild({ startImmediately: true }));
        interruptAppend = () => fiber.interruptUnsafe();
        expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true);
        expect(endedRows).toBe(1);
        expect(closed).toBe(1);
        expect(yield* client`SELECT count(*) AS n FROM append_cancel_buffer`).toEqual([{ n: 0 }]);
        yield* client.appendRows({ table: "append_cancel_buffer", rows: [[3]] });
        expect(yield* client`SELECT * FROM append_cancel_buffer`).toEqual([{ id: 3 }]);
      })
    );

    it.effect("serializes statements on the shared native connection", () =>
      Effect.gen(function* () {
        const liveConnection = yield* acquireNativeDuckDbConnection;
        const client = yield* DuckDbClient.fromConnection({ connection: liveConnection });
        const sql = client.withoutTransforms();

        const firstStarted = makeLatch();
        const releaseFirst = makeLatch();
        const secondStarted = makeLatch();
        let firstRun = true;
        let activeExecutions = 0;
        let maxActiveExecutions = 0;
        const run = liveConnection.run.bind(liveConnection);
        liveConnection.run = (...args: Parameters<DuckDBConnection["run"]>) => {
          activeExecutions += 1;
          maxActiveExecutions = activeExecutions > maxActiveExecutions ? activeExecutions : maxActiveExecutions;
          if (firstRun) {
            firstRun = false;
            firstStarted.resolve();
            return releaseFirst.promise
              .then(() => run(...args))
              .finally(() => {
                activeExecutions -= 1;
              });
          }
          secondStarted.resolve();
          return run(...args).finally(() => {
            activeExecutions -= 1;
          });
        };

        yield* Effect.gen(function* () {
          const firstFiber = yield* sql
            .unsafe<{ readonly value: number }>("SELECT 1 AS value")
            .unprepared.pipe(Effect.forkChild({ startImmediately: true }));
          yield* awaitLatch(firstStarted);
          const secondFiber = yield* sql
            .unsafe<{ readonly value: number }>("SELECT 2 AS value")
            .unprepared.pipe(Effect.forkChild({ startImmediately: true }));
          expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
          releaseFirst.resolve();
          expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
          expect(yield* Fiber.join(firstFiber)).toEqual([{ value: 1 }]);
          expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
          expect(maxActiveExecutions).toBe(1);
        }).pipe(Effect.ensuring(Effect.sync(() => releaseFirst.resolve())));
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect("streams rows through native streaming results", () =>
      Effect.gen(function* () {
        const liveConnection = yield* acquireNativeDuckDbConnection;
        const client = yield* DuckDbClient.fromConnection({ connection: liveConnection });
        const sql = client.withoutTransforms();

        yield* sql`CREATE TABLE stream_events (id VARCHAR)`;
        yield* sql`INSERT INTO stream_events VALUES (${"stream-1"}), (${"stream-2"})`;

        let streamCalls = 0;
        let runCalls = 0;
        const stream = liveConnection.stream.bind(liveConnection);
        const run = liveConnection.run.bind(liveConnection);
        liveConnection.stream = (...args: Parameters<DuckDBConnection["stream"]>) => {
          streamCalls += 1;
          return stream(...args);
        };
        liveConnection.run = (...args: Parameters<DuckDBConnection["run"]>) => {
          runCalls += 1;
          return run(...args);
        };

        const streamedRows = yield* Stream.runCollect(
          sql<{ readonly id: string }>`SELECT id FROM stream_events ORDER BY id`.stream
        );

        expect(A.fromIterable(streamedRows)).toEqual([{ id: "stream-1" }, { id: "stream-2" }]);
        expect(streamCalls).toBe(1);
        expect(runCalls).toBe(0);
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect("keeps the connection locked until an interrupted native operation settles", () =>
      Effect.gen(function* () {
        const firstStarted = makeLatch();
        const releaseFirst = makeLatch();
        const secondStarted = makeLatch();
        let firstRun = true;
        const fakeConnection = {
          closeSync: () => undefined,
          interrupt: () => undefined,
          prepare: () => Promise.reject(new Error("prepare unavailable")),
          run: (sql: string) => {
            if (isSetupStatement(sql)) {
              return Promise.resolve(setupResult);
            }
            if (firstRun) {
              firstRun = false;
              firstStarted.resolve();
              return releaseFirst.promise.then(() => fakeQueryResult([{ value: 1 }]));
            }
            secondStarted.resolve();
            return Promise.resolve(fakeQueryResult([{ value: 2 }]));
          },
        };
        const client = yield* DuckDbClient.fromConnection({
          connection: fakeConnection as unknown as DuckDBConnection,
        });

        yield* Effect.gen(function* () {
          const firstFiber = yield* client
            .unsafe<{ readonly value: number }>("SELECT 1 AS value")
            .unprepared.pipe(Effect.forkChild({ startImmediately: true }));
          yield* awaitLatch(firstStarted);
          const interruption = yield* Fiber.interrupt(firstFiber).pipe(Effect.forkChild({ startImmediately: true }));
          const secondFiber = yield* client
            .unsafe<{ readonly value: number }>("SELECT 2 AS value")
            .unprepared.pipe(Effect.forkChild({ startImmediately: true }));
          expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
          releaseFirst.resolve();
          expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
          expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
          yield* Fiber.join(interruption);
          pipe(yield* Fiber.await(firstFiber), Exit.hasInterrupts, assertTrue);
        }).pipe(Effect.ensuring(Effect.sync(() => releaseFirst.resolve())));
      })
    );
  });

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect("destroys a statement whose prepare settles after its caller was interrupted", () =>
      Effect.gen(function* () {
        const firstStarted = makeLatch();
        const releaseFirst = makeLatch();
        const secondStarted = makeLatch();
        let destroyCalls = 0;
        let firstPrepare = true;
        const makeStatement = (rows: ReadonlyArray<Record<string, unknown>>) => ({
          bind: () => undefined,
          clearBindings: () => undefined,
          destroySync: () => {
            destroyCalls += 1;
          },
          run: () => Promise.resolve(fakeQueryResult(rows)),
        });
        const fakeConnection = {
          closeSync: () => undefined,
          interrupt: () => undefined,
          prepare: () => {
            if (firstPrepare) {
              firstPrepare = false;
              firstStarted.resolve();
              return releaseFirst.promise.then(() => makeStatement([{ value: 1 }]));
            }
            secondStarted.resolve();
            return Promise.resolve(makeStatement([{ value: 2 }]));
          },
          run: () => Promise.resolve(setupResult),
        };
        const client = yield* DuckDbClient.fromConnection({
          connection: fakeConnection as unknown as DuckDBConnection,
        });

        yield* Effect.gen(function* () {
          const firstFiber = yield* client
            .unsafe<{ readonly value: number }>("select ? as value", [1])
            .pipe(Effect.forkChild({ startImmediately: true }));
          yield* awaitLatch(firstStarted);
          const interruption = yield* Fiber.interrupt(firstFiber).pipe(Effect.forkChild({ startImmediately: true }));
          const secondFiber = yield* client
            .unsafe<{ readonly value: number }>("select ? as value", [2])
            .pipe(Effect.forkChild({ startImmediately: true }));
          expect(yield* latchResolvesWithin(secondStarted, 50)).toBe(false);
          releaseFirst.resolve();
          expect(yield* latchResolvesWithin(secondStarted, 1000)).toBe(true);
          expect(yield* Fiber.join(secondFiber)).toEqual([{ value: 2 }]);
          yield* Fiber.join(interruption);
          expect(destroyCalls).toBe(1);
          pipe(yield* Fiber.await(firstFiber), Exit.hasInterrupts, assertTrue);
        }).pipe(Effect.ensuring(Effect.sync(() => releaseFirst.resolve())));
      })
    );
  });

  it.effect("caches the direct-run fallback when native prepare rejects multiple statements", () =>
    Effect.gen(function* () {
      let prepares = 0;
      const runs: Array<ReadonlyArray<unknown>> = [];
      const fakeConnection = {
        interrupt: () => undefined,
        prepare: () => {
          prepares += 1;
          return Promise.reject(new Error("Invalid Input Error: Cannot prepare multiple statements at once"));
        },
        run: (text: string, binds?: ReadonlyArray<unknown>) => {
          if (text === "select ? as value; select 2") {
            runs.push(binds ?? []);
            return Promise.resolve(fakeQueryResult([{ value: binds?.[0] }]));
          }
          return Promise.resolve(setupResult);
        },
      };
      const client = yield* DuckDbClient.fromConnection({
        connection: fakeConnection as unknown as DuckDBConnection,
      });
      expect(yield* client.unsafe("select ? as value; select 2", [1])).toEqual([{ value: 1 }]);
      expect(yield* client.unsafe("select ? as value; select 2", [3])).toEqual([{ value: 3 }]);
      expect(prepares).toBe(1);
      expect(runs).toEqual([[1], [3]]);
    }).pipe(Effect.provideServiceEffect(Reactivity.Reactivity, Reactivity.make))
  );

  // A private TestClock per test: advancing a clock shared through it.layer
  // would move every other test of that block (effect-vitest EV015).
  it.effect("re-prepares a cached bound statement once its prepareCacheTTL expires", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      let prepared = 0;
      const fakeConnection = {
        closeSync: () => undefined,
        interrupt: () => undefined,
        prepare: () => {
          prepared += 1;
          const generation = prepared;
          events.push(`prepare ${generation}`);
          return Promise.resolve({
            bind: () => undefined,
            clearBindings: () => undefined,
            destroySync: () => {
              events.push(`destroy ${generation}`);
            },
            run: () => Promise.resolve(fakeQueryResult([{ generation }])),
          });
        },
        run: () => Promise.resolve(setupResult),
      };
      const client = yield* DuckDbClient.fromConnection({
        connection: fakeConnection as unknown as DuckDBConnection,
        prepareCacheTTL: "50 millis",
      });
      const select = client.unsafe<{ readonly generation: number }>("select ? as generation", [1]);

      expect(yield* select).toEqual([{ generation: 1 }]);
      // A use inside the TTL reuses the statement and does not extend its lifetime.
      yield* TestClock.adjust("30 millis");
      expect(yield* select).toEqual([{ generation: 1 }]);
      yield* TestClock.adjust("20 millis");
      expect(yield* select).toEqual([{ generation: 2 }]);
      expect(events).toEqual(["prepare 1", "destroy 1", "prepare 2"]);
      yield* TestClock.adjust("49 millis");
      expect(yield* select).toEqual([{ generation: 2 }]);
      expect(events).toEqual(["prepare 1", "destroy 1", "prepare 2"]);
    }).pipe(Effect.provideServiceEffect(Reactivity.Reactivity, Reactivity.make))
  );

  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "fails with ConnectionError when the database directory does not exist",
      Effect.fnUntraced(function* () {
        const error = yield* DuckDbClient.make({ databasePath: "/nonexistent-duckdb-dir/nested/x.duckdb" }).pipe(
          Effect.flip
        );
        expect(reasonTagOf(error)).toBe("ConnectionError");
      })
    );
  });

  it.layer(Layer.merge(nativeDirectoryLayer, Reactivity.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "exports and imports FK data and sequence state in CSV and Parquet",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const sourceScope = yield* Scope.make();
        const databasePath = path.join(tmpDir, "export-source.duckdb");
        const source = yield* DuckDbClient.make({ databasePath }).pipe(Scope.provide(sourceScope));
        yield* source`CREATE SEQUENCE serial START 1`;
        yield* source`CREATE TABLE z_parent (id INTEGER PRIMARY KEY DEFAULT nextval('serial'))`;
        yield* source`CREATE TABLE a_child (id INTEGER PRIMARY KEY, parent INTEGER REFERENCES z_parent(id))`;
        yield* source`INSERT INTO z_parent VALUES (DEFAULT), (DEFAULT), (DEFAULT)`;
        yield* source`INSERT INTO a_child VALUES (1, 3)`;
        const refusedDir = path.join(tmpDir, "refused-export");
        const refused = yield* source
          .withTransaction(source.exportDatabase({ directory: refusedDir }))
          .pipe(Effect.flip);
        expect(refused.reason._tag).toBe("UnknownError");
        expect(yield* fs.exists(refusedDir)).toBe(false);
        for (const format of ["csv", "parquet"] as const) {
          const directory = path.join(tmpDir, format);
          yield* source.exportDatabase({ directory, format });
          const target = yield* DuckDbClient.make({ databasePath: path.join(tmpDir, `import-${format}.duckdb`) });
          yield* target.importDatabase({ directory });
          expect(yield* target`SELECT * FROM a_child`).toEqual([{ id: 1, parent: 3 }]);
          expect(yield* target`SELECT count(*) AS n FROM z_parent`).toEqual([{ n: 3 }]);
          expect(yield* target`SELECT nextval('serial') AS n`).toEqual([{ n: 4 }]);
          expect((yield* target.importDatabase({ directory }).pipe(Effect.flip)).reason._tag).toBe("SqlSyntaxError");
        }
        yield* Scope.close(sourceScope, Exit.void);
        const reader = yield* DuckDbClient.make({ databasePath, readOnly: true });
        const directory = path.join(tmpDir, "readonly-export");
        yield* reader.exportDatabase({ directory });
        expect(yield* fs.exists(path.join(directory, "schema.sql"))).toBe(true);
      })
    );

    it.effect(
      "dumps deterministic catalog DDL and migration history only after applied migrations",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = yield* DuckDbClient.make({ databasePath: ":memory:" });
        yield* source`ATTACH ':memory:' AS ignored`;
        yield* source`CREATE TABLE ignored.main.outside (id INTEGER)`;
        const run = DuckDbMigrator.run({
          schemaDirectory: path.join(tmpDir, "dump"),
          loader: DuckDbMigrator.fromRecord({
            "1_catalog": Effect.gen(function* () {
              const sql = yield* SqlClient.SqlClient;
              yield* sql`CREATE TYPE mood AS ENUM ('good', 'isn''t bad')`;
              yield* sql`CREATE SEQUENCE serial START 7`;
              yield* sql`CREATE TABLE base (id INTEGER DEFAULT nextval('serial'), mood mood)`;
              yield* sql`CREATE MACRO from_base() AS TABLE SELECT * FROM base`;
              yield* sql`CREATE MACRO plus_one(x) AS x + 1`;
              yield* sql`CREATE MACRO typed(a INTEGER) AS 'int', (a VARCHAR) AS 'str'`;
              yield* sql`CREATE MACRO overloaded(x) AS x + 1, (x, y) AS x + y`;
              yield* sql`CREATE MACRO overloaded_table(x) AS TABLE (SELECT x AS n),
                (x, y) AS TABLE (SELECT x + y AS n)`;
              yield* sql`CREATE VIEW scalar_view AS SELECT plus_one(41) AS n`;
              yield* sql`CREATE VIEW table_view AS SELECT * FROM from_base()`;
              yield* sql`CREATE VIEW nested_view AS SELECT * FROM scalar_view`;
              yield* sql`CREATE INDEX mood_idx ON base(mood)`;
              yield* sql`CREATE SCHEMA custom`;
              yield* sql`CREATE TABLE custom.other (id INTEGER)`;
              yield* sql`UPDATE effect_sql_migrations SET created_at = TIMESTAMP '2024-01-01 00:00:00'`;
            }),
          }),
        }).pipe(Effect.provideService(SqlClient.SqlClient, source));
        expect(yield* run).toEqual([[1, "catalog"]]);
        const file = path.join(tmpDir, "dump", "_schema.sql");
        const text = yield* fs.readFileString(file);
        expect(text).not.toContain("outside");
        const target = yield* DuckDbClient.make({ databasePath: ":memory:" });
        yield* target.unsafe(text);
        expect(yield* target`SELECT * FROM nested_view`).toEqual([{ n: 42 }]);
        expect(yield* target`SELECT typed(42) AS a, typed('hello') AS b`).toEqual([{ a: "int", b: "str" }]);
        expect(yield* target`SELECT overloaded(41) AS a, overloaded(20, 22) AS b`).toEqual([{ a: 42, b: 42 }]);
        expect(yield* target`SELECT * FROM overloaded_table(42)`).toEqual([{ n: 42 }]);
        expect(yield* target`SELECT * FROM overloaded_table(20, 22)`).toEqual([{ n: 42 }]);
        expect(yield* target`SELECT * FROM table_view`).toEqual([]);
        yield* target`INSERT INTO base (mood) VALUES ('good')`;
        expect(yield* target`SELECT * FROM base`).toEqual([{ id: 7, mood: "good" }]);
        expect(yield* target`SELECT index_name FROM duckdb_indexes()`).toEqual([{ index_name: "mood_idx" }]);
        expect(yield* target`SELECT * FROM custom.other`).toEqual([]);
        expect(yield* target`SELECT * FROM effect_sql_migrations`).toEqual(
          yield* source`SELECT * FROM effect_sql_migrations`
        );
        yield* fs.writeFileString(file, "unchanged");
        expect(yield* run).toEqual([]);
        expect(yield* fs.readFileString(file)).toBe("unchanged");
        // Re-applying a no-op migration triggers a second dump of the same catalog.
        yield* source`DELETE FROM effect_sql_migrations`;
        const redump = DuckDbMigrator.run({
          schemaDirectory: path.join(tmpDir, "redump"),
          loader: DuckDbMigrator.fromRecord({
            "1_catalog": source`UPDATE effect_sql_migrations SET created_at = TIMESTAMP '2024-01-01 00:00:00'`,
          }),
        }).pipe(Effect.provideService(SqlClient.SqlClient, source));
        yield* redump;
        const second = yield* fs.readFileString(path.join(tmpDir, "redump", "_schema.sql"));
        // Both runs fix the history timestamp so the catalog and rows are identical.
        expect(second).toBe(text);
      })
    );

    it.effect(
      "pins ALTER dependencies beyond OID order and replacement OID renewal",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = yield* DuckDbClient.make({ databasePath: ":memory:" });
        yield* source`CREATE TABLE early (id INTEGER)`;
        yield* source`CREATE SEQUENCE late`;
        yield* source`ALTER TABLE early ALTER COLUMN id SET DEFAULT nextval('late')`;
        yield* source`CREATE VIEW before_view AS SELECT 1 AS n`;
        yield* source`CREATE VIEW after_view AS SELECT 2 AS n`;
        yield* source`CREATE OR REPLACE VIEW before_view AS SELECT * FROM after_view`;
        expect(yield* source`SELECT view_name FROM duckdb_views() WHERE NOT internal ORDER BY view_oid`).toEqual([
          { view_name: "after_view" },
          { view_name: "before_view" },
        ]);
        yield* DuckDbMigrator.run({
          schemaDirectory: path.join(tmpDir, "alter"),
          loader: DuckDbMigrator.fromRecord({ "1_noop": Effect.void }),
        }).pipe(Effect.provideService(SqlClient.SqlClient, source));
        const text = yield* fs.readFileString(path.join(tmpDir, "alter", "_schema.sql"));
        const tableIndex = Str.indexOf("CREATE TABLE early")(text);
        const sequenceIndex = Str.indexOf("CREATE SEQUENCE late")(text);
        expect(O.getOrThrow(tableIndex)).toBeLessThan(O.getOrThrow(sequenceIndex));
        const target = yield* DuckDbClient.make({ databasePath: ":memory:" });
        const error = yield* target.unsafe(text).pipe(Effect.flip);
        expect(error.reason._tag).toBe("SqlSyntaxError");
        expect(error.reason.cause).toMatchObject({
          message: expect.stringContaining("Sequence with name late does not exist"),
        });
      })
    );

    it.effect(
      "keeps applied migrations when writing the schema artifact fails",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = yield* DuckDbClient.make({ databasePath: ":memory:" });
        const schemaDirectory = path.join(tmpDir, "not-a-directory");
        yield* fs.writeFileString(schemaDirectory, "preserved");
        expect(
          yield* DuckDbMigrator.run({
            schemaDirectory,
            loader: DuckDbMigrator.fromRecord({ "1_noop": Effect.void }),
          }).pipe(Effect.provideService(SqlClient.SqlClient, source))
        ).toEqual([[1, "noop"]]);
        expect(yield* fs.readFileString(schemaDirectory)).toBe("preserved");
        expect(yield* source`SELECT migration_id FROM effect_sql_migrations`).toEqual([{ migration_id: 1 }]);
      })
    );

    it.effect(
      "shares one database between clients of the same file",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "shared.duckdb");

        const firstScope = yield* Scope.make();
        const secondScope = yield* Scope.make();
        const first = (yield* DuckDbClient.make({ databasePath }).pipe(Scope.provide(firstScope))).withoutTransforms();
        const second = (yield* DuckDbClient.make({ databasePath }).pipe(
          Scope.provide(secondScope)
        )).withoutTransforms();

        yield* first`CREATE TABLE shared_events (id INTEGER)`;
        yield* first`INSERT INTO shared_events VALUES (${1})`;
        expect(yield* second<{ readonly id: number }>`SELECT id FROM shared_events`).toEqual([{ id: 1 }]);

        const mismatch = yield* DuckDbClient.make({ databasePath, databaseOptions: { threads: "2" } }).pipe(
          Effect.flip
        );
        expect(reasonTagOf(mismatch)).toBe("ConnectionError");

        yield* Scope.close(firstScope, Exit.void);
        yield* Scope.close(secondScope, Exit.void);

        const fresh = (yield* DuckDbClient.make({ databasePath })).withoutTransforms();
        expect(yield* fresh<{ readonly id: number }>`SELECT id FROM shared_events`).toEqual([{ id: 1 }]);
      })
    );
  });

  it.layer(Layer.merge(nativeDirectoryLayer, Reactivity.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses READ_ONLY clients beside an in-process read-write client",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "read-only.duckdb");

        const writerScope = yield* Scope.make();
        const writer = (yield* DuckDbClient.make({ databasePath }).pipe(
          Scope.provide(writerScope)
        )).withoutTransforms();
        yield* writer`CREATE TABLE ro_events (id INTEGER)`;
        yield* writer`INSERT INTO ro_events VALUES (${7})`;

        const refused = yield* DuckDbClient.make({ databasePath, readOnly: true }).pipe(Effect.flip);
        expect(reasonTagOf(refused)).toBe("ConnectionError");

        yield* Scope.close(writerScope, Exit.void);

        const readerA = (yield* DuckDbClient.make({
          databasePath,
          readOnly: true,
          databaseOptions: { ACCESS_MODE: "READ_WRITE" },
        })).withoutTransforms();
        const readerB = (yield* DuckDbClient.make({ databasePath, readOnly: true })).withoutTransforms();
        expect(yield* readerA<{ readonly id: number }>`SELECT id FROM ro_events`).toEqual([{ id: 7 }]);
        expect(yield* readerB<{ readonly id: number }>`SELECT id FROM ro_events`).toEqual([{ id: 7 }]);

        const writeError = yield* readerA`INSERT INTO ro_events VALUES (${8})`.pipe(Effect.flip);
        expect(reasonTagOf(writeError)).toBe("AuthorizationError");

        const writerWhileReading = yield* DuckDbClient.make({ databasePath }).pipe(Effect.flip);
        expect(reasonTagOf(writerWhileReading)).toBe("ConnectionError");
      })
    );
  });

  it.layer(Layer.merge(nativeDirectoryLayer, Reactivity.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "shares a file between the legacy DuckDb service and DuckDbClient",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "legacy-shared.duckdb");

        const legacyContext = yield* Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath })));
        const legacy = Context.get(legacyContext, DuckDb);
        yield* legacy.run("CREATE TABLE legacy_events (id VARCHAR)");
        yield* legacy.run("INSERT INTO legacy_events VALUES ('legacy')");

        const sql = (yield* DuckDbClient.make({ databasePath })).withoutTransforms();
        expect(yield* sql<{ readonly id: string }>`SELECT id FROM legacy_events`).toEqual([{ id: "legacy" }]);
        yield* sql`INSERT INTO legacy_events VALUES (${"client"})`;

        const rows = yield* legacy.query("SELECT id FROM legacy_events ORDER BY id");
        expect(rows).toEqual([{ id: "client" }, { id: "legacy" }]);
      })
    );
  });

  it.layer(Layer.merge(nativeDirectoryLayer, Reactivity.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses legacy READ_ONLY beside a writer and supports standalone cached readers",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "legacy-read-only.duckdb");
        const writerScope = yield* Scope.make();
        const writerContext = yield* Layer.build(
          DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))
        ).pipe(Scope.provide(writerScope));
        const writer = Context.get(writerContext, DuckDb);
        yield* writer.run("CREATE TABLE legacy_ro_events (id INTEGER)");
        yield* writer.run("INSERT INTO legacy_ro_events VALUES (7)");
        yield* writer.run("CHECKPOINT");
        const readOnlyLayer = DuckDb.makeNodeLayer(
          DuckDbConnectionOptions.make({ databasePath, databaseOptions: { access_mode: "READ_ONLY" } })
        );
        const refusedContext = yield* Layer.build(readOnlyLayer);
        const refused = yield* Context.get(refusedContext, DuckDb).query("SELECT 1").pipe(Effect.flip);
        expect(refused._tag).toBe("DuckDbError");
        expect(refused.message).toBe("Failed to open DuckDB connection.");
        expect(String(O.getOrUndefined(refused.cause))).toContain(DIFFERENT_CONFIGURATION);
        // A refused reader must leave the writer usable, including after checkpoint.
        yield* writer.run("INSERT INTO legacy_ro_events VALUES (8)");
        yield* writer.run("CHECKPOINT");
        yield* Scope.close(writerScope, Exit.void);

        const readerScope = yield* Scope.make();
        const readerContext = yield* Layer.build(readOnlyLayer).pipe(Scope.provide(readerScope));
        const reader = Context.get(readerContext, DuckDb);
        expect(yield* reader.query("SELECT id FROM legacy_ro_events ORDER BY id")).toEqual([{ id: 7 }, { id: 8 }]);
        const secondScope = yield* Scope.make();
        const secondContext = yield* Layer.build(readOnlyLayer).pipe(Scope.provide(secondScope));
        const second = Context.get(secondContext, DuckDb);
        expect(yield* second.query("SELECT id FROM legacy_ro_events ORDER BY id")).toEqual([{ id: 7 }, { id: 8 }]);
        const writeError = yield* reader.run("INSERT INTO legacy_ro_events VALUES (9)").pipe(Effect.flip);
        expect(writeError._tag).toBe("DuckDbError");
        const refusedWriter = yield* DuckDbClient.make({ databasePath }).pipe(Effect.flip);
        expect(reasonTagOf(refusedWriter)).toBe("ConnectionError");
        yield* Scope.close(readerScope, Exit.void);
        expect(yield* second.query("SELECT id FROM legacy_ro_events ORDER BY id")).toEqual([{ id: 7 }, { id: 8 }]);
        yield* Scope.close(secondScope, Exit.void);
        const attachedReader = (yield* DuckDbClient.make({ databasePath: ":memory:" })).withoutTransforms();
        yield* attachedReader.attach(databasePath, "legacy_snapshot", { readOnly: true });
        expect(
          yield* attachedReader<{ readonly id: number }>`SELECT id FROM legacy_snapshot.legacy_ro_events ORDER BY id`
        ).toEqual([{ id: 7 }, { id: 8 }]);
        const attachedWriteError = yield* attachedReader`INSERT INTO legacy_snapshot.legacy_ro_events VALUES (9)`.pipe(
          Effect.flip
        );
        expect(reasonTagOf(attachedWriteError)).toBe("AuthorizationError");
        yield* attachedReader.detach("legacy_snapshot");
        const reopened = (yield* DuckDbClient.make({ databasePath })).withoutTransforms();
        yield* reopened`INSERT INTO legacy_ro_events VALUES (${9})`;
        yield* reopened.checkpoint({ force: true });
        expect(yield* reopened<{ readonly id: number }>`SELECT id FROM legacy_ro_events ORDER BY id`).toEqual([
          { id: 7 },
          { id: 8 },
          { id: 9 },
        ]);
      })
    );
  });

  it.layer(
    Layer.unwrap(
      Effect.gen(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        return DuckDbClient.layer({ databasePath: path.join(tmpDir, "parquet.duckdb") });
      })
    ).pipe(Layer.provideMerge(nativeDirectoryLayer)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "exports parquet outside transactions and refuses inside them",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const parquetPath = path.join(tmpDir, "events.parquet");
        const transactionParquetPath = path.join(tmpDir, "transaction-events.parquet");

        const client = yield* DuckDbClient.DuckDbClient;
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        expect(client).toBe(yield* SqlClient.SqlClient);

        yield* sql`CREATE TABLE parquet_events (id VARCHAR, value INTEGER)`;
        yield* sql`INSERT INTO parquet_events VALUES (${"parquet-1"}, ${1})`;
        yield* client.copyTableToParquet(
          DuckDbParquetExport.make({ filePath: parquetPath, tableName: "parquet_events" })
        );
        expect(yield* fs.exists(parquetPath)).toBe(true);
        expect(
          yield* sql.unsafe<{ readonly id: string; readonly value: number }>(
            `SELECT id, value FROM read_parquet('${parquetPath}')`
          )
        ).toEqual([{ id: "parquet-1", value: 1 }]);

        const refused = yield* sql
          .withTransaction(
            client.copyTableToParquet(
              DuckDbParquetExport.make({ filePath: transactionParquetPath, tableName: "parquet_events" })
            )
          )
          .pipe(Effect.flip);
        expect(reasonTagOf(refused)).toBe("UnknownError");
        expect(yield* fs.exists(transactionParquetPath)).toBe(false);
      })
    );
  });
});

type ClassifiedCause = {
  readonly _tag: string;
  readonly reason: { readonly _tag: string };
};

describe("DuckDb legacy re-base", { concurrent: false }, () => {
  it.effect(
    "waits for a running legacy statement before closing the native connection",
    Effect.fnUntraced(function* () {
      const scope = yield* Scope.make();
      const context = yield* Layer.buildWithScope(
        DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })),
        scope
      );
      const duckdb = Context.get(context, DuckDb);
      const fiber = yield* duckdb
        .query("SELECT count(*)::INTEGER AS n FROM range(200000000)")
        .pipe(Effect.forkDetach({ startImmediately: true }));
      yield* liveSleep(50);
      yield* Scope.close(scope, Exit.void);
      const exit = yield* Fiber.await(fiber).pipe(Effect.timeoutOption(Duration.seconds(20)), TestClock.withLive);
      pipe(exit, O.isSome, assertTrue);
    }),
    { timeout: 30_000 }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "refuses to commit a legacy transaction DuckDB aborted after a swallowed failure",
        Effect.fnUntraced(function* () {
          const duckdb = yield* DuckDb;
          yield* duckdb.run("CREATE TABLE aborted_events (id INTEGER PRIMARY KEY)");
          yield* duckdb.run("INSERT INTO aborted_events VALUES (1)");

          const error = yield* duckdb
            .withTransaction(
              Effect.fnUntraced(function* (transaction) {
                yield* transaction.run("INSERT INTO aborted_events VALUES (2)");
                yield* transaction.run("INSERT INTO aborted_events VALUES (1)").pipe(Effect.ignore);
                return "swallowed";
              })
            )
            .pipe(Effect.flip);

          expect(error._tag).toBe("DuckDbError");
          expect(error.operation).toBe("withTransaction");
          expect(error.message).toContain("DuckDB aborted this transaction");
          pipe(error.cause, O.isSome, assertTrue);
          expect(yield* duckdb.query("SELECT id FROM aborted_events ORDER BY id")).toEqual([{ id: 1 }]);
        })
      );

      it.effect(
        "refuses to commit a legacy transaction after a swallowed interrupted statement",
        Effect.fnUntraced(function* () {
          const duckdb = yield* DuckDb;
          yield* duckdb.run("CREATE TABLE interrupted_events (id INTEGER PRIMARY KEY)");

          const error = yield* duckdb
            .withTransaction(
              Effect.fnUntraced(function* (transaction) {
                yield* transaction.run("INSERT INTO interrupted_events VALUES (1)");
                const slow = yield* transaction
                  .query("SELECT sum(a.range * b.range) AS total FROM range(1000000) a, range(1000000) b")
                  .pipe(Effect.timeoutOption(Duration.millis(100)), TestClock.withLive);
                assertNone(slow);
                return "swallowed";
              })
            )
            .pipe(Effect.flip);

          expect(error._tag).toBe("DuckDbError");
          expect(error.operation).toBe("withTransaction");
          expect(error.message).toContain("DuckDB aborted this transaction");
          expect(yield* duckdb.query("SELECT count(*)::INTEGER AS n FROM interrupted_events")).toEqual([{ n: 0 }]);
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "cancels a long legacy native query on interruption and stays usable",
        Effect.fnUntraced(function* () {
          const duckdb = yield* DuckDb;
          const exit = yield* duckdb
            .query("SELECT sum(a.range * b.range) AS total FROM range(1000000) a, range(1000000) b")
            .pipe(Effect.timeout(Duration.millis(200)), TestClock.withLive, Effect.exit);

          pipe(exit, Exit.isFailure, assertTrue);
          expect(yield* duckdb.query("SELECT 42 AS answer")).toEqual([{ answer: 42 }]);
        })
      );
    }
  );

  it.layer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "keeps the classified SqlError as the legacy DuckDbError cause",
        Effect.fnUntraced(function* () {
          const duckdb = yield* DuckDb;
          yield* duckdb.run("CREATE TABLE unique_events (id INTEGER PRIMARY KEY)");
          yield* duckdb.run("INSERT INTO unique_events VALUES ($id)", { id: 1 });

          const error = yield* duckdb.run("INSERT INTO unique_events VALUES ($id)", { id: 1 }).pipe(Effect.flip);

          expect(error.operation).toBe("run");
          expect(O.getOrUndefined(error.statement)).toBe("INSERT INTO unique_events VALUES ($id)");
          const cause = O.getOrThrow(error.cause) as ClassifiedCause;
          expect(cause._tag).toBe("SqlError");
          expect(reasonTagOf(cause)).toBe("UniqueViolation");
          expect(error.message).toContain("Constraint Error: Duplicate key");
        })
      );
    }
  );
});

const DIFFERENT_CONFIGURATION = "Can't open a connection to same database file with a different configuration";

describe("DuckDbClient read-only first open", { concurrent: false }, () => {
  it.layer(Layer.merge(nativeDirectoryLayer, Reactivity.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "blocks later read-write opens of the same file until the read-only client closes",
      Effect.fnUntraced(function* () {
        const tmpDir = yield* NativeTestDirectory;
        const path = yield* Path.Path;
        const databasePath = path.join(tmpDir, "read-only-first.duckdb");

        const seedScope = yield* Scope.make();
        const seed = (yield* DuckDbClient.make({ databasePath }).pipe(Scope.provide(seedScope))).withoutTransforms();
        yield* seed`CREATE TABLE ro_first_events (id INTEGER)`;
        yield* seed`INSERT INTO ro_first_events VALUES (${1})`;
        yield* Scope.close(seedScope, Exit.void);

        const readerScope = yield* Scope.make();
        const reader = (yield* DuckDbClient.make({ databasePath, readOnly: true }).pipe(
          Scope.provide(readerScope)
        )).withoutTransforms();

        const refused = yield* DuckDbClient.make({ databasePath }).pipe(Effect.flip);
        expect(reasonTagOf(refused)).toBe("ConnectionError");
        expect(refused.reason.isRetryable).toBe(true);
        expect(String(refused.reason.cause)).toContain(DIFFERENT_CONFIGURATION);

        const legacyContext = yield* Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath })));
        const legacyError = yield* Context.get(legacyContext, DuckDb)
          .query("SELECT id FROM ro_first_events")
          .pipe(Effect.flip);
        expect(legacyError._tag).toBe("DuckDbError");
        expect(legacyError.message).toBe("Failed to open DuckDB connection.");
        expect(String(O.getOrUndefined(legacyError.cause))).toContain(DIFFERENT_CONFIGURATION);

        expect(yield* reader<{ readonly id: number }>`SELECT id FROM ro_first_events`).toEqual([{ id: 1 }]);
        yield* Scope.close(readerScope, Exit.void);

        const writer = (yield* DuckDbClient.make({ databasePath })).withoutTransforms();
        yield* writer`INSERT INTO ro_first_events VALUES (${2})`;
        expect(yield* writer<{ readonly id: number }>`SELECT id FROM ro_first_events ORDER BY id`).toEqual([
          { id: 1 },
          { id: 2 },
        ]);
      })
    );
  });
});
