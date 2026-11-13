/**
 * AC-2 and AC-3 on the adversarial concurrent-edit fixture.
 *
 * One-labeller rule: the agent-memory-store-p2 integration lane built the
 * fixture (`admission-fixture.ts`), labelled its strata and wrote the oracle
 * (`admission-replay.ts`); no spike trace is used. The composition below was
 * fixed in decision `p2-adversarial-fixture-is-seeded-contention-strata`
 * before any admission outcome was measured. Strata, clusters and their share
 * of the 118 cluster writes:
 *
 * | Stratum | Clusters | Writes | Share |
 * | --- | --- | --- | --- |
 * | reviseVersusRevise (one node, two different texts) | 6 | 12 | 12/118 |
 * | identicalText (one node, one text twice) | 4 | 8 | 8/118 |
 * | reviseVersusRetire (either order) | 6 | 12 | 12/118 |
 * | insertUnderRetiredAnchor | 4 | 8 | 8/118 |
 * | insertsAfterOnePredecessor | 4 | 8 | 8/118 |
 * | contestedChainHead (retire against a two-paragraph chain) | 3 | 6 | 6/118 |
 * | differentNodesOneFile (three writers; must all land) | 4 | 12 | 12/118 |
 * | tableRowNeighbours | 4 | 8 | 8/118 |
 * | listItemNeighbours | 4 | 8 | 8/118 |
 * | gapNodeEdits | 4 | 8 | 8/118 |
 * | statusForward | 3 | 6 | 6/118 |
 * | statusEqual | 2 | 4 | 4/118 |
 * | statusBackward | 3 | 6 | 6/118 |
 * | statusOutsideLifecycle | 2 | 4 | 4/118 |
 * | mixedCleanAndContested | 4 | 8 | 8/118 |
 *
 * Every writer edits the same exported base, so this is an upper bound on
 * contention; it is not the S14b replay of real sessions, and its
 * resolver-needed ratio and per-op landing share are reported against the
 * SPEC bars, not claimed to meet them (see the decision). The suite runs under
 * Bun only (the SQLite driver imports `bun:sqlite`). Set
 * `BEEP_TEST_AGENT_MEMORY_REPORT` to a file path to append the measured
 * counts there; they are also logged and asserted.
 */
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { buildAdversarialFixture, strata } from "./admission-fixture.ts";
import { prepareReplay, replayOnce, verdictOf } from "./admission-replay.ts";
import { loadGoalsMarkdownSample } from "./fixtures/goals-markdown-sample.ts";
import { isBunRuntime, report, TestPlatform, tempDirectory } from "./projector-support.ts";
import type { AdversarialFixture } from "./admission-fixture.ts";
import type { RunVerdict } from "./admission-replay.ts";

/** Runs of the fixture: the same clusters in 100 seeded admission orders. */
const runs = 100;

// S14b's measured resolver-needed ratio and per-op landing bar, as integers.
const resolverBar = { held: 26, writes: 279 } as const;
const perOpBarPercent = 95;

// The counts this replay measured over its 100 runs (11,800 writes, 15,600
// operations), pinned so a change in admission or in the fixture shows.
const MEASURED_FLOOR = 912;
const MEASURED_RESOLVER_NEEDED = 1_912;
const MEASURED_LANDED = 12_178;
const MEASURED_BACKWARD = 744;

class AdversarialReplay extends Context.Service<
  AdversarialReplay,
  { readonly fixture: AdversarialFixture; readonly verdicts: ReadonlyArray<RunVerdict> }
>()("@beep/agent-memory-store/test/Admission.acceptance.test/AdversarialReplay") {}

const replayLayer = Layer.effect(
  AdversarialReplay,
  Effect.gen(function* () {
    const sample = yield* loadGoalsMarkdownSample;
    const fixture = buildAdversarialFixture(sample.files);
    const workspace = yield* tempDirectory("beep-ac2-ac3-");
    const prepared = yield* prepareReplay(fixture, workspace);
    const verdicts = yield* Effect.forEach(A.range(1, runs), (seed) =>
      Effect.map(replayOnce(prepared, seed), verdictOf)
    );
    return AdversarialReplay.of({ fixture, verdicts });
  })
).pipe(Layer.provide(TestPlatform));

const sum = (verdicts: ReadonlyArray<RunVerdict>, count: (verdict: RunVerdict) => number): number =>
  A.reduce(verdicts, 0, (total, verdict) => total + count(verdict));

const span = (verdicts: ReadonlyArray<RunVerdict>, count: (verdict: RunVerdict) => number) => {
  const values = A.map(verdicts, count);
  return { min: Math.min(...values), max: Math.max(...values) };
};

const logged = Effect.fnUntraced(function* (line: string) {
  yield* Effect.logInfo(line);
  yield* report(line);
});

describe.skipIf(!isBunRuntime)("admission on the adversarial fixture (Bun runtime)", () => {
  it.layer(Layer.mergeAll(replayLayer, TestPlatform), { timeout: "120 seconds" })("seeded runs", (it) => {
    it.effect("the fixture composition is the one the decision declared", () =>
      Effect.gen(function* () {
        const { fixture } = yield* AdversarialReplay;
        const byStratum = A.map(strata, ({ stratum }) => [
          stratum,
          A.filter(fixture.clusters, (cluster) => cluster.stratum === stratum).length,
        ]);
        expect(byStratum).toEqual(A.map(strata, ({ stratum, clusters }) => [stratum, clusters]));
        expect(fixture.files).toHaveLength(14);
        expect(A.flatMap(fixture.clusters, (cluster) => cluster.writers)).toHaveLength(118);
      })
    );

    it.effect(
      "AC-2 zero silent loss: in 0 of 100 seeded runs does an admitted write drop another writer's content, and every contested node is held with both texts",
      () =>
        Effect.gen(function* () {
          const { verdicts } = yield* AdversarialReplay;
          const lossRuns = A.filter(verdicts, (verdict) => verdict.losses.length > 0);
          const contested = sum(verdicts, (verdict) => verdict.contestedNodes);
          const contestedHeld = sum(verdicts, (verdict) => verdict.contestedHeldWithBothTexts);
          const writes = sum(verdicts, (verdict) => verdict.writes);
          yield* logged(
            `AC-2 runs=${verdicts.length} runsWithLoss=${lossRuns.length} contestedHeldWithBothTexts=${contestedHeld}/${contested} deleteVersusEditHeld=${sum(verdicts, (verdict) => verdict.deleteVersusEditHeld)} writes=${writes}`
          );
          expect(verdicts).toHaveLength(runs);
          expect(A.flatMap(lossRuns, (verdict) => verdict.losses)).toEqual([]);
          expect(A.every(verdicts, (verdict) => verdict.exportMatchesDisk)).toBe(true);
          expect(A.every(verdicts, (verdict) => verdict.writes === 118 && verdict.operations === 156)).toBe(true);
          // Six reviseVersusRevise nodes and four mixed batches contest one node each, in every run.
          expect(contested).toBe(10 * runs);
          expect(contestedHeld).toBe(contested);
          // reviseVersusRetire holds exactly one side of each of its six clusters, whichever lands first.
          expect(sum(verdicts, (verdict) => verdict.deleteVersusEditHeld)).toBe(6 * runs);
        })
    );

    it.effect(
      "AC-3 held-write budget: the structural floor is measured first, resolver-needed writes and per-op landing are measured against 26/279 and 95%, typed status conflicts leave the held path with 0 wrong and the guard rejects every backward move",
      () =>
        Effect.gen(function* () {
          const { verdicts } = yield* AdversarialReplay;
          const writes = sum(verdicts, (verdict) => verdict.writes);
          const operations = sum(verdicts, (verdict) => verdict.operations);
          const floor = sum(verdicts, (verdict) => verdict.structuralFloorWrites);
          const resolverNeeded = sum(verdicts, (verdict) => verdict.resolverNeededWrites);
          const landed = sum(verdicts, (verdict) => verdict.landedOperations);
          const statusConflicts = sum(verdicts, (verdict) => verdict.statusConflicts);
          const statusHeld = sum(verdicts, (verdict) => verdict.statusHeld);
          const statusWrong = sum(verdicts, (verdict) => verdict.statusWrong);
          const backward = sum(verdicts, (verdict) => verdict.backwardMoves);
          const backwardRejected = sum(verdicts, (verdict) => verdict.backwardRejected);
          const floorSpan = span(verdicts, (verdict) => verdict.structuralFloorWrites);
          const resolverSpan = span(verdicts, (verdict) => verdict.resolverNeededWrites);
          const meetsResolverBar = resolverNeeded * resolverBar.writes <= resolverBar.held * writes;
          const meetsPerOpBar = landed * 100 >= perOpBarPercent * operations;
          yield* logged(`AC-3 structuralFloor=${floor}/${writes} (per run ${floorSpan.min}..${floorSpan.max} of 118)`);
          yield* logged(
            `AC-3 resolverNeeded=${resolverNeeded}/${writes} (per run ${resolverSpan.min}..${resolverSpan.max} of 118) against ${resolverBar.held}/${resolverBar.writes}: ${resolverNeeded}*${resolverBar.writes}=${resolverNeeded * resolverBar.writes} vs ${resolverBar.held}*${writes}=${resolverBar.held * writes}, bar met=${meetsResolverBar}`
          );
          yield* logged(
            `AC-3 perOpLanded=${landed}/${operations} against ${perOpBarPercent}%: bar met=${meetsPerOpBar}`
          );
          yield* logged(
            `AC-3 statusConflicts=${statusConflicts} held=${statusHeld} wrong=${statusWrong} backwardMoves=${backward} rejected=${backwardRejected}`
          );

          // Typed status fields: never held, never wrong, every backward move refused.
          expect(statusConflicts).toBe(10 * runs);
          expect(statusHeld).toBe(0);
          expect(statusWrong).toBe(0);
          expect(backward).toBeGreaterThan(0);
          expect(backwardRejected).toBe(backward);

          // The measured counts, asserted exactly so any change in admission shows.
          expect({ floor, resolverNeeded, landed, backward }).toEqual({
            floor: MEASURED_FLOOR,
            resolverNeeded: MEASURED_RESOLVER_NEEDED,
            landed: MEASURED_LANDED,
            backward: MEASURED_BACKWARD,
          });
          // Per run the floor and the resolver-needed count stay inside the
          // ranges the strata allow: at least the 16 writes that must hold in
          // every order, at most every contested cluster holding.
          expect(resolverSpan.min).toBeGreaterThanOrEqual(16);
          expect(resolverSpan.max).toBeLessThanOrEqual(16 + 4 + 3);
          expect(floorSpan.min).toBeGreaterThanOrEqual(6);
          expect(floorSpan.max).toBeLessThanOrEqual(6 + 4 + 3);
          // On this upper-bound fixture neither ratio bar is met; the SPEC bars
          // stay, and AC-3 is not ticked on this fixture.
          expect([meetsResolverBar, meetsPerOpBar]).toEqual([false, false]);
        })
    );
  });
});
