/**
 * Party-owned immutable cores and separate evidence, generation and review records.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimReview, ReviewTag, ValidTime } from "@beep/epistemics/Claim";
import { ClaimId, makeClaimCore, makeClaimRecords } from "@beep/epistemics/ClaimCore.schema";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $PartyDomainId } from "@beep/identity/packages";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ActivityId, AssertionId, PrincipalId } from "../../Ids.ts";
import { logicalKey, Proposition } from "../../Proposition.ts";
import { EvidenceAnchor } from "../../Provenance.ts";

const $I = $PartyDomainId.create("entities/Claim/Claim.model");
const review = makeClaimReview({ $I, ids: { assertion: AssertionId, activity: ActivityId, principal: PrincipalId } });
const core = makeClaimCore({
  $I,
  proposition: Proposition,
  ids: {
    logicalKey,
    scope: S.NonEmptyString,
    principal: PrincipalId,
    action: S.NonEmptyString,
    revision: S.NonEmptyString,
  },
});

/**
 * Separate evidence signals; absence is never interpreted as zero confidence.
 *
 * **Example** (Validate evidence signals)
 *
 * ```ts
 * import { EvidenceSignals } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(EvidenceSignals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceSignals extends S.Opaque<EvidenceSignals, { readonly brand: unique symbol }>()(
  review.EvidenceSignals
) {}

/**
 * Party review states bound to party reviewer and assertion identifiers.
 *
 * **Example** (Construct an unreviewed state)
 *
 * ```ts
 * import { ReviewState } from "@beep/party-domain/Claim"
 * ReviewState.cases.Proposed.make({})
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewState = review.ReviewState;
/**
 * Runtime review-state union.
 * @category models
 * @since 0.0.0
 */
export type ReviewState = typeof ReviewState.Type;

/**
 * One source's assertion or denial, retaining exact evidence anchors.
 *
 * **Example** (Decode a source assertion)
 * ```ts
 * import { SourceAssertion } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SourceAssertion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SourceAssertion extends S.Opaque<SourceAssertion, { readonly brand: unique symbol }>()(
  S.Struct({
    id: AssertionId,
    proposition: Proposition,
    stance: S.Literals(["asserts", "denies"]),
    anchors: S.NonEmptyArray(EvidenceAnchor),
    producedBy: ActivityId,
    validTime: ValidTime,
    recordedAt: S.DateTimeUtcFromMillis,
  }).pipe(
    $PartyDomainId.create("entities/Claim/Claim.model").annoteSchema("SourceAssertion", {
      description: "One proposition asserted by one source occurrence; not a resolved fact.",
    })
  )
) {}

/**
 * Source dependence with party-owned assertion and activity identifiers.
 *
 * **Example** (Decode a dependence assessment)
 * ```ts
 * import { DependenceAssessment } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DependenceAssessment)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DependenceAssessment extends S.Opaque<DependenceAssessment, { readonly brand: unique symbol }>()(
  review.DependenceAssessment
) {}

/**
 * A human disposition on the exact evidence basis that was reviewed.
 *
 * **Example** (Decode a reviewer disposition)
 * ```ts
 * import { ReviewerDisposition } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewerDisposition)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReviewerDisposition extends S.Opaque<ReviewerDisposition, { readonly brand: unique symbol }>()(
  review.ReviewerDisposition
) {}

/**
 * Creation facts for one party proposition, with no mutable review or evidence scores.
 *
 * **Example** (Decode ClaimCore at its boundary)
 *
 * ```ts
 * import { ClaimCore } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimCore)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimCore extends S.Opaque<ClaimCore, { readonly brand: unique symbol }>()(core.ClaimCore) {}

const records = makeClaimRecords({ $I, core: ClaimCore });

/**
 * An immutable content address paired with the exact core it identifies.
 *
 * **Example** (Decode ClaimRecord at its boundary)
 *
 * ```ts
 * import { ClaimRecord } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimRecord)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimRecord extends S.Opaque<ClaimRecord, { readonly brand: unique symbol }>()(records.ClaimRecord) {}

/**
 * The explicit person, organization or pinned software asserting a native projection.
 *
 * **Example** (Decode ClaimAgent at its boundary)
 *
 * ```ts
 * import { ClaimAgent } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimAgent)
 * console.log(typeof decode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimAgent = core.AgentRef;
/**
 * Decoded ClaimAgent record.
 * @category models
 * @since 0.0.0
 */
export type ClaimAgent = typeof ClaimAgent.Type;

/**
 * Explicit native projection facts, distinct from an earlier source assertion activity.
 *
 * **Example** (Decode ClaimCreation at its boundary)
 *
 * ```ts
 * import { ClaimCreation } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimCreation)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimCreation extends S.Opaque<ClaimCreation, { readonly brand: unique symbol }>()(
  S.Struct({
    activity: ActivityStart,
    generatedAt: S.DateTimeUtcFromMillis,
    knowledgeStart: S.DateTimeUtcFromMillis,
    scope: S.NonEmptyString,
    assertedBy: ClaimAgent,
  })
    .check(
      S.makeFilter(
        (creation) =>
          DateTime.isLessThanOrEqualTo(creation.activity.started, creation.generatedAt) &&
          DateTime.isLessThanOrEqualTo(creation.generatedAt, creation.knowledgeStart),
        $I.annote("ClaimCreationOrder", { description: "Native generation starts, ends, then becomes known." })
      )
    )
    .pipe(
      $I.annoteSchema("ClaimCreation", { description: "No source id, actor or scope is invented by a projection." })
    )
) {}

/**
 * Source assertion references retained separately from text occurrence support.
 *
 * **Example** (Decode ClaimEvidenceLinks at its boundary)
 *
 * ```ts
 * import { ClaimEvidenceLinks } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimEvidenceLinks)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimEvidenceLinks extends S.Opaque<ClaimEvidenceLinks, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    at: S.DateTimeUtcFromMillis,
    supportedBy: S.Array(AssertionId),
    challengedBy: S.Array(AssertionId),
  }).pipe($I.annoteSchema("ClaimEvidenceLinks", { description: "Source references keep their assertion namespace." }))
) {}

/**
 * A claim-local review event retaining its exact reviewer disposition and evidence basis.
 *
 * **Example** (Decode ClaimReviewRecord at its boundary)
 *
 * ```ts
 * import { ClaimReviewRecord } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimReviewRecord)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimReviewRecord extends S.Opaque<ClaimReviewRecord, { readonly brand: unique symbol }>()(
  S.Struct({ claim: ClaimId, at: S.DateTimeUtcFromMillis, review: ReviewState }).pipe(
    $I.annoteSchema("ClaimReviewRecord", {
      description: "Review is joined at read time; it never enters core identity.",
    })
  )
) {}

/**
 * Independent evidence observations recorded for one exact claim at an explicit time.
 *
 * **Example** (Decode ClaimSignalRecord at its boundary)
 *
 * ```ts
 * import { ClaimSignalRecord } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimSignalRecord)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSignalRecord extends S.Opaque<ClaimSignalRecord, { readonly brand: unique symbol }>()(
  S.Struct({ claim: ClaimId, at: S.DateTimeUtcFromMillis, signals: EvidenceSignals }).pipe(
    $I.annoteSchema("ClaimSignalRecord", { description: "Signals remain independent from immutable core identity." })
  )
) {}

/**
 * The native activity and generation end needed to check a core append.
 *
 * **Example** (Decode ClaimGeneration at its boundary)
 *
 * ```ts
 * import { ClaimGeneration } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimGeneration)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimGeneration extends S.Opaque<ClaimGeneration, { readonly brand: unique symbol }>()(
  S.Struct({ claim: ClaimId, activity: ActivityStart, ended: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("ClaimGeneration", {
      description: "Native generation receipt; source activity ids remain separate.",
    })
  )
) {}

/**
 * A separate attack between content-addressed claims; source assertion challenges stay evidence links.
 *
 * **Example** (Decode ClaimChallenge at its boundary)
 *
 * ```ts
 * import { ClaimChallenge } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimChallenge)
 * console.log(typeof decode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimChallenge = core.Challenge;
/**
 * Decoded ClaimChallenge record.
 * @category models
 * @since 0.0.0
 */
export type ClaimChallenge = typeof ClaimChallenge.Type;

/**
 * An explicit direct retraction that leaves the immutable core unchanged.
 *
 * **Example** (Decode ClaimRetraction at its boundary)
 *
 * ```ts
 * import { ClaimRetraction } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimRetraction)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimRetraction extends S.Opaque<ClaimRetraction, { readonly brand: unique symbol }>()(core.Retraction) {}

/**
 * Serialized scoped admission evidence that grants no capability merely by decoding.
 *
 * **Example** (Decode ClaimAdmission at its boundary)
 *
 * ```ts
 * import { ClaimAdmission } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimAdmission)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimAdmission extends S.Opaque<ClaimAdmission, { readonly brand: unique symbol }>()(core.Admission) {}

/**
 * Writable proposed or verbatim events, independent of review acceptance.
 *
 * **Example** (Decode ClaimStance at its boundary)
 *
 * ```ts
 * import { ClaimStance } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimStance)
 * console.log(typeof decode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimStance = core.StanceRecord;
/**
 * Decoded ClaimStance record.
 * @category models
 * @since 0.0.0
 */
export type ClaimStance = typeof ClaimStance.Type;

/**
 * Append-only core history with separate generation, evidence, review and authority event collections.
 *
 * **Example** (Decode ClaimLedger at its boundary)
 *
 * ```ts
 * import { ClaimLedger } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimLedger)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimLedger extends S.Opaque<ClaimLedger, { readonly brand: unique symbol }>()(
  S.Struct({
    claims: S.Array(ClaimRecord).pipe(S.withConstructorDefault(Effect.succeed([]))),
    generations: S.Array(ClaimGeneration).pipe(S.withConstructorDefault(Effect.succeed([]))),
    evidence: S.Array(ClaimEvidenceLinks).pipe(S.withConstructorDefault(Effect.succeed([]))),
    reviews: S.Array(ClaimReviewRecord).pipe(S.withConstructorDefault(Effect.succeed([]))),
    signals: S.Array(ClaimSignalRecord).pipe(S.withConstructorDefault(Effect.succeed([]))),
    challenges: S.Array(ClaimChallenge).pipe(S.withConstructorDefault(Effect.succeed([]))),
    retractions: S.Array(ClaimRetraction).pipe(S.withConstructorDefault(Effect.succeed([]))),
    admissions: S.Array(ClaimAdmission).pipe(S.withConstructorDefault(Effect.succeed([]))),
    stances: S.Array(ClaimStance).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe($I.annoteSchema("ClaimLedger", { description: "Separate immutable records; no claim envelope is stored." }))
) {}

/**
 * A read-time join retaining the core and optional independent observations without inventing status.
 *
 * **Example** (Decode ClaimRead at its boundary)
 *
 * ```ts
 * import { ClaimRead } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimRead)
 * console.log(typeof decode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimRead extends S.Opaque<ClaimRead, { readonly brand: unique symbol }>()(
  S.Struct({
    record: ClaimRecord,
    knowledge: S.OptionFromOptionalKey(ClaimKnowledgeInterval),
    evidence: S.OptionFromOptionalKey(ClaimEvidenceLinks),
    review: S.OptionFromOptionalKey(ClaimReviewRecord),
    signals: S.OptionFromOptionalKey(ClaimSignalRecord),
  }).pipe($I.annoteSchema("ClaimRead", { description: "A transient joined view, never an appendable envelope." }))
) {}

/**
 * Explicit partition, times and review tags used by a joined party read.
 *
 * **Example** (Inspect the required scope)
 *
 * ```ts
 * import { ClaimReadScope } from "@beep/party-domain/Claim"
 * console.log(ClaimReadScope.fields.scope)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimReadScope extends S.Opaque<ClaimReadScope, { readonly brand: unique symbol }>()(
  S.Struct({
    scope: S.NonEmptyString,
    asOf: S.DateTimeUtcFromMillis,
    validAt: S.DateTimeUtcFromMillis,
    states: S.Array(ReviewTag),
  }).pipe($I.annoteSchema("ClaimReadScope", { description: "A caller-selected partition and bitemporal read scope." }))
) {}

/**
 * Structural stream fields accepted by composite ledger snapshots.
 * @category models
 * @since 0.0.0
 */
export type ClaimLedgerData = S.Struct.Type<typeof ClaimLedger.fields>;
