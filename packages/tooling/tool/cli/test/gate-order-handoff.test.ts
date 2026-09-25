import {
  EconomicsSeedSourceView,
  EconomicsSeedSourceViewJson,
  GateOrderCostSource,
  GateOrderHandoff,
  GateOrderHandoffJson,
  GateOrderHandoffSource,
  GateOrderSeed,
  GateOrderSeedRow,
  GateOrderSortKey,
} from "@beep/repo-cli/commands/Quality";
import {
  githubCheckChangesetStatusLane,
  githubCheckPrePushLanes,
  redSchedulingDecision,
} from "@beep/repo-cli/test/Quality";
import {
  DEFAULT_GATE_ORDER_COST_SOURCES,
  DEFAULT_GATE_ORDER_SEED,
  GATE_ORDER_SOURCE,
  gateOrderHandoff,
  gateOrderSeedFindings,
  orderWaveLanes,
  POSTDATES_A1_FIRST_RED_BASIS,
  rankWaveLanes,
  WAVE_ORDER_KEYS,
} from "@beep/repo-cli/test/Yeet";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema/Sha256";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { assertSchemaArbitraryDecodesToSelf, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type {
  GateOrderSeedFinding,
  GateOrderSeedFindingKind,
  GithubCheckLaneSpec,
} from "@beep/repo-cli/commands/Quality";

const ECONOMICS_PATH = "goals/time-to-certainty/research/economics.json";
const HANDOFF_PATH = "goals/time-to-certainty/research/gate-order-handoff.json";
const EMPTY_INPUT_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const COVERAGE_KINDS: ReadonlyArray<GateOrderSeedFindingKind> = [
  "unseeded-lane",
  "orphan-seed-row",
  "cost-basis-unmapped",
  "lane-class-wave-mismatch",
];

const declaredLanes: ReadonlyArray<GithubCheckLaneSpec> = githubCheckPrePushLanes("/repo", [
  githubCheckChangesetStatusLane("/repo"),
]);

// The §1 canonical encoding: two-space pretty JSON plus a trailing newline. Only this
// fixture computes the committed bytes; GateOrderHandoffJson encodes compact JSON.
const encodeHandoffBytes = (handoff: GateOrderHandoff) =>
  Effect.map(S.encodeEffect(S.fromJsonString(GateOrderHandoff, { space: 2 }))(handoff), (text) => `${text}\n`);

const loadEconomics = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const economicsPath = path.join(repoRoot, ECONOMICS_PATH);
  const view = yield* EconomicsSeedSourceViewJson.decode(yield* fs.readFileString(economicsPath));
  return { repoRoot, economicsPath, view, handoffPath: path.join(repoRoot, HANDOFF_PATH) };
});

const handoffSource = (view: EconomicsSeedSourceView): GateOrderHandoffSource =>
  GateOrderHandoffSource.make({
    reference: GATE_ORDER_SOURCE,
    schemaVersion: view.schemaVersion,
    measurementAsOf: view.measurementAsOf,
    firstFailurePopulation: view.firstFailure.attemptsWithReconstructableOuterFailure,
    firstFailureRedAttempts: view.firstFailure.redAttempts,
  });

const defaultHandoff = (view: EconomicsSeedSourceView): GateOrderHandoff =>
  gateOrderHandoff(DEFAULT_GATE_ORDER_SEED, DEFAULT_GATE_ORDER_COST_SOURCES, declaredLanes, handoffSource(view), view);

const withSeedRow = (
  seed: GateOrderSeed,
  laneId: string,
  patch: Partial<ConstructorParameters<typeof GateOrderSeedRow>[0]>
): GateOrderSeed =>
  GateOrderSeed.make({
    ...seed,
    lanes: A.map(seed.lanes, (row) => (row.laneId === laneId ? GateOrderSeedRow.make({ ...row, ...patch }) : row)),
  });

const withCostSource = (
  laneId: string,
  patch: Partial<ConstructorParameters<typeof GateOrderCostSource>[0]>
): ReadonlyArray<GateOrderCostSource> =>
  A.map(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) =>
    entry.laneId === laneId ? GateOrderCostSource.make({ ...entry, ...patch }) : entry
  );

const withFirstFailure = (
  view: EconomicsSeedSourceView,
  patch: Partial<EconomicsSeedSourceView["firstFailure"]>
): EconomicsSeedSourceView =>
  EconomicsSeedSourceView.make({ ...view, firstFailure: { ...view.firstFailure, ...patch } });

const findingSummary = (findings: ReadonlyArray<GateOrderSeedFinding>) =>
  A.map(findings, (finding) => ({ kind: finding.kind, laneId: O.getOrElse(finding.laneId, () => "") }));

const idsOfKind = (findings: ReadonlyArray<GateOrderSeedFinding>, kind: GateOrderSeedFindingKind): string =>
  pipe(
    A.filter(findings, (finding) => finding.kind === kind),
    A.map((finding) => O.getOrElse(finding.laneId, () => "?")),
    A.join(", ")
  );

const countBy = <T>(values: ReadonlyArray<T>, key: (value: T) => string): Record<string, number> =>
  R.map(A.groupBy(values, key), (group) => group.length);

type EncodedHandoff = typeof GateOrderHandoff.Encoded;
type EncodedLane = EncodedHandoff["lanes"][number];

const mapEncodedLane = (
  encoded: EncodedHandoff,
  laneId: string,
  patch: (lane: EncodedLane) => EncodedLane
): EncodedHandoff => ({
  ...encoded,
  lanes: A.map(encoded.lanes, (lane) => (lane.laneId === laneId ? patch(lane) : lane)),
});

const mapEncodedLaneAt = (
  encoded: EncodedHandoff,
  index: number,
  patch: (lane: EncodedLane) => EncodedLane
): EncodedHandoff => ({
  ...encoded,
  lanes: A.map(encoded.lanes, (lane, position) => (position === index ? patch(lane) : lane)),
});

type IndexedLane = readonly [declarationIndex: number, lane: GithubCheckLaneSpec];

// Every WAVE_ORDER_KEYS component before the deciding key ties the adjacent pair; the
// deciding key itself orders the predecessor strictly first.
const expectDecidingKeySeparates = (
  laneId: string,
  decidedBy: GateOrderSortKey,
  previous: IndexedLane,
  current: IndexedLane
): void => {
  const decidingIndex = O.getOrThrow(A.findFirstIndex(WAVE_ORDER_KEYS, ([key]) => key === decidedBy));
  for (const [key, order] of A.take(WAVE_ORDER_KEYS, decidingIndex)) {
    expect(order(previous, current), `${laneId}: ${key} must tie`).toBe(0);
  }
  const [key, order] = O.getOrThrow(A.get(WAVE_ORDER_KEYS, decidingIndex));
  expect(order(previous, current), `${laneId}: ${key} must separate`).toBe(-1);
};

describe("gate-order handoff (TTC D1, rulings 76-78)", () => {
  it.effect(
    "fixture 1: the seed covers exactly the declared pre-push plan",
    Effect.fnUntraced(function* () {
      const { view } = yield* loadEconomics();
      const findings = gateOrderSeedFindings(
        DEFAULT_GATE_ORDER_SEED,
        DEFAULT_GATE_ORDER_COST_SOURCES,
        declaredLanes,
        view
      );
      const coverage = A.filter(findings, (finding) => A.contains(COVERAGE_KINDS, finding.kind));

      expect(
        findingSummary(coverage),
        `gate-order seed does not cover the pre-push plan (unseeded: ${idsOfKind(findings, "unseeded-lane")}; orphan: ${idsOfKind(findings, "orphan-seed-row")}). Add a DEFAULT_GATE_ORDER_SEED row and a DEFAULT_GATE_ORDER_COST_SOURCES entry in packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts under the ruling 76 seeding rule (goals/time-to-certainty/research/decisions.md, round 24), then rerun this file once with vitest -u, which writes goals/time-to-certainty/research/gate-order-handoff.json when the run ends, and once without -u, which must pass; review the handoff diff.`
      ).toEqual([]);

      // Must-fail: the pre-D1 seed leaves quality:cache-policy unseeded.
      const preD1Seed = GateOrderSeed.make({
        ...DEFAULT_GATE_ORDER_SEED,
        lanes: A.filter(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.laneId !== "quality:cache-policy"),
      });
      const preD1Costs = A.filter(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) => entry.laneId !== "quality:cache-policy");
      expect(findingSummary(gateOrderSeedFindings(preD1Seed, preD1Costs, declaredLanes, view))).toEqual([
        { kind: "unseeded-lane", laneId: "quality:cache-policy" },
      ]);

      // Must-fail: a seed row naming no declared lane is one orphan and nothing else.
      const retired = pipe(
        A.findFirst(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.laneId === "repo-sanity:versions"),
        O.map((row) => GateOrderSeedRow.make({ ...row, laneId: "quality:retired" })),
        O.getOrThrow
      );
      expect(retired.durationPointer).toBe("/hosted/laneRows/7/p50DurationMs");
      expect(retired.firstRedPointer).toBe("/firstFailure/actionableLaneMix");
      expect(retired.costP50Seconds).toBe(183);
      expect(retired.redProbability).toBe(0);
      const orphanSeed = GateOrderSeed.make({
        ...DEFAULT_GATE_ORDER_SEED,
        lanes: A.append(DEFAULT_GATE_ORDER_SEED.lanes, retired),
      });
      expect(
        findingSummary(gateOrderSeedFindings(orphanSeed, DEFAULT_GATE_ORDER_COST_SOURCES, declaredLanes, view))
      ).toEqual([{ kind: "orphan-seed-row", laneId: "quality:retired" }]);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fixture 2: every seed pointer agrees with the pinned A1 document",
    Effect.fnUntraced(function* () {
      const { view } = yield* loadEconomics();
      const findingsFor = (
        seed: GateOrderSeed,
        costSources: ReadonlyArray<GateOrderCostSource> = DEFAULT_GATE_ORDER_COST_SOURCES,
        source: EconomicsSeedSourceView = view
      ) => findingSummary(gateOrderSeedFindings(seed, costSources, declaredLanes, source));
      const one = (kind: GateOrderSeedFindingKind, laneId: string) => [{ kind, laneId }];

      expect(findingsFor(DEFAULT_GATE_ORDER_SEED)).toEqual([]);

      expect(findingsFor(withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", { costP50Seconds: 268 }))).toEqual(
        one("duration-mismatch", "quality:lint")
      );
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", { durationPointer: "/hosted/laneRows/17/p50DurationMs" })
        )
      ).toEqual(one("duration-unresolved", "quality:lint"));
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "repo-sanity:versions", {
            durationPointer: "/hosted/laneRows/7/p95DurationMs",
          })
        )
      ).toEqual(one("pointer-shape-unknown", "repo-sanity:versions"));
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:jsdoc-ratchet", {
            durationPointer: "/hosted/laneRows/13/p50DurationMs",
          })
        )
      ).toEqual(one("duration-source-mismatch", "quality:jsdoc-ratchet"));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          withCostSource("quality:storybook", { costBasis: "a1-lane-row", sourceKey: O.some("SAST") })
        )
      ).toEqual(one("duration-source-mismatch", "quality:storybook"));
      expect(findingsFor(withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:docgen", { redProbability: 1 / 832 }))).toEqual(
        one("absent-red-nonzero", "quality:docgen")
      );
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:security", {
            firstRedPointer: "/firstFailure/actionableLaneMix/26",
          })
        )
      ).toEqual(one("red-lane-mismatch", "quality:security"));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          DEFAULT_GATE_ORDER_COST_SOURCES,
          withFirstFailure(view, { attemptsWithReconstructableOuterFailure: 833 })
        )
      ).toEqual(one("population-mismatch", ""));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          DEFAULT_GATE_ORDER_COST_SOURCES,
          withFirstFailure(view, { redAttempts: 1611 })
        )
      ).toEqual(one("red-attempts-mismatch", ""));
      expect(findingsFor(withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:knip", { laneClass: "heavy" }))).toEqual(
        one("lane-class-wave-mismatch", "quality:knip")
      );
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:build", {
            durationPointer: "/localWrapperLanes/13/p50DurationMs",
            costP50Seconds: 5.455,
          }),
          withCostSource("quality:build", { sourceKey: O.some("publish:00-head-install-preflight") })
        )
      ).toEqual(one("duration-source-ambiguous", "quality:build"));

      // Must-fail, the remaining finding kinds and a keyless A1 cost source: one finding each.
      expect(findingsFor(DEFAULT_GATE_ORDER_SEED, withCostSource("quality:lint", { sourceKey: O.none() }))).toEqual(
        one("duration-source-mismatch", "quality:lint")
      );
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", {
            firstRedPointer: "/firstFailure/actionableLaneMix/6/attempts",
          })
        )
      ).toEqual(one("pointer-shape-unknown", "quality:lint"));
      expect(
        findingsFor(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", {
            firstRedPointer: "/firstFailure/actionableLaneMix/41",
          })
        )
      ).toEqual(one("red-unresolved", "quality:lint"));
      expect(findingsFor(withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", { redProbability: 66 / 832 }))).toEqual(
        one("red-mismatch", "quality:lint")
      );
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          A.append(
            DEFAULT_GATE_ORDER_COST_SOURCES,
            GateOrderCostSource.make({
              laneId: "quality:retired",
              costBasis: "a1-proxy-row",
              sourceKey: O.some("Lint"),
            })
          )
        )
      ).toEqual(one("cost-basis-unmapped", "quality:retired"));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          A.filter(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) => entry.laneId !== "quality:lint")
        )
      ).toEqual(one("cost-basis-unmapped", "quality:lint"));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          A.filter(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) => entry.laneId !== "quality:storybook")
        )
      ).toEqual(one("cost-basis-unmapped", "quality:storybook"));
      expect(
        findingsFor(
          DEFAULT_GATE_ORDER_SEED,
          DEFAULT_GATE_ORDER_COST_SOURCES,
          EconomicsSeedSourceView.make({ ...view, measurementAsOf: "2026-09-04T00:00:00.000Z" })
        )
      ).toEqual(one("measurement-mismatch", ""));
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fixture 3: the seed pins the committed A1 bytes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { economicsPath } = yield* loadEconomics();
      const bytes = yield* fs.readFile(economicsPath);
      const changed = Uint8Array.from(bytes);
      changed[0] = (changed[0] ?? 0) ^ 1;

      expect(yield* S.decodeEffect(Sha256HexFromBytes)(bytes)).toBe(GATE_ORDER_SOURCE.sha256);
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(changed)).not.toBe(GATE_ORDER_SOURCE.sha256);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fixture 4: the committed handoff document equals the bytes the checkout computes",
    Effect.fnUntraced(function* () {
      const { view, handoffPath } = yield* loadEconomics();
      // (a) Compute the handoff and its canonical bytes.
      const computed = defaultHandoff(view);
      const bytes = yield* encodeHandoffBytes(computed);

      // (b) The byte snapshot is the first assertion; nothing reads the committed file first.
      // Regenerate with two runs from packages/tooling/tool/cli: `bunx vitest run
      // test/gate-order-handoff.test.ts -u` (vitest writes the file when this file's run ends),
      // then the same command without -u, which must pass. Review the diff.
      yield* Effect.promise(() => expect(bytes).toMatchFileSnapshot(handoffPath));

      // (c) The computed bytes decode back to the computed value.
      const decoded = yield* GateOrderHandoffJson.decode(bytes);
      expect(S.toEquivalence(GateOrderHandoff)(decoded, computed)).toBe(true);

      // Must-fail: a changed seed cost or source digest changes the bytes.
      const alteredSeed = yield* encodeHandoffBytes(
        gateOrderHandoff(
          withSeedRow(DEFAULT_GATE_ORDER_SEED, "quality:lint", { costP50Seconds: 266 }),
          DEFAULT_GATE_ORDER_COST_SOURCES,
          declaredLanes,
          handoffSource(view),
          view
        )
      );
      const alteredSource = yield* encodeHandoffBytes(
        gateOrderHandoff(
          DEFAULT_GATE_ORDER_SEED,
          DEFAULT_GATE_ORDER_COST_SOURCES,
          declaredLanes,
          GateOrderHandoffSource.make({
            ...handoffSource(view),
            reference: CacheEvidenceReference.make({
              path: GATE_ORDER_SOURCE.path,
              sha256: Sha256Hex.make(EMPTY_INPUT_SHA256),
            }),
          }),
          view
        )
      );
      expect(alteredSeed).not.toBe(bytes);
      expect(alteredSource).not.toBe(bytes);

      // A missing cost source falls back to external-run, which only the external-run
      // sentinel satisfies: storybook's handoff is unchanged, lint's is incoherent.
      const withoutCost = (laneId: string) =>
        gateOrderHandoff(
          DEFAULT_GATE_ORDER_SEED,
          A.filter(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) => entry.laneId !== laneId),
          declaredLanes,
          handoffSource(view),
          view
        );
      expect(yield* encodeHandoffBytes(withoutCost("quality:storybook"))).toBe(bytes);
      expect(() => withoutCost("quality:lint")).toThrow();
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fixture 5: the handoff order is the wave order and each lane's deciding key separates it",
    Effect.fnUntraced(function* () {
      const { view } = yield* loadEconomics();
      const handoff = defaultHandoff(view);
      const ranked = rankWaveLanes(DEFAULT_GATE_ORDER_SEED, declaredLanes);

      expect(A.map(handoff.lanes, (lane) => lane.laneId)).toEqual(
        A.map(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, declaredLanes), (lane) => lane.id)
      );
      expect(A.map(ranked, (entry) => entry.lane.id)).toEqual(A.map(handoff.lanes, (lane) => lane.laneId));

      const indexed = A.map(ranked, (entry) => [entry.declarationIndex, entry.lane] as const);
      expect(A.map(WAVE_ORDER_KEYS, ([key]) => key)).toEqual(GateOrderSortKey.Options);
      assertNone(O.getOrThrow(A.head(handoff.lanes)).decidedBy);
      for (const [previousRank, lane] of A.drop(handoff.lanes, 1).entries()) {
        expectDecidingKeySeparates(
          lane.laneId,
          O.getOrThrow(lane.decidedBy),
          O.getOrThrow(A.get(indexed, previousRank)),
          O.getOrThrow(A.get(indexed, previousRank + 1))
        );
      }
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fixture 6: deciding-key, red-scheduling, cost-basis and postdating census",
    Effect.fnUntraced(function* () {
      const { view } = yield* loadEconomics();
      const handoff = defaultHandoff(view);
      const decided = A.getSomes(A.map(handoff.lanes, (lane) => lane.decidedBy));

      expect(countBy(decided, (key) => key)).toEqual({
        "cost-p50": 19,
        "first-red-share": 6,
        "declaration-index": 5,
        "lane-class": 1,
      });
      expect(
        A.sort(
          A.map(
            A.filter(handoff.lanes, (lane) => lane.redScheduling === "continue-after-imprecise-red"),
            (lane) => lane.laneId
          ),
          Order.String
        )
      ).toEqual(["quality:coverage", "quality:nix", "quality:sast", "quality:security"]);
      expect(A.filter(handoff.lanes, (lane) => lane.redScheduling === "stop-after-red").length).toBe(28);
      expect(
        A.every(handoff.lanes, (lane) =>
          O.exists(
            A.findFirst(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.laneId === lane.laneId),
            (row) => redSchedulingDecision(O.some(row)) === lane.redScheduling
          )
        )
      ).toBe(true);
      expect(countBy(handoff.lanes, (lane) => lane.costBasis)).toEqual({
        "a1-lane-row": 16,
        "a1-proxy-row": 15,
        "external-run": 1,
      });
      expect(
        A.sort(
          A.map(
            A.filter(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.firstRedBasis === POSTDATES_A1_FIRST_RED_BASIS),
            (row) => row.laneId
          ),
          Order.String
        )
      ).toEqual([
        "fallow:health",
        "quality:cache-policy",
        "quality:doctest",
        "quality:storybook",
        "repo-sanity:config-typecheck",
      ]);
    }, provideScopedLayer(NodeServices.layer))
  );

  // The helper decodes generated Type values as Encoded input, so it covers the Option-free
  // schemas; the Option-carrying ones are guarded by fixture 7's JSON round trip.
  it("the Option-free handoff schemas decode their own arbitraries", () => {
    assertSchemaArbitraryDecodesToSelf(GateOrderHandoffSource);
    assertSchemaArbitraryDecodesToSelf(EconomicsSeedSourceView);
  });

  it.effect(
    "fixture 7: the handoff schema rejects incoherent documents",
    Effect.fnUntraced(function* () {
      const { view } = yield* loadEconomics();
      const handoff = defaultHandoff(view);
      const roundTrip = yield* GateOrderHandoffJson.decode(yield* GateOrderHandoffJson.encode(handoff));
      expect(S.toEquivalence(GateOrderHandoff)(roundTrip, handoff)).toBe(true);

      const encoded = yield* S.encodeEffect(GateOrderHandoff)(handoff);
      const rejects = Effect.fnUntraced(function* (label: string, document: EncodedHandoff) {
        const text = yield* S.encodeEffect(UnknownFromJsonString)(document);
        const error = yield* Effect.flip(GateOrderHandoffJson.decode(text));
        assertInstanceOf(error, S.SchemaError, label);
      });

      // The unmutated encoded document decodes, so every rejection below is the mutation's.
      yield* GateOrderHandoffJson.decode(yield* S.encodeEffect(UnknownFromJsonString)(encoded));

      yield* rejects("schemaVersion v0", {
        ...encoded,
        schemaVersion: "gate-order-handoff/v0" as "gate-order-handoff/v1",
      });
      yield* rejects("scope main", { ...encoded, scope: "pre-push:main" as "pre-push:non-main" });
      yield* rejects("source sha256", {
        ...encoded,
        source: { ...encoded.source, reference: { ...encoded.source.reference, sha256: "XYZ" } },
      });
      yield* rejects(
        "rank gap",
        mapEncodedLaneAt(encoded, 1, (lane) => ({ ...lane, rank: 2 }))
      );
      yield* rejects(
        "duplicate lane id",
        mapEncodedLaneAt(encoded, 1, (lane) => ({ ...lane, laneId: encoded.lanes[0]?.laneId ?? lane.laneId }))
      );
      yield* rejects(
        "decidedBy at rank 0",
        mapEncodedLaneAt(encoded, 0, (lane) => ({ ...lane, decidedBy: "cost-p50" }))
      );
      yield* rejects(
        "decidedBy null at rank 1",
        mapEncodedLaneAt(encoded, 1, (lane) => ({ ...lane, decidedBy: null }))
      );
      yield* rejects(
        "lane id without seed row",
        mapEncodedLane(encoded, "quality:lint", (lane) => ({ ...lane, laneId: "quality:retired" }))
      );
      yield* rejects(
        "external-run lane with a duration source key",
        mapEncodedLane(encoded, "quality:storybook", (lane) => ({ ...lane, durationSourceKey: "SAST" }))
      );
      yield* rejects(
        "external-run lane with a P50",
        mapEncodedLane(encoded, "quality:storybook", (lane) => ({ ...lane, durationP50Ms: 584000 }))
      );
      yield* rejects(
        "A1 lane without a P95",
        mapEncodedLane(encoded, "quality:lint", (lane) => ({ ...lane, durationP95Ms: null }))
      );
      yield* rejects(
        "exact first-red row without its lane",
        mapEncodedLane(encoded, "quality:lint", (lane) => ({ ...lane, firstRedSourceLane: null }))
      );
      yield* rejects(
        "absent first-red row with a lane",
        mapEncodedLane(encoded, "quality:docgen", (lane) => ({ ...lane, firstRedSourceLane: "quality:docgen" }))
      );
      yield* rejects("source measurementAsOf", {
        ...encoded,
        source: { ...encoded.source, measurementAsOf: "2026-09-04T00:00:00.000Z" },
      });
      yield* rejects("source population", {
        ...encoded,
        source: { ...encoded.source, firstFailurePopulation: 833 },
      });
      yield* rejects("source path", {
        ...encoded,
        source: { ...encoded.source, reference: { ...encoded.source.reference, path: "research/economics.json" } },
      });
    }, provideScopedLayer(NodeServices.layer))
  );
});
