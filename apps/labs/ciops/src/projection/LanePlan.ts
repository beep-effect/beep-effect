/**
 * Pure lane-order planning core for the S7-v2 planner seam (contract §8).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { Effect, Graph, HashSet, MutableHashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CyclicPlanError, GateOrderHandoffView, HandoffDecodeError, LanePlanProposal, LaneStep } from "./Schemas.ts";
import type { HandoffLane, PlanEpisodeInput } from "./Schemas.ts";

const $I = $CiopsId.create("projection/LanePlan");

/**
 * Provisional precedence from one lane to the lane planned directly after it.
 *
 * **Details**
 *
 * The handoff carries a total order and no edges, so the planner's only
 * precedences are the rank chain from {@link rankChain}. A precedence is
 * provisional ordering, never a dependency claim, and is never derived from
 * `firstRedSourceLane`.
 *
 * **Example** (Construct one rank-chain precedence)
 *
 * ```ts
 * import { LanePrecedence } from "@/projection/LanePlan"
 *
 * const precedence = LanePrecedence.make({ beforeLaneId: "fallow:audit", afterLaneId: "quality:secrets" })
 * console.log(precedence.afterLaneId) // "quality:secrets"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LanePrecedence extends S.Class<LanePrecedence>($I`LanePrecedence`)(
  { beforeLaneId: S.NonEmptyString, afterLaneId: S.NonEmptyString },
  $I.annote("LanePrecedence", {
    description: "Provisional precedence from one handoff lane to the next; never a dependency claim.",
  })
) {}

const byRank: Order.Order<HandoffLane> = Order.mapInput(Order.Number, (lane: HandoffLane) => lane.rank);
const byDeclaration: Order.Order<HandoffLane> = Order.mapInput(
  Order.Number,
  (lane: HandoffLane) => lane.declarationIndex
);
const sameLaneOrder = A.makeEquivalence(Str.Equivalence);

const decodeHandoffViewText = S.decodeUnknownEffect(S.fromJsonString(GateOrderHandoffView));

/**
 * Decodes the subset of a `gate-order-handoff/v1` document the planner reads.
 *
 * **Details**
 *
 * Every schema failure (shape, literal, lane-id pattern, uniqueness or rank
 * coherence) becomes a `HandoffDecodeError` naming the repo-relative `path`.
 * Excess handoff members are ignored.
 *
 * **Example** (Decode a one-lane handoff)
 *
 * ```ts
 * import { decodeHandoffView } from "@/projection/LanePlan"
 * import { Effect } from "effect"
 *
 * const text = JSON.stringify({
 *   schemaVersion: "gate-order-handoff/v1",
 *   scope: "pre-push:non-main",
 *   orderRule: "gate-order-lexicographic/v1",
 *   lanes: [{ rank: 0, laneId: "quality:secrets", declarationIndex: 0 }]
 * })
 * const view = Effect.runSync(decodeHandoffView("handoff.json", text))
 * console.log(view.lanes.length) // 1
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeHandoffView = Effect.fn("LanePlan.decodeHandoffView")((path: string, text: string) =>
  decodeHandoffViewText(text).pipe(
    Effect.mapError((error) => HandoffDecodeError.make({ path, message: error.message }))
  )
);

/**
 * Builds the rank chain: one precedence from the lane at rank `r` to rank `r + 1`.
 *
 * **Details**
 *
 * The deployed pre-push runs one single-lane wave per lane in rank order, so
 * this chain is the lane DAG's only edge set. It is independent of the lane
 * array's order.
 *
 * **Example** (Chain two lanes by rank)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { rankChain } from "@/projection/LanePlan"
 * import { HandoffLane } from "@/projection/Schemas"
 *
 * const chain = rankChain([
 *   HandoffLane.make({ rank: S.Natural.make(1), laneId: "quality:secrets", declarationIndex: S.Natural.make(0) }),
 *   HandoffLane.make({ rank: S.Natural.make(0), laneId: "fallow:audit", declarationIndex: S.Natural.make(1) })
 * ])
 * console.log(chain[0]?.beforeLaneId) // "fallow:audit"
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const rankChain = (lanes: ReadonlyArray<HandoffLane>): ReadonlyArray<LanePrecedence> => {
  const ranked = A.sort(lanes, byRank);
  return A.zipWith(ranked, A.drop(ranked, 1), (before, after) =>
    LanePrecedence.make({ beforeLaneId: before.laneId, afterLaneId: after.laneId })
  );
};

// Graph.addEdge throws on a missing endpoint and the laneId-keyed index would collapse a repeated lane id into a
// false cycle, so both are rejected first as caller defects (contract §8.1: a duplicate laneId is never a cycle).
const requireCoherentLanes = Effect.fnUntraced(function* (
  lanes: ReadonlyArray<HandoffLane>,
  precedences: ReadonlyArray<LanePrecedence>
) {
  const laneIds = HashSet.fromIterable(A.map(lanes, (lane) => lane.laneId));
  if (HashSet.size(laneIds) !== lanes.length) {
    return yield* Effect.die(
      `Lane plan input carries ${lanes.length} lanes but only ${HashSet.size(laneIds)} distinct lane ids.`
    );
  }
  const unknown = A.findFirst(
    precedences,
    (precedence) => !HashSet.has(laneIds, precedence.beforeLaneId) || !HashSet.has(laneIds, precedence.afterLaneId)
  );
  if (O.isSome(unknown)) {
    return yield* Effect.die(
      `Lane precedence ${unknown.value.beforeLaneId} -> ${unknown.value.afterLaneId} names a lane outside the plan.`
    );
  }
});

// Contract §8.1/§3.3: nodes keyed by laneId in ascending declarationIndex, edges in precedence order.
const buildLaneGraph = (
  lanes: ReadonlyArray<HandoffLane>,
  precedences: ReadonlyArray<LanePrecedence>
): Graph.DirectedGraph<string, LanePrecedence> =>
  Graph.directed<string, LanePrecedence>((mutable) => {
    const indexByLane = MutableHashMap.empty<string, Graph.NodeIndex>();
    A.forEach(A.sort(lanes, byDeclaration), (lane) => {
      MutableHashMap.set(indexByLane, lane.laneId, Graph.addNode(mutable, lane.laneId));
    });
    A.forEach(precedences, (precedence) => {
      pipe(
        O.all([
          MutableHashMap.get(indexByLane, precedence.beforeLaneId),
          MutableHashMap.get(indexByLane, precedence.afterLaneId),
        ]),
        O.map(([source, target]) => Graph.addEdge(mutable, source, target, precedence))
      );
    });
  });

// CycleResult.path repeats its first node at the end; drop it so a self-loop renders as [laneId].
const cycleWitness = (graph: Graph.DirectedGraph<string, LanePrecedence>, cycle: Graph.CycleResult) =>
  A.getSomes(A.map(A.dropRight(cycle.path, 1), (index) => Graph.getNode(graph, index)));

// findCycle runs before topo because topo throws a GraphError on a cycle.
const failOnCycle = (graph: Graph.DirectedGraph<string, LanePrecedence>): Effect.Effect<void, CyclicPlanError> =>
  O.match(Graph.findCycle(graph), {
    onNone: () => Effect.void,
    onSome: (cycle) => Effect.fail(CyclicPlanError.make({ cycleNodes: cycleWitness(graph, cycle) })),
  });

// Nodes are inserted in declaration order, so agreement with rank order is a real check, not a tautology.
const requireRankAgreement = Effect.fnUntraced(function* (
  lanes: ReadonlyArray<HandoffLane>,
  order: ReadonlyArray<string>
) {
  const rankOrder = A.map(A.sort(lanes, byRank), (lane) => lane.laneId);
  if (!sameLaneOrder(order, rankOrder)) {
    return yield* Effect.die(
      `Lane plan self-check failed: topological order [${A.join(order, ", ")}] disagrees with rank order [${A.join(rankOrder, ", ")}].`
    );
  }
});

/**
 * Orders lanes over an explicit precedence list with `Graph.findCycle` then `Graph.topo`.
 *
 * **Details**
 *
 * Nodes are keyed by `laneId` and inserted in ascending `declarationIndex`;
 * edges follow the precedence list. A cycle fails `CyclicPlanError` with the
 * witness's lane ids (the closing repeat dropped; a self-loop is one id). The
 * topological order becomes 0-based lane steps after a self-check against the
 * rank order.
 *
 * **Gotchas**
 *
 * An acyclic precedence list that forces an order other than the rank order,
 * a precedence naming a lane outside `lanes`, or a repeated `laneId` in
 * `lanes` is a caller defect (`Effect.die`), not a typed failure: from the
 * rank chain over a decoded handoff none of them can happen.
 *
 * **Example** (Plan two lanes over their rank chain)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { planLanes, rankChain } from "@/projection/LanePlan"
 * import { HandoffLane } from "@/projection/Schemas"
 * import { Effect } from "effect"
 *
 * const lanes = [
 *   HandoffLane.make({ rank: S.Natural.make(1), laneId: "quality:secrets", declarationIndex: S.Natural.make(0) }),
 *   HandoffLane.make({ rank: S.Natural.make(0), laneId: "fallow:audit", declarationIndex: S.Natural.make(1) })
 * ]
 * const steps = Effect.runSync(planLanes(lanes, rankChain(lanes)))
 * console.log(steps[0]?.laneId) // "fallow:audit"
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const planLanes = Effect.fn("LanePlan.planLanes")(function* (
  lanes: ReadonlyArray<HandoffLane>,
  precedences: ReadonlyArray<LanePrecedence>
): Effect.fn.Return<ReadonlyArray<LaneStep>, CyclicPlanError> {
  yield* requireCoherentLanes(lanes, precedences);
  const graph = buildLaneGraph(lanes, precedences);
  yield* failOnCycle(graph);
  const order = A.fromIterable(Graph.values(Graph.topo(graph)));
  yield* requireRankAgreement(lanes, order);
  return A.map(order, (laneId, laneStepIndex) => LaneStep.make({ laneStepIndex, laneId }));
});

/**
 * Plans a decoded handoff view into a `LanePlanProposal` for one episode.
 *
 * **Details**
 *
 * The caller has already verified that the handoff bytes hash to
 * `input.handoff.sha256`. The plan id is minted from that digest alone
 * (`lane-plan-${sha256}`); the path is recorded but never enters identity.
 *
 * **Example** (Plan a one-lane view)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { planHandoffView } from "@/projection/LanePlan"
 * import { GateOrderHandoffRef, GateOrderHandoffView, HandoffLane, PlanEpisodeInput } from "@/projection/Schemas"
 * import { Effect } from "effect"
 *
 * const input = PlanEpisodeInput.make({
 *   episodeId: "lane-plan-episode-1",
 *   repoRoot: ".",
 *   handoff: GateOrderHandoffRef.make({
 *     path: "handoff.json",
 *     sha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 *   })
 * })
 * const view = GateOrderHandoffView.make({
 *   schemaVersion: "gate-order-handoff/v1",
 *   scope: "pre-push:non-main",
 *   orderRule: "gate-order-lexicographic/v1",
 *   lanes: [HandoffLane.make({ rank: S.Natural.make(0), laneId: "quality:secrets", declarationIndex: S.Natural.make(0) })]
 * })
 * const plan = Effect.runSync(planHandoffView(input, view))
 * console.log(plan.planId.startsWith("lane-plan-")) // true
 * ```
 *
 * @category planning
 * @since 0.0.0
 */
export const planHandoffView = Effect.fn("LanePlan.planHandoffView")(function* (
  input: PlanEpisodeInput,
  view: GateOrderHandoffView
): Effect.fn.Return<LanePlanProposal, CyclicPlanError> {
  const laneSteps = yield* planLanes(view.lanes, rankChain(view.lanes));
  return LanePlanProposal.make({
    episodeId: input.episodeId,
    planId: `lane-plan-${input.handoff.sha256}`,
    handoffPath: input.handoff.path,
    handoffSha256: input.handoff.sha256,
    orderRule: view.orderRule,
    scope: view.scope,
    laneSteps,
  });
});
