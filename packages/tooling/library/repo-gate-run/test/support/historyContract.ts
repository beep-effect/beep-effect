import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { HistoryConfig } from "@beep/gate-report/History";
import { Item } from "@beep/gate-report/Item";
import { DiagnosticKeyInput, diagnosticKey, fingerprint, ItemKey } from "@beep/gate-report/ItemKey";
import { HistoryItemQuery, HistoryRunsQuery, HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistoryStore, NO_MAIN_BASELINE } from "@beep/repo-gate-run/GateHistoryStore";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { ItemOutcome } from "@beep/gate-report/Vocabulary";
import type { HistoryAnswer } from "@beep/repo-gate-run/GateHistory";

const TEST_FILE = "src/math.test.ts";

export const testItem = (input: {
  readonly name: string;
  readonly outcome: ItemOutcome;
  readonly attempts?: A.NonEmptyReadonlyArray<ItemOutcome>;
}): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: TEST_FILE, fullName: `math > ${input.name}` }),
    unit: TEST_FILE,
    path: ["math"],
    name: input.name,
    outcome: input.outcome,
    attempts: O.fromUndefinedOr(input.attempts),
  });

export const keyOf = (name: string): string =>
  fingerprint(ItemKey.cases.TestKey.make({ file: TEST_FILE, fullName: `math > ${name}` }));

export type RunInput = {
  readonly runId: string;
  readonly at: number;
  readonly items: ReadonlyArray<Item>;
  readonly branch?: string;
  readonly input?: string;
  readonly gate?: string;
  readonly subject?: string;
  readonly itemKind?: "test" | "diagnostic";
  readonly units?: ReadonlyArray<Unit>;
};

export const reportOf = (run: RunInput): GateReport => {
  const red = A.some(run.items, (item) => item.outcome === "failed");
  return GateReport.make({
    gate: run.gate ?? "test",
    subject: run.subject ?? "@beep/glob",
    itemKind: run.itemKind ?? "test",
    runId: run.runId,
    startedAt: DateTime.makeUnsafe(run.at),
    durationMs: 10,
    inputFingerprint: run.input ?? `input-${run.runId}`,
    branch: O.fromUndefinedOr(run.branch),
    reason: red ? "failed" : "passed",
    outcome: red ? "some-fail" : "all-pass",
    units: run.units ?? [Unit.make({ id: TEST_FILE, kind: "file" })],
    items: run.items,
    totals: Totals.make({ collected: A.length(run.items) }),
  });
};

export const laneA = HistoryScope.make({ branch: "feature/a" });
const laneB = HistoryScope.make({ branch: "feature/b" });

export const ingestAll = Effect.fnUntraced(function* (runs: ReadonlyArray<RunInput>, scope: HistoryScope = laneA) {
  const store = yield* GateHistoryStore;
  yield* Effect.forEach(runs, (run) => store.ingest(reportOf(run), scope), { concurrency: 1, discard: true });
});

export const answerFor = Effect.fnUntraced(function* (run: RunInput, scope: HistoryScope = laneA) {
  const store = yield* GateHistoryStore;
  return yield* store.answer(reportOf(run), scope);
});

const labelOf = (answer: HistoryAnswer, name: string) => R.get(answer.labels, keyOf(name));

const PKG = "@beep/glob";
const diagnostic = (message: string, outcome: ItemOutcome = "failed"): Item =>
  Item.make({
    key: diagnosticKey(DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message })),
    unit: "src/a.ts",
    path: [],
    name: message,
    outcome,
  });
const checkRun = (runId: string, at: number, items: ReadonlyArray<Item>): RunInput => ({
  runId,
  at,
  items,
  gate: "check",
  itemKind: "diagnostic",
  units: [Unit.make({ id: PKG, kind: "package" })],
});

/**
 * Run the store contract against a backend.
 */
export const historyContract = (backend: {
  readonly name: string;
  readonly layerFor: (config: HistoryConfig) => Layer.Layer<GateHistoryStore>;
}) => {
  const { name, layerFor } = backend;
  const withStore =
    (config: HistoryConfig = HistoryConfig.make({})) =>
    <A, E>(effect: Effect.Effect<A, E, GateHistoryStore>) =>
      layerFor(config).pipe(
        Layer.build,
        Effect.flatMap((context) => Effect.provideContext(effect, context)),
        Effect.scoped
      );

  describe(`${name} history store`, () => {
    it.effect("labels from the lane: persistent, introduced, recovered for one run", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            {
              runId: "r1",
              at: 1000,
              items: [
                testItem({ name: "adds", outcome: "failed" }),
                testItem({ name: "subtracts", outcome: "passed" }),
              ],
            },
            {
              runId: "r2",
              at: 2000,
              items: [
                testItem({ name: "adds", outcome: "failed" }),
                testItem({ name: "subtracts", outcome: "failed" }),
              ],
            },
          ]);
          const third = yield* answerFor({
            runId: "r3",
            at: 3000,
            items: [
              testItem({ name: "adds", outcome: "failed" }),
              testItem({ name: "subtracts", outcome: "failed" }),
              testItem({ name: "divides", outcome: "failed" }),
            ],
          });
          assertSome(labelOf(third, "adds"), "persistent");
          assertSome(labelOf(third, "subtracts"), "persistent");
          assertNone(labelOf(third, "divides"));
          const recovered = yield* answerFor({
            runId: "r3",
            at: 3000,
            items: [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "subtracts", outcome: "failed" })],
          });
          assertSome(labelOf(recovered, "adds"), "recovered");
          assert.isTrue(O.isSome(recovered.delta));
          yield* ingestAll([
            {
              runId: "r3",
              at: 3000,
              items: [
                testItem({ name: "adds", outcome: "passed" }),
                testItem({ name: "subtracts", outcome: "failed" }),
              ],
            },
          ]);
          const fourth = yield* answerFor({
            runId: "r4",
            at: 4000,
            items: [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "subtracts", outcome: "passed" })],
          });
          assertNone(labelOf(fourth, "adds"));
          assertSome(labelOf(fourth, "subtracts"), "recovered");
          yield* ingestAll([
            {
              runId: "r4",
              at: 4000,
              items: [
                testItem({ name: "adds", outcome: "passed" }),
                testItem({ name: "subtracts", outcome: "passed" }),
              ],
            },
          ]);
          const fifth = yield* answerFor({
            runId: "r5",
            at: 5000,
            items: [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "subtracts", outcome: "failed" })],
          });
          assertNone(labelOf(fifth, "adds"));
          assertSome(labelOf(fifth, "subtracts"), "introduced-on-lane");
        })
      )
    );

    it.effect("AC-H1: a red on one branch never changes a label or a delta on another", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            { runId: "a1", at: 1000, items: [testItem({ name: "adds", outcome: "passed" })] },
            { runId: "a2", at: 2000, items: [testItem({ name: "adds", outcome: "failed" })] },
          ]);
          const onB = yield* answerFor(
            { runId: "b1", at: 3000, items: [testItem({ name: "adds", outcome: "failed" })] },
            laneB
          );
          assertNone(labelOf(onB, "adds"));
          assertNone(onB.delta);
          yield* ingestAll([{ runId: "b1", at: 3000, items: [testItem({ name: "adds", outcome: "failed" })] }], laneB);
          const onA = yield* answerFor({
            runId: "a3",
            at: 4000,
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          assertSome(labelOf(onA, "adds"), "persistent");
          assert.deepStrictEqual([O.getOrThrow(onA.delta).stillFailing, O.getOrThrow(onA.delta).new], [1, 0]);
          const againB = yield* answerFor(
            { runId: "b2", at: 5000, items: [testItem({ name: "adds", outcome: "failed" })] },
            laneB
          );
          assertSome(labelOf(againB, "adds"), "persistent");
        })
      )
    );

    it.effect("AC-H5: with W = 3 the reader and the retention both keep three observations", () =>
      withStore(HistoryConfig.make({ window: 3, retainRuns: 2 }))(
        Effect.gen(function* () {
          yield* ingestAll([
            { runId: "r1", at: 1000, input: "same", items: [testItem({ name: "adds", outcome: "failed" })] },
            { runId: "r2", at: 2000, items: [testItem({ name: "adds", outcome: "passed" })] },
            { runId: "r3", at: 3000, items: [testItem({ name: "adds", outcome: "passed" })] },
            { runId: "r4", at: 4000, items: [testItem({ name: "adds", outcome: "passed" })] },
          ]);
          const answer = yield* answerFor({
            runId: "r5",
            at: 5000,
            input: "same",
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          const notFlakyOutsideWindow = labelOf(answer, "adds");
          assertSome(notFlakyOutsideWindow, "introduced-on-lane");
          const store = yield* GateHistoryStore;
          const series = yield* store.series(
            HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "adds" })
          );
          assert.deepStrictEqual(
            A.map(series, (entry) => A.map(entry.observations, (observation) => observation.runId)),
            [["r4", "r3", "r2"]]
          );
          const runs = yield* store.runs(HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob" }));
          assert.deepStrictEqual(
            A.map(runs, (run) => run.runId),
            ["r4", "r3"]
          );
        })
      )
    );

    it.effect("a wider window sees the old fail on the same input and labels flaky", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            { runId: "r1", at: 1000, input: "same", items: [testItem({ name: "adds", outcome: "failed" })] },
            { runId: "r2", at: 2000, input: "same", items: [testItem({ name: "adds", outcome: "passed" })] },
          ]);
          const answer = yield* answerFor({
            runId: "r3",
            at: 3000,
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          assertSome(labelOf(answer, "adds"), "flaky");
        })
      )
    );

    it.effect("AC-H10: a replayed record adds nothing and answers as the run it replays", () =>
      withStore()(
        Effect.gen(function* () {
          const store = yield* GateHistoryStore;
          const first: RunInput = {
            runId: "r1",
            at: 1000,
            items: [testItem({ name: "adds", outcome: "failed" }), testItem({ name: "subtracts", outcome: "passed" })],
          };
          const second: RunInput = {
            runId: "r2",
            at: 2000,
            items: [testItem({ name: "adds", outcome: "failed" }), testItem({ name: "subtracts", outcome: "failed" })],
          };
          yield* ingestAll([first]);
          const before = yield* answerFor(second);
          const ingested = yield* store.ingest(reportOf(second), laneA);
          const replayed = yield* store.ingest(reportOf(second), laneA);
          assert.deepStrictEqual([ingested.inserted, replayed.inserted], [true, false]);
          yield* ingestAll([{ runId: "r3", at: 3000, items: [testItem({ name: "adds", outcome: "passed" })] }]);
          const replay = yield* answerFor(second);
          assert.deepStrictEqual(replay, before);
          const runs = yield* store.runs(
            HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob", branch: O.some("feature/a") })
          );
          assert.deepStrictEqual(
            A.map(runs, (run) => run.runId),
            ["r3", "r2", "r1"]
          );
        })
      )
    );

    it.effect(
      "AC-H10: a replay keeps its answer, and adds nothing, after retention dropped what it was answered from",
      () =>
        withStore(HistoryConfig.make({ window: 2, retainRuns: 2 }))(
          Effect.gen(function* () {
            const store = yield* GateHistoryStore;
            const failing = (runId: string, at: number): RunInput => ({
              runId,
              at,
              items: [testItem({ name: "adds", outcome: "failed" })],
            });
            yield* ingestAll([failing("r1", 1000)]);
            const rendered = yield* answerFor(failing("r2", 2000));
            assertSome(labelOf(rendered, "adds"), "persistent");
            assert.strictEqual(O.getOrThrow(rendered.delta).stillFailing, 1);
            yield* ingestAll([failing("r2", 2000), failing("r3", 3000)]);
            const replayed = yield* answerFor(failing("r2", 2000));
            assert.deepStrictEqual(replayed, rendered);
            const seriesQuery = HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "adds" });
            const before = yield* store.series(seriesQuery);
            const replays = yield* Effect.forEach(
              [failing("r1", 1000), failing("r2", 2000), failing("r3", 3000)],
              (run) => store.ingest(reportOf(run), laneA),
              { concurrency: 1 }
            );
            assert.deepStrictEqual(
              A.map(replays, (replay) => replay.inserted),
              [false, false, false]
            );
            const after = yield* store.series(seriesQuery);
            assert.deepStrictEqual(
              after,
              before,
              "r1's run row is gone and r2, r3 hold the series window: replaying any of them changes nothing"
            );
          })
        )
    );

    it.effect("AC-H10: a replay of a pruned run whose observation is still in a window adds nothing", () =>
      withStore(HistoryConfig.make({ window: 5, retainRuns: 1 }))(
        Effect.gen(function* () {
          const store = yield* GateHistoryStore;
          const first: RunInput = { runId: "r1", at: 1000, items: [testItem({ name: "adds", outcome: "failed" })] };
          yield* ingestAll([first, { runId: "r2", at: 2000, items: [testItem({ name: "adds", outcome: "passed" })] }]);
          const replay = yield* store.ingest(reportOf(first), laneA);
          assert.isFalse(replay.inserted);
          const series = yield* store.series(
            HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "adds" })
          );
          assert.deepStrictEqual(
            A.map(series, (entry) => A.map(entry.observations, (observation) => observation.runId)),
            [["r2", "r1"]]
          );
        })
      )
    );

    it.effect("a run restored on another branch is answered from that branch, not with the kept answer", () =>
      withStore()(
        Effect.gen(function* () {
          const failing = (runId: string, at: number): RunInput => ({
            runId,
            at,
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          yield* ingestAll([failing("r1", 1000), failing("r2", 2000)]);
          const onA = yield* answerFor(failing("r2", 2000));
          const onB = yield* answerFor(failing("r2", 2000), laneB);
          assertSome(labelOf(onA, "adds"), "persistent");
          assertNone(labelOf(onB, "adds"));
        })
      )
    );

    it.effect("a partial run is no delta's previous run and says nothing about the items it does not report", () =>
      withStore()(
        Effect.gen(function* () {
          const broken = diagnostic("Type 'a' is wrong.");
          yield* ingestAll([checkRun("c1", 1000, [broken])]);
          const partial = HistoryScope.make({ ...laneA, partial: true });
          const incident = checkRun("q1", 2000, [diagnostic("No location.", "passed")]);
          const own = yield* answerFor(incident, partial);
          assertNone(own.delta);
          yield* ingestAll([incident], partial);
          const answer = yield* answerFor(checkRun("c2", 3000, [broken]));
          assertSome(R.get(answer.labels, fingerprint(broken.key)), "persistent");
          const delta = O.getOrThrow(answer.delta);
          assert.deepStrictEqual([delta.fixed, delta.stillFailing, delta.new], [0, 1, 0]);
        })
      )
    );

    it.effect("a diagnostic warned now is no passed observation, while one that is gone is", () =>
      withStore()(
        Effect.gen(function* () {
          const warned = diagnostic("Type 'a' is wrong.");
          const gone = diagnostic("Name 'b' is missing.");
          yield* ingestAll([
            checkRun("c1", 1000, [warned, gone]),
            checkRun("c2", 2000, [diagnostic("Type 'a' is wrong.", "warned")]),
          ]);
          const store = yield* GateHistoryStore;
          const outcomesOf = (item: Item) =>
            Effect.map(
              store.series(
                HistoryItemQuery.make({ gate: "check", subject: "@beep/glob", selector: fingerprint(item.key) })
              ),
              A.flatMap((entry) => A.map(entry.observations, (observation) => observation.outcome))
            );
          const ofWarned = yield* outcomesOf(warned);
          const ofGone = yield* outcomesOf(gone);
          assert.deepStrictEqual(ofWarned, ["failed"]);
          assert.deepStrictEqual(ofGone, ["passed", "failed"]);
        })
      )
    );

    it.effect("AC-H6: the delta against the lane's previous run, and the scope note", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            {
              runId: "r1",
              at: 1000,
              items: [
                testItem({ name: "adds", outcome: "failed" }),
                testItem({ name: "subtracts", outcome: "failed" }),
                testItem({ name: "divides", outcome: "passed" }),
              ],
            },
          ]);
          const rerun = yield* answerFor({
            runId: "r2",
            at: 2000,
            items: [
              testItem({ name: "adds", outcome: "passed" }),
              testItem({ name: "subtracts", outcome: "failed" }),
              testItem({ name: "divides", outcome: "failed" }),
            ],
          });
          const delta = O.getOrThrow(rerun.delta);
          assert.deepStrictEqual([delta.fixed, delta.stillFailing, delta.new, delta.scopeDiffers], [1, 1, 1, false]);
          const narrower = yield* answerFor({
            runId: "r2",
            at: 2000,
            units: [Unit.make({ id: TEST_FILE, kind: "file" }), Unit.make({ id: "src/other.test.ts", kind: "file" })],
            items: [testItem({ name: "subtracts", outcome: "failed" })],
          });
          assert.isTrue(O.getOrThrow(narrower.delta).scopeDiffers);
        })
      )
    );

    it.effect("a diagnostic key absent from a checked unit is a passed observation", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([checkRun("c1", 1000, [diagnostic("Type 'a' is wrong.")]), checkRun("c2", 2000, [])]);
          const answer = yield* answerFor(checkRun("c3", 3000, [diagnostic("Type 'a' is wrong.")]));
          const key = fingerprint(diagnostic("Type 'a' is wrong.").key);
          assertSome(R.get(answer.labels, key), "introduced-on-lane");
          const store = yield* GateHistoryStore;
          const series = yield* store.series(HistoryItemQuery.make({ gate: "check", subject: PKG, selector: key }));
          assert.deepStrictEqual(
            A.flatMap(series, (entry) => A.map(entry.observations, (observation) => observation.outcome)),
            ["passed", "failed"]
          );
        })
      )
    );

    it.effect("says once that there is no main baseline on a red run, never on a green one", () =>
      withStore()(
        Effect.gen(function* () {
          const red = yield* answerFor({
            runId: "r1",
            at: 1000,
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          const green = yield* answerFor({
            runId: "r1",
            at: 1000,
            items: [testItem({ name: "adds", outcome: "passed" })],
          });
          assertSome(red.baseline, NO_MAIN_BASELINE);
          assertNone(green.baseline);
          const empty = yield* answerFor({ runId: "r1", at: 1000, items: [] });
          assert.deepStrictEqual([R.size(empty.labels), O.isNone(empty.baseline)], [0, true]);
        })
      )
    );

    it.effect("AC-H3 and AC-H13: a series shows its branches and calls the one flaky rule", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            {
              runId: "r1",
              at: 1000,
              items: [testItem({ name: "adds", outcome: "passed", attempts: ["failed", "passed"] })],
            },
          ]);
          yield* ingestAll([{ runId: "b1", at: 2000, items: [testItem({ name: "adds", outcome: "failed" })] }], laneB);
          const store = yield* GateHistoryStore;
          const series = yield* store.series(
            HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "adds" })
          );
          const byBranch = A.map(series, (entry) => [entry.branch, entry.flaky, A.length(entry.observations)] as const);
          assert.sameDeepMembers(
            [...byBranch],
            [
              ["feature/a", true, 2],
              ["feature/b", false, 1],
            ]
          );
          const none = yield* store.series(
            HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "nothing" })
          );
          assert.strictEqual(A.length(none), 0);
          const runs = yield* store.runs(
            HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob", branch: O.some("feature/b") })
          );
          assert.deepStrictEqual(
            A.map(runs, (run) => [run.runId, run.failed, run.observations, run.units] as const),
            [["b1", 1, 1, 1]]
          );
        })
      )
    );

    it.effect("a report's own branch wins over the scope's", () =>
      withStore()(
        Effect.gen(function* () {
          yield* ingestAll([
            { runId: "r1", at: 1000, branch: "feature/b", items: [testItem({ name: "adds", outcome: "failed" })] },
          ]);
          const onB = yield* answerFor(
            { runId: "b2", at: 2000, items: [testItem({ name: "adds", outcome: "failed" })] },
            laneB
          );
          assertSome(labelOf(onB, "adds"), "persistent");
          const own = yield* answerFor({
            runId: "b3",
            at: 3000,
            branch: "feature/b",
            items: [testItem({ name: "adds", outcome: "failed" })],
          });
          assertSome(labelOf(own, "adds"), "persistent");
        })
      )
    );
  });
};
