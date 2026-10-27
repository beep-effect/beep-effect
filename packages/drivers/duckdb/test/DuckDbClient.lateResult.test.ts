import { DuckDbClient } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as MutableRef from "effect/MutableRef";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import type { DuckDBConnection } from "@duckdb/node-api";

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
  });
});
