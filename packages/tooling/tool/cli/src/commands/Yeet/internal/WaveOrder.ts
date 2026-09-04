/**
 * Evidence-backed ordering for Yeet local proof waves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Context, Effect, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as HM from "effect/HashMap";
import * as O from "effect/Option";
import * as Tuple from "effect/Tuple";
import {
  GateOrderLaneClass,
  GateOrderSeed,
  GateOrderSeedRow,
  GatePrecisionClass,
  GithubCheckLaneSpec,
} from "../../Quality/Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WaveOrder");
const ECONOMICS_SOURCE_PATH = "goals/time-to-certainty/research/economics.json";
const NO_EXACT_FIRST_RED_POINTER = "/firstFailure/actionableLaneMix";
const PRECISE_BASIS = "No environment-only or indirect A4 attribution is assigned to this terminal red.";
const HOSTED_DURATION_BASIS = "A1 hosted required-context P50 for this lane family.";
const NO_EXACT_FIRST_RED_BASIS = "No exact lane row appears in A1 actionableLaneMix; zero of 832 was observed.";
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
 * related wrapper used as the P50 proxy. First-red probabilities use the 832
 * attempts whose first actionable failure was reconstructable.
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
    repoSanityRow("repo-sanity:tsconfig-sync", 9 / 832, O.some(22)),
    repoSanityRow("repo-sanity:fallow-boundaries-config", 17 / 832, O.some(14)),
    repoSanityRow("repo-sanity:versions", 0),
    repoSanityRow("repo-sanity:syncpack", 0),
    repoSanityRow("repo-sanity:sherif", 0),
    repoSanityRow("repo-sanity:bun-audit", 13 / 832, O.some(17)),
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
    cheapWrapperRow("quality:check:tsgo-tests", 6 / 832, O.some(24), "heavy", HEAVY_BASIS),
    hostedRow("quality:check:tsgo-smoke", 383, 2, 0),
    policyHostedRow("quality:knip", 80, 9, 11 / 832, O.some(20)),
    hostedRow("quality:jsdoc-ratchet", 82, 16, 0),
    hostedRow("quality:docgen", 115, 5, 0),
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
    policyHostedRow("pre-push:secrets", 54, 11, 4 / 832, O.some(31)),
    policyHostedRow(
      "pre-push:security",
      28,
      12,
      5 / 832,
      O.some(27),
      "imprecise",
      "A4 environment-only attribution: Docker daemon and image-pull failures share this lane's exit."
    ),
    policyHostedRow(
      "pre-push:sast",
      82,
      13,
      0,
      O.none(),
      "imprecise",
      "A4 environment-only attribution: Docker daemon and image-pull failures share this lane's exit."
    ),
    policyHostedRow(
      "pre-push:nix",
      102,
      14,
      0,
      O.none(),
      "imprecise",
      "A4 environment-only attribution: the Nix gate depends on the host execution environment."
    ),
  ],
});

type IndexedLane = readonly [declarationIndex: number, lane: GithubCheckLaneSpec];

const estimateNumber = (entry: IndexedLane, select: (estimate: GateOrderSeedRow) => number, fallback: number): number =>
  pipe(
    entry[1].orderEstimate,
    O.map(select),
    O.getOrElse(() => fallback)
  );

const indexedLaneOrder = Order.combineAll<IndexedLane>([
  Order.mapInput(Order.Number, (entry) => (O.isSome(entry[1].orderEstimate) ? 0 : 1)),
  Order.mapInput(Order.Number, (entry) =>
    pipe(
      entry[1].orderEstimate,
      O.map((estimate) =>
        GateOrderLaneClass.$match(estimate.laneClass, { "policy-preflight": () => 0, heavy: () => 1 })
      ),
      O.getOrElse(() => 0)
    )
  ),
  Order.mapInput(Order.Number, (entry) => estimateNumber(entry, (estimate) => estimate.costP50Seconds, 0)),
  Order.mapInput(Order.flip(Order.Number), (entry) => estimateNumber(entry, (estimate) => estimate.redProbability, 0)),
  Order.mapInput(Order.Number, (entry) =>
    pipe(
      entry[1].orderEstimate,
      O.map((estimate) => GatePrecisionClass.$match(estimate.precision, { precise: () => 0, imprecise: () => 1 })),
      O.getOrElse(() => 0)
    )
  ),
  Order.mapInput(Order.Number, (entry) => entry[0]),
]);

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
} = dual(2, (seed: GateOrderSeed, lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<GithubCheckLaneSpec> => {
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

  return A.map(A.sort(indexed, indexedLaneOrder), (entry) => entry[1]);
});

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
