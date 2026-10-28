import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbEventJournal from "@beep/duckdb/DuckDbEventJournal";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as SqlClient from "effect/sql/SqlClient";
import { suite } from "./shared/SqlEventJournalSharedTest.ts";

suite("duckdb", DuckDbTestLayer);
it.layer(DuckDbTestLayer, { timeout: "30 seconds" })("DuckDB journal widths", (it) => {
  it.effect("round-trips current epoch milliseconds and remote sequences beyond INT32", () =>
    Effect.gen(function* () {
      const journal = yield* DuckDbEventJournal.make({ entryTable: "width_entries", remotesTable: "width_remotes" });
      const now = yield* Clock.currentTimeMillis;
      const remoteId = EventJournal.makeRemoteIdUnsafe();
      const entry = EventJournal.Entry.make(
        {
          id: EventJournal.makeEntryIdUnsafe({ msecs: now }),
          event: "Width",
          primaryKey: "key",
          payload: new Uint8Array(),
        },
        { disableChecks: true }
      );
      yield* journal.writeFromRemote({
        remoteId,
        entries: [EventJournal.RemoteEntry.make({ entry, remoteSequence: 4294967296 })],
        effect: () => Effect.void,
      });
      assert.strictEqual(EventJournal.entryIdMillis(A.getUnsafe(yield* journal.entries, 0).id), now);
      const sql = yield* SqlClient.SqlClient;
      const [cursor] = yield* sql<{ next_sequence: number }>`SELECT next_sequence FROM width_remotes_cursors`;
      assert.strictEqual(cursor?.next_sequence, 4294967297);
    })
  );
});
