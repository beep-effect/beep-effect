import { DuckDbClient } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { assert, describe, vi } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as MutableRef from "effect/MutableRef";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";

// Fake native connection whose `stream` call ignores `interrupt()` and only
// resolves once the test releases it, after the caller was already cancelled.
const setupResult = {
  closeSync: () => undefined,
  returnType: 3,
  rowsChanged: 0,
  convertRowObjects: () => Promise.resolve([{ database_name: "memory", path: null }]),
  convertRows: () => Promise.resolve([]),
};

const makeLateStreamNative = () => {
  const started = Deferred.makeUnsafe<void>();
  const interrupted = Deferred.makeUnsafe<void>();
  const closed = MutableRef.make(0);
  const lateResult = {
    closeSync: () => {
      MutableRef.update(closed, (n) => n + 1);
    },
  };
  const late = Promise.withResolvers<typeof lateResult>();
  const connection = {
    run: (sql: string) =>
      /duckdb_databases/.test(sql) ? Promise.resolve(setupResult) : Promise.reject(new Error(`unexpected: ${sql}`)),
    prepare: () => Promise.reject(new Error("unexpected prepare")),
    stream: () => {
      Deferred.doneUnsafe(started, Effect.void);
      return late.promise;
    },
    interrupt: () => {
      Deferred.doneUnsafe(interrupted, Effect.void);
    },
    closeSync: () => undefined,
  };
  return {
    connection: connection as unknown as DuckDBConnection,
    started,
    interrupted,
    closed,
    release: () => late.resolve(lateResult),
  };
};

describe("DuckDbClient late native results", () => {
  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "closes a stream result that resolves after its caller was interrupted",
      Effect.fnUntraced(function* () {
        const native = makeLateStreamNative();
        const client = yield* DuckDbClient.fromConnection({ connection: native.connection });
        const fiber = yield* client.unsafe("SELECT 1 AS one").stream.pipe(Stream.runCollect, Effect.forkChild);
        yield* Deferred.await(native.started);
        const interrupting = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild);
        // The cancel handler has asked the native call to stop; it completes anyway.
        yield* Deferred.await(native.interrupted);
        native.release();
        yield* Fiber.join(interrupting);
        assert.strictEqual(MutableRef.get(native.closed), 1);
      })
    );
    it.effect(
      "closes materialized results on conversion failure and ignores disposal errors",
      Effect.fnUntraced(function* () {
        const instance = yield* Effect.acquireRelease(
          Effect.promise(() => DuckDBInstance.create(":memory:")),
          (instance) => Effect.sync(() => instance.closeSync())
        );
        const native = yield* Effect.acquireRelease(
          Effect.promise(() => instance.connect()),
          (connection) => Effect.sync(() => connection.closeSync())
        );
        const client = yield* DuckDbClient.fromConnection({ connection: native, prepareCacheSize: 0 });
        const closed = MutableRef.make(0);
        const run = native.run.bind(native);
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(native, "run").mockImplementation((...args) =>
              run(...args).then((result) => {
                vi.spyOn(result, "convertRowObjects").mockRejectedValue(new Error("row conversion refused"));
                const close = result.closeSync.bind(result);
                vi.spyOn(result, "closeSync").mockImplementation(() => {
                  close();
                  MutableRef.update(closed, (n) => n + 1);
                  throw new Error("close refused");
                });
                return result;
              })
            )
          ),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const error = yield* client.unsafe("SELECT 1 AS one").pipe(Effect.flip);
        assert.strictEqual(error.reason.cause instanceof Error && error.reason.cause.message, "row conversion refused");
        assert.strictEqual(MutableRef.get(closed), 1);
        assert.deepStrictEqual(yield* client.unsafe("SELECT 1 AS one").values, [[1]]);
        assert.strictEqual(MutableRef.get(closed), 2);
      })
    );
    it.effect(
      "closes a reader catalog result before reporting malformed session schemas",
      Effect.fnUntraced(function* () {
        const read = DuckDBConnection.prototype.runAndReadAll;
        const closed = MutableRef.make(0);
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(DuckDBConnection.prototype, "runAndReadAll").mockImplementation(function (
              this: DuckDBConnection,
              sql,
              ...args
            ) {
              return read.call(this, sql, ...args).then((result) => {
                if (sql === "SELECT database_name AS catalog, schema_name AS schema FROM duckdb_schemas()") {
                  vi.spyOn(result, "getRowObjects").mockReturnValue([{ catalog: 42, schema: null }]);
                  const close = result.closeSync.bind(result);
                  vi.spyOn(result, "closeSync").mockImplementation(() => {
                    MutableRef.update(closed, (n) => n + 1);
                    close();
                  });
                }
                return result;
              });
            })
          ),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const client = yield* DuckDbClient.make({ databasePath: ":memory:", readerConnections: 1 });
        const error = yield* client.unsafe("SELECT 1 AS one").stream.pipe(Stream.runCollect, Effect.flip);
        assert.strictEqual(error.reason._tag, "UnknownError");
        assert.strictEqual(error.reason.operation, "executeStream");
        assert.strictEqual(MutableRef.get(closed), 1);
      })
    );
  });
});
