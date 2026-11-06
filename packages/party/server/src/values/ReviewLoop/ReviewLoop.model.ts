/**
 * Evidence-bound review cases, decisions and application results.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidInterval } from "@beep/epistemics/ValidInterval";
import { $PartyServerId } from "@beep/identity/packages";
import { ClaimVersion, SourceAssertion } from "@beep/party-domain/Claim";
import { ActivityId, Digest, IdentifierId, PrincipalId } from "@beep/party-domain/Ids";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { ResolutionScope } from "@beep/party-domain/Resolution";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { CollisionOutcome } from "../IdentityEvidence/IdentityEvidence.model.ts";
import { NameShape, ObservedSpan, OrgLead } from "../OrgEvidence/OrgEvidence.model.ts";

const $I = $PartyServerId.create("values/ReviewLoop/ReviewLoop.model");

/**
 * A reviewer-visible mailbox attached to an existing integer party anchor.
 * **Example** (Decode CaseMailbox)
 * ```ts
 * import { CaseMailbox } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CaseMailbox)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CaseMailbox extends S.Opaque<CaseMailbox, { readonly brand: unique symbol }>()(
  S.Struct({
    party: PartyId,
    identifiers: S.NonEmptyArray(IdentifierId),
    domains: S.Array(S.String),
    span: S.OptionFromNullOr(ObservedSpan),
  }).pipe(
    $I.annoteSchema("CaseMailbox", {
      description: "A reviewer-visible mailbox attached to an existing integer party anchor.",
    })
  )
) {}

/**
 * The exact evidence presented for an identity collision.
 * **Example** (Decode CaseEvidence)
 * ```ts
 * import { CaseEvidence } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CaseEvidence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CaseEvidence extends S.Opaque<CaseEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    shape: NameShape,
    outcome: CollisionOutcome,
    orgLead: OrgLead,
    mailboxes: S.NonEmptyArray(CaseMailbox),
  })
    .check(
      S.makeFilter(
        (value) => A.length(A.dedupe(A.map(value.mailboxes, (mailbox) => mailbox.party))) === A.length(value.mailboxes),
        $I.annote("UniqueCaseParties", { message: "Each case mailbox must have a distinct party anchor." })
      )
    )
    .pipe($I.annoteSchema("CaseEvidence", { description: "The exact evidence presented for an identity collision." }))
) {}

/**
 * A collision case bound to its canonical evidence digest.
 * **Example** (Decode CollisionCase)
 * ```ts
 * import { CollisionCase } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollisionCase)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CollisionCase extends S.Opaque<CollisionCase, { readonly brand: unique symbol }>()(
  S.Struct({ evidence: CaseEvidence, basis: Digest }).pipe(
    $I.annoteSchema("CollisionCase", { description: "A collision case bound to its canonical evidence digest." })
  )
) {}

/**
 * A complete grouping of case parties or an explicit skip.
 * **Example** (Decode ReviewVerdict)
 * ```ts
 * import { ReviewVerdict } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewVerdict)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ReviewVerdict = S.TaggedUnion({
  Grouped: {
    groups: PartyId.pipe(S.NonEmptyArray, S.NonEmptyArray).check(
      S.makeFilter(
        (groups) => A.length(A.dedupe(A.flatten(groups))) === A.length(A.flatten(groups)),
        $I.annote("DisjointReviewGroups", { message: "A party may appear in only one review group." })
      )
    ),
  },
  Skip: {},
}).pipe($I.annoteSchema("ReviewVerdict", { description: "Partition of the current case parties, or skip." }));
/**
 * Decoded review verdict.
 * @category models
 * @since 0.0.0
 */
export type ReviewVerdict = typeof ReviewVerdict.Type;

/**
 * A sourced reviewer decision bound to an evidence digest and explicit validity.
 * **Example** (Decode CollisionDecision)
 * ```ts
 * import { CollisionDecision } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollisionDecision)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CollisionDecision extends S.Opaque<CollisionDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    verdict: ReviewVerdict,
    basis: Digest,
    reviewer: PrincipalId,
    reviewedAt: S.DateTimeUtcFromMillis,
    note: S.String,
    validity: ValidInterval,
    producedBy: ActivityId,
    anchor: EvidenceAnchor,
  }).pipe(
    $I.annoteSchema("CollisionDecision", {
      description: "A sourced reviewer decision bound to an evidence digest and explicit validity.",
    })
  )
) {}

/**
 * Disposition of a review in the current evidence and query scope.
 * **Example** (Decode ReviewStatus)
 * ```ts
 * import { ReviewStatus } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewStatus)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ReviewStatus = LiteralKit([
  "reviewed-same",
  "reviewed-distinct",
  "reviewed-grouped",
  "conflicting-review",
  "invalid-decision",
  "skipped",
  "stale-review",
  "unreviewed",
  "out-of-scope",
]).pipe($I.annoteSchema("ReviewStatus", { description: "Review queue status in a specific resolution scope." }));
/**
 * Decoded review status.
 * @category models
 * @since 0.0.0
 */
export type ReviewStatus = typeof ReviewStatus.Type;

/**
 * A current sealed case and the decision proposed for it.
 * **Example** (Decode DecisionClaimsInput)
 * ```ts
 * import { DecisionClaimsInput } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DecisionClaimsInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DecisionClaimsInput extends S.Opaque<DecisionClaimsInput, { readonly brand: unique symbol }>()(
  S.Struct({ case: CollisionCase, decision: CollisionDecision }).pipe(
    $I.annoteSchema("DecisionClaimsInput", { description: "A current sealed case and the decision proposed for it." })
  )
) {}

/**
 * Source assertions and accepted versions from a validated reviewer decision.
 * **Example** (Decode ReviewEvidence)
 * ```ts
 * import { ReviewEvidence } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewEvidence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReviewEvidence extends S.Opaque<ReviewEvidence, { readonly brand: unique symbol }>()(
  S.Struct({ assertions: S.Array(SourceAssertion), versions: S.Array(ClaimVersion) }).pipe(
    $I.annoteSchema("ReviewEvidence", {
      description: "Source assertions and accepted versions from a validated reviewer decision.",
    })
  )
) {}

/**
 * Current cases, recorded decisions and the bitemporal scope to evaluate.
 * **Example** (Decode ReviewInput)
 * ```ts
 * import { ReviewInput } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReviewInput extends S.Opaque<ReviewInput, { readonly brand: unique symbol }>()(
  S.Struct({ cases: S.Array(CollisionCase), decisions: S.Array(CollisionDecision), scope: ResolutionScope }).pipe(
    $I.annoteSchema("ReviewInput", {
      description: "Current cases, recorded decisions and the bitemporal scope to evaluate.",
    })
  )
) {}

/**
 * One case status and evidence emitted only when its decision settles.
 * **Example** (Decode ReviewApplication)
 * ```ts
 * import { ReviewApplication } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewApplication)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReviewApplication extends S.Opaque<ReviewApplication, { readonly brand: unique symbol }>()(
  S.Struct({
    case: CollisionCase,
    status: ReviewStatus,
    decision: S.OptionFromNullOr(CollisionDecision),
    evidence: ReviewEvidence,
  }).pipe(
    $I.annoteSchema("ReviewApplication", {
      description: "One case status and evidence emitted only when its decision settles.",
    })
  )
) {}

/**
 * A decision rejected before any accepted claim or source assertion is emitted.
 * **Example** (Report an invalid partition)
 * ```ts
 * import { ReviewDecisionError } from "@beep/party-server/ReviewLoop"
 * ReviewDecisionError.make({ reason: "invalid-partition" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ReviewDecisionError extends S.TaggedError<ReviewDecisionError, { readonly brand: unique symbol }>(
  $I`ReviewDecisionError`
)(
  "ReviewDecisionError",
  { reason: S.Literals(["tampered-case", "stale-basis", "invalid-partition"]) },
  $I.annoteError<ReviewDecisionError>("ReviewDecisionError", {
    description: "Decision does not match the sealed current evidence.",
  })
) {}

/**
 * Canonical identifier references used to allocate a provisional mailbox anchor.
 * **Example** (Decode MailboxAnchorInput)
 * ```ts
 * import { MailboxAnchorInput } from "@beep/party-server/ReviewLoop"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MailboxAnchorInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MailboxAnchorInput extends S.Opaque<MailboxAnchorInput, { readonly brand: unique symbol }>()(
  S.Struct({ identifiers: S.NonEmptyArray(IdentifierId) }).pipe(
    $I.annoteSchema("MailboxAnchorInput", {
      description: "Identifiers for an ingestion anchor, not proof of personal identity.",
    })
  )
) {}
