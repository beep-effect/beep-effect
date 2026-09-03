/**
 * Schema-first domain model for the S7 CI-operations projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt } from "@beep/schema";
import { Effect, HashMap, HashSet } from "effect";
import * as S from "effect/Schema";

const $I = $CiopsId.create("projection/Schemas");

/**
 * Heavy-work classes understood by the deployed Yeet admission scheduler.
 *
 * **Example** (Recognize a work kind)
 *
 * ```ts
 * import { AdmissionWorkKind } from "@beep/ciops/src/projection/Schemas"
 *
 * console.log(AdmissionWorkKind.is["full-proof"]("full-proof")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionWorkKind = LiteralKit(["full-proof", "merged-preview", "review-fix", "publish"]).pipe(
  $I.annoteSchema("AdmissionWorkKind", {
    description: "Heavy-work class accepted by the S7 admission projection.",
  })
);

/**
 * Decoded heavy-work class accepted by {@link AdmissionWorkKind}.
 *
 * @see {@link AdmissionWorkKind} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionWorkKind = typeof AdmissionWorkKind.Type;

/**
 * Priority classes used by the deployed scheduler's effective-rank ordering.
 *
 * **Example** (Inspect priority order)
 *
 * ```ts
 * import { AdmissionPriority } from "@beep/ciops/src/projection/Schemas"
 *
 * console.log(AdmissionPriority.Options) // ["publish", "verify"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionPriority = LiteralKit(["publish", "verify"]).pipe(
  $I.annoteSchema("AdmissionPriority", {
    description: "Priority class attached to a pending admission request.",
  })
);

/**
 * Decoded priority class accepted by {@link AdmissionPriority}.
 *
 * @see {@link AdmissionPriority} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionPriority = typeof AdmissionPriority.Type;

/**
 * Scope labels carried by v1 schedule steps.
 *
 * **Example** (Recognize the admission scope)
 *
 * ```ts
 * import { ScheduleScope } from "@beep/ciops/src/projection/Schemas"
 *
 * console.log(ScheduleScope.is.admission("admission")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScheduleScope = LiteralKit(["admission"]).pipe(
  $I.annoteSchema("ScheduleScope", {
    description: "Projection scope represented by a v1 schedule step.",
  })
);

/**
 * Decoded schedule-step scope accepted by {@link ScheduleScope}.
 *
 * @see {@link ScheduleScope} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ScheduleScope = typeof ScheduleScope.Type;

/**
 * Token weights decoded from the ratified S6 policy A-Box.
 *
 * **Example** (Construct ratified work weights)
 *
 * ```ts
 * import { AdmissionTokenWeights } from "@beep/ciops/src/projection/Schemas"
 * import { PosInt } from "@beep/schema"
 *
 * const weights = AdmissionTokenWeights.make({
 *   fullProof: PosInt.make(3),
 *   mergedPreview: PosInt.make(5),
 *   reviewFix: PosInt.make(1),
 *   publish: PosInt.make(1)
 * })
 * console.log(weights.mergedPreview) // 5
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class AdmissionTokenWeights extends S.Class<AdmissionTokenWeights>($I`AdmissionTokenWeights`)(
  {
    fullProof: PosInt,
    mergedPreview: PosInt,
    reviewFix: PosInt,
    publish: PosInt,
  },
  $I.annote("AdmissionTokenWeights", {
    description: "Token charge assigned to each ratified admission work kind.",
  })
) {}

/**
 * Complete v1 admission policy decoded from committed S6 A-Box bytes.
 *
 * **Example** (Construct an admission policy)
 *
 * ```ts
 * import { AdmissionPolicyParams, AdmissionTokenWeights } from "@beep/ciops/src/projection/Schemas"
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
 * console.log(policy.capacityMaxTokens) // 10
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class AdmissionPolicyParams extends S.Class<AdmissionPolicyParams>($I`AdmissionPolicyParams`)(
  {
    capacityMaxTokens: PosInt,
    slotSizeGib: PosInt,
    reserveGib: PosInt,
    hardFloorGib: PosInt,
    heartbeatSeconds: PosInt,
    publishAgingSeconds: PosInt,
    reviewFixClassCap: PosInt,
    weights: AdmissionTokenWeights,
    priorityOrder: S.Array(AdmissionPriority),
  },
  $I.annote("AdmissionPolicyParams", {
    description: "Ratified weighted-admission parameters decoded from the S6 policy A-Box.",
  })
) {}

/**
 * Request view consumed by the deterministic admission projection.
 *
 * **Example** (Construct a pending request)
 *
 * ```ts
 * import { PendingRequest } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const request = PendingRequest.make({
 *   nonce: "request-1",
 *   kind: "full-proof",
 *   priority: "verify",
 *   weightTokens: PosInt.make(3),
 *   originKey: "origin-a",
 *   enqueuedAtMillis: NonNegativeInt.make(1000)
 * })
 * console.log(request.nonce) // "request-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PendingRequest extends S.Class<PendingRequest>($I`PendingRequest`)(
  {
    nonce: S.NonEmptyString,
    kind: AdmissionWorkKind,
    priority: AdmissionPriority,
    weightTokens: PosInt,
    originKey: S.String,
    enqueuedAtMillis: NonNegativeInt,
  },
  $I.annote("PendingRequest", {
    description: "Minimal pending-ticket view needed to reproduce scheduler admission order.",
  })
) {}

/**
 * Active token charges and derived counters at one projection instant.
 *
 * **Details**
 *
 * `activeGrants` maps each admitted nonce to its charged token weight. The
 * review-fix counter is retained because the deployed class cap cannot be
 * derived from weights alone.
 *
 * **Example** (Construct an empty token ledger)
 *
 * ```ts
 * import { TokenLedgerState } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const ledger = TokenLedgerState.make({
 *   activeGrants: HashMap.empty(),
 *   activeReviewFixNonces: HashSet.empty(),
 *   activeTokenTotal: NonNegativeInt.make(0)
 * })
 * console.log(ledger.activeTokenTotal) // 0
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class TokenLedgerState extends S.Class<TokenLedgerState>($I`TokenLedgerState`)(
  {
    activeGrants: S.HashMap(S.String, PosInt),
    activeReviewFixNonces: S.HashSet(S.String),
    activeTokenTotal: NonNegativeInt,
  },
  $I.annote("TokenLedgerState", {
    description: "Active admission charges reconstructed by nonce from journal deltas.",
  })
) {}

/**
 * One admitted action in a deterministic schedule proposal.
 *
 * **Example** (Construct an admission step)
 *
 * ```ts
 * import { PendingRequest, ScheduleStep } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const request = PendingRequest.make({
 *   nonce: "request-1",
 *   kind: "review-fix",
 *   priority: "verify",
 *   weightTokens: PosInt.make(1),
 *   originKey: "",
 *   enqueuedAtMillis: NonNegativeInt.make(1000)
 * })
 * const step = ScheduleStep.make({
 *   stepIndex: NonNegativeInt.make(0),
 *   scheduledUnitRef: request.nonce,
 *   scope: "admission",
 *   request,
 *   activeTokenTotalAfter: NonNegativeInt.make(1)
 * })
 * console.log(step.scope) // "admission"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ScheduleStep extends S.Class<ScheduleStep>($I`ScheduleStep`)(
  {
    stepIndex: NonNegativeInt,
    scheduledUnitRef: S.NonEmptyString,
    scope: ScheduleScope,
    request: PendingRequest,
    activeTokenTotalAfter: NonNegativeInt,
  },
  $I.annote("ScheduleStep", {
    description: "One capacity-safe admission action prescribed by a v1 schedule proposal.",
  })
) {}

/**
 * Deterministic admission schedule plus the explicit deferred request tail.
 *
 * **Example** (Construct an empty proposal)
 *
 * ```ts
 * import { ScheduleProposal } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const proposal = ScheduleProposal.make({
 *   proposalId: "schedule-policy-prefix-1000",
 *   projectionInstantMillis: NonNegativeInt.make(1000),
 *   steps: [],
 *   deferredTail: [],
 *   policyDigest: "policy",
 *   journalPrefixDigest: "prefix"
 * })
 * console.log(proposal.steps.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ScheduleProposal extends S.Class<ScheduleProposal>($I`ScheduleProposal`)(
  {
    proposalId: S.NonEmptyString,
    projectionInstantMillis: NonNegativeInt,
    steps: S.Array(ScheduleStep),
    deferredTail: S.Array(PendingRequest),
    policyDigest: S.NonEmptyString,
    journalPrefixDigest: S.NonEmptyString,
  },
  $I.annote("ScheduleProposal", {
    description: "Byte-provenanced admission schedule produced by the S7 projection.",
  })
) {}

/**
 * Complete explicit input to the clock-free projection core.
 *
 * **Example** (Construct projection input)
 *
 * ```ts
 * import { AdmissionPolicyParams, AdmissionTokenWeights, ProjectionInput, TokenLedgerState } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const input = ProjectionInput.make({
 *   policy: AdmissionPolicyParams.make({
 *     capacityMaxTokens: PosInt.make(10),
 *     slotSizeGib: PosInt.make(5),
 *     reserveGib: PosInt.make(10),
 *     hardFloorGib: PosInt.make(15),
 *     heartbeatSeconds: PosInt.make(5),
 *     publishAgingSeconds: PosInt.make(120),
 *     reviewFixClassCap: PosInt.make(3),
 *     weights: AdmissionTokenWeights.make({
 *       fullProof: PosInt.make(3),
 *       mergedPreview: PosInt.make(5),
 *       reviewFix: PosInt.make(1),
 *       publish: PosInt.make(1)
 *     }),
 *     priorityOrder: ["publish", "verify"]
 *   }),
 *   pending: [],
 *   ledger: TokenLedgerState.make({
 *     activeGrants: HashMap.empty(),
 *     activeReviewFixNonces: HashSet.empty(),
 *     activeTokenTotal: NonNegativeInt.make(0)
 *   }),
 *   projectionInstantMillis: NonNegativeInt.make(1000),
 *   policyDigest: "policy",
 *   journalPrefixDigest: "prefix"
 * })
 * console.log(input.pending.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ProjectionInput extends S.Class<ProjectionInput>($I`ProjectionInput`)(
  {
    policy: AdmissionPolicyParams,
    pending: S.Array(PendingRequest),
    ledger: TokenLedgerState,
    projectionInstantMillis: NonNegativeInt,
    policyDigest: S.NonEmptyString,
    journalPrefixDigest: S.NonEmptyString,
  },
  $I.annote("ProjectionInput", {
    description: "Policy, pending requests, token state, instant, and provenance digests supplied to projection.",
  })
) {}

/**
 * Canonically serialized schedule-as-A-Box document.
 *
 * **Example** (Wrap deterministic Turtle bytes)
 *
 * ```ts
 * import { TurtleDocument } from "@beep/ciops/src/projection/Schemas"
 *
 * const document = TurtleDocument.make({ content: "@prefix ciops: <https://oip.law/ontology/ci-ops#> .\n" })
 * console.log(document.content.startsWith("@prefix")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export class TurtleDocument extends S.Class<TurtleDocument>($I`TurtleDocument`)(
  { content: S.String },
  $I.annote("TurtleDocument", {
    description: "Canonical byte content emitted for one schedule proposal A-Box.",
  })
) {}

/**
 * One expected-versus-actual differential replay discrepancy.
 *
 * **Example** (Describe a replay mismatch)
 *
 * ```ts
 * import { ProjectionMismatch } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const mismatch = ProjectionMismatch.make({
 *   eventIndex: NonNegativeInt.make(4),
 *   admittedAtMillis: NonNegativeInt.make(1000),
 *   expectedNonce: "actual",
 *   projectedNonce: "projected",
 *   pendingCount: NonNegativeInt.make(2),
 *   activeTokenTotal: NonNegativeInt.make(3),
 *   requestWeightTokens: PosInt.make(5),
 *   wouldBeActiveTokenTotal: PosInt.make(8),
 *   capacityMaxTokens: PosInt.make(10),
 *   activeGrantNonces: ["holder-1"]
 * })
 * console.log(mismatch.expectedNonce) // "actual"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ProjectionMismatch extends S.Class<ProjectionMismatch>($I`ProjectionMismatch`)(
  {
    eventIndex: NonNegativeInt,
    admittedAtMillis: NonNegativeInt,
    expectedNonce: S.NonEmptyString,
    projectedNonce: S.String,
    pendingCount: NonNegativeInt,
    activeTokenTotal: NonNegativeInt,
    requestWeightTokens: PosInt,
    wouldBeActiveTokenTotal: PosInt,
    capacityMaxTokens: PosInt,
    activeGrantNonces: S.Array(S.String),
  },
  $I.annote("ProjectionMismatch", {
    description: "Replay event whose projected first admission differs from the deployed journal grant.",
  })
) {}

/**
 * Failure to decode the committed policy artifact or validate projection input.
 *
 * **Example** (Construct a policy decode failure)
 *
 * ```ts
 * import { PolicyDecodeError } from "@beep/ciops/src/projection/Schemas"
 *
 * const error = PolicyDecodeError.make({ message: "A-Box shape did not match" })
 * console.log(error._tag) // "PolicyDecodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PolicyDecodeError extends S.TaggedError<PolicyDecodeError>($I`PolicyDecodeError`)(
  "PolicyDecodeError",
  { message: S.String },
  $I.annoteError<PolicyDecodeError>("PolicyDecodeError", {
    description: "Strict policy A-Box decoding or projection-input validation failed.",
  })
) {}

/**
 * Reserved typed failure for a cyclic future lane-DAG episode plan.
 *
 * **Example** (Construct a cyclic-plan failure)
 *
 * ```ts
 * import { CyclicPlanError } from "@beep/ciops/src/projection/Schemas"
 *
 * const error = CyclicPlanError.make({ cycleNodes: ["lane-a", "lane-b"] })
 * console.log(error._tag) // "CyclicPlanError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CyclicPlanError extends S.TaggedError<CyclicPlanError>($I`CyclicPlanError`)(
  "CyclicPlanError",
  { cycleNodes: S.Array(S.NonEmptyString) },
  $I.annoteError<CyclicPlanError>("CyclicPlanError", {
    description: "Future lane-DAG planning failed because the episode graph contains a cycle.",
  })
) {}

/**
 * Honest v1 failure returned by the unimplemented lane-DAG planner seam.
 *
 * **Example** (Construct the planner seam failure)
 *
 * ```ts
 * import { PlannerNotImplementedError } from "@beep/ciops/src/projection/Schemas"
 *
 * const error = PlannerNotImplementedError.make({ message: "Lane-DAG planning is reserved for v2." })
 * console.log(error._tag) // "PlannerNotImplementedError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlannerNotImplementedError extends S.TaggedError<PlannerNotImplementedError>(
  $I`PlannerNotImplementedError`
)(
  "PlannerNotImplementedError",
  { message: S.String },
  $I.annoteError<PlannerNotImplementedError>("PlannerNotImplementedError", {
    description: "The explicit v2 lane-DAG planning seam was invoked by a v1 implementation.",
  })
) {}

/**
 * Gating error carrying every mismatch found by differential journal replay.
 *
 * **Example** (Construct a replay failure)
 *
 * ```ts
 * import { ReplayMismatchError } from "@beep/ciops/src/projection/Schemas"
 *
 * const error = ReplayMismatchError.make({ message: "Replay diverged", mismatches: [] })
 * console.log(error._tag) // "ReplayMismatchError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReplayMismatchError extends S.TaggedError<ReplayMismatchError>($I`ReplayMismatchError`)(
  "ReplayMismatchError",
  { message: S.String, mismatches: S.Array(ProjectionMismatch) },
  $I.annoteError<ReplayMismatchError>("ReplayMismatchError", {
    description: "Differential replay found one or more deployed-versus-projected admission mismatches.",
  })
) {}

/**
 * Admitted event view accepted from live or S6-redacted journal records.
 *
 * **Details**
 *
 * Owner fields are optional because the committed golden snapshot redacts
 * `pid` and `procStart` while preserving all admission-order carriers.
 *
 * **Example** (Construct a redacted admitted event)
 *
 * ```ts
 * import { AdmissionJournalAdmitted } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const event = AdmissionJournalAdmitted.make({
 *   schemaVersion: "yeet-admission-journal/v1",
 *   nonce: "request-1",
 *   pid: O.none(),
 *   procStart: O.none(),
 *   kind: "full-proof",
 *   weightTokens: PosInt.make(3),
 *   priority: "verify",
 *   originKey: "origin-a",
 *   enqueuedAtMillis: NonNegativeInt.make(1000),
 *   admittedAtMillis: NonNegativeInt.make(2000)
 * })
 * console.log(event._tag) // "admission-admitted"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalAdmitted extends S.Class<AdmissionJournalAdmitted>($I`AdmissionJournalAdmitted`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.tag("admission-admitted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(NonNegativeInt),
    procStart: S.OptionFromOptionalKey(S.String),
    kind: AdmissionWorkKind,
    weightTokens: PosInt,
    priority: AdmissionPriority,
    originKey: S.String,
    enqueuedAtMillis: NonNegativeInt,
    admittedAtMillis: NonNegativeInt,
  },
  $I.annote("AdmissionJournalAdmitted", {
    description: "Journal transition recording one pending request becoming an active grant.",
  })
) {}

/**
 * Released event view accepted from live or S6-redacted journal records.
 *
 * **Example** (Construct a redacted released event)
 *
 * ```ts
 * import { AdmissionJournalReleased } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const event = AdmissionJournalReleased.make({
 *   schemaVersion: "yeet-admission-journal/v1",
 *   nonce: "request-1",
 *   pid: O.none(),
 *   releasedAtMillis: NonNegativeInt.make(3000),
 *   memoryPeakBytes: O.none()
 * })
 * console.log(event._tag) // "admission-released"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalReleased extends S.Class<AdmissionJournalReleased>($I`AdmissionJournalReleased`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.tag("admission-released"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(NonNegativeInt),
    releasedAtMillis: NonNegativeInt,
    memoryPeakBytes: S.OptionFromOptionalKey(NonNegativeInt),
  },
  $I.annote("AdmissionJournalReleased", {
    description: "Journal transition releasing the active token charge identified by nonce.",
  })
) {}

// Private vocabulary used to decode v2 lease-eviction rows.
const AdmissionLeaseEvictionReason = LiteralKit(["owner-dead-or-reused"]).pipe(
  $I.annoteSchema("AdmissionLeaseEvictionReason", {
    description: "Reason a v2 admission lease was evicted.",
  })
);

// Private vocabulary used to decode v2 queued-ticket eviction rows.
const AdmissionTicketEvictionReason = LiteralKit(["queued-submitter-death"]).pipe(
  $I.annoteSchema("AdmissionTicketEvictionReason", {
    description: "Reason a v2 admission queue ticket was evicted.",
  })
);

/**
 * Lease-eviction event accepted from the v2 admission journal.
 *
 * **Example** (Construct an eviction event)
 *
 * ```ts
 * import { AdmissionJournalLeaseEvicted } from "@beep/ciops/src/projection/Schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const event = AdmissionJournalLeaseEvicted.make({
 *   schemaVersion: "yeet-admission-journal/v2",
 *   nonce: "request-1",
 *   pid: O.none(),
 *   evictedAtMillis: NonNegativeInt.make(3000),
 *   reason: "owner-dead-or-reused"
 * })
 * console.log(event._tag) // "admission-lease-evicted"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalLeaseEvicted extends S.Class<AdmissionJournalLeaseEvicted>(
  $I`AdmissionJournalLeaseEvicted`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.tag("admission-lease-evicted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(NonNegativeInt),
    evictedAtMillis: NonNegativeInt,
    reason: AdmissionLeaseEvictionReason,
  },
  $I.annote("AdmissionJournalLeaseEvicted", {
    description: "V2 journal transition releasing an active grant after its owner is verified dead.",
  })
) {}

// Private schema retained in the public union so mixed v1/v2 journals decode.
class AdmissionJournalTicketEvicted extends S.Class<AdmissionJournalTicketEvicted>($I`AdmissionJournalTicketEvicted`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.tag("admission-ticket-evicted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(NonNegativeInt),
    evictedAtMillis: NonNegativeInt,
    reason: AdmissionTicketEvictionReason,
  },
  $I.annote("AdmissionJournalTicketEvicted", {
    description: "V2 journal transition recording a verified dead queued submitter.",
  })
) {}

/**
 * Tagged union of admitted and released journal transitions used by replay.
 *
 * **Example** (Decode an admitted event)
 *
 * ```ts
 * import { AdmissionJournalEvent } from "@beep/ciops/src/projection/Schemas"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(AdmissionJournalEvent)({
 *   schemaVersion: "yeet-admission-journal/v1",
 *   _tag: "admission-released",
 *   nonce: "request-1",
 *   releasedAtMillis: 3000
 * })
 * console.log(decoded._tag) // "admission-released"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionJournalEvent = S.Union([
  AdmissionJournalAdmitted,
  AdmissionJournalReleased,
  AdmissionJournalLeaseEvicted,
  AdmissionJournalTicketEvicted,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AdmissionJournalEvent", {
    description: "Admission transition decoded from the S6 golden journal or the live journal shape.",
  })
);

/**
 * Decoded journal transition accepted by {@link AdmissionJournalEvent}.
 *
 * @see {@link AdmissionJournalEvent} for runtime decoding and tagged-union helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionJournalEvent = typeof AdmissionJournalEvent.Type;

/**
 * V1 lane-planner input reserved for the future DAG implementation.
 *
 * **Example** (Construct a reserved planner request)
 *
 * ```ts
 * import { PlanEpisodeInput } from "@beep/ciops/src/projection/Schemas"
 *
 * const input = PlanEpisodeInput.make({ episodeId: "episode-1" })
 * console.log(input.episodeId) // "episode-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanEpisodeInput extends S.Class<PlanEpisodeInput>($I`PlanEpisodeInput`)(
  { episodeId: S.NonEmptyString },
  $I.annote("PlanEpisodeInput", {
    description: "Minimal typed carrier preserving the v2 lane-DAG planning seam.",
  })
) {}

/**
 * Constructs the canonical empty token ledger used at replay start.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { emptyTokenLedger } from "@beep/ciops/src/projection/Schemas"
 *
 * console.log(emptyTokenLedger.activeTokenTotal) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyTokenLedger = TokenLedgerState.make({
  activeGrants: HashMap.empty(),
  activeReviewFixNonces: HashSet.empty(),
  activeTokenTotal: NonNegativeInt.make(0),
});

/**
 * Shared typed failure effect returned by the v1 planner seam.
 *
 * **Example** (Inspect the planner failure effect)
 *
 * ```ts
 * import { plannerNotImplemented } from "@beep/ciops/src/projection/Schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(plannerNotImplemented)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const plannerNotImplemented: Effect.Effect<never, PlannerNotImplementedError> = Effect.fail(
  PlannerNotImplementedError.make({ message: "Lane-DAG episode planning is reserved for S7 v2." })
);
