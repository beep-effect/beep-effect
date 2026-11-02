import * as SqlEventJournal from "@beep/duckdb/DuckDbEventJournal";
/** Vendored from effect@4.0.6 (MIT, Effectful Technologies Inc.). */
// beep: public leaf imports, repo test runner, native storage and Effect helpers satisfy repo laws.
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import type * as SqlClient from "effect/sql/SqlClient";

let nextNamespace = 0;

// beep: DuckDB has one serialized writer and no server lock catalog. A fiber yield
// lets the competing operation attempt the client permit; it must remain pending.
export const suite: {
  <E>(layer: Layer.Layer<SqlClient.SqlClient, E>): (name: string) => void;
  <E>(name: string, layer: Layer.Layer<SqlClient.SqlClient, E>): void;
} = dual(2, <E>(name: string, layer: Layer.Layer<SqlClient.SqlClient, E>) =>
  it.layer(Layer.merge(Reactivity.layer, layer), { timeout: "60 seconds", excludeTestServices: true })(
    `SqlEventJournal shared by processes (${name})`,
    (it) => {
      // Process B's local write stays open in its callback while process A
      // imports a newer entry. If A commits first, B then commits an entry that
      // sorts before one committed ahead of it, and B's callback never saw it.
      it.effect("an import waits for a local write in flight on another connection", () =>
        Effect.gen(function* () {
          const namespace = `shared_${++nextNamespace}`;
          const options = { entryTable: `${namespace}_entries`, remotesTable: `${namespace}_remotes` };
          const journalA = yield* SqlEventJournal.make(options);
          const journalB = yield* SqlEventJournal.make(options);

          const started = yield* Deferred.make<EventJournal.Entry>();
          const release = yield* Deferred.make<void>();
          const writeB = yield* journalB
            .writeMany({
              entries: [{ event: "Repro", primaryKey: "key", payload: new Uint8Array() }],
              effect: ([entry]) => Effect.andThen(Deferred.succeed(started, entry), Deferred.await(release)),
            })
            .pipe(Effect.forkChild);
          const local = yield* Deferred.await(started);

          const newer = EventJournal.Entry.make(
            {
              id: EventJournal.makeEntryIdUnsafe({ msecs: EventJournal.entryIdMillis(local.id) + 60_000 }),
              event: "Repro",
              primaryKey: "key",
              payload: new Uint8Array(),
            },
            { disableChecks: true }
          );
          const importA = yield* journalA
            .writeFromRemote({
              remoteId: EventJournal.makeRemoteIdUnsafe(),
              entries: [EventJournal.RemoteEntry.make({ remoteSequence: 0, entry: newer })],
              effect: () => Effect.void,
            })
            .pipe(Effect.forkChild);

          yield* Effect.yieldNow;
          const waited = importA.pollUnsafe() === undefined;
          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(writeB);
          yield* Fiber.join(importA);

          assert.isTrue(waited, "the import committed while an older local write was in flight");
          assert.deepStrictEqual(
            A.map(yield* journalA.entries, (entry) => entry.idString),
            [local.idString, newer.idString]
          );
        })
      );
    }
  )
);
