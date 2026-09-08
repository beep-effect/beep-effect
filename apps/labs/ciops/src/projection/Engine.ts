/**
 * Pure deterministic admission-order projection engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { Effect, HashMap, HashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { AdmissionPriority, AdmissionWorkKind, PolicyDecodeError, ScheduleProposal, ScheduleStep } from "./Schemas.ts";
import type { AdmissionPolicyParams, PendingRequest, ProjectionInput } from "./Schemas.ts";

const inputFailure = (message: string) => PolicyDecodeError.make({ message });

/**
 * Selects the decoded policy weight for one admission work kind.
 *
 * **Example** (Read a review-fix charge)
 *
 * ```ts
 * import { admissionWeightFor } from "@/projection/Engine"
 * import { AdmissionPolicyParams, AdmissionTokenWeights } from "@/projection/Schemas"
 * import { PosInt } from "@beep/schema"
 *
 * const policy = AdmissionPolicyParams.make({
 *   capacityMaxTokens: PosInt.make(10),
 *   slotSizeGib: PosInt.make(5),
 *   reserveGib: PosInt.make(10),
 *   hardFloorGib: PosInt.make(15),
 *   heartbeatSeconds: PosInt.make(5),
 *   publishAgingSeconds: PosInt.make(120),
 *   reviewFixClassCap: PosInt.make(3),
 *   weights: AdmissionTokenWeights.make({
 *     fullProof: PosInt.make(3),
 *     mergedPreview: PosInt.make(5),
 *     reviewFix: PosInt.make(1),
 *     publish: PosInt.make(1)
 *   }),
 *   priorityOrder: ["publish", "verify"]
 * })
 * console.log(admissionWeightFor("review-fix", policy)) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const admissionWeightFor: {
  (kind: AdmissionWorkKind, policy: AdmissionPolicyParams): number;
  (policy: AdmissionPolicyParams): (kind: AdmissionWorkKind) => number;
} = dual(2, (kind: AdmissionWorkKind, policy: AdmissionPolicyParams): number =>
  AdmissionWorkKind.$match(kind, {
    "full-proof": () => policy.weights.fullProof,
    "merged-preview": () => policy.weights.mergedPreview,
    "review-fix": () => policy.weights.reviewFix,
    publish: () => policy.weights.publish,
  })
);

const effectivePriorityRank = (
  request: PendingRequest,
  projectionInstantMillis: number,
  policy: AdmissionPolicyParams
): number =>
  AdmissionPriority.$match(request.priority, {
    publish: () => 0,
    verify: () => (projectionInstantMillis - request.enqueuedAtMillis >= policy.publishAgingSeconds * 1000 ? 0 : 1),
  });

const requestOrder = (input: ProjectionInput): Order.Order<PendingRequest> =>
  pipe(
    Order.mapInput(Order.Number, (request: PendingRequest) =>
      effectivePriorityRank(request, input.projectionInstantMillis, input.policy)
    ),
    Order.combine(Order.mapInput(Order.Number, (request: PendingRequest) => request.enqueuedAtMillis)),
    Order.combine(Order.mapInput(Order.String, (request: PendingRequest) => request.originKey)),
    Order.combine(Order.mapInput(Order.String, (request: PendingRequest) => request.nonce))
  );

const validatePolicyOrder = (policy: AdmissionPolicyParams): Effect.Effect<void, PolicyDecodeError> => {
  const publishFirst = pipe(A.get(policy.priorityOrder, 0), O.exists(AdmissionPriority.is.publish));
  const verifySecond = pipe(A.get(policy.priorityOrder, 1), O.exists(AdmissionPriority.is.verify));
  return A.length(policy.priorityOrder) === 2 && publishFirst && verifySecond
    ? Effect.void
    : Effect.fail(inputFailure("Admission priority order must decode as publish, then verify."));
};

const validateLedger = (input: ProjectionInput): Effect.Effect<void, PolicyDecodeError> => {
  const derivedTotal = HashMap.reduce(input.ledger.activeGrants, 0, (total, weight) => total + weight);
  const reviewFixSubset = HashSet.every(input.ledger.activeReviewFixNonces, (nonce) =>
    HashMap.has(input.ledger.activeGrants, nonce)
  );
  return derivedTotal === input.ledger.activeTokenTotal && reviewFixSubset
    ? Effect.void
    : Effect.fail(inputFailure("Token ledger counters did not match its active nonce charges."));
};

const validateRequests = (input: ProjectionInput): Effect.Effect<void, PolicyDecodeError> => {
  const nonceCount = HashSet.size(HashSet.fromIterable(A.map(input.pending, (request) => request.nonce)));
  if (nonceCount !== A.length(input.pending)) {
    return Effect.fail(inputFailure("Pending requests must have unique nonces."));
  }
  return pipe(
    A.findFirst(input.pending, (request) => request.weightTokens !== admissionWeightFor(request.kind, input.policy)),
    O.match({
      onNone: () => Effect.void,
      onSome: (request) =>
        Effect.fail(
          inputFailure(`Pending request "${request.nonce}" did not carry the A-Box weight for ${request.kind}.`)
        ),
    })
  );
};

const validateInput = Effect.fnUntraced(function* (input: ProjectionInput): Effect.fn.Return<void, PolicyDecodeError> {
  yield* validatePolicyOrder(input.policy);
  yield* validateLedger(input);
  yield* validateRequests(input);
});

interface AdmissionFold {
  readonly activeReviewFixCount: number;
  readonly activeTokenTotal: number;
  readonly capacityBlocked: boolean;
  readonly deferredTail: ReadonlyArray<PendingRequest>;
  readonly steps: ReadonlyArray<ScheduleStep>;
}

const admitInto =
  (policy: AdmissionPolicyParams) =>
  (state: AdmissionFold, request: PendingRequest): AdmissionFold => {
    const reviewFix = AdmissionWorkKind.is["review-fix"](request.kind);
    // Class-cap deferral is skippable: it never arms head-of-line blocking.
    if (reviewFix && state.activeReviewFixCount >= policy.reviewFixClassCap) {
      return { ...state, deferredTail: A.append(state.deferredTail, request) };
    }
    const nextTotal = state.activeTokenTotal + request.weightTokens;
    if (state.capacityBlocked || nextTotal > policy.capacityMaxTokens) {
      return { ...state, capacityBlocked: true, deferredTail: A.append(state.deferredTail, request) };
    }
    return {
      activeTokenTotal: nextTotal,
      activeReviewFixCount: reviewFix ? state.activeReviewFixCount + 1 : state.activeReviewFixCount,
      capacityBlocked: false,
      steps: A.append(
        state.steps,
        ScheduleStep.make({
          stepIndex: NonNegativeInt.make(A.length(state.steps)),
          scheduledUnitRef: request.nonce,
          scope: "admission",
          request,
          activeTokenTotalAfter: NonNegativeInt.make(nextTotal),
        })
      ),
      deferredTail: state.deferredTail,
    };
  };

/**
 * Projects pending requests into capacity-safe admissions and a deferred tail.
 *
 * **Details**
 *
 * Ordering is total and stable: effective priority rank, enqueue instant,
 * origin key, then nonce. Verify requests age into rank zero after the decoded
 * policy window. Capacity preserves deployed head-of-line behavior, while a
 * saturated review-fix class remains skippable as in the live scheduler.
 *
 * **Example** (Project an empty queue)
 *
 * ```ts
 * import { projectSchedule } from "@/projection/Engine"
 * import {
 *   AdmissionPolicyParams,
 *   AdmissionTokenWeights,
 *   ProjectionInput,
 *   emptyTokenLedger
 * } from "@/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const policy = AdmissionPolicyParams.make({
 *   capacityMaxTokens: PosInt.make(10),
 *   slotSizeGib: PosInt.make(5),
 *   reserveGib: PosInt.make(10),
 *   hardFloorGib: PosInt.make(15),
 *   heartbeatSeconds: PosInt.make(5),
 *   publishAgingSeconds: PosInt.make(120),
 *   reviewFixClassCap: PosInt.make(3),
 *   weights: AdmissionTokenWeights.make({
 *     fullProof: PosInt.make(3),
 *     mergedPreview: PosInt.make(5),
 *     reviewFix: PosInt.make(1),
 *     publish: PosInt.make(1)
 *   }),
 *   priorityOrder: ["publish", "verify"]
 * })
 * const proposal = Effect.runSync(projectSchedule(ProjectionInput.make({
 *   policy,
 *   pending: [],
 *   ledger: emptyTokenLedger,
 *   projectionInstantMillis: NonNegativeInt.make(1000),
 *   policyDigest: "policy",
 *   journalPrefixDigest: "prefix"
 * })))
 * console.log(proposal.deferredTail.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectSchedule = Effect.fn("CiOpsProjection.project")(function* (
  input: ProjectionInput
): Effect.fn.Return<ScheduleProposal, PolicyDecodeError> {
  yield* validateInput(input);

  const ordered = A.sort(input.pending, requestOrder(input));
  const folded = A.reduce(
    ordered,
    {
      activeTokenTotal: input.ledger.activeTokenTotal as number,
      activeReviewFixCount: HashSet.size(input.ledger.activeReviewFixNonces),
      capacityBlocked: false,
      steps: A.empty<ScheduleStep>(),
      deferredTail: A.empty<PendingRequest>(),
    },
    admitInto(input.policy)
  );

  return ScheduleProposal.make({
    proposalId: `schedule-${input.policyDigest}-${input.journalPrefixDigest}-${input.projectionInstantMillis}`,
    projectionInstantMillis: input.projectionInstantMillis,
    steps: folded.steps,
    deferredTail: folded.deferredTail,
    policyDigest: input.policyDigest,
    journalPrefixDigest: input.journalPrefixDigest,
  });
});
