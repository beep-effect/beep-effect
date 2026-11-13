/**
 * AC-3 on the replay of this repository's own goals history, the replay the
 * SPEC bars were measured on (S14 and S14b): sequential agent sessions up to
 * commit 3f0261b37a0 replayed as concurrent writers, every writer of a cluster
 * starting from the cluster's one base.
 *
 * One-labeller rule: the agent-memory-store-p2 lane built the replay
 * (`fixtures/build-goals-history-replay.ts`, frozen in
 * `fixtures/goals-history-replay.json.gz`), its folder layout
 * (`history-replay-fixture.ts`) and the oracle (`admission-replay.ts`); the
 * construction rule, the judged order and the counting were fixed in decision
 * `p2-ac3-history-replay-construction` before any admission outcome was
 * measured. The test reads only the frozen file, never git history.
 *
 * The judged run admits every writer in history order; three seeded orders
 * are reported beside it, and all four must show zero silent loss. The suite
 * runs under Bun only (the SQLite driver imports `bun:sqlite`). Set
 * `BEEP_TEST_AGENT_MEMORY_REPORT` to a file path to append the measured
 * counts there; they are also logged and asserted.
 */
import { partition } from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import { prepareReplay, replayInSubmissionOrder, replayOnce, verdictOf } from "./admission-replay.ts";
import { loadGoalsHistoryReplay } from "./fixtures/goals-history-replay.ts";
import { historyFixtureOf, historyStatus } from "./history-replay-fixture.ts";
import { isBunRuntime, report, TestPlatform, tempDirectory } from "./projector-support.ts";
import type { AdmissionOutcome, NodeId, NodeOperation } from "@beep/agent-memory-store";
import type { ReplayRun, RunVerdict } from "./admission-replay.ts";

/** The pinned commit and the seeded orders the decision fixed. */
const pinnedCommit = "3f0261b37a0e98a0bcef4e5f0ef2c922b68e9fb2";
const seeds = [1, 2, 3];

// S14b's measured resolver-needed ratio and per-op landing bar, as integers.
const resolverBar = { held: 26, writes: 279 } as const;
const perOpBarPercent = 95;

class HistoryReplay extends Context.Service<
  HistoryReplay,
  {
    readonly sessions: number;
    readonly commit: string;
    readonly writes: number;
    readonly captured: number;
    readonly history: ReplayRun;
    readonly verdicts: ReadonlyArray<RunVerdict>;
  }
>()("@beep/agent-memory-store/test/Admission.history-replay.test/HistoryReplay") {}

const replayLayer = Layer.effect(
  HistoryReplay,
  Effect.gen(function* () {
    const replay = yield* loadGoalsHistoryReplay;
    const fixture = historyFixtureOf(replay);
    const workspace = yield* tempDirectory("beep-ac3-history-");
    const prepared = yield* prepareReplay(fixture, workspace, historyStatus);
    const history = yield* replayInSubmissionOrder(prepared);
    const seeded = yield* Effect.forEach(seeds, (seed) => Effect.map(replayOnce(prepared, seed), verdictOf));
    return HistoryReplay.of({
      sessions: replay.sessions,
      commit: replay.commit,
      writes: A.flatMap(fixture.clusters, (cluster) => cluster.writers).length,
      captured: prepared.writers.length,
      history,
      verdicts: [verdictOf(history), ...seeded],
    });
  })
).pipe(Layer.provide(TestPlatform));

const logged = Effect.fnUntraced(function* (line: string) {
  yield* Effect.logInfo(line);
  yield* report(line);
});

// --- The breakdown of what did not land ----------------------------------------------

// The partition kind of every base node, by node id.
const baseKinds = (run: ReplayRun) => {
  const kinds = MutableHashMap.empty<NodeId, string>();
  for (const file of run.base.files) {
    const parts = partition(
      A.join(
        A.map(file.nodes, (node) => node.anchor.anchor.quote),
        ""
      )
    ).nodes;
    for (const [node, part] of A.zip(file.nodes, parts)) {
      MutableHashMap.set(kinds, node.nodeId, part.kind);
    }
  }
  return kinds;
};

// The kind of the node an operation names: an insert's own text, otherwise the base node's.
const kindOf = (kinds: MutableHashMap.MutableHashMap<NodeId, string>, operation: NodeOperation): string =>
  operation.op === "insert"
    ? O.getOrElse(
        O.map(A.head(partition(operation.text).nodes), (node) => node.kind),
        () => "empty"
      )
    : O.getOrElse(MutableHashMap.get(kinds, operation.nodeId), () => "unknown");

const codesOf = (outcome: AdmissionOutcome): string =>
  outcome.outcome === "held" || outcome.outcome === "rejected"
    ? A.join(A.dedupe(A.map(outcome.violations, (violation) => violation.code)), "+")
    : "";

const tally = (keys: ReadonlyArray<string>): ReadonlyArray<readonly [string, number]> => {
  const counts = MutableHashMap.empty<string, number>();
  for (const key of keys) {
    MutableHashMap.set(counts, key, O.getOrElse(MutableHashMap.get(counts, key), () => 0) + 1);
  }
  return A.sort(
    A.fromIterable(counts),
    Order.mapInput(Order.String, ([key]: readonly [string, number]) => key)
  );
};

// Every operation of the run with the kind of the node it names and its outcome.
const operationsOf = (run: ReplayRun) => {
  const kinds = baseKinds(run);
  return A.flatMap(run.writes, (write) =>
    A.map(A.zip(write.batch.operations, write.outcomes), ([operation, outcome]) => ({
      kind: kindOf(kinds, operation),
      operation,
      outcome,
      write,
    }))
  );
};

const tallyLine = (counts: ReadonlyArray<readonly [string, number]>): string =>
  A.join(
    A.map(counts, ([key, count]) => `${key}=${count}`),
    "; "
  );

/** What did not land, by operation, node kind, outcome and finding; and the held writes by their findings. */
const breakdownOf = (run: ReplayRun) => {
  const operations = operationsOf(run);
  const notLanded = A.filter(operations, ({ outcome }) => outcome.outcome !== "landed");
  const heldWrites = A.filter(run.writes, (write) => A.some(write.outcomes, (outcome) => outcome.outcome === "held"));
  return {
    contentOperations: A.filter(operations, ({ kind }) => kind !== "gap").length,
    contentLanded: A.filter(operations, ({ kind, outcome }) => kind !== "gap" && outcome.outcome === "landed").length,
    notLanded: tally(
      A.map(
        notLanded,
        ({ kind, operation, outcome }) => `${operation.op} ${kind} ${outcome.outcome} ${codesOf(outcome)}`
      )
    ),
    heldWrites: tally(
      A.map(heldWrites, (write) =>
        A.join(
          A.dedupe(
            A.map(
              A.filter(write.outcomes, (outcome) => outcome.outcome === "held"),
              codesOf
            )
          ),
          " | "
        )
      )
    ),
  };
};

// --- The bars ------------------------------------------------------------------------

const meetsResolverBar = (verdict: RunVerdict, writes: number): boolean =>
  verdict.resolverNeededWrites * resolverBar.writes <= resolverBar.held * writes;

const meetsPerOpBar = (verdict: RunVerdict): boolean =>
  verdict.landedOperations * 100 >= perOpBarPercent * verdict.operations;

/** The AC-3 counts of one order. */
const countsOf = (verdict: RunVerdict, order: string) => ({
  order,
  floor: verdict.structuralFloorWrites,
  resolverNeeded: verdict.resolverNeededWrites,
  landed: verdict.landedOperations,
  operations: verdict.operations,
  statusNodes: verdict.statusConflicts,
  statusHeld: verdict.statusHeld,
  statusWrong: verdict.statusWrong,
  backward: verdict.backwardMoves,
  backwardRejected: verdict.backwardRejected,
});

const lineOf = (counts: ReturnType<typeof countsOf>, writes: number): string =>
  `AC-3 ${counts.order} floor=${counts.floor}/${writes} resolverNeeded=${counts.resolverNeeded}/${writes} (${counts.resolverNeeded}*${resolverBar.writes}=${counts.resolverNeeded * resolverBar.writes} vs ${resolverBar.held}*${writes}=${resolverBar.held * writes}) landed=${counts.landed}/${counts.operations} (x100=${counts.landed * 100} vs ${perOpBarPercent}x=${perOpBarPercent * counts.operations}) statusNodes=${counts.statusNodes} held=${counts.statusHeld} wrong=${counts.statusWrong} backward=${counts.backward} rejected=${counts.backwardRejected}`;

// The counts the replay measured, pinned so a change in admission or in the replay shows.
const order = (
  name: string,
  floor: number,
  resolverNeeded: number,
  landed: number,
  backward: number
): ReturnType<typeof countsOf> => ({
  order: name,
  floor,
  resolverNeeded,
  landed,
  operations: 3_364,
  statusNodes: 28,
  statusHeld: 0,
  statusWrong: 0,
  backward,
  backwardRejected: backward,
});

const MEASURED = [
  order("history", 11, 40, 3_267, 0),
  order("seed 1", 8, 36, 3_285, 4),
  order("seed 2", 10, 39, 3_202, 0),
  order("seed 3", 11, 40, 3_167, 1),
];

const MEASURED_BREAKDOWN = {
  contentOperations: 1_818,
  contentLanded: 1_743,
  notLanded: [
    ["delete paragraph held deleteVersusEdit", 4],
    ["insert gap held insertAfterMissingNode", 19],
    ["insert gap held insertUnderDeletedAnchor", 3],
    ["insert heading held insertAfterMissingNode", 3],
    ["insert heading held insertUnderDeletedAnchor", 2],
    ["insert listItem held insertAfterMissingNode", 9],
    ["insert paragraph held insertAfterMissingNode", 8],
    ["replace codeFence held staleExpectedRevision", 1],
    ["replace listItem held staleExpectedRevision", 9],
    ["replace paragraph held deleteVersusEdit", 2],
    ["replace paragraph held staleExpectedRevision", 33],
    ["replace tableRow held staleExpectedRevision", 4],
  ],
  heldWrites: [
    ["deleteVersusEdit", 3],
    ["deleteVersusEdit | staleExpectedRevision", 1],
    ["insertUnderDeletedAnchor | insertAfterMissingNode", 5],
    ["staleExpectedRevision", 29],
    ["staleExpectedRevision | deleteVersusEdit", 2],
  ],
};

describe.skipIf(!isBunRuntime)("admission on the goals history replay (Bun runtime)", () => {
  it.layer(Layer.mergeAll(replayLayer, TestPlatform), { timeout: "120 seconds" })("history and seeded orders", (it) => {
    it.effect("the replay is the one the decision fixed", () =>
      Effect.gen(function* () {
        const replay = yield* HistoryReplay;
        const [history] = replay.verdicts;
        yield* logged(
          `AC-3 history replay commit=${replay.commit} sessions=${replay.sessions} writes=${replay.writes} captured=${replay.captured} operations=${history?.operations}`
        );
        expect(replay.commit).toBe(pinnedCommit);
        expect(replay.sessions).toBe(200);
        expect(A.dedupe(A.map(replay.history.writes, (write) => write.cluster.id))).toHaveLength(118);
        expect({ writes: replay.writes, captured: replay.captured, operations: history?.operations }).toEqual({
          writes: 275,
          captured: 275,
          operations: 3_364,
        });
      })
    );

    it.effect("zero silent loss on the history replay, in history order and in every seeded order", () =>
      Effect.gen(function* () {
        const { verdicts } = yield* HistoryReplay;
        yield* logged(
          `AC-3 history losses per order=${A.join(
            A.map(verdicts, (verdict) => String(verdict.losses.length)),
            ","
          )}`
        );
        expect(A.flatMap(verdicts, (verdict) => verdict.losses)).toEqual([]);
        expect(A.every(verdicts, (verdict) => verdict.exportMatchesDisk)).toBe(true);
      })
    );

    it.effect(
      "AC-3 on the history replay: the structural floor, resolver-needed writes against 26/279, per-op landing against 95%, typed status conflicts",
      () =>
        Effect.gen(function* () {
          const replay = yield* HistoryReplay;
          const measured = A.map(replay.verdicts, (verdict, index) =>
            countsOf(verdict, index === 0 ? "history" : `seed ${index}`)
          );
          for (const counts of measured) {
            yield* logged(lineOf(counts, replay.writes));
          }
          const breakdown = breakdownOf(replay.history);
          yield* logged(
            `AC-3 history content operations landed=${breakdown.contentLanded}/${breakdown.contentOperations}`
          );
          yield* logged(`AC-3 history not landed: ${tallyLine(breakdown.notLanded)}`);
          yield* logged(`AC-3 history held writes by findings: ${tallyLine(breakdown.heldWrites)}`);

          // The measured counts per order, asserted exactly so any change in admission shows.
          expect(measured).toEqual(MEASURED);
          // The judged run: the history order. The resolver-needed bar is not
          // met (40 x 279 = 11,160 above 26 x 275 = 7,150); per-op landing is
          // (3,267 x 100 = 326,700 at or above 95 x 3,364 = 319,580).
          const history = replay.verdicts[0] as RunVerdict;
          expect([meetsResolverBar(history, replay.writes), meetsPerOpBar(history)]).toEqual([false, true]);
          // Typed status fields: never held, never wrong, every backward move refused.
          expect(A.every(replay.verdicts, (verdict) => verdict.statusHeld === 0 && verdict.statusWrong === 0)).toBe(
            true
          );
          expect(A.every(replay.verdicts, (verdict) => verdict.backwardRejected === verdict.backwardMoves)).toBe(true);
          expect(breakdown).toEqual(MEASURED_BREAKDOWN);
        })
    );
  });
});
