import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateHistoryError, HistoryConfig } from "@beep/gate-report/History";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings, GateConsole } from "@beep/repo-gate-run/GateConsole";
import { GateHistory } from "@beep/repo-gate-run/GateHistory";
import {
  HistoryRunRecord,
  HistoryScope,
  KnownKey,
  runRecordOf,
  scopedReport,
  withAbsentPassed,
} from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistoryStore, makeGateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import { GateRecorder, RunSource } from "@beep/repo-gate-run/GateRecorder";
import { GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { packageTarget } from "./support/fixtures.ts";
import { historyContract, laneA, reportOf, testItem } from "./support/historyContract.ts";

historyContract({ name: "in-memory", layerFor: GateHistoryStore.layerMemory });

const E = GateEvent.cases;

const runEvents = (runId: string, at: number, failing: ReadonlyArray<string>): ReadonlyArray<GateEvent> => [
  E.RunStarted.make({
    runId,
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    startedAt: DateTime.makeUnsafe(at),
    inputFingerprint: `input-${runId}`,
  }),
  E.UnitCollected.make({ unit: "src/math.test.ts", items: 2 }),
  ...A.map(["adds", "subtracts"], (name) =>
    E.ItemFinished.make({ item: testItem({ name, outcome: A.contains(failing, name) ? "failed" : "passed" }) })
  ),
  E.RunFinished.make({ durationMs: 50, reason: A.isReadonlyArrayEmpty(failing) ? "passed" : "failed" }),
];

const gateRequest = (events: ReadonlyArray<GateEvent>) =>
  GateRunRequest.make({
    target: packageTarget("test"),
    source: RunSource.cases.RunEvents.make({ events }),
    exitCode: 1,
  });

const consoleServices = Layer.mergeAll(
  GateConsole.layer(ConsoleSettings.make({ audience: "agent" })),
  GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerMemory)),
  GateHistoryStore.historyLayer(laneA)
).pipe(Layer.provideMerge(GateHistoryStore.layerMemory()));

describe("the store fills core's history slot", () => {
  it.layer(consoleServices, { timeout: "30 seconds" })("over the in-memory store", (it) => {
    it.effect("renders a label, the delta and the one missing-baseline line through runGate", () =>
      Effect.gen(function* () {
        const store = yield* GateHistoryStore;
        const first = yield* runGate(gateRequest(runEvents("r1", 1000, ["adds"])), Stream.empty);
        yield* store.ingest(first.report, laneA);
        const second = yield* runGate(gateRequest(runEvents("r2", 2000, ["adds", "subtracts"])), Stream.empty);
        const lines = Str.split(second.output.text, "\n");
        assert.isTrue(A.some(lines, (line) => Str.includes("adds [persistent]")(line)));
        assert.include(lines, "since last run: 0 fixed, 1 still failing, 1 new");
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("no main baseline: "))), 1);
        assert.strictEqual(lines[0], A.lastNonEmpty(lines as A.NonEmptyReadonlyArray<string>));
      })
    );
  });

  it.layer(
    Layer.mergeAll(GateHistoryStore.historyLayer(laneA)).pipe(
      Layer.provide(
        Layer.succeed(
          GateHistoryStore,
          GateHistoryStore.of({
            ingest: Effect.fn("GateHistoryStore.ingest")(function* () {
              return yield* GateHistoryError.make({ reason: "write-failed", message: "disk full" });
            }),
            answer: Effect.fn("GateHistoryStore.answer")(function* () {
              return yield* GateHistoryError.make({ reason: "open-busy", message: "database is locked" });
            }),
            runs: Effect.fn("GateHistoryStore.runs")(function* () {
              return A.empty();
            }),
            series: Effect.fn("GateHistoryStore.series")(function* () {
              return A.empty();
            }),
          })
        )
      )
    ),
    { timeout: "30 seconds" }
  )("over a failing store", (it) => {
    it.effect("turns a store failure into a read failure naming its reason", () =>
      Effect.gen(function* () {
        const history = yield* GateHistory;
        const error = yield* Effect.flip(history.read(reportOf({ runId: "r1", at: 1000, items: [] })));
        assert.strictEqual(error.message, "open-busy: database is locked");
      })
    );
  });
});

describe("history records", () => {
  const record = (itemKind: "test" | "diagnostic") =>
    HistoryRunRecord.make({
      gate: "check",
      subject: "@beep/glob",
      branch: "feature/a",
      origin: "local",
      runId: "r1",
      inputFingerprint: "x",
      at: DateTime.makeUnsafe(0),
      itemKind,
      units: ["@beep/glob"],
      failed: [],
      entries: [],
    });
  const known = [
    KnownKey.make({ fingerprint: "d", unit: "@beep/glob", title: "TS2322" }),
    KnownKey.make({ fingerprint: "d", unit: "@beep/glob", title: "TS2322" }),
    KnownKey.make({ fingerprint: "e", unit: "@beep/other", title: "TS2322" }),
  ];

  it("adds one passed entry per known diagnostic key in a checked unit, and leaves a test run alone", () => {
    assert.deepStrictEqual(
      A.map(withAbsentPassed(known)(record("diagnostic")).entries, (entry) => [entry.fingerprint, entry.outcome]),
      [["d", "passed"]]
    );
    assert.strictEqual(withAbsentPassed(record("test"), known).entries.length, 0);
  });

  it("records a report under the scope, the report's own head winning", () => {
    const report = reportOf({
      runId: "r1",
      at: 1000,
      items: [testItem({ name: "adds", outcome: "failed", attempts: ["failed", "failed"] })],
    });
    const scope = HistoryScope.make({ branch: "feature/a", head: O.some("abc") });
    const recorded = runRecordOf(scope)(report);
    assert.deepStrictEqual(
      [recorded.branch, O.getOrNull(recorded.head), A.length(recorded.entries), A.length(recorded.failed)],
      ["feature/a", "abc", 2, 1]
    );
    assertSome(
      scopedReport(scope)(scopedReport(report, HistoryScope.make({ branch: "feature/b" }))).branch,
      "feature/b"
    );
  });

  it.effect("records a run with no kept answer when its history cannot be read", () =>
    Effect.gen(function* () {
      const kept = yield* Ref.make(A.empty<HistoryRunRecord>());
      const unread = Effect.fail(GateHistoryError.make({ reason: "open-busy", message: "database is locked" }));
      const store = yield* makeGateHistoryStore(HistoryConfig.make({}), {
        insert: (run) => Effect.as(Ref.update(kept, A.append(run)), true),
        recorded: () => unread,
        lane: () => unread,
        previous: () => unread,
        runs: () => unread,
        series: () => unread,
      });
      const report = reportOf({ runId: "r1", at: 1000, items: [testItem({ name: "adds", outcome: "failed" })] });
      const ingest = yield* store.ingest(report, laneA);
      assert.isTrue(ingest.inserted);
      const runs = yield* Ref.get(kept);
      assert.deepStrictEqual(
        A.map(runs, (run) => O.isNone(run.answer)),
        [true]
      );
    })
  );

  it.effect("builds a store over the in-memory backend by default", () =>
    Effect.gen(function* () {
      const store = yield* makeGateHistoryStore(HistoryConfig.make({}));
      const ingest = yield* store.ingest(reportOf({ runId: "r1", at: 1000, items: [] }), laneA);
      assert.isTrue(ingest.inserted);
    })
  );
});
