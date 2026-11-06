import { DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Reactivity from "effect/reactivity/Reactivity";
import { isSqlError, UnknownError } from "effect/sql/SqlError";
import {
  makeEntry,
  makeOptions,
  makeStorage,
  makeStoreId,
  openChanges,
  suite,
} from "./shared/SqlEventLogServerUnencryptedStorageTest.ts";
import type * as EventJournal from "effect/eventlog/EventJournal";

suite("duckdb", DuckDbTestLayer, { savepoints: false });

const assertEntries = (
  rows: ReadonlyArray<EventJournal.RemoteEntry>,
  expected: ReadonlyArray<EventJournal.Entry>,
  startSequence: number
) => {
  assert.deepStrictEqual(
    A.map(rows, (row) => row.remoteSequence),
    A.map(expected, (_, index) => startSequence + index)
  );
  assert.deepStrictEqual(
    A.map(rows, (row) => row.entry.idString),
    A.map(expected, (entry) => entry.idString)
  );
};

it.layer(Layer.mergeAll(Reactivity.layer, DuckDbTestLayer), { timeout: "30 seconds" })(
  "SqlEventLogServerUnencrypted (duckdb, no savepoints)",
  (it) => {
    // Replaces the vendored "commits outer writes but discards a caught nested rollback" case:
    // DuckDB has no savepoints, so a caught nested rollback refuses the outer COMMIT.
    it.effect("refuses the outer commit after a caught nested rollback and publishes nothing from it", () =>
      Effect.gen(function* () {
        const storage = yield* makeStorage(makeOptions("nested_rollback_refused"));
        const storeId = makeStoreId("nested_rollback_refused");
        const backlog = makeEntry("Ada");
        const before = makeEntry("Grace");
        const rolledBack = makeEntry("Margaret");
        const after = makeEntry("Linus");
        const sentinel = makeEntry("Barbara");
        yield* storage.write(storeId, [backlog]);
        const changes = yield* openChanges(storage, storeId);
        assertEntries([yield* Queue.take(changes)], [backlog], 1);

        const exit = yield* storage
          .withTransaction(
            Effect.gen(function* () {
              yield* storage.write(storeId, [before]);
              const error = yield* storage
                .withTransaction(
                  Effect.gen(function* () {
                    yield* storage.write(storeId, [rolledBack]);
                    return yield* Effect.fail("nested rollback");
                  })
                )
                .pipe(Effect.flip);
              assert.strictEqual(error, "nested rollback");
              yield* storage.write(storeId, [after]);
            })
          )
          .pipe(Effect.exit);

        // Storage.withTransaction turns SqlError into a defect (`Effect.catchIf(isSqlError, Effect.die)`).
        const failure = exit.pipe(Exit.match({ onSuccess: () => "committed", onFailure: Cause.squash }));
        assertTrue(isSqlError(failure));
        const reason = isSqlError(failure) ? failure.reason : undefined;
        assert.instanceOf(reason, UnknownError);
        assert.strictEqual(reason?.operation, "commitTransaction");

        // The sentinel exposes leaked notifications without sleeps.
        yield* storage.write(storeId, [sentinel]);
        assertEntries([yield* Queue.take(changes)], [sentinel], 2);
        yield* Effect.yieldNow;
        const poll1 = yield* Queue.poll(changes);
        assertNone(poll1);

        const openChanges2 = yield* openChanges(storage, storeId);
        const persisted = yield* Queue.takeAll(openChanges2);
        assertEntries(persisted, [backlog, sentinel], 1);
      })
    );
  }
);
