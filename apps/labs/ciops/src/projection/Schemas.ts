/**
 * Schema-first domain model for the S7 CI-operations projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Sha256Hex } from "@beep/schema/Sha256";
import { Effect, HashMap, HashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { PosInt } from "./PosInt.ts";

const $I = $CiopsId.create("projection/Schemas");

/**
 * Heavy-work classes understood by the deployed Yeet admission scheduler.
 *
 * **Example** (Recognize a work kind)
 *
 * ```ts
 * import { AdmissionWorkKind } from "@/projection/Schemas"
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

const AdmissionPriorityKit = LiteralKit(["publish", "verify"]);

/**
 * Priority classes used by the deployed scheduler's effective-rank ordering.
 *
 * **Example** (Inspect priority order)
 *
 * ```ts
 * import { AdmissionPriority } from "@/projection/Schemas"
 *
 * console.log(AdmissionPriority.literals) // ["publish", "verify"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionPriority = S.Literals(AdmissionPriorityKit.literals).pipe(
  $I.annoteSchema("AdmissionPriority", {
    description: "Priority class attached to a pending admission request.",
  }),
  SchemaUtils.withStatics(() => ({
    $match: AdmissionPriorityKit.$match,
    Enum: AdmissionPriorityKit.Enum,
    is: AdmissionPriorityKit.is,
    toTaggedUnion: AdmissionPriorityKit.toTaggedUnion,
  }))
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
 * import { ScheduleScope } from "@/projection/Schemas"
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
 * import * as S from "effect/Schema"
 * import { AdmissionTokenWeights } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
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
 * import * as S from "effect/Schema"
 * import { AdmissionPolicyParams, AdmissionTokenWeights } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
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
 * import * as S from "effect/Schema"
 * import { PendingRequest } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const request = PendingRequest.make({
 *   nonce: "request-1",
 *   kind: "full-proof",
 *   priority: "verify",
 *   weightTokens: PosInt.make(3),
 *   originKey: "origin-a",
 *   enqueuedAtMillis: S.Natural.make(1000)
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
    enqueuedAtMillis: S.Natural,
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
 * import * as S from "effect/Schema"
 * import { TokenLedgerState } from "@/projection/Schemas"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const ledger = TokenLedgerState.make({
 *   activeGrants: HashMap.empty(),
 *   activeReviewFixNonces: HashSet.empty(),
 *   activeTokenTotal: S.Natural.make(0)
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
    activeTokenTotal: S.Natural,
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
 * import * as S from "effect/Schema"
 * import { PendingRequest, ScheduleStep } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const request = PendingRequest.make({
 *   nonce: "request-1",
 *   kind: "review-fix",
 *   priority: "verify",
 *   weightTokens: PosInt.make(1),
 *   originKey: "",
 *   enqueuedAtMillis: S.Natural.make(1000)
 * })
 * const step = ScheduleStep.make({
 *   stepIndex: S.Natural.make(0),
 *   scheduledUnitRef: request.nonce,
 *   scope: "admission",
 *   request,
 *   activeTokenTotalAfter: S.Natural.make(1)
 * })
 * console.log(step.scope) // "admission"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ScheduleStep extends S.Class<ScheduleStep>($I`ScheduleStep`)(
  {
    stepIndex: S.Natural,
    scheduledUnitRef: S.NonEmptyString,
    scope: ScheduleScope,
    request: PendingRequest,
    activeTokenTotalAfter: S.Natural,
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
 * import * as S from "effect/Schema"
 * import { ScheduleProposal } from "@/projection/Schemas"
 *
 * const proposal = ScheduleProposal.make({
 *   episodeId: "verification-1",
 *   proposalId: "schedule-policy-prefix-1000",
 *   projectionInstantMillis: S.Natural.make(1000),
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
    episodeId: S.NonEmptyString,
    proposalId: S.NonEmptyString,
    projectionInstantMillis: S.Natural,
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
 * **Details**
 *
 * `episodeId` identifies a bounded verification occurrence supplied by the
 * caller. Keep it across revisions of that occurrence's proposal; allocate a
 * different id for a different occurrence. Replay uses its pinned journal
 * digest and the zero-based grant event index, never a scheduler singleton.
 *
 * **Example** (Construct projection input)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AdmissionPolicyParams, AdmissionTokenWeights, ProjectionInput, TokenLedgerState } from "@/projection/Schemas"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const input = ProjectionInput.make({
 *   episodeId: "verification-1",
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
 *     activeTokenTotal: S.Natural.make(0)
 *   }),
 *   projectionInstantMillis: S.Natural.make(1000),
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
    episodeId: S.NonEmptyString,
    policy: AdmissionPolicyParams,
    pending: S.Array(PendingRequest),
    ledger: TokenLedgerState,
    projectionInstantMillis: S.Natural,
    policyDigest: S.NonEmptyString,
    journalPrefixDigest: S.NonEmptyString,
  },
  $I.annote("ProjectionInput", {
    description: "Verification occurrence, policy, pending requests, token state, instant, and provenance digests.",
  })
) {}

/**
 * Canonically serialized schedule-as-A-Box document.
 *
 * **Example** (Wrap deterministic Turtle bytes)
 *
 * ```ts
 * import { TurtleDocument } from "@/projection/Schemas"
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
 * import * as S from "effect/Schema"
 * import { ProjectionMismatch } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const mismatch = ProjectionMismatch.make({
 *   eventIndex: S.Natural.make(4),
 *   admittedAtMillis: S.Natural.make(1000),
 *   expectedNonce: "actual",
 *   projectedNonce: "projected",
 *   pendingCount: S.Natural.make(2),
 *   activeTokenTotal: S.Natural.make(3),
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
    eventIndex: S.Natural,
    admittedAtMillis: S.Natural,
    expectedNonce: S.NonEmptyString,
    projectedNonce: S.String,
    pendingCount: S.Natural,
    activeTokenTotal: S.Natural,
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
 * import { PolicyDecodeError } from "@/projection/Schemas"
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
 * Typed failure for a lane precedence graph that contains a cycle.
 *
 * **Details**
 *
 * The lane planner runs `Graph.findCycle` before `Graph.topo`, so a cycle in
 * explicit precedence input surfaces here instead of as a `GraphError` defect.
 * `cycleNodes` carries the witness's lane ids. The handoff's rank chain cannot
 * be cyclic; a duplicate `laneId` is a decode failure, not a cycle.
 *
 * **Example** (Construct a cyclic-plan failure)
 *
 * ```ts
 * import { CyclicPlanError } from "@/projection/Schemas"
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
    description: "Lane planning failed because the lane precedence graph contains a cycle.",
  })
) {}

/**
 * Failure to read the gate-order handoff bytes at the supplied location.
 *
 * **Example** (Construct a handoff read failure)
 *
 * ```ts
 * import { HandoffReadError } from "@/projection/Schemas"
 *
 * const error = HandoffReadError.make({
 *   path: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   message: "No such file"
 * })
 * console.log(error._tag) // "HandoffReadError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HandoffReadError extends S.TaggedError<HandoffReadError>($I`HandoffReadError`)(
  "HandoffReadError",
  { path: S.String, message: S.String },
  $I.annoteError<HandoffReadError>("HandoffReadError", {
    description: "The gate-order handoff document could not be read at its repo-relative path.",
  })
) {}

/**
 * Failure raised when the handoff bytes do not hash to the pinned SHA-256.
 *
 * **Details**
 *
 * The digest is taken over the raw file bytes and compared before any decode,
 * so a drifted document never reaches the subset decoder.
 *
 * **Example** (Construct a digest mismatch)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { HandoffDigestMismatchError } from "@/projection/Schemas"
 *
 * const error = HandoffDigestMismatchError.make({
 *   path: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   expectedSha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198"),
 *   actualSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(error._tag) // "HandoffDigestMismatchError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HandoffDigestMismatchError extends S.TaggedError<HandoffDigestMismatchError>(
  $I`HandoffDigestMismatchError`
)(
  "HandoffDigestMismatchError",
  { path: S.String, expectedSha256: Sha256Hex, actualSha256: Sha256Hex },
  $I.annoteError<HandoffDigestMismatchError>("HandoffDigestMismatchError", {
    description: "The gate-order handoff bytes do not hash to the SHA-256 pinned by the planner input.",
  })
) {}

/**
 * Failure to decode the gate-order handoff subset the lane planner reads.
 *
 * **Example** (Construct a handoff decode failure)
 *
 * ```ts
 * import { HandoffDecodeError } from "@/projection/Schemas"
 *
 * const error = HandoffDecodeError.make({
 *   path: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   message: "Lane ids must be unique"
 * })
 * console.log(error._tag) // "HandoffDecodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HandoffDecodeError extends S.TaggedError<HandoffDecodeError>($I`HandoffDecodeError`)(
  "HandoffDecodeError",
  { path: S.String, message: S.String },
  $I.annoteError<HandoffDecodeError>("HandoffDecodeError", {
    description: "The pinned gate-order handoff bytes did not match the lab's subset view.",
  })
) {}

/**
 * Gating error carrying every mismatch found by differential journal replay.
 *
 * **Example** (Construct a replay failure)
 *
 * ```ts
 * import { ReplayMismatchError } from "@/projection/Schemas"
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
 * Owner-reference derivation variants recorded by run-3 Ruling 11 custody.
 *
 * **Details**
 *
 * A surrogate journal row drops the live `pid`/`procStart` pair and carries a
 * salted 12-hex `ownerRef` instead; the variant names which process members
 * fed that hash. The vocabulary is the `run4-fleet` manifest custody block.
 *
 * **Example** (Recognize the pid-pair variant)
 *
 * ```ts
 * import { AdmissionOwnerRefVariant } from "@/projection/Schemas"
 *
 * console.log(AdmissionOwnerRefVariant.is.pid_pair("pid_pair")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionOwnerRefVariant = LiteralKit(["pid_pair", "ownerpid", "attachedpid", "weak"]).pipe(
  $I.annoteSchema("AdmissionOwnerRefVariant", {
    description: "Process members hashed into a surrogate admission owner reference (run-3 Ruling 11).",
  })
);

/**
 * Decoded owner-reference variant accepted by {@link AdmissionOwnerRefVariant}.
 *
 * @see {@link AdmissionOwnerRefVariant} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionOwnerRefVariant = typeof AdmissionOwnerRefVariant.Type;

/**
 * Custody reading of one decoded admission journal row.
 *
 * **Details**
 *
 * `live` rows carry the deployed `pid`; `surrogate` rows carry a run-3
 * Ruling 11 `ownerRef` instead; `redacted` rows carry neither (the S6 golden
 * strips owner members). The reading is derived by
 * {@link admissionRowCustody}, never stored in the encoded row.
 *
 * **Example** (Recognize surrogate custody)
 *
 * ```ts
 * import { AdmissionRowCustody } from "@/projection/Schemas"
 *
 * console.log(AdmissionRowCustody.is.surrogate("surrogate")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionRowCustody = LiteralKit(["live", "surrogate", "redacted"]).pipe(
  $I.annoteSchema("AdmissionRowCustody", {
    description: "Whether a journal row carries a live pid, a surrogate ownerRef, or neither.",
  })
);

/**
 * Decoded custody reading accepted by {@link AdmissionRowCustody}.
 *
 * @see {@link AdmissionRowCustody} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionRowCustody = typeof AdmissionRowCustody.Type;

// Run-3 Ruling 11 surrogates (owner and checkout references) are salted 12-hex digests.
const optionalSurrogateRef = S.String.check(S.isPattern(/^[0-9a-f]{12}$/)).pipe(
  S.OptionFromOptionalKey,
  S.withConstructorDefault(Effect.succeedNone)
);

const optionalOwnerRefVariant = AdmissionOwnerRefVariant.pipe(
  S.OptionFromOptionalKey,
  S.withConstructorDefault(Effect.succeedNone)
);

interface OwnerCarrier {
  readonly ownerRef: O.Option<string>;
  readonly pid: O.Option<number>;
}

// P2 Ruling 8 custody invariants. Each filter reads only the members it names,
// so one filter instance serves every journal class whose struct carries them.
const hasOneOwner = (row: OwnerCarrier): boolean => O.isSome(row.pid) !== O.isSome(row.ownerRef);

const hasAtMostOneOwner = (row: OwnerCarrier): boolean => !(O.isSome(row.pid) && O.isSome(row.ownerRef));

const hasPairedOwnerVariant = (row: {
  readonly ownerRef: O.Option<string>;
  readonly ownerRefVariant: O.Option<AdmissionOwnerRefVariant>;
}): boolean => O.isSome(row.ownerRef) === O.isSome(row.ownerRefVariant);

const hasOneCheckout = (row: {
  readonly checkoutRoot: O.Option<string>;
  readonly checkoutRef: O.Option<string>;
}): boolean => O.isSome(row.checkoutRoot) !== O.isSome(row.checkoutRef);

const v3OneOwner = S.makeFilter(hasOneOwner, {
  message: "A v3 admission row carries exactly one of pid (live) or ownerRef (surrogate)",
});

const legacyAtMostOneOwner = S.makeFilter(hasAtMostOneOwner, {
  message: "A v1/v2 admission row carries at most one of pid or ownerRef",
});

const pairedOwnerVariant = S.makeFilter(hasPairedOwnerVariant, {
  message: "ownerRefVariant is present exactly when ownerRef is present",
});

const v3OneCheckout = S.makeFilter(hasOneCheckout, {
  message: "A v3 admission row carries exactly one of checkoutRoot or checkoutRef",
});

// A live queued row always carried its process start beside its pid; a surrogate never does.
const hasPidPairedProcStart = (row: {
  readonly pid: O.Option<number>;
  readonly procStart: O.Option<string>;
}): boolean => O.isSome(row.pid) === O.isSome(row.procStart);

const v3PidPairedProcStart = S.makeFilter(hasPidPairedProcStart, {
  message: "A v3 queued admission row carries procStart exactly when it carries pid",
});

/**
 * Derives the custody reading of one decoded admission journal row.
 *
 * **Details**
 *
 * A row with `pid` is `live`, a row with `ownerRef` is `surrogate`, and a row
 * with neither is `redacted`. Decoding already rejects a v3 row that carries
 * both or neither, and a v1/v2 row that carries both, so the reading is total
 * and never invents a pid.
 *
 * **Example** (Read surrogate custody)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { admissionRowCustody } from "@/projection/Schemas"
 *
 * console.log(admissionRowCustody({ pid: O.none(), ownerRef: O.some("01e0c0c6c4e1") })) // "surrogate"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const admissionRowCustody = (row: OwnerCarrier): AdmissionRowCustody =>
  O.as(row.pid, AdmissionRowCustody.Enum.live).pipe(
    O.orElse(() => O.as(row.ownerRef, AdmissionRowCustody.Enum.surrogate)),
    O.getOrElse(() => AdmissionRowCustody.Enum.redacted)
  );

/**
 * Admitted event view accepted from live or S6-redacted journal records.
 *
 * **Details**
 *
 * Owner fields are optional because the committed golden snapshot redacts
 * `pid` and `procStart` while preserving all admission-order carriers. Pinned
 * corpus rows carry a surrogate `ownerRef`/`ownerRefVariant` pair instead of
 * `pid` (run-3 Ruling 11); decode rejects a row that carries both.
 *
 * **Example** (Construct a redacted admitted event)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AdmissionJournalAdmitted } from "@/projection/Schemas"
 * import * as O from "effect/Option"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
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
 *   enqueuedAtMillis: S.Natural.make(1000),
 *   admittedAtMillis: S.Natural.make(2000)
 * })
 * console.log(event._tag) // "admission-admitted"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalAdmitted extends S.Class<AdmissionJournalAdmitted>($I`AdmissionJournalAdmitted`)(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.tag("admission-admitted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(S.Natural),
    procStart: S.OptionFromOptionalKey(S.String),
    ownerRef: optionalSurrogateRef,
    ownerRefVariant: optionalOwnerRefVariant,
    kind: AdmissionWorkKind,
    weightTokens: PosInt,
    priority: AdmissionPriority,
    originKey: S.String,
    enqueuedAtMillis: S.Natural,
    admittedAtMillis: S.Natural,
  }).check(legacyAtMostOneOwner, pairedOwnerVariant),
  $I.annote("AdmissionJournalAdmitted", {
    description: "Journal transition recording one pending request becoming an active grant.",
  })
) {}

/**
 * Released event view accepted from live or S6-redacted journal records.
 *
 * @internal
 * @since 0.0.0
 */
class AdmissionJournalReleased extends S.Class<AdmissionJournalReleased>($I`AdmissionJournalReleased`)(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.tag("admission-released"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(S.Natural),
    ownerRef: optionalSurrogateRef,
    ownerRefVariant: optionalOwnerRefVariant,
    releasedAtMillis: S.Natural,
    memoryPeakBytes: S.OptionFromOptionalKey(S.Natural),
  }).check(legacyAtMostOneOwner, pairedOwnerVariant),
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
 * @internal
 * @since 0.0.0
 */
class AdmissionJournalLeaseEvicted extends S.Class<AdmissionJournalLeaseEvicted>($I`AdmissionJournalLeaseEvicted`)(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.tag("admission-lease-evicted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(S.Natural),
    ownerRef: optionalSurrogateRef,
    ownerRefVariant: optionalOwnerRefVariant,
    evictedAtMillis: S.Natural,
    reason: AdmissionLeaseEvictionReason,
  }).check(legacyAtMostOneOwner, pairedOwnerVariant),
  $I.annote("AdmissionJournalLeaseEvicted", {
    description: "V2 journal transition releasing an active grant after its owner is verified dead.",
  })
) {}

// Private schema retained in the public union so mixed v1/v2 journals decode.
class AdmissionJournalTicketEvicted extends S.Class<AdmissionJournalTicketEvicted>($I`AdmissionJournalTicketEvicted`)(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.tag("admission-ticket-evicted"),
    nonce: S.NonEmptyString,
    pid: S.OptionFromOptionalKey(S.Natural),
    ownerRef: optionalSurrogateRef,
    ownerRefVariant: optionalOwnerRefVariant,
    evictedAtMillis: S.Natural,
    reason: AdmissionTicketEvictionReason,
  }).check(legacyAtMostOneOwner, pairedOwnerVariant),
  $I.annote("AdmissionJournalTicketEvicted", {
    description: "V2 journal transition recording a verified dead queued submitter.",
  })
) {}

// V3 rows carry either live owner and checkout attribution (`pid`, `checkoutRoot`)
// or run-3 Ruling 11 surrogates (`ownerRef`, `checkoutRef`); legacy classes above
// continue accepting the redacted S6 shape; no CLI internals cross this boundary.
// `.extend` keeps these struct checks (effect 4.0.0 `makeClass.extend` re-applies
// `struct.ast.checks`); spreading `.fields` does not, so the spread v3 classes
// below re-apply the same filter instances (P2 Ruling 8).
class AdmissionJournalV3Identity extends S.Class<AdmissionJournalV3Identity>($I`AdmissionJournalV3Identity`)(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-journal/v3"),
    nonce: S.String,
    pid: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ownerRef: optionalSurrogateRef,
    ownerRefVariant: optionalOwnerRefVariant,
    attemptId: S.Trim.check(S.isNonEmpty({ message: "String must not be empty" }), S.isUUID()).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    checkoutRoot: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    checkoutRef: optionalSurrogateRef,
    branch: S.String,
  }).check(v3OneOwner, pairedOwnerVariant, v3OneCheckout),
  $I.annote("AdmissionJournalV3Identity", {
    description: "V3 journal identity: exactly one live or surrogate owner and one checkout attribution.",
  })
) {}

// The extension restates the inherited `pid` (same schema, same key position) so its
// own struct check can pair `procStart` with it; `.extend` appends that check.
class AdmissionJournalQueuedIdentity extends AdmissionJournalV3Identity.extend<AdmissionJournalQueuedIdentity>(
  $I`AdmissionJournalQueuedIdentity`
)(
  S.Struct({
    pid: AdmissionJournalV3Identity.fields.pid,
    procStart: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    kind: AdmissionWorkKind,
    priority: AdmissionPriority,
    originKey: S.String,
    enqueuedAtMillis: S.Finite,
  }).check(v3PidPairedProcStart),
  $I.annote("AdmissionJournalQueuedIdentity", {
    description: "Queued request identity carried by ledger-neutral enqueue and withdrawal events.",
  })
) {}

class AdmissionJournalEnqueued extends AdmissionJournalQueuedIdentity.extend<AdmissionJournalEnqueued>(
  $I`AdmissionJournalEnqueued`
)(
  { _tag: S.tag("admission-enqueued"), weightTokens: S.Finite },
  $I.annote("AdmissionJournalEnqueued", { description: "V3 request enqueue; does not charge admitted tokens." })
) {}

class AdmissionJournalWithdrawn extends AdmissionJournalQueuedIdentity.extend<AdmissionJournalWithdrawn>(
  $I`AdmissionJournalWithdrawn`
)(
  { _tag: S.tag("admission-withdrawn"), withdrawnAtMillis: S.Finite },
  $I.annote("AdmissionJournalWithdrawn", { description: "V3 queued withdrawal; does not release admitted tokens." })
) {}

class AdmissionJournalReleasedV3 extends S.Class<AdmissionJournalReleasedV3>($I`AdmissionJournalReleasedV3`)(
  S.Struct({ ...AdmissionJournalReleased.fields, ...AdmissionJournalV3Identity.fields }).check(
    v3OneOwner,
    pairedOwnerVariant,
    v3OneCheckout
  ),
  $I.annote("AdmissionJournalReleasedV3", { description: "V3 release with direct checkout attribution." })
) {}

class AdmissionJournalLeaseEvictedV3 extends S.Class<AdmissionJournalLeaseEvictedV3>(
  $I`AdmissionJournalLeaseEvictedV3`
)(
  S.Struct({
    ...AdmissionJournalLeaseEvicted.fields,
    ...AdmissionJournalV3Identity.fields,
    lastHeartbeatAtMillis: S.Finite,
  }).check(v3OneOwner, pairedOwnerVariant, v3OneCheckout),
  $I.annote("AdmissionJournalLeaseEvictedV3", {
    description: "V3 lease eviction with checkout attribution and the last observed heartbeat.",
  })
) {}

class AdmissionJournalTicketEvictedV3 extends S.Class<AdmissionJournalTicketEvictedV3>(
  $I`AdmissionJournalTicketEvictedV3`
)(
  S.Struct({ ...AdmissionJournalTicketEvicted.fields, ...AdmissionJournalV3Identity.fields }).check(
    v3OneOwner,
    pairedOwnerVariant,
    v3OneCheckout
  ),
  $I.annote("AdmissionJournalTicketEvictedV3", { description: "V3 queued ticket eviction with checkout attribution." })
) {}

/**
 * Mixed v1/v2/v3 admission transitions accepted by live-journal replay.
 *
 * **Details**
 *
 * Enqueue and withdrawal rows are ledger-neutral but count in the decoded
 * source-event index. Versions share tags, so consumers match the decoded union
 * with Effect Match instead of `S.toTaggedUnion`, which rejects duplicate tags.
 *
 * **Example** (Decode a legacy released event)
 *
 * ```ts
 * import { AdmissionJournalEvent } from "@/projection/Schemas"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(AdmissionJournalEvent)({
 *   schemaVersion: "yeet-admission-journal/v1",
 *   _tag: "admission-released",
 *   nonce: "request-1",
 *   releasedAtMillis: 3000
 * })
 * console.log(decoded._tag) // "Some"
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
  AdmissionJournalEnqueued,
  AdmissionJournalWithdrawn,
  AdmissionJournalReleasedV3,
  AdmissionJournalLeaseEvictedV3,
  AdmissionJournalTicketEvictedV3,
]).pipe(
  $I.annoteSchema("AdmissionJournalEvent", {
    description: "Admission transition decoded from the S6 golden journal or the live journal shape.",
  })
);

/**
 * Decoded journal transition accepted by {@link AdmissionJournalEvent}.
 *
 * @see {@link AdmissionJournalEvent} for mixed-version runtime decoding.
 * @category models
 * @since 0.0.0
 */
export type AdmissionJournalEvent = typeof AdmissionJournalEvent.Type;

/**
 * Pre-push scope a gate-order handoff and its lane plan apply to.
 *
 * **Details**
 *
 * This is the handoff's `scope` member, kept separate from the admission-only
 * {@link ScheduleScope}. Any other scope fails the subset decode.
 *
 * **Example** (Recognize the handoff scope)
 *
 * ```ts
 * import { LaneScope } from "@/projection/Schemas"
 *
 * console.log(LaneScope.is["pre-push:non-main"]("pre-push:non-main")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LaneScope = LiteralKit(["pre-push:non-main"]).pipe(
  $I.annoteSchema("LaneScope", {
    description: "Pre-push scope of a gate-order handoff and the lane plan derived from it.",
  })
);

/**
 * Decoded lane scope accepted by {@link LaneScope}.
 *
 * @see {@link LaneScope} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type LaneScope = typeof LaneScope.Type;

/**
 * Order rule under which the handoff's lane ranks were computed.
 *
 * **Details**
 *
 * The lab never recomputes this order; it only reads the ranks the rule
 * produced. A new rule is a new literal (time-to-certainty ruling 76) and
 * fails the subset decode until a ruling admits it here.
 *
 * **Example** (Recognize the lexicographic gate order)
 *
 * ```ts
 * import { LaneOrderRule } from "@/projection/Schemas"
 *
 * console.log(LaneOrderRule.is["gate-order-lexicographic/v1"]("gate-order-lexicographic/v1")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LaneOrderRule = LiteralKit(["gate-order-lexicographic/v1"]).pipe(
  $I.annoteSchema("LaneOrderRule", {
    description: "Gate-order rule named by the handoff document and carried by its lane plan.",
  })
);

/**
 * Decoded order rule accepted by {@link LaneOrderRule}.
 *
 * @see {@link LaneOrderRule} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type LaneOrderRule = typeof LaneOrderRule.Type;

// Ruling-28 lane ids are `family:name` segments; the set stays open, so this is a pattern, not a kit.
const LaneId = S.NonEmptyString.check(
  S.isPattern(/^[a-z0-9-]+(:[a-z0-9-]+)+$/, {
    message: "Lane ids must be lowercase colon-separated segments such as quality:secrets",
  })
).pipe(
  $I.annoteSchema("LaneId", {
    description: "Colon-separated verification lane id named by the gate-order handoff.",
  })
);

// Normalized repo-relative path: no absolute root, no `./`, no empty and no `..` segment (P2 Ruling 5).
const RepoRelativePath = S.NonEmptyString.check(
  S.isPattern(/^(?:[.@]?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[.@]?[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/, {
    message: "Handoff paths must be normalized repo-relative paths (no leading '/', './', empty or '..' segments)",
  })
).pipe(
  $I.annoteSchema("RepoRelativePath", {
    description: "Repo-relative file path that cannot escape the caller-supplied repo root.",
  })
);

/**
 * Location and pinned SHA-256 of a `gate-order-handoff/v1` document.
 *
 * **Details**
 *
 * The path is a repo-relative locator and never enters plan identity; the
 * SHA-256 is the document's identity and is checked against the raw bytes
 * before any decode.
 *
 * **Example** (Reference the pinned handoff)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { GateOrderHandoffRef } from "@/projection/Schemas"
 *
 * const handoff = GateOrderHandoffRef.make({
 *   path: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   sha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 * })
 * console.log(handoff.sha256.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateOrderHandoffRef extends S.Class<GateOrderHandoffRef>($I`GateOrderHandoffRef`)(
  { path: RepoRelativePath, sha256: Sha256Hex },
  $I.annote("GateOrderHandoffRef", {
    description: "Repo-relative path and pinned SHA-256 of the gate-order handoff document.",
  })
) {}

/**
 * Lane-planner input: the caller's episode key and the pinned handoff to plan from.
 *
 * **Details**
 *
 * `repoRoot` is the caller-supplied root the handoff path resolves under;
 * like the path it is a locator and never enters plan identity.
 *
 * **Example** (Construct a lane-planner request)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { GateOrderHandoffRef, PlanEpisodeInput } from "@/projection/Schemas"
 *
 * const input = PlanEpisodeInput.make({
 *   episodeId: "lane-plan-episode-1",
 *   repoRoot: ".",
 *   handoff: GateOrderHandoffRef.make({
 *     path: "goals/time-to-certainty/research/gate-order-handoff.json",
 *     sha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 *   })
 * })
 * console.log(input.episodeId) // "lane-plan-episode-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanEpisodeInput extends S.Class<PlanEpisodeInput>($I`PlanEpisodeInput`)(
  { episodeId: S.NonEmptyString, repoRoot: S.NonEmptyString, handoff: GateOrderHandoffRef },
  $I.annote("PlanEpisodeInput", {
    description: "Caller-owned episode key plus the repo root and pinned handoff the lane planner reads.",
  })
) {}

/**
 * One lane row of the handoff subset the planner decodes.
 *
 * **Example** (Construct a handoff lane)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HandoffLane } from "@/projection/Schemas"
 *
 * const lane = HandoffLane.make({
 *   rank: S.Natural.make(0),
 *   laneId: "fallow:audit",
 *   declarationIndex: S.Natural.make(26)
 * })
 * console.log(lane.laneId) // "fallow:audit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HandoffLane extends S.Class<HandoffLane>($I`HandoffLane`)(
  { rank: S.Natural, laneId: LaneId, declarationIndex: S.Natural },
  $I.annote("HandoffLane", {
    description: "Rank, lane id and declaration index of one gate-order handoff lane.",
  })
) {}

const hasUniqueLaneIds = (lanes: ReadonlyArray<HandoffLane>): boolean =>
  HashSet.size(HashSet.fromIterable(A.map(lanes, (lane) => lane.laneId))) === A.length(lanes);

const hasUniqueDeclarationIndexes = (lanes: ReadonlyArray<HandoffLane>): boolean =>
  HashSet.size(HashSet.fromIterable(A.map(lanes, (lane) => lane.declarationIndex))) === A.length(lanes);

// Contract §8.1: the rank set is exactly 0..n-1 (no gap, no duplicate), whatever the array order.
const hasCoherentRanks = (lanes: ReadonlyArray<HandoffLane>): boolean =>
  A.every(
    A.sort(
      A.map(lanes, (lane) => lane.rank),
      Order.Number
    ),
    (rank, index) => rank === index
  );

/**
 * Subset view of `gate-order-handoff/v1` that the lane planner reads.
 *
 * **Details**
 *
 * Only `schemaVersion`, `scope`, `orderRule` and each lane's `rank`, `laneId`
 * and `declarationIndex` are decoded; every other member is ignored, so the lab
 * never mirrors the repo-cli `GateOrderHandoff` schema. The decode fails on an
 * empty lane array, a duplicate `laneId`, a duplicate `declarationIndex`, or a
 * rank set other than exactly `0..n-1`.
 *
 * **Example** (Decode a one-lane handoff from JSON text)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GateOrderHandoffView } from "@/projection/Schemas"
 *
 * const view = S.decodeSync(S.fromJsonString(GateOrderHandoffView))(
 *   JSON.stringify({
 *     schemaVersion: "gate-order-handoff/v1",
 *     scope: "pre-push:non-main",
 *     orderRule: "gate-order-lexicographic/v1",
 *     seed: { ignored: true },
 *     lanes: [{ rank: 0, laneId: "quality:secrets", declarationIndex: 0, decidedBy: null }]
 *   })
 * )
 * console.log(view.lanes.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateOrderHandoffView extends S.Class<GateOrderHandoffView>($I`GateOrderHandoffView`)(
  {
    schemaVersion: S.Literal("gate-order-handoff/v1"),
    scope: LaneScope,
    orderRule: LaneOrderRule,
    lanes: S.NonEmptyArray(HandoffLane).check(
      S.makeFilter(hasUniqueLaneIds, { message: "Handoff lane ids must be unique" }),
      S.makeFilter(hasUniqueDeclarationIndexes, { message: "Handoff declaration indexes must be unique" }),
      S.makeFilter(hasCoherentRanks, { message: "Handoff lane ranks must be exactly 0..n-1" })
    ),
  },
  $I.annote("GateOrderHandoffView", {
    description: "Lab-local subset view of a gate-order-handoff/v1 document; excess members are ignored.",
  })
) {}

/**
 * One 0-based position in a lane plan, naming the lane ordered there.
 *
 * **Example** (Construct a lane step)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LaneStep } from "@/projection/Schemas"
 *
 * const step = LaneStep.make({ laneStepIndex: S.Natural.make(0), laneId: "fallow:audit" })
 * console.log(step.laneStepIndex) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class LaneStep extends S.Class<LaneStep>($I`LaneStep`)(
  { laneStepIndex: S.Natural, laneId: LaneId },
  $I.annote("LaneStep", {
    description: "One 0-based lane position in a lane plan; distinct from an admission ScheduleStep.",
  })
) {}

const lanePlanIdPrefix = "lane-plan-";

// Contract §8.3: planId is minted from the handoff digest, never chosen by the caller.
const hasDerivedPlanId = (plan: { readonly planId: string; readonly handoffSha256: string }): boolean =>
  plan.planId === `${lanePlanIdPrefix}${plan.handoffSha256}`;

const hasPositionalLaneSteps = (plan: { readonly laneSteps: ReadonlyArray<LaneStep> }): boolean =>
  A.every(plan.laneSteps, (step, index) => step.laneStepIndex === index);

/**
 * Lane-order plan derived from one pinned gate-order handoff.
 *
 * **Details**
 *
 * This is its own proposal type, never a widened `ScheduleProposal`: lane
 * steps are not admitted seat requests. `handoffPath` records where the
 * handoff was read (P2 Ruling 3) but stays outside identity: `planId` is
 * content-derived from the handoff SHA-256 alone and reads no clock.
 *
 * **Gotchas**
 *
 * Decoding and `make` both fail unless `planId` is exactly
 * `lane-plan-${handoffSha256}` and every step's `laneStepIndex` equals its
 * array position. The `lane-plan-` prefix keeps plan nodes disjoint from the
 * `schedule-` admission proposal nodes.
 *
 * **Example** (Construct an empty lane plan)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { LanePlanProposal } from "@/projection/Schemas"
 *
 * const handoffSha256 = Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 * const plan = LanePlanProposal.make({
 *   episodeId: "lane-plan-episode-1",
 *   planId: `lane-plan-${handoffSha256}`,
 *   handoffPath: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   handoffSha256,
 *   orderRule: "gate-order-lexicographic/v1",
 *   scope: "pre-push:non-main",
 *   laneSteps: []
 * })
 * console.log(plan.laneSteps.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class LanePlanProposal extends S.Class<LanePlanProposal>($I`LanePlanProposal`)(
  S.Struct({
    episodeId: S.NonEmptyString,
    planId: S.NonEmptyString,
    handoffPath: RepoRelativePath,
    handoffSha256: Sha256Hex,
    orderRule: LaneOrderRule,
    scope: LaneScope,
    laneSteps: S.Array(LaneStep),
  }).check(
    S.makeFilter(hasDerivedPlanId, { message: "Lane plan ids must be lane-plan- followed by the handoff SHA-256" }),
    S.makeFilter(hasPositionalLaneSteps, { message: "Lane step indexes must equal their 0-based positions" })
  ),
  $I.annote("LanePlanProposal", {
    description: "Ordered lane steps planned from one sha256-pinned gate-order handoff, with its read path.",
  })
) {}

/**
 * Constructs the canonical empty token ledger used at replay start.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { emptyTokenLedger } from "@/projection/Schemas"
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
  activeTokenTotal: S.Natural.make(0),
});
