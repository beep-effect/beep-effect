import * as SqlEventLogServerEncrypted from "@beep/duckdb/DuckDbEventLogServerEncrypted";
/** Vendored from effect@4.0.6 (MIT, Effectful Technologies Inc.). */
// beep: public leaf imports, repo test runner, native storage and Effect helpers satisfy repo laws.
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as EventLogEncryption from "effect/eventlog/EventLogEncryption";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import type { StoreId } from "effect/eventlog/EventLogMessage";

const storeId = "store-a" as StoreId;
let nextNamespace = 0;

const makeBatch = (...entryIds: Array<EventJournal.EntryId>): EventLogEncryption.EncryptedBatch => ({
  entryIds: entryIds as [EventJournal.EntryId, ...Array<EventJournal.EntryId>],
  iv: new Uint8Array(12),
  encryptedBatch: Uint8Array.of(entryIds.length),
});

const ids = (batches: ReadonlyArray<{ readonly entryIds: ReadonlyArray<EventJournal.EntryId> }>) =>
  A.map(batches, (batch) =>
    A.map(batch.entryIds, (id) =>
      A.join(
        A.map(A.fromIterable(id), (n) => `${n}`),
        ","
      )
    )
  );

// beep: DuckDB has no server lock catalog; yielding allows the other writer
// to attempt the shared client permit before this transaction is released.
const awaitLockWait = Effect.yieldNow;

// Writer A holds its write open in a transaction until writer B, a separate
// storage standing in for another server process, is blocked on it. B retries
// once if it loses, as a client retries a failed write.
const competingWrites = Effect.fnUntraced(function* (
  first: EventLogEncryption.EncryptedBatch,
  second: EventLogEncryption.EncryptedBatch
) {
  const sql = yield* SqlClient.SqlClient;
  const publicKey = yield* Effect.sync(() => EventJournal.makeEntryIdUnsafe().toString());
  // Own tables, so other suites sharing the database don't race on creating them.
  const namespace = `competing_${++nextNamespace}`;
  const options = { entryTablePrefix: `${namespace}_events`, remoteIdTable: `${namespace}_remote_id` };
  const storageA = yield* SqlEventLogServerEncrypted.makeStorage(options);
  const storageB = yield* SqlEventLogServerEncrypted.makeStorage(options);
  // Create the scope's tables first, so only the writes compete.
  const setup = makeBatch(EventJournal.makeEntryIdUnsafe());
  yield* storageA.write(publicKey, storeId, [setup]);
  yield* storageB.changes(publicKey, storeId, 0).pipe(Stream.take(1), Stream.runDrain);

  const written = yield* Deferred.make<void>();
  const commit = yield* Deferred.make<void>();
  const writerA = yield* sql
    .withTransaction(
      Effect.gen(function* () {
        yield* storageA.write(publicKey, storeId, [first]);
        yield* Deferred.succeed(written, undefined);
        yield* Deferred.await(commit);
      })
    )
    .pipe(Effect.forkChild);
  yield* Deferred.await(written);

  const writerB = yield* storageB.write(publicKey, storeId, [second]).pipe(Effect.forkChild);
  yield* awaitLockWait;
  yield* Deferred.succeed(commit, undefined);
  yield* Fiber.join(writerA);
  const attempt = yield* Fiber.await(writerB);
  const stored = Exit.isSuccess(attempt) ? attempt.value : yield* storageB.write(publicKey, storeId, [second]);

  const persisted = yield* storageA.changes(publicKey, storeId, 0).pipe(Stream.take(3), Stream.runCollect);
  return { stored, persisted: A.drop(persisted, 1) };
});

// beep: Share the competing-write sequence assertion for the duplication gate.
const assertConsecutive = (batches: ReadonlyArray<EventLogEncryption.EncryptedRemoteBatch>) => {
  const first = A.getUnsafe(batches, 0).sequence;
  assert.deepStrictEqual(
    A.map(batches, (batch) => batch.sequence),
    [first, first + 1]
  );
};

export const suite: {
  <E>(layer: Layer.Layer<SqlClient.SqlClient, E>): (name: string) => void;
  <E>(name: string, layer: Layer.Layer<SqlClient.SqlClient, E>): void;
} = dual(2, <E>(name: string, layer: Layer.Layer<SqlClient.SqlClient, E>) =>
  it.layer(Layer.mergeAll(Reactivity.layer, EventLogEncryption.layerSubtle, layer), {
    timeout: "60 seconds",
    excludeTestServices: true,
  })(`SqlEventLogServerEncrypted storage (${name})`, (it) => {
    it.effect(
      "stores a batch with more ids than one statement can bind",
      () =>
        Effect.gen(function* () {
          const publicKey = yield* Effect.sync(() => EventJournal.makeEntryIdUnsafe().toString());
          const namespace = `oversized_${++nextNamespace}`;
          const storage = yield* SqlEventLogServerEncrypted.makeStorage({
            entryTablePrefix: `${namespace}_events`,
            remoteIdTable: `${namespace}_remote_id`,
          });
          // Above the bind parameter limits: 2100 on SQL Server, 32767 for the
          // PostgreSQL client and 65535 on MySQL.
          const batch: EventLogEncryption.EncryptedBatch = {
            entryIds: A.makeBy(65_536, () => EventJournal.makeEntryIdUnsafe()),
            iv: new Uint8Array(12),
            encryptedBatch: Uint8Array.of(1),
          };

          const stored = yield* storage.write(publicKey, storeId, [batch]);
          const retried = yield* storage.write(publicKey, storeId, [batch]);
          const persisted = yield* storage.changes(publicKey, storeId, 0).pipe(Stream.take(1), Stream.runCollect);

          assert.deepStrictEqual(ids(stored), ids([batch]));
          assert.deepStrictEqual(retried, []);
          assert.deepStrictEqual(ids(persisted), ids([batch]));
          assert.strictEqual(A.getUnsafe(persisted, 0).sequence, A.getUnsafe(stored, 0).sequence);
        }),
      { timeout: 60_000 }
    );

    it.effect("stores a competing write after its writer retries", () =>
      Effect.gen(function* () {
        const [a, b] = [EventJournal.makeEntryIdUnsafe(), EventJournal.makeEntryIdUnsafe()];
        const { persisted, stored } = yield* competingWrites(makeBatch(a), makeBatch(b));

        assert.deepStrictEqual(ids(stored), ids([makeBatch(b)]));
        assert.deepStrictEqual(ids(persisted), ids([makeBatch(a), makeBatch(b)]));
        // beep: Reuse the sequence assertion required by the duplication gate.
        assertConsecutive(persisted);
      })
    );

    it.effect("stores a competing partly known batch whole, once", () =>
      Effect.gen(function* () {
        const [a, b] = [EventJournal.makeEntryIdUnsafe(), EventJournal.makeEntryIdUnsafe()];
        const { persisted, stored } = yield* competingWrites(makeBatch(a), makeBatch(b, a));

        assert.deepStrictEqual(ids(stored), ids([makeBatch(b, a)]));
        assert.deepStrictEqual(ids(persisted), ids([makeBatch(a), makeBatch(b, a)]));
        // beep: Reuse the sequence assertion required by the duplication gate.
        assertConsecutive(persisted);
      })
    );
  })
);
