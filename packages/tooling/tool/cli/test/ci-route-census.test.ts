import {
  ChangeAtom,
  ChangeClassifier,
  ChangeSet,
  CI_LANE_ID_VALUES,
  HostedJob,
  HostedRun,
  RouteCensusReader,
  RouteCorpusLoaded,
  RouteCorpusReceipt,
  RouteError,
  routeFootprintCanonicalJson,
  VerificationRoute,
} from "@beep/repo-cli/commands/Ci";
import {
  ciLaneOfPrePushLaneId,
  ensureRouteHeads,
  jobNameToLane,
  missingFromBatchCheck,
  orderSelectedLanes,
  prePushLaneId,
  RouteCensusReaderLive,
  RouteGit,
  verificationRouteLayer,
} from "@beep/repo-cli/commands/Ci/RouteCensus";
import { sha256Hex } from "@beep/repo-cli/test/Goals";
import { githubCheckPrePushLanes } from "@beep/repo-cli/test/Quality";
import { DEFAULT_GATE_ORDER_SEED, orderWaveLanes, WaveOrder } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import censusRunsJson from "./fixtures/ci-route/census/census-runs.json" with { type: "json" };
import replayRunsJson from "./fixtures/ci-route/census/replay-runs.json" with { type: "json" };
import type { ChangeAtomKind, CiLaneId, RouteCensus, RouteLaneCost, RouteReplay } from "@beep/repo-cli/commands/Ci";

const decodeRuns = S.decodeUnknownEffect(S.Array(HostedRun));

const atom = (kind: ChangeAtomKind, path: string): ChangeAtom => ChangeAtom.make({ kind, path, digest: "00" });

const classifierLayer = (atomsFor: (head: string) => ReadonlyArray<ChangeAtom>) =>
  Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
        return ChangeSet.make({ base: input.base, head: input.head, changedPaths: [], atoms: atomsFor(input.head) });
      }),
    })
  );

// Fails for any head outside the table, so a test proves a head was never classified.
const strictClassifierLayer = (table: Readonly<Record<string, ReadonlyArray<ChangeAtom>>>) =>
  Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
        const atoms = yield* Effect.fromOption(R.get(table, input.head)).pipe(
          Effect.mapError(() => RouteError.new("classify", `unexpected classify of ${input.head}`))
        );
        return ChangeSet.make({ base: input.base, head: input.head, changedPaths: [], atoms });
      }),
    })
  );

const atomsByHead =
  (table: Readonly<Record<string, ReadonlyArray<ChangeAtom>>>) =>
  (head: string): ReadonlyArray<ChangeAtom> =>
    O.getOrElse(R.get(table, head), () => A.empty<ChangeAtom>());

const allUnknown = (): ReadonlyArray<ChangeAtom> => [atom("unknown", "mystery.bin")];
const noAtoms = (): ReadonlyArray<ChangeAtom> => A.empty<ChangeAtom>();

const gitLayer = (
  mergeBases: Readonly<Record<string, string>>,
  ancestors: ReadonlyArray<readonly [ancestor: string, descendant: string]>,
  ensured: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>,
  unresolved: ReadonlyArray<string> = []
) =>
  Layer.succeed(
    RouteGit,
    RouteGit.of({
      repoRoot: Effect.succeed("/repo"),
      mergeBase: Effect.fn("RouteGit.mergeBase")(function* (head) {
        return yield* Effect.fromOption(R.get(mergeBases, head)).pipe(
          Effect.mapError(() => RouteError.new("git", `no merge base for ${head}`))
        );
      }),
      isAncestor: Effect.fn("RouteGit.isAncestor")(function* (ancestor, descendant) {
        // Like git: a commit missing from the object store fails the check.
        if (A.contains(unresolved, ancestor)) {
          return yield* RouteError.new("git", `git merge-base --is-ancestor ${ancestor} ${descendant} exited 128.`);
        }
        return A.some(ancestors, ([from, to]) => from === ancestor && to === descendant);
      }),
      ensureHeads: Effect.fn("RouteGit.ensureHeads")(function* (shas) {
        yield* Ref.update(ensured, A.append(shas));
        return A.filter(shas, (sha) => A.contains(unresolved, sha));
      }),
    })
  );

const corpusOf = (runs: ReadonlyArray<HostedRun>): RouteCorpusLoaded =>
  RouteCorpusLoaded.make({
    receipt: RouteCorpusReceipt.make({
      schemaVersion: "route-corpus/v1",
      capturedAt: "2026-10-31T00:00:00Z",
      since: "2026-09-01",
      until: "2026-10-31",
      workflows: ["Check"],
      runs: runs.length,
      heads: A.dedupe(A.map(runs, (run) => run.headSha)).length,
      path: "goals/verification-route/research/corpus/runs.json",
      sha256: "c0ffee",
    }),
    runs,
  });

const readerLayer = (
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Layer.Layer<RouteCensusReader, RouteError> =>
  RouteCensusReaderLive.pipe(Layer.provide(Layer.mergeAll(classifier, git, NodeCrypto.layer)));

const runCensus = (
  runs: ReadonlyArray<HostedRun>,
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Effect.Effect<RouteCensus, RouteError> =>
  Effect.gen(function* () {
    const reader = yield* RouteCensusReader;
    return yield* reader.census(corpusOf(runs));
  }).pipe(provideScopedLayer(readerLayer(classifier, git)));

const runReplay = (
  runs: ReadonlyArray<HostedRun>,
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Effect.Effect<RouteReplay, RouteError> =>
  Effect.gen(function* () {
    const reader = yield* RouteCensusReader;
    return yield* reader.replay(corpusOf(runs));
  }).pipe(provideScopedLayer(readerLayer(classifier, git)));

const costOf = (costs: ReadonlyArray<RouteLaneCost>, lane: CiLaneId): O.Option<RouteLaneCost> =>
  A.findFirst(costs, (cost) => cost.lane === lane);

// Replay fixture git: a1 forks at m1 (a main run exists), b2 at m9 (no run;
// m0 is its nearest ancestor with one, m2 is newer and not an ancestor), c3 at
// zz (no ancestor run at all).
const REPLAY_MERGE_BASES = { a1: "m1", b2: "m9", c3: "zz" };
const REPLAY_ANCESTORS: ReadonlyArray<readonly [string, string]> = [["m0", "m9"]];

// Lanes a change with no atoms skips: every lane but the external security lane.
const SKIPPED_WITHOUT_ATOMS = CI_LANE_ID_VALUES.length - 1;

const LANES_WITHOUT_PRE_PUSH_TWIN: ReadonlyArray<CiLaneId> = ["ecosystem", "fallow", "labs", "property", "repo-sanity"];

describe("route joins", () => {
  it("joins hosted job names to lanes through the descriptor context", () => {
    assertSome(jobNameToLane("Heavy / Check"), "check");
    assertSome(jobNameToLane("Lint (lint-a)"), "lint");
    assertSome(jobNameToLane("Test Unit (repo-cli-1)"), "test-unit");
    assertSome(jobNameToLane("Security"), "security");
    assertNone(jobNameToLane("PR Size Label"));
    assertNone(jobNameToLane("Coverage Artifact Migration"));
  });

  it("joins quality:<lane> pre-push ids to lanes both ways", () => {
    expect(prePushLaneId("docgen")).toBe("quality:docgen");
    assertSome(ciLaneOfPrePushLaneId("quality:docgen"), "docgen");
    assertNone(ciLaneOfPrePushLaneId("quality:cache-policy"));
    assertNone(ciLaneOfPrePushLaneId("repo-sanity:versions"));
  });

  it("orders twins by the given order and appends lanes without a twin in lane-id order", () => {
    const specs = githubCheckPrePushLanes("/repo", []);
    const selected = HashSet.fromIterable<CiLaneId>(["labs", "check", "lint"]);
    expect(orderSelectedLanes(selected, (lanes) => lanes, specs)).toEqual(["lint", "check", "labs"]);
    expect(orderSelectedLanes(selected, A.reverse, specs)).toEqual(["check", "lint", "labs"]);
  });

  it("reads missing commits from a batch-check report", () => {
    expect(missingFromBatchCheck(["aa", "bb", "cc", "dd"], "aa commit 250\nbb missing\ncc tree 31\n")).toEqual([
      "bb",
      "cc",
      "dd",
    ]);
  });
});

describe("route head fetch", () => {
  it.effect("fetches only when a head is missing, then each head still missing by sha, and returns the rest", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const present = yield* Ref.make(HashSet.fromIterable(["a1", "c3"]));
      const record = (call: string) => Ref.update(calls, A.append(call));
      const ensure = ensureRouteHeads({
        fetchCommit: Effect.fn("RouteGit.fetchCommit")(function* (sha) {
          yield* record(`fetch ${sha}`);
          // The remote still serves b2 by sha; d4 is gone.
          if (sha === "b2") {
            yield* Ref.update(present, HashSet.add(sha));
          }
        }),
        fetchPullHeads: record("fetch pull refs"),
        missingCommits: Effect.fn("RouteGit.missingCommits")(function* (shas) {
          yield* record(`check ${A.join(shas, ",")}`);
          const have = yield* Ref.get(present);
          return A.filter(shas, (sha) => !HashSet.has(have, sha));
        }),
      });

      expect(yield* ensure(["a1", "b2", "c3", "d4"])).toEqual(["d4"]);
      const log = yield* Ref.get(calls);
      expect(A.take(log, 3)).toEqual(["check a1,b2,c3,d4", "fetch pull refs", "check a1,b2,c3,d4"]);
      expect(
        A.sort(
          A.filter(log, (call) => Str.startsWith("fetch ")(call) && call !== "fetch pull refs"),
          Str.Order
        )
      ).toEqual(["fetch b2", "fetch d4"]);
      assertSome(A.last(log), "check b2,d4");
      expect(log).toHaveLength(6);

      // Every head already local: one object-store check, no network.
      yield* Ref.set(calls, []);
      expect(yield* ensure(["a1", "b2", "c3"])).toEqual([]);
      expect(yield* Ref.get(calls)).toEqual(["check a1,b2,c3"]);

      yield* Ref.set(calls, []);
      expect(yield* ensure([])).toEqual([]);
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );
});

const planLayer = Layer.mergeAll(
  verificationRouteLayer((base, head) => Effect.succeed([`${base}:affected`, `${head}:affected`])).pipe(
    Layer.provide(Layer.mergeAll(WaveOrder.Default, NodeCrypto.layer))
  ),
  NodeCrypto.layer
);

it.layer(planLayer, { timeout: "30 seconds" })("verification route plan", (it) => {
  it.effect("selects every lane in wave order at all-unknown and skips none", () =>
    Effect.gen(function* () {
      const route = yield* VerificationRoute;
      const plan = yield* route.plan(
        ChangeSet.make({ base: "base", head: "head", changedPaths: ["mystery.bin"], atoms: allUnknown() })
      );

      const waved = A.flatMap(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, githubCheckPrePushLanes("/repo", [])), (spec) =>
        A.filter(CI_LANE_ID_VALUES, (lane) => spec.id === `quality:${lane}`)
      );
      const lanes = A.map(plan.selected, (selection) => selection.lane);
      expect(lanes).toEqual(A.appendAll(waved, LANES_WITHOUT_PRE_PUSH_TWIN));
      expect(lanes).toHaveLength(CI_LANE_ID_VALUES.length);
      expect(A.every(CI_LANE_ID_VALUES, (lane) => A.contains(lanes, lane))).toBe(true);
      expect(A.every(plan.selected, (selection) => A.contains(selection.selectedBy, "unknown"))).toBe(true);
      expect(plan.skipped).toEqual([]);
      expect(plan.affectedPackages).toEqual(["base:affected", "head:affected"]);
      expect(plan.footprintDigest).toBe(yield* sha256Hex(routeFootprintCanonicalJson()));
    })
  );

  it.effect("selects only the external lanes for a change with no atoms", () =>
    Effect.gen(function* () {
      const route = yield* VerificationRoute;
      const plan = yield* route.plan(ChangeSet.make({ base: "base", head: "head", changedPaths: [], atoms: [] }));
      expect(A.map(plan.selected, (selection) => [selection.lane, selection.selectedBy])).toEqual([["security", []]]);
      expect(plan.skipped).toEqual(A.filter(CI_LANE_ID_VALUES, (lane) => lane !== "security"));
    })
  );
});

it.layer(NodeCrypto.layer)("route census", (it) => {
  const censusAtoms = atomsByHead({
    p1: [atom("pkg:catalog", "package.json")],
    x2: [atom("pkg:catalog", "package.json"), atom("docs:markdown", "README.md"), atom("unknown", "mystery.bin")],
  });

  it.effect("splits lane machine time into pure and mixed rows by atom kind", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(censusAtoms),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );

      expect(yield* Ref.get(ensured)).toEqual([["p1", "x2"]]);
      expect(census.heads).toBe(2);
      expect(census.classifiedHeads).toBe(2);
      expect(census.unknownAtomShare).toBe(0.25);
      expect(census.unresolvedHeads).toBe(0);
      expect(census.corpusSha256).toBe("c0ffee");
      expect(census.footprintDigest).toBe(yield* sha256Hex(routeFootprintCanonicalJson()));
      // p1 (pure pkg:catalog): lint 60 s + 30 s shards, check 120 s; the PR Size
      // Label job has no lane and the untimed Test Unit shard has no cost.
      // x2 (mixed): lint 40 s + 10 s over two attempts (one head), check 90 s.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["pkg:catalog", "check", 1, 120_000, 1, 90_000],
        ["pkg:catalog", "lint", 1, 90_000, 1, 50_000],
        ["docs:markdown", "check", 0, 0, 1, 90_000],
        ["unknown", "check", 0, 0, 1, 90_000],
        ["docs:markdown", "lint", 0, 0, 1, 50_000],
        ["unknown", "lint", 0, 0, 1, 50_000],
      ]);
    })
  );

  it.effect("costs lint from the gate-order seed, property from the corpus, and labs from nothing", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(censusAtoms),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );
      const seedLint = yield* Effect.fromOption(
        A.findFirst(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.laneId === "quality:lint")
      );

      expect(census.costs).toHaveLength(CI_LANE_ID_VALUES.length);
      const lint = yield* Effect.fromOption(costOf(census.costs, "lint"));
      expect(lint.basis).toBe("gate-order-seed");
      assertSome(lint.p50Ms, Math.round(seedLint.costP50Seconds * 1000));
      assertSome(lint.source, seedLint.durationPointer);

      const property = yield* Effect.fromOption(costOf(census.costs, "property"));
      expect(property.basis).toBe("hosted-median");
      assertSome(property.p50Ms, 20_000);

      const labs = yield* Effect.fromOption(costOf(census.costs, "labs"));
      expect(labs.basis).toBe("none");
      assertNone(labs.p50Ms);
      assertNone(labs.source);
    })
  );

  it.effect("counts a head missing after ensureHeads as one unknown atom without classifying it", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // x2 stays missing after ensureHeads; neither the classifier nor mergeBase knows it.
      const census = yield* runCensus(
        runs,
        strictClassifierLayer({ p1: [atom("pkg:catalog", "package.json")] }),
        gitLayer({ p1: "m1" }, [], ensured, ["x2"])
      );

      expect(yield* Ref.get(ensured)).toEqual([["p1", "x2"]]);
      expect(census.heads).toBe(2);
      expect(census.unresolvedHeads).toBe(1);
      expect(census.unknownAtomShare).toBe(0.5);
      // x2's only kind is the unknown atom, so its lane time is pure unknown time.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["pkg:catalog", "check", 1, 120_000, 0, 0],
        ["pkg:catalog", "lint", 1, 90_000, 0, 0],
        ["unknown", "check", 1, 90_000, 0, 0],
        ["unknown", "lint", 1, 50_000, 0, 0],
      ]);
    })
  );

  it.effect("judges purity over tree kinds, so commits metadata alone is pure only on an empty-tree head", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        strictClassifierLayer({
          p1: [atom("packet", "goals/x/PLAN.md"), atom("commits", "base..head")],
          x2: [atom("commits", "base..head")],
        }),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );

      // p1 {packet, commits}: pure for packet, mixed for commits (it has a tree kind).
      // x2 {commits}: an empty-tree head, pure for commits.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["packet", "check", 1, 120_000, 0, 0],
        ["commits", "check", 1, 90_000, 1, 120_000],
        ["packet", "lint", 1, 90_000, 0, 0],
        ["commits", "lint", 1, 50_000, 1, 90_000],
      ]);
    })
  );

  it.effect("counts unclassified heads without rows", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );
      expect(census.heads).toBe(3);
      expect(census.classifiedHeads).toBe(0);
      expect(census.unknownAtomShare).toBe(0);
      expect(census.rows).toEqual([]);
    })
  );
});

describe("route replay", () => {
  for (const missing of [true, false]) {
    it.effect(`counts skipped failures against ${missing ? "missing" : "cancelled"} base lane results`, () =>
      Effect.gen(function* () {
        const original = yield* decodeRuns(replayRunsJson);
        const runs = A.map(original, (run) =>
          run.headSha === "m1"
            ? HostedRun.make({
                ...run,
                jobs: missing
                  ? A.filter(run.jobs, (job) => job.name !== "Heavy / Check")
                  : A.map(run.jobs, (job) =>
                      job.name === "Heavy / Check" ? HostedJob.make({ ...job, conclusion: O.some("cancelled") }) : job
                    ),
              })
            : run
        );
        const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const replay = yield* runReplay(
          runs,
          classifierLayer(noAtoms),
          gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
        );
        const head = yield* Effect.fromOption(A.findFirst(replay.perHead, (row) => row.headSha === "a1"));
        expect(head.skippedReds).toEqual(["check"]);
        expect(head.baseUnknown).toBe(true);
        expect(replay.baseUnknownHeads).toBe(2);
        expect(replay.skippedReds).toBe(3);
      })
    );
  }

  it.effect("has recall 1 at all-unknown", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replay = yield* runReplay(
        runs,
        classifierLayer(allUnknown),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );

      // Pull-request heads first, then the main candidates for base evidence.
      expect(yield* Ref.get(ensured)).toEqual([
        ["a1", "b2", "c3"],
        ["m2", "m1", "m0"],
      ]);
      expect(replay.recall).toBe(1);
      expect(replay.skippedLaneRuns).toBe(0);
      expect(replay.skippedReds).toBe(0);
      expect(replay.baseUnknownHeads).toBe(1);
      expect(A.map(replay.perHead, (head) => head.headSha)).toEqual(["a1", "b2", "c3"]);
      expect(A.every(replay.perHead, (head) => head.selected.length === CI_LANE_ID_VALUES.length)).toBe(true);
      expect(A.every(replay.perHead, (head) => A.isReadonlyArrayEmpty(head.skipped))).toBe(true);
    })
  );

  it.effect(
    "counts a skipped red only when the lane was green on the base, and every red when the base is unknown",
    () =>
      Effect.gen(function* () {
        const runs = yield* decodeRuns(replayRunsJson);
        const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const replay = yield* runReplay(
          runs,
          classifierLayer(noAtoms),
          gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
        );

        // With no atoms only the external security lane is selected.
        // a1: check red and green on m1 (counts).
        // b2: base is m0, the newest main run that is an ancestor of m9 (m2 is not,
        // and the feat/not-main push of m0 is no base); sast green there
        // (counts), codegen red there (inherited).
        // c3: no base run, so its lint red counts (fail-closed).
        expect(
          A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
        ).toEqual([
          ["a1", "m1", ["check"], false],
          ["b2", "m9", ["sast"], false],
          ["c3", "zz", ["lint"], true],
        ]);
        expect(A.every(replay.perHead, (head) => A.contains(head.selected, "security"))).toBe(true);
        expect(A.every(replay.perHead, (head) => head.selected.length === 1)).toBe(true);
        expect(A.every(replay.perHead, (head) => head.skipped.length === SKIPPED_WITHOUT_ATOMS)).toBe(true);
        expect(replay.heads).toBe(3);
        expect(replay.skippedLaneRuns).toBe(3 * SKIPPED_WITHOUT_ATOMS);
        expect(replay.skippedReds).toBe(3);
        expect(replay.baseUnknownHeads).toBe(1);
        expect(replay.unresolvedHeads).toBe(0);
        expect(replay.recall).toBe(1 - 3 / (3 * SKIPPED_WITHOUT_ATOMS));
        expect(replay.corpusSha256).toBe("c0ffee");
      })
  );

  it.effect("skips a main candidate that stays missing instead of failing the replay", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // m2, the newest main run, cannot be fetched; asking git about it would fail.
      const replay = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured, ["m2"])
      );

      expect(
        A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
      ).toEqual([
        ["a1", "m1", ["check"], false],
        ["b2", "m9", ["sast"], false],
        ["c3", "zz", ["lint"], true],
      ]);
    })
  );

  it.effect("selects every lane for an unresolved head and marks its base unknown", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // b2 stays missing after ensureHeads; neither the classifier nor mergeBase knows it.
      const replay = yield* runReplay(
        runs,
        strictClassifierLayer({ a1: [], c3: [] }),
        gitLayer({ a1: "m1", c3: "zz" }, REPLAY_ANCESTORS, ensured, ["b2"])
      );

      expect(
        A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
      ).toEqual([
        ["a1", "m1", ["check"], false],
        ["b2", "<unresolved>", [], true],
        ["c3", "zz", ["lint"], true],
      ]);
      const b2 = yield* Effect.fromOption(A.findFirst(replay.perHead, (head) => head.headSha === "b2"));
      expect(b2.selected).toEqual(CI_LANE_ID_VALUES);
      expect(b2.skipped).toEqual([]);
      expect(replay.unresolvedHeads).toBe(1);
      expect(replay.baseUnknownHeads).toBe(2);
      expect(replay.skippedLaneRuns).toBe(2 * SKIPPED_WITHOUT_ATOMS);
      expect(replay.skippedReds).toBe(2);
      expect(replay.recall).toBe(1 - 2 / (2 * SKIPPED_WITHOUT_ATOMS));
    })
  );

  it.effect("does not count a red on an external lane as a skipped red, even when the base was green", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replay = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );

      // a1 has no atoms and is red on Security while m1, its base, is green there:
      // the external lane is selected for every change, so the red is not a miss.
      const a1 = yield* Effect.fromOption(A.findFirst(replay.perHead, (head) => head.headSha === "a1"));
      expect(a1.baseUnknown).toBe(false);
      expect(a1.selected).toEqual(["security"]);
      expect(A.contains(a1.skipped, "security")).toBe(false);
      expect(A.contains(a1.skippedReds, "security")).toBe(false);
      expect(a1.skippedReds).toEqual(["check"]);
    })
  );
});
