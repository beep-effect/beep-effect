import { VerdictRow } from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ModHost } from "@/PracticeMod.host";
import { KgAnswerItem } from "@/PracticeMod.values";
import { VerdictInput, VerdictLog, verdictLogLayer } from "@/PracticeMod.verdicts";
import type { Verdict } from "@beep/law-practice-domain/values";

// What the fake host stored, so a test can seed and inspect it.
class FakeHostState extends Context.Service<
  FakeHostState,
  { readonly store: MutableHashMap.MutableHashMap<string, unknown> }
>()("@beep/practice-claude-mod/test/PracticeMod.verdicts.test/FakeHostState") {}

const fakeHost = Layer.effect(ModHost)(
  Effect.map(FakeHostState, ({ store }) =>
    ModHost.of({
      // Yield after each read so concurrent records interleave between read and write.
      storeGet: Effect.fn("FakeHost.storeGet")((key: string) =>
        Effect.sync(() => O.getOrUndefined(MutableHashMap.get(store, key))).pipe(Effect.tap(() => Effect.yieldNow))
      ),
      storeSet: Effect.fn("FakeHost.storeSet")((key: string, value: unknown) =>
        Effect.sync(() => void MutableHashMap.set(store, key, value))
      ),
      toast: Effect.fn("FakeHost.toast")((_text: string) => Effect.void),
      sessionId: Effect.succeed("s-1"),
      now: Effect.succeed(DateTime.makeUnsafe(1_000)),
    })
  )
);

const testLayer = () => {
  const state = Layer.sync(FakeHostState)(() => ({ store: MutableHashMap.empty<string, unknown>() }));
  return verdictLogLayer.pipe(Layer.provide(fakeHost), Layer.provideMerge(state));
};

const item = KgAnswerItem.make({
  itemId: "kg-answer:s-1:t-1",
  sessionId: "s-1",
  turnId: "t-1",
  question: "Which matter is 10008US01?",
  matter: O.none(),
});

const verdict = (value: Verdict, note: O.Option<string> = O.none()) =>
  VerdictInput.make({ item, verdict: value, note });

const VerdictRows = S.Array(VerdictRow);

describe("VerdictLog", () => {
  it.prop(
    "round-trips schema-derived verdict rows and inputs",
    [Arbitrary.schema(VerdictRow), Arbitrary.schema(VerdictInput)],
    ([row, input]) => {
      const rowEncoded = Result.getOrThrow(S.encodeResult(VerdictRow)(row));
      assertTrue(S.toEquivalence(VerdictRow)(Result.getOrThrow(S.decodeResult(VerdictRow)(rowEncoded)), row));
      const inputEncoded = Result.getOrThrow(S.encodeResult(VerdictInput)(input));
      assertTrue(S.toEquivalence(VerdictInput)(Result.getOrThrow(S.decodeResult(VerdictInput)(inputEncoded)), input));
    },
    { arbitrary: { runs: 10 } }
  );

  it.layer(testLayer(), { timeout: "5 seconds" })("revisions", (it) => {
    it.effect(
      "appends revisions and reads the latest",
      Effect.fnUntraced(function* () {
        const log = yield* VerdictLog;
        const first = yield* log.record(verdict("wrong", O.some("Missed the continuation.")));
        const second = yield* log.record(verdict("withdrawn"));
        const latest = yield* log.current(item.itemId);

        expect(first.revision).toBe(1);
        expect(second.revision).toBe(2);
        assertSome(
          O.map(latest, (row) => row.verdict),
          "withdrawn"
        );
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("locks", (it) => {
    it.effect(
      "refuses a verdict on a locked item",
      Effect.fnUntraced(function* () {
        const { store } = yield* FakeHostState;
        const locked = VerdictRow.make({
          batchId: "session:s-1",
          itemId: item.itemId,
          verdict: "right",
          note: O.none(),
          revision: 1,
          recordedAt: DateTime.makeUnsafe(0),
          lockedAt: O.some(DateTime.makeUnsafe(0)),
        });
        const value1 = yield* S.encodeEffect(VerdictRows)([locked]);
        MutableHashMap.set(store, "verdict-rows/v2", value1);

        const log = yield* VerdictLog;
        const error = yield* Effect.flip(log.record(verdict("wrong")));
        expect(error._tag).toBe("VerdictLocked");
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("export", (it) => {
    it.effect(
      "exports one JSON line per revision",
      Effect.fnUntraced(function* () {
        const log = yield* VerdictLog;
        yield* log.record(verdict("right"));
        yield* log.record(verdict("partly", O.some("Right family, wrong docket.")));
        const jsonl = yield* log.exportJsonl;

        expect(Str.split("\n")(Str.trim(jsonl)).length).toBe(2);
        expect(Str.includes('"verdict":"partly"')(jsonl)).toBe(true);
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("concurrency", (it) => {
    it.effect(
      "keeps both revisions when two records overlap",
      Effect.fnUntraced(function* () {
        const log = yield* VerdictLog;
        const rows = yield* Effect.all([log.record(verdict("wrong")), log.record(verdict("right"))], {
          concurrency: 2,
        });

        expect(
          A.sort(
            A.map(rows, (row) => row.revision),
            Order.Number
          )
        ).toEqual([1, 2]);
        const { store } = yield* FakeHostState;
        const stored = yield* store.pipe(
          MutableHashMap.get("verdict-rows/v2"),
          O.getOrUndefined,
          S.decodeUnknownEffect(VerdictRows)
        );
        expect(stored).toHaveLength(2);
      })
    );
  });
  it.layer(testLayer(), { timeout: "5 seconds" })("migration", (it) => {
    it.effect(
      "migrates v1 in append order once and preserves the reversal key",
      Effect.fnUntraced(function* () {
        const { store } = yield* FakeHostState;
        const legacy = [
          {
            schemaVersion: "practice-verdict/v1",
            itemId: item.itemId,
            verdict: "wrong",
            note: "Check this",
            revision: 8,
            recordedAt: "1970-01-01T00:00:01.000Z",
            lockedAt: null,
          },
          {
            schemaVersion: "practice-verdict/v1",
            itemId: "kg-answer:s-2:t-1",
            verdict: "right",
            note: null,
            revision: 0,
            recordedAt: "1970-01-01T00:00:00.000Z",
            lockedAt: "1970-01-01T00:00:02.000Z",
          },
          {
            schemaVersion: "practice-verdict/v1",
            itemId: item.itemId,
            verdict: null,
            note: null,
            revision: 9,
            recordedAt: "1970-01-01T00:00:03.000Z",
            lockedAt: null,
          },
        ];
        MutableHashMap.set(store, "verdict-rows", legacy);
        MutableHashMap.set(store, "verdict-rows/v2", []);
        const log = yield* VerdictLog;
        const latest = yield* log.current(item.itemId);
        assertSome(
          O.map(latest, (row) => row.verdict),
          "withdrawn"
        );
        const migrated = yield* store.pipe(
          MutableHashMap.get("verdict-rows/v2"),
          O.getOrUndefined,
          S.decodeUnknownEffect(VerdictRows)
        );
        expect(A.map(migrated, (row) => row.revision)).toEqual([1, 1, 2]);
        expect(A.map(migrated, (row) => row.batchId)).toEqual(["session:s-1", "session:s-2", "session:s-1"]);
        assertNone(A.getUnsafe(migrated, 2).note);
        assertNone(A.getUnsafe(migrated, 2).lockedAt);
        const encoded = yield* S.encodeEffect(VerdictRows)(migrated);
        expect(encoded).toEqual([
          {
            itemId: item.itemId,
            batchId: "session:s-1",
            verdict: "wrong",
            note: "Check this",
            revision: 1,
            recordedAt: 1000,
          },
          {
            itemId: "kg-answer:s-2:t-1",
            batchId: "session:s-2",
            verdict: "right",
            revision: 1,
            recordedAt: 0,
            lockedAt: 2000,
          },
          { itemId: item.itemId, batchId: "session:s-1", verdict: "withdrawn", revision: 2, recordedAt: 3000 },
        ]);
        assertSome(MutableHashMap.get(store, "verdict-rows"), legacy);
        const next = yield* log.record(verdict("right"));
        expect(next.revision).toBe(3);
        const pipe2 = yield* store.pipe(
          MutableHashMap.get("verdict-rows/v2"),
          O.getOrUndefined,
          S.decodeUnknownEffect(VerdictRows)
        );
        expect(pipe2).toHaveLength(4);
        // A nonempty v2 log wins even when the reversal key is unreadable.
        MutableHashMap.set(store, "verdict-rows", "unreadable old data");
        const exportJsonl3 = yield* log.exportJsonl;
        expect(exportJsonl3).toContain('"recordedAt":3000');
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("invalid migration", (it) => {
    it.effect(
      "refuses malformed legacy rows without overwriting either key",
      Effect.fnUntraced(function* () {
        const { store } = yield* FakeHostState;
        const invalid = [{ schemaVersion: "practice-verdict/v1", itemId: "not-an-answer" }];
        MutableHashMap.set(store, "verdict-rows", invalid);
        MutableHashMap.remove(store, "verdict-rows/v2");
        const log = yield* VerdictLog;
        expect((yield* Effect.flip(log.record(verdict("right"))))._tag).toBe("VerdictStoreUnreadable");
        assertSome(MutableHashMap.get(store, "verdict-rows"), invalid);
        assertNone(MutableHashMap.get(store, "verdict-rows/v2"));
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("batch and recency", (it) => {
    it.effect(
      "orders by timestamp then append order, ignoring revisions and lock rows",
      Effect.fnUntraced(function* () {
        const { store } = yield* FakeHostState;
        const rows = yield* S.decodeEffect(VerdictRows)([
          { itemId: item.itemId, batchId: "old", verdict: "wrong", revision: 9, recordedAt: 1000 },
          { itemId: item.itemId, batchId: "old", verdict: "right", revision: 1, recordedAt: 2000 },
          { itemId: item.itemId, batchId: "new", verdict: "partly", revision: 9, recordedAt: 2000 },
          // Same timestamp, lower revision, appended later: append order wins.
          { itemId: item.itemId, batchId: "new2", verdict: "withdrawn", revision: 1, recordedAt: 2000 },
          // A lock row is never a verdict, however recent.
          { itemId: item.itemId, batchId: "other", verdict: "wrong", revision: 20, recordedAt: 3000, lockedAt: 3000 },
        ]);
        const value4 = yield* S.encodeEffect(VerdictRows)(rows);
        MutableHashMap.set(store, "verdict-rows/v2", value4);
        const log = yield* VerdictLog;
        const current5 = yield* log.current(item.itemId);
        assertSome(
          O.map(current5, (row) => row.verdict),
          "withdrawn"
        );
        const fresh = yield* log.record(verdict("right"));
        expect(fresh.batchId).toBe("session:s-1");
        expect(fresh.revision).toBe(1);
        assertNone(fresh.lockedAt);
        const current6 = yield* log.current("missing");
        assertNone(current6);
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })("latest batch lock", (it) => {
    it.effect(
      "refuses a write to a batch that holds a lock row, even when another batch is newer",
      Effect.fnUntraced(function* () {
        const { store } = yield* FakeHostState;
        const rows = yield* S.decodeEffect(VerdictRows)([
          {
            itemId: item.itemId,
            batchId: "session:s-1",
            verdict: "right",
            revision: 2,
            recordedAt: 1000,
            lockedAt: 1000,
          },
          { itemId: item.itemId, batchId: "session:s-1", verdict: "wrong", revision: 1, recordedAt: 0 },
          { itemId: item.itemId, batchId: "other", verdict: "right", revision: 1, recordedAt: 2000 },
        ]);
        const value7 = yield* S.encodeEffect(VerdictRows)(rows);
        MutableHashMap.set(store, "verdict-rows/v2", value7);
        const log = yield* VerdictLog;
        expect((yield* Effect.flip(log.record(verdict("wrong"))))._tag).toBe("VerdictLocked");
      })
    );
  });
});
