/**
 * Evidence-backed ordering for Yeet local proof waves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CacheEvidenceReference } from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema/Sha256";
import { A, Str } from "@beep/utils";
import { Context, Effect, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as HM from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Tuple from "effect/Tuple";
import {
  classifyGateOrderPointer,
  GateOrderCostSource,
  GateOrderHandoff,
  GateOrderHandoffLane,
  GateOrderLaneClass,
  GateOrderSeed,
  GateOrderSeedFinding,
  GateOrderSeedRow,
  GatePrecisionClass,
  GithubCheckLaneSpec,
} from "../../Quality/Quality.schemas.ts";
import { redSchedulingDecision } from "../../Quality/Tasks.ts";
import type {
  EconomicsSeedSourceView,
  GateOrderCostBasis,
  GateOrderHandoffSource,
  GateOrderPointerKind,
  GateOrderSeedFindingKind,
  GateOrderSortKey,
} from "../../Quality/Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WaveOrder");
const ECONOMICS_SOURCE_PATH = "goals/time-to-certainty/research/economics.json";
const NO_EXACT_FIRST_RED_POINTER = "/firstFailure/actionableLaneMix";
const PRECISE_BASIS = "No environment-only or indirect A4 attribution is assigned to this terminal red.";
const HOSTED_DURATION_BASIS = "A1 hosted required-context P50 for this lane family.";
const NO_EXACT_FIRST_RED_BASIS = "No exact lane row appears in A1 actionableLaneMix; zero of 832 was observed.";
/**
 * First-red basis for a seed row whose lane joined the pre-push plan after the A1 window.
 *
 * **Details**
 *
 * The A1 window ends at the seed's `measurementAsOf`; a lane declared after it
 * could not have been observed, so its first-red share is 0 by absence
 * (TTC ruling 76 seeding rule).
 *
 * **Example** (Read the postdating basis)
 *
 * ```ts
 * import { POSTDATES_A1_FIRST_RED_BASIS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(POSTDATES_A1_FIRST_RED_BASIS.startsWith("The lane postdates")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const POSTDATES_A1_FIRST_RED_BASIS =
  "The lane postdates the A1 window; the share is 0 by absence, not by observation.";
const POLICY_PREFLIGHT_BASIS = "SPEC B3 policy/preflight partition; this lane is a preflight policy gate.";
const HEAVY_BASIS = "SPEC B3 heavy partition; this lane performs build, test, or documentation work.";

const hostedDurationPointer = (index: number): string => `/hosted/laneRows/${index}/p50DurationMs`;
const localDurationPointer = (index: number): string => `/localWrapperLanes/${index}/p50DurationMs`;
const firstRedPointer = (index: number): string => `/firstFailure/actionableLaneMix/${index}`;

const seedRow = (
  laneId: string,
  costP50Seconds: number,
  durationPointer: string,
  durationBasis: string,
  redProbability: number,
  firstRedIndex: O.Option<number>,
  precision: GatePrecisionClass,
  precisionBasis: string,
  laneClass: GateOrderLaneClass,
  laneClassBasis: string
): GateOrderSeedRow =>
  GateOrderSeedRow.make({
    laneId,
    costP50Seconds,
    durationBasis,
    durationPointer,
    redProbability,
    firstRedBasis: O.isSome(firstRedIndex)
      ? "Exact A1 actionable-lane count divided by the 832 reconstructable first failures."
      : NO_EXACT_FIRST_RED_BASIS,
    firstRedPointer: pipe(
      firstRedIndex,
      O.map(firstRedPointer),
      O.getOrElse(() => NO_EXACT_FIRST_RED_POINTER)
    ),
    laneClass,
    laneClassBasis,
    precision,
    precisionBasis,
  });

const hostedRow = (
  laneId: string,
  costP50Seconds: number,
  durationIndex: number,
  redProbability: number,
  firstRedIndex: O.Option<number> = O.none(),
  precision: GatePrecisionClass = "precise",
  precisionBasis: string = PRECISE_BASIS,
  laneClass: GateOrderLaneClass = "heavy",
  laneClassBasis: string = HEAVY_BASIS
): GateOrderSeedRow =>
  seedRow(
    laneId,
    costP50Seconds,
    hostedDurationPointer(durationIndex),
    HOSTED_DURATION_BASIS,
    redProbability,
    firstRedIndex,
    precision,
    precisionBasis,
    laneClass,
    laneClassBasis
  );

const policyHostedRow = (
  laneId: string,
  costP50Seconds: number,
  durationIndex: number,
  redProbability: number,
  firstRedIndex: O.Option<number> = O.none(),
  precision: GatePrecisionClass = "precise",
  precisionBasis: string = PRECISE_BASIS
): GateOrderSeedRow =>
  hostedRow(
    laneId,
    costP50Seconds,
    durationIndex,
    redProbability,
    firstRedIndex,
    precision,
    precisionBasis,
    "policy-preflight",
    POLICY_PREFLIGHT_BASIS
  );

const repoSanityRow = (
  laneId: string,
  redProbability: number,
  firstRedIndex: O.Option<number> = O.none()
): GateOrderSeedRow =>
  seedRow(
    laneId,
    183,
    hostedDurationPointer(7),
    "A1 hosted Repo Sanity aggregate P50 proxy; inner-lane durations were not yet recorded.",
    redProbability,
    firstRedIndex,
    "precise",
    PRECISE_BASIS,
    "policy-preflight",
    POLICY_PREFLIGHT_BASIS
  );

const postdatesA1Window = (row: GateOrderSeedRow): GateOrderSeedRow =>
  GateOrderSeedRow.make({ ...row, firstRedBasis: POSTDATES_A1_FIRST_RED_BASIS });

const cheapWrapperRow = (
  laneId: string,
  redProbability: number,
  firstRedIndex: O.Option<number> = O.none(),
  laneClass: GateOrderLaneClass = "policy-preflight",
  laneClassBasis: string = POLICY_PREFLIGHT_BASIS
): GateOrderSeedRow =>
  seedRow(
    laneId,
    96.764,
    localDurationPointer(2),
    "A1 full cheap-gates wrapper P50 proxy; inner-lane durations were not yet recorded.",
    redProbability,
    firstRedIndex,
    "precise",
    PRECISE_BASIS,
    laneClass,
    laneClassBasis
  );

/**
 * Checked-in A1/A4 ordering seed for the current Yeet pre-push lane set.
 *
 * **Details**
 *
 * Every row carries JSON pointers into the frozen A1 economics report. Where
 * A1 did not yet carry an inner-lane duration, the row names the aggregate or
 * related wrapper used as the P50 proxy. First-red shares use the 832
 * attempts whose first actionable failure was reconstructable. Every pointer
 * except `quality:storybook`'s `/hosted/laneRows` sentinel is
 * fixture-verified, including which A1 row it resolves to (see
 * {@link DEFAULT_GATE_ORDER_COST_SOURCES}); storybook's 584 s is one external
 * main run.
 *
 * **Gotchas**
 *
 * A row's `redProbability` is a first-red share and a rank weight, not
 * P(red). Lanes that joined the plan after the A1 window carry
 * {@link POSTDATES_A1_FIRST_RED_BASIS}.
 *
 * **Example** (Inspect seed provenance)
 *
 * ```ts
 * import { DEFAULT_GATE_ORDER_SEED } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(DEFAULT_GATE_ORDER_SEED.sourcePath) // "goals/time-to-certainty/research/economics.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_GATE_ORDER_SEED = GateOrderSeed.make({
  schemaVersion: "gate-order/v1",
  sourcePath: ECONOMICS_SOURCE_PATH,
  measurementAsOf: "2026-09-03T06:29:38.367Z",
  firstFailurePopulation: 832,
  lanes: [
    cheapWrapperRow("quality:changeset-status", 35 / 832, O.some(10)),
    repoSanityRow("repo-sanity:changeset-graph", 2 / 832, O.some(39)),
    // taskIds: //#config-sync:check (+ //#lint:policy-fingerprint).
    repoSanityRow("repo-sanity:tsconfig-sync", 9 / 832, O.some(22)),
    // taskIds: //#fallow:boundaries:config-check (+ //#lint:policy-fingerprint).
    repoSanityRow("repo-sanity:fallow-boundaries-config", 17 / 832, O.some(14)),
    repoSanityRow("repo-sanity:versions", 0),
    repoSanityRow("repo-sanity:syncpack", 0),
    repoSanityRow("repo-sanity:sherif", 0),
    postdatesA1Window(repoSanityRow("repo-sanity:config-typecheck", 0)),
    repoSanityRow("repo-sanity:bun-audit", 13 / 832, O.some(17)),
    // Joined the repo-sanity group after the A1 window (#1068); seeded under the
    // ruling 76 seeding rule so it no longer runs after every seeded lane.
    GateOrderSeedRow.make({
      laneId: "quality:cache-policy",
      costP50Seconds: 183,
      durationPointer: hostedDurationPointer(7),
      durationBasis:
        "A1 hosted Repo Sanity aggregate P50 proxy; the lane joined the group on 2026-09-10 (#1068), after the A1 window.",
      redProbability: 0,
      firstRedPointer: NO_EXACT_FIRST_RED_POINTER,
      firstRedBasis: POSTDATES_A1_FIRST_RED_BASIS,
      precision: "precise",
      precisionBasis: PRECISE_BASIS,
      laneClass: "policy-preflight",
      laneClassBasis: POLICY_PREFLIGHT_BASIS,
    }),
    seedRow(
      "quality:build",
      14.348,
      localDurationPointer(12),
      "A1 affected build wrapper P50 proxy; pre-push inner-lane durations were not yet recorded.",
      65 / 832,
      O.some(7),
      "precise",
      "Terminal reds occur after the established environment-only TS2589 quarantine.",
      "heavy",
      HEAVY_BASIS
    ),
    hostedRow("quality:lint", 267, 0, 67 / 832, O.some(6)),
    // taskIds: policy root tasks plus lint:laws and affected lint:jsdoc/lint:deprecated-apis;
    // hosted legacy ESLint/shards and CLI aggregates have no task hash (Stage E).
    hostedRow("quality:lint-policy", 363, 1, 23 / 832, O.some(12)),
    hostedRow(
      "quality:check",
      383,
      2,
      23 / 832,
      O.some(11),
      "precise",
      "Terminal reds occur after the established environment-only TS2589 quarantine."
    ),
    // taskIds: //#knip:check (+ //#lint:policy-fingerprint).
    policyHostedRow("quality:knip", 80, 9, 11 / 832, O.some(20)),
    // taskIds: //#jsdoc:inventory:check; CLI compare follows a fresh inventory.
    hostedRow("quality:jsdoc-ratchet", 82, 16, 0),
    hostedRow("quality:docgen", 115, 5, 0),
    // Hosted "Heavy / Doctest" is laneRows[16] (p50 82 s); the lane joined the
    // pre-push set with the quality-lane audit (2026-09-09, D8).
    // taskIds: <owner>#doctest (+ upstream transit).
    postdatesA1Window(hostedRow("quality:doctest", 82, 16, 0)),
    hostedRow(
      "quality:coverage",
      603,
      8,
      0,
      O.none(),
      "imprecise",
      "A4 indirect attribution: an edited callee can move coverage in an untouched caller."
    ),
    policyHostedRow("quality:codegen", 107, 6, 0),
    policyHostedRow("quality:commitlint", 63, 10, 0),
    hostedRow("quality:desktop-ipc", 69, 15, 0),
    hostedRow("quality:test-unit", 495, 3, 0),
    hostedRow("quality:test-integration", 137, 4, 0),
    postdatesA1Window(
      seedRow(
        "quality:storybook",
        584,
        "/hosted/laneRows",
        "Storybook build-and-test wall time on main run 34323229096 (quality-lane audit 2026-09-09); A1 recorded no row for this non-required context.",
        0,
        O.none(),
        "precise",
        PRECISE_BASIS,
        "heavy",
        HEAVY_BASIS
      )
    ),
    // taskIds: //#fallow:audit:check (+ //#lint:policy-fingerprint).
    seedRow(
      "fallow:audit",
      1.863,
      localDurationPointer(15),
      "A1 Fallow advisory wrapper P50 proxy; blocking inner-lane durations were not yet recorded.",
      47 / 832,
      O.some(8),
      "precise",
      PRECISE_BASIS,
      "policy-preflight",
      POLICY_PREFLIGHT_BASIS
    ),
    // taskIds: //#fallow:dead-code:check (+ //#lint:policy-fingerprint).
    seedRow(
      "fallow:dead-code",
      1.863,
      localDurationPointer(15),
      "A1 Fallow advisory wrapper P50 proxy; blocking inner-lane durations were not yet recorded.",
      3 / 832,
      O.some(33),
      "precise",
      PRECISE_BASIS,
      "policy-preflight",
      POLICY_PREFLIGHT_BASIS
    ),
    // Unseeded lanes sort after every seeded one, which put this 2-second gate
    // behind coverage (quality-lane audit 2026-09-09, D2 / D8).
    // taskIds: //#fallow:health:check (+ //#lint:policy-fingerprint).
    postdatesA1Window(
      seedRow(
        "fallow:health",
        1.863,
        localDurationPointer(15),
        "A1 Fallow advisory wrapper P50 proxy; blocking inner-lane durations were not yet recorded.",
        0,
        O.none(),
        "precise",
        PRECISE_BASIS,
        "policy-preflight",
        POLICY_PREFLIGHT_BASIS
      )
    ),
    policyHostedRow("quality:secrets", 54, 11, 4 / 832, O.some(31)),
    policyHostedRow(
      "quality:security",
      28,
      12,
      5 / 832,
      O.some(27),
      "imprecise",
      "A4 environment-only attribution: Docker daemon and image-pull failures share this lane's exit."
    ),
    policyHostedRow(
      "quality:sast",
      82,
      13,
      0,
      O.none(),
      "imprecise",
      "A4 environment-only attribution: Docker daemon and image-pull failures share this lane's exit."
    ),
    policyHostedRow(
      "quality:nix",
      102,
      14,
      0,
      O.none(),
      "imprecise",
      "A4 environment-only attribution: the Nix gate depends on the host execution environment."
    ),
  ],
});

/**
 * Pinned A1 economics document every gate-order seed pointer resolves in.
 *
 * **Details**
 *
 * The sha256 pins the P0 baseline bytes the seed was built from. A PR that
 * only re-renders the file through the A1 script's self-receipt moves the pin
 * and regenerates the handoff; a change to any value, row key or population a
 * seed pointer resolves to is a reseed and needs its own ruling (TTC ruling 77).
 *
 * **Example** (Read the pinned source path)
 *
 * ```ts
 * import { GATE_ORDER_SOURCE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GATE_ORDER_SOURCE.path) // "goals/time-to-certainty/research/economics.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GATE_ORDER_SOURCE = CacheEvidenceReference.make({
  path: ECONOMICS_SOURCE_PATH,
  sha256: Sha256Hex.make("37e854ef859c00e4930cb1b23cfba5989a2947c121a9f0bc88c30e2fc2785230"),
});

const costSource = (laneId: string, costBasis: GateOrderCostBasis, sourceKey: O.Option<string>): GateOrderCostSource =>
  GateOrderCostSource.make({ laneId, costBasis, sourceKey });

const laneRowCost = (laneId: string, sourceKey: string): GateOrderCostSource =>
  costSource(laneId, "a1-lane-row", O.some(sourceKey));

const proxyRowCost = (laneId: string, sourceKey: string): GateOrderCostSource =>
  costSource(laneId, "a1-proxy-row", O.some(sourceKey));

/**
 * The A1 row each {@link DEFAULT_GATE_ORDER_SEED} lane's cost P50 is read from, and why.
 *
 * **Details**
 *
 * One entry per seed row: 16 lanes read their own hosted A1 row
 * (`a1-lane-row`), 15 read a group aggregate or wrapper row shared with
 * siblings (`a1-proxy-row`), and `quality:storybook` reads one named run
 * outside A1 (`external-run`). The gate-order fixture checks that each seed
 * duration pointer resolves to the row named here.
 *
 * **Example** (Find the storybook cost basis)
 *
 * ```ts
 * import { DEFAULT_GATE_ORDER_COST_SOURCES } from "@beep/repo-cli/test/Yeet"
 * import * as A from "effect/Array"
 *
 * console.log(A.filter(DEFAULT_GATE_ORDER_COST_SOURCES, (entry) => entry.costBasis === "external-run").length) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_GATE_ORDER_COST_SOURCES: ReadonlyArray<GateOrderCostSource> = [
  proxyRowCost("quality:changeset-status", "full:00-cheap-gates"),
  proxyRowCost("repo-sanity:changeset-graph", "Repo Sanity"),
  proxyRowCost("repo-sanity:tsconfig-sync", "Repo Sanity"),
  proxyRowCost("repo-sanity:fallow-boundaries-config", "Repo Sanity"),
  proxyRowCost("repo-sanity:versions", "Repo Sanity"),
  proxyRowCost("repo-sanity:syncpack", "Repo Sanity"),
  proxyRowCost("repo-sanity:sherif", "Repo Sanity"),
  proxyRowCost("repo-sanity:config-typecheck", "Repo Sanity"),
  proxyRowCost("repo-sanity:bun-audit", "Repo Sanity"),
  proxyRowCost("quality:cache-policy", "Repo Sanity"),
  proxyRowCost("quality:build", "feedback:01-build"),
  laneRowCost("quality:lint", "Lint"),
  laneRowCost("quality:lint-policy", "Heavy / Lint Policy"),
  laneRowCost("quality:check", "Heavy / Check"),
  laneRowCost("quality:knip", "Knip"),
  proxyRowCost("quality:jsdoc-ratchet", "Heavy / Doctest"),
  laneRowCost("quality:docgen", "Heavy / Docgen"),
  laneRowCost("quality:doctest", "Heavy / Doctest"),
  laneRowCost("quality:coverage", "Heavy / Coverage Regression"),
  laneRowCost("quality:codegen", "Codegen Drift"),
  laneRowCost("quality:commitlint", "Commitlint"),
  laneRowCost("quality:desktop-ipc", "Professional Desktop IPC Stdio"),
  laneRowCost("quality:test-unit", "Test Unit"),
  laneRowCost("quality:test-integration", "Heavy / Test Integration"),
  costSource("quality:storybook", "external-run", O.none()),
  proxyRowCost("fallow:audit", "advisory:01-fallow-feedback"),
  proxyRowCost("fallow:dead-code", "advisory:01-fallow-feedback"),
  proxyRowCost("fallow:health", "advisory:01-fallow-feedback"),
  laneRowCost("quality:secrets", "Secret Scanning"),
  laneRowCost("quality:security", "Security"),
  laneRowCost("quality:sast", "SAST"),
  laneRowCost("quality:nix", "Nix Shell"),
];

type IndexedLane = readonly [declarationIndex: number, lane: GithubCheckLaneSpec];

const estimateNumber = (entry: IndexedLane, select: (estimate: GateOrderSeedRow) => number, fallback: number): number =>
  pipe(
    entry[1].orderEstimate,
    O.map(select),
    O.getOrElse(() => fallback)
  );

/**
 * The D1 wave-order key: six named comparison components in comparison order.
 *
 * **Details**
 *
 * `gate-order-lexicographic/v1` (TTC ruling 76): seeded before unseeded,
 * `policy-preflight` before `heavy`, cost P50 ascending, first-red share
 * descending, `precise` before `imprecise`, then declaration index. One table
 * drives both {@link orderWaveLanes} and the `decidedBy` explanation of
 * {@link rankWaveLanes}; each entry compares `[declarationIndex, lane]` pairs
 * whose lanes carry their seed row as `orderEstimate`.
 *
 * **Example** (List the key names)
 *
 * ```ts
 * import { WAVE_ORDER_KEYS } from "@beep/repo-cli/test/Yeet"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(WAVE_ORDER_KEYS, ([key]) => key)[2]) // "cost-p50"
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const WAVE_ORDER_KEYS: ReadonlyArray<readonly [GateOrderSortKey, Order.Order<IndexedLane>]> = [
  ["seeded", Order.mapInput(Order.Number, (entry: IndexedLane) => (O.isSome(entry[1].orderEstimate) ? 0 : 1))],
  [
    "lane-class",
    Order.mapInput(Order.Number, (entry: IndexedLane) =>
      pipe(
        entry[1].orderEstimate,
        O.map((estimate) =>
          GateOrderLaneClass.$match(estimate.laneClass, { "policy-preflight": () => 0, heavy: () => 1 })
        ),
        O.getOrElse(() => 0)
      )
    ),
  ],
  [
    "cost-p50",
    Order.mapInput(Order.Number, (entry: IndexedLane) =>
      estimateNumber(entry, (estimate) => estimate.costP50Seconds, 0)
    ),
  ],
  [
    "first-red-share",
    Order.mapInput(Order.flip(Order.Number), (entry: IndexedLane) =>
      estimateNumber(entry, (estimate) => estimate.redProbability, 0)
    ),
  ],
  [
    "precision",
    Order.mapInput(Order.Number, (entry: IndexedLane) =>
      pipe(
        entry[1].orderEstimate,
        O.map((estimate) => GatePrecisionClass.$match(estimate.precision, { precise: () => 0, imprecise: () => 1 })),
        O.getOrElse(() => 0)
      )
    ),
  ],
  ["declaration-index", Order.mapInput(Order.Number, (entry: IndexedLane) => entry[0])],
];

const indexedLaneOrder = Order.combineAll(A.map(WAVE_ORDER_KEYS, Tuple.get(1)));

type RankedWaveLane = {
  readonly rank: number;
  readonly declarationIndex: number;
  readonly decidedBy: O.Option<GateOrderSortKey>;
  readonly lane: GithubCheckLaneSpec;
};

const decidingKey = (previous: IndexedLane, current: IndexedLane): O.Option<GateOrderSortKey> =>
  A.findFirst(WAVE_ORDER_KEYS, ([key, order]) => (order(previous, current) === 0 ? O.none() : O.some(key)));

/**
 * Enrich, order and explain the current lane set from a versioned evidence seed.
 *
 * **Details**
 *
 * Applies the same enrichment and sort as {@link orderWaveLanes} and records,
 * for every lane after the first, the first {@link WAVE_ORDER_KEYS} component
 * that separates it from its predecessor. `decidedBy` is `None` at rank 0.
 *
 * **Example** (Rank an empty lane set)
 *
 * ```ts
 * import { DEFAULT_GATE_ORDER_SEED, rankWaveLanes } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(rankWaveLanes(DEFAULT_GATE_ORDER_SEED, []).length) // 0
 * ```
 *
 * @param seed - Versioned economics seed used to enrich matching lanes.
 * @param lanes - Current lane declarations to order without dropping unknown entries.
 * @returns Enriched lanes in execution order with rank, declaration index and deciding key.
 * @category planning
 * @since 0.0.0
 */
export const rankWaveLanes: {
  (lanes: ReadonlyArray<GithubCheckLaneSpec>): (seed: GateOrderSeed) => ReadonlyArray<RankedWaveLane>;
  (seed: GateOrderSeed, lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<RankedWaveLane>;
} = dual(2, (seed: GateOrderSeed, lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<RankedWaveLane> => {
  const estimatesByLane = HM.fromIterable(A.map(seed.lanes, (estimate) => Tuple.make(estimate.laneId, estimate)));
  const indexed = A.map(lanes, (lane, index) =>
    Tuple.make(
      index,
      GithubCheckLaneSpec.make({
        ...lane,
        orderEstimate: HM.get(estimatesByLane, lane.id),
      })
    )
  );
  const sorted = A.sort(indexed, indexedLaneOrder);

  return A.map(sorted, (entry, rank) => ({
    rank,
    declarationIndex: entry[0],
    decidedBy: O.flatMap(A.get(sorted, rank - 1), (previous) => decidingKey(previous, entry)),
    lane: entry[1],
  }));
});

/**
 * Enrich and order the current lane set from a versioned evidence seed.
 *
 * **Details**
 *
 * Seeded lanes are partitioned into policy/preflight and heavy work, then
 * ordered within each partition by P50 cost ascending, first-red share
 * descending, precision, and declaration order. Lanes absent from the seed
 * are appended after every seeded lane and retain declaration order.
 *
 * **Example** (Keep unknown lanes at the tail)
 *
 * ```ts
 * import { DEFAULT_GATE_ORDER_SEED, orderWaveLanes } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, []).length) // 0
 * ```
 *
 * @param seed - Versioned economics seed used to enrich matching lanes.
 * @param lanes - Current lane declarations to order without dropping unknown entries.
 * @returns Enriched lane specifications in deterministic execution order.
 * @category planning
 * @since 0.0.0
 */
export const orderWaveLanes: {
  (lanes: ReadonlyArray<GithubCheckLaneSpec>): (seed: GateOrderSeed) => ReadonlyArray<GithubCheckLaneSpec>;
  (seed: GateOrderSeed, lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<GithubCheckLaneSpec>;
} = dual(
  2,
  (seed: GateOrderSeed, lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<GithubCheckLaneSpec> =>
    A.map(rankWaveLanes(seed, lanes), (ranked) => ranked.lane)
);

type ResolvedA1Row = {
  readonly key: string;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
};

const hostedA1Rows = (view: EconomicsSeedSourceView): ReadonlyArray<ResolvedA1Row> =>
  A.map(view.hosted.laneRows, (row) => ({
    key: row.context,
    p50DurationMs: row.p50DurationMs,
    p95DurationMs: row.p95DurationMs,
  }));

const wrapperA1Rows = (view: EconomicsSeedSourceView): ReadonlyArray<ResolvedA1Row> =>
  A.map(view.localWrapperLanes, (row) => ({
    key: row.id,
    p50DurationMs: row.p50DurationMs,
    p95DurationMs: row.p95DurationMs,
  }));

const durationPointerKinds = HashSet.fromIterable<GateOrderPointerKind>([
  "hosted-lane-row",
  "hosted-lane-array",
  "local-wrapper-row",
]);
const firstRedPointerKinds = HashSet.fromIterable<GateOrderPointerKind>(["first-failure-row", "first-failure-absent"]);

const classifySlotPointer = (
  pointer: string,
  kinds: HashSet.HashSet<GateOrderPointerKind>
): O.Option<readonly [GateOrderPointerKind, O.Option<number>]> =>
  O.filter(classifyGateOrderPointer(pointer), ([kind]) => HashSet.has(kinds, kind));

const rowsForDurationKind = (
  view: EconomicsSeedSourceView,
  kind: GateOrderPointerKind
): ReadonlyArray<ResolvedA1Row> => (kind === "hosted-lane-row" ? hostedA1Rows(view) : wrapperA1Rows(view));

const resolveDurationRow = (view: EconomicsSeedSourceView, pointer: string): O.Option<ResolvedA1Row> =>
  O.flatMap(classifySlotPointer(pointer, durationPointerKinds), ([kind, index]) =>
    O.flatMap(index, (position) => A.get(rowsForDurationKind(view, kind), position))
  );

const resolveFirstRedLane = (view: EconomicsSeedSourceView, pointer: string): O.Option<string> =>
  O.flatMap(classifySlotPointer(pointer, firstRedPointerKinds), ([, index]) =>
    O.flatMap(index, (position) => O.map(A.get(view.firstFailure.actionableLaneMix, position), (entry) => entry.lane))
  );

type FindingFields = {
  readonly laneId?: string | undefined;
  readonly pointer?: string | undefined;
  readonly expected?: number | undefined;
  readonly actual?: number | undefined;
  readonly detail?: string | undefined;
};

const finding = (kind: GateOrderSeedFindingKind, fields: FindingFields): GateOrderSeedFinding =>
  GateOrderSeedFinding.make({
    kind,
    laneId: O.fromUndefinedOr(fields.laneId),
    pointer: O.fromUndefinedOr(fields.pointer),
    expected: O.fromUndefinedOr(fields.expected),
    actual: O.fromUndefinedOr(fields.actual),
    detail: O.fromUndefinedOr(fields.detail),
  });

const findingUnless = (holds: boolean, make: () => GateOrderSeedFinding): ReadonlyArray<GateOrderSeedFinding> =>
  holds ? [] : [make()];

const expectedLaneClass = (lane: GithubCheckLaneSpec): GateOrderLaneClass =>
  lane.wave === "preflight" ? "policy-preflight" : "heavy";

const ruling28Alias = (laneId: string): string => `pre-push:${pipe(laneId, Str.split(":"), A.drop(1), A.join(":"))}`;

const renderKey = (key: O.Option<string>): string => O.getOrElse(key, () => "none");

const isExternalRun = (source: GateOrderCostSource): boolean => source.costBasis === "external-run";

const durationSourceFindings = (
  row: GateOrderSeedRow,
  source: GateOrderCostSource,
  resolved: O.Option<ResolvedA1Row>,
  rows: ReadonlyArray<ResolvedA1Row>
): ReadonlyArray<GateOrderSeedFinding> =>
  O.match(resolved, {
    // The external-run sentinel pairs with an external-run entry and nothing else.
    onNone: () =>
      findingUnless(isExternalRun(source) && O.isNone(source.sourceKey), () =>
        finding("duration-source-mismatch", {
          laneId: row.laneId,
          pointer: row.durationPointer,
          detail: `expected external-run, cost source is ${source.costBasis} ${renderKey(source.sourceKey)}`,
        })
      ),
    onSome: (resolvedRow) => [
      ...findingUnless(!isExternalRun(source) && O.contains(source.sourceKey, resolvedRow.key), () =>
        finding("duration-source-mismatch", {
          laneId: row.laneId,
          pointer: row.durationPointer,
          detail: `expected ${source.costBasis} ${renderKey(source.sourceKey)}, resolved ${resolvedRow.key}`,
        })
      ),
      ...findingUnless(
        !O.exists(source.sourceKey, (key) => A.filter(rows, (candidate) => candidate.key === key).length > 1),
        () =>
          finding("duration-source-ambiguous", {
            laneId: row.laneId,
            pointer: row.durationPointer,
            detail: `cost source key ${renderKey(source.sourceKey)} names more than one row`,
          })
      ),
    ],
  });

const sourceFindings = (
  source: O.Option<GateOrderCostSource>,
  check: (entry: GateOrderCostSource) => ReadonlyArray<GateOrderSeedFinding>
): ReadonlyArray<GateOrderSeedFinding> => O.getOrElse(O.map(source, check), A.empty<GateOrderSeedFinding>);

const resolvedDurationFindings = (
  row: GateOrderSeedRow,
  source: O.Option<GateOrderCostSource>,
  rows: ReadonlyArray<ResolvedA1Row>,
  resolved: O.Option<ResolvedA1Row>
): ReadonlyArray<GateOrderSeedFinding> =>
  O.match(resolved, {
    onNone: () => [finding("duration-unresolved", { laneId: row.laneId, pointer: row.durationPointer })],
    onSome: (resolvedRow) => [
      ...findingUnless(Math.round(row.costP50Seconds * 1000) === resolvedRow.p50DurationMs, () =>
        finding("duration-mismatch", {
          laneId: row.laneId,
          pointer: row.durationPointer,
          expected: Math.round(row.costP50Seconds * 1000),
          actual: resolvedRow.p50DurationMs,
        })
      ),
      ...sourceFindings(source, (entry) => durationSourceFindings(row, entry, O.some(resolvedRow), rows)),
    ],
  });

const durationFindings = (
  row: GateOrderSeedRow,
  source: O.Option<GateOrderCostSource>,
  view: EconomicsSeedSourceView
): ReadonlyArray<GateOrderSeedFinding> =>
  O.match(classifySlotPointer(row.durationPointer, durationPointerKinds), {
    onNone: () => [finding("pointer-shape-unknown", { laneId: row.laneId, pointer: row.durationPointer })],
    onSome: ([kind, index]) => {
      if (kind === "hosted-lane-array") {
        return sourceFindings(source, (entry) => durationSourceFindings(row, entry, O.none(), []));
      }
      const rows = rowsForDurationKind(view, kind);
      return resolvedDurationFindings(
        row,
        source,
        rows,
        O.flatMap(index, (position) => A.get(rows, position))
      );
    },
  });

const exactRedFindings = (
  row: GateOrderSeedRow,
  count: number,
  resolved: O.Option<EconomicsSeedSourceView["firstFailure"]["actionableLaneMix"][number]>
): ReadonlyArray<GateOrderSeedFinding> =>
  O.match(resolved, {
    onNone: () => [finding("red-unresolved", { laneId: row.laneId, pointer: row.firstRedPointer })],
    onSome: (entry) => [
      ...findingUnless(count === entry.attempts, () =>
        finding("red-mismatch", {
          laneId: row.laneId,
          pointer: row.firstRedPointer,
          expected: count,
          actual: entry.attempts,
        })
      ),
      ...findingUnless(entry.lane === row.laneId || entry.lane === ruling28Alias(row.laneId), () =>
        finding("red-lane-mismatch", {
          laneId: row.laneId,
          pointer: row.firstRedPointer,
          detail: `expected ${row.laneId} or ${ruling28Alias(row.laneId)}, resolved ${entry.lane}`,
        })
      ),
    ],
  });

const redFindings = (
  row: GateOrderSeedRow,
  seed: GateOrderSeed,
  view: EconomicsSeedSourceView
): ReadonlyArray<GateOrderSeedFinding> => {
  const count = Math.round(row.redProbability * seed.firstFailurePopulation);
  return O.match(classifySlotPointer(row.firstRedPointer, firstRedPointerKinds), {
    onNone: () => [finding("pointer-shape-unknown", { laneId: row.laneId, pointer: row.firstRedPointer })],
    onSome: ([kind, index]) =>
      kind === "first-failure-absent"
        ? findingUnless(row.redProbability === 0, () =>
            finding("absent-red-nonzero", {
              laneId: row.laneId,
              pointer: row.firstRedPointer,
              expected: 0,
              actual: count,
            })
          )
        : exactRedFindings(
            row,
            count,
            O.flatMap(index, (position) => A.get(view.firstFailure.actionableLaneMix, position))
          ),
  });
};

/**
 * Check a gate-order seed against the declared plan and the pinned A1 document.
 *
 * **Details**
 *
 * Seed rows and cost sources are looked up by `laneId`, never by index.
 * Coverage runs first (`unseeded-lane`, `orphan-seed-row`, cost sources that
 * name no seed row); every later check runs only over rows that name a
 * declared lane, and each check runs only when its inputs resolved, so an
 * unresolved or unknown pointer yields only its own finding. Then, per row:
 * cost-source coverage, lane class against the declared wave, duration value
 * and source row, first-red count and lane (or its ruling-28 `pre-push:`
 * alias). Last, the seed's population, the A1 red-attempt sum and
 * `measurementAsOf`. The committed seed yields no findings.
 *
 * **Gotchas**
 *
 * Red counts multiply `redProbability` by the seed's own
 * `firstFailurePopulation`, so a population drift is one
 * `population-mismatch` finding rather than one per row.
 *
 * **Example** (Check an empty seed against an empty plan)
 *
 * ```ts
 * import { EconomicsSeedSourceView, GateOrderSeed } from "@beep/repo-cli/commands/Quality"
 * import { gateOrderSeedFindings } from "@beep/repo-cli/test/Yeet"
 *
 * const seed = GateOrderSeed.make({
 *   schemaVersion: "gate-order/v1",
 *   sourcePath: "goals/time-to-certainty/research/economics.json",
 *   measurementAsOf: "2026-09-03T06:29:38.367Z",
 *   firstFailurePopulation: 832,
 *   lanes: []
 * })
 * const view = EconomicsSeedSourceView.make({
 *   schemaVersion: "verification-economics/v1",
 *   measurementAsOf: "2026-09-03T06:29:38.367Z",
 *   hosted: { laneRows: [] },
 *   localWrapperLanes: [],
 *   firstFailure: { attemptsWithReconstructableOuterFailure: 832, redAttempts: 1, actionableLaneMix: [{ lane: "x", attempts: 1 }] }
 * })
 * console.log(gateOrderSeedFindings(seed, [], [], view).length) // 0
 * ```
 *
 * @param seed - Gate-order seed to check.
 * @param costSources - One cost-source entry per seeded lane.
 * @param declaredLanes - The declared pre-push lanes the seed must cover.
 * @param view - The decoded subset of the pinned A1 document.
 * @returns Every disagreement found; empty when the seed, plan and A1 agree.
 * @category validation
 * @since 0.0.0
 */
export const gateOrderSeedFindings: {
  (
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    view: EconomicsSeedSourceView
  ): (seed: GateOrderSeed) => ReadonlyArray<GateOrderSeedFinding>;
  (
    seed: GateOrderSeed,
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    view: EconomicsSeedSourceView
  ): ReadonlyArray<GateOrderSeedFinding>;
} = dual(
  4,
  (
    seed: GateOrderSeed,
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    view: EconomicsSeedSourceView
  ): ReadonlyArray<GateOrderSeedFinding> => {
    const declaredById = HM.fromIterable(A.map(declaredLanes, (lane) => Tuple.make(lane.id, lane)));
    const seedIds = HashSet.fromIterable(A.map(seed.lanes, (row) => row.laneId));
    const costById = HM.fromIterable(A.map(costSources, (entry) => Tuple.make(entry.laneId, entry)));
    const mixSum = A.reduce(view.firstFailure.actionableLaneMix, 0, (total, entry) => total + entry.attempts);

    const coverage = [
      ...A.flatMap(declaredLanes, (lane) =>
        findingUnless(HashSet.has(seedIds, lane.id), () => finding("unseeded-lane", { laneId: lane.id }))
      ),
      ...A.flatMap(seed.lanes, (row) =>
        findingUnless(HM.has(declaredById, row.laneId), () => finding("orphan-seed-row", { laneId: row.laneId }))
      ),
      ...A.flatMap(costSources, (entry) =>
        findingUnless(HashSet.has(seedIds, entry.laneId), () =>
          finding("cost-basis-unmapped", { laneId: entry.laneId, detail: "cost source names no seed row" })
        )
      ),
    ];

    const rows = A.flatMap(seed.lanes, (row) =>
      O.match(HM.get(declaredById, row.laneId), {
        onNone: A.empty<GateOrderSeedFinding>,
        onSome: (lane) => {
          const source = HM.get(costById, row.laneId);
          return [
            ...findingUnless(O.isSome(source), () =>
              finding("cost-basis-unmapped", { laneId: row.laneId, detail: "seeded lane has no cost source" })
            ),
            ...findingUnless(row.laneClass === expectedLaneClass(lane), () =>
              finding("lane-class-wave-mismatch", {
                laneId: row.laneId,
                detail: `lane class ${row.laneClass}, declared wave ${lane.wave}`,
              })
            ),
            ...durationFindings(row, source, view),
            ...redFindings(row, seed, view),
          ];
        },
      })
    );

    const globals = [
      ...findingUnless(seed.firstFailurePopulation === view.firstFailure.attemptsWithReconstructableOuterFailure, () =>
        finding("population-mismatch", {
          pointer: "/firstFailure/attemptsWithReconstructableOuterFailure",
          expected: seed.firstFailurePopulation,
          actual: view.firstFailure.attemptsWithReconstructableOuterFailure,
        })
      ),
      ...findingUnless(view.firstFailure.redAttempts === mixSum, () =>
        finding("red-attempts-mismatch", {
          pointer: "/firstFailure/redAttempts",
          expected: mixSum,
          actual: view.firstFailure.redAttempts,
        })
      ),
      ...findingUnless(seed.measurementAsOf === view.measurementAsOf, () =>
        finding("measurement-mismatch", {
          pointer: "/measurementAsOf",
          detail: `seed ${seed.measurementAsOf}, A1 ${view.measurementAsOf}`,
        })
      ),
    ];

    return [...coverage, ...rows, ...globals];
  }
);

/**
 * Build the SPEC D1 gate-order handoff document from a seed, its cost sources and the pinned A1 view.
 *
 * **Details**
 *
 * Ranks the declared lanes with {@link rankWaveLanes}, then records per lane
 * its red-scheduling consequence, its cost basis, the resolved A1 duration
 * row's key, P50 and P95, and the resolved A1 first-red lane key. The scope is
 * the non-main full pre-push tier and the rule `gate-order-lexicographic/v1`.
 *
 * **Gotchas**
 *
 * Call it after {@link gateOrderSeedFindings} reports no findings: the result
 * is built through `GateOrderHandoff.make`, whose coherence check throws for
 * an unseeded lane, a lane without a cost source whose pointer is not the
 * external-run sentinel, or an unresolved pointer.
 *
 * **Example** (Reference the handoff builder)
 *
 * ```ts
 * import { gateOrderHandoff } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof gateOrderHandoff) // "function"
 * ```
 *
 * @param seed - Gate-order seed that orders and is carried verbatim.
 * @param costSources - One cost-source entry per seeded lane.
 * @param declaredLanes - The declared pre-push lanes in declaration order.
 * @param source - The pinned A1 document reference and populations.
 * @param view - The decoded subset of the pinned A1 document.
 * @returns The `gate-order-handoff/v1` document.
 * @category planning
 * @since 0.0.0
 */
export const gateOrderHandoff: {
  (
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    source: GateOrderHandoffSource,
    view: EconomicsSeedSourceView
  ): (seed: GateOrderSeed) => GateOrderHandoff;
  (
    seed: GateOrderSeed,
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    source: GateOrderHandoffSource,
    view: EconomicsSeedSourceView
  ): GateOrderHandoff;
} = dual(
  5,
  (
    seed: GateOrderSeed,
    costSources: ReadonlyArray<GateOrderCostSource>,
    declaredLanes: ReadonlyArray<GithubCheckLaneSpec>,
    source: GateOrderHandoffSource,
    view: EconomicsSeedSourceView
  ): GateOrderHandoff => {
    const costById = HM.fromIterable(A.map(costSources, (entry) => Tuple.make(entry.laneId, entry)));
    const lanes = A.map(rankWaveLanes(seed, declaredLanes), (ranked) => {
      const duration = O.flatMap(ranked.lane.orderEstimate, (row) => resolveDurationRow(view, row.durationPointer));
      return GateOrderHandoffLane.make({
        rank: ranked.rank,
        laneId: ranked.lane.id,
        declarationIndex: ranked.declarationIndex,
        decidedBy: ranked.decidedBy,
        redScheduling: redSchedulingDecision(ranked.lane.orderEstimate),
        // A missing entry falls back to the one basis the coherence check refutes
        // unless the lane's pointer is the external-run sentinel.
        costBasis: pipe(
          HM.get(costById, ranked.lane.id),
          O.map((entry) => entry.costBasis),
          O.getOrElse((): GateOrderCostBasis => "external-run")
        ),
        durationSourceKey: O.map(duration, (row) => row.key),
        durationP50Ms: O.map(duration, (row) => row.p50DurationMs),
        durationP95Ms: O.map(duration, (row) => row.p95DurationMs),
        firstRedSourceLane: O.flatMap(ranked.lane.orderEstimate, (row) =>
          resolveFirstRedLane(view, row.firstRedPointer)
        ),
      });
    });

    return GateOrderHandoff.make({
      schemaVersion: "gate-order-handoff/v1",
      scope: "pre-push:non-main",
      orderRule: "gate-order-lexicographic/v1",
      source,
      seed,
      lanes,
    });
  }
);

/**
 * Ordering operations supplied to Yeet and the local GitHub-check runner.
 *
 * @category services
 * @since 0.0.0
 */
export interface WaveOrderShape {
  readonly order: (lanes: ReadonlyArray<GithubCheckLaneSpec>) => ReadonlyArray<GithubCheckLaneSpec>;
}

/**
 * Service that turns the current lane declarations into an evidence-ordered plan.
 *
 * **Example** (Order an empty lane set)
 *
 * ```ts
 * import { WaveOrder } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const order = yield* WaveOrder
 *   return order.order([])
 * }).pipe(Effect.provide(WaveOrder.Default))
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WaveOrder extends Context.Service<WaveOrder, WaveOrderShape>()($I`WaveOrder`, {
  make: (seed: GateOrderSeed): Effect.Effect<WaveOrderShape> =>
    Effect.succeed({ order: (lanes) => orderWaveLanes(seed, lanes) }),
}) {
  /** Default A1/A4 ordering used by Yeet and direct pre-push invocations. */
  static readonly Default = Layer.effect(WaveOrder, WaveOrder.make(DEFAULT_GATE_ORDER_SEED));
}
