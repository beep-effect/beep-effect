/**
 * Party-owned binding of the shared epistemic claim envelope.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimEnvelope, ValidTime } from "@beep/epistemics/Claim";
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ActivityId, AssertionId, ClaimVersionId, PrincipalId } from "../../Ids.ts";
import { logicalKey, Proposition } from "../../Proposition.ts";
import { EvidenceAnchor } from "../../Provenance.ts";

const envelope = makeClaimEnvelope({
  $I: $PartyDomainId.create("values/Claim/Claim.model"),
  proposition: Proposition,
  logicalKey,
  ids: {
    claimVersion: ClaimVersionId,
    assertion: AssertionId,
    activity: ActivityId,
    principal: PrincipalId,
  },
});

/**
 * Immutable party assertion version with evidence, review and two time axes.
 *
 * **Example** (Decode at the ledger boundary)
 *
 * ```ts
 * import { ClaimVersion } from "@beep/party-domain/Claim"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ClaimVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimVersion extends S.Opaque<ClaimVersion, { readonly brand: unique symbol }>()(envelope.ClaimVersion) {}

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
  envelope.EvidenceSignals
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
export const ReviewState = envelope.ReviewState;
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
    $PartyDomainId.create("values/Claim/Claim.model").annoteSchema("SourceAssertion", {
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
  envelope.DependenceAssessment
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
  envelope.ReviewerDisposition
) {}
