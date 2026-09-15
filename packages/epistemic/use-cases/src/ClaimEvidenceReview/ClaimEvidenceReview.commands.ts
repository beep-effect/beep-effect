/**
 * Inputs for explaining and approving an exact claim-evidence basis.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimEvidenceBasis, ClaimEvidenceReview } from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ClaimEvidenceReview/ClaimEvidenceReview.commands");

const ResolvedClaimEvidence = S.Struct({
  basis: ClaimEvidenceBasis,
  currentSource: SourceTextIdentity,
  sourceText: S.String,
});

/**
 * Recheck current source text and explain whether a retained review applies.
 *
 * **Details**
 *
 * `currentSource` is the source identity resolved now by the application.
 * `basis.source` is the identity used to extract the claim. Keeping them
 * separate makes source and extractor drift observable.
 *
 * **Example** (Inspect the current and extracted source boundaries)
 *
 * ```ts
 * import { ExplainClaimEvidence } from "@beep/epistemic-use-cases/ClaimEvidenceReview"
 *
 * console.log(ExplainClaimEvidence.fields.currentSource !== undefined) // true
 * console.log(ExplainClaimEvidence.fields.basis.fields.source !== undefined) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ExplainClaimEvidence extends S.Class<ExplainClaimEvidence>($I`ExplainClaimEvidence`)(
  {
    ...ResolvedClaimEvidence.fields,
    review: S.OptionFromNullOr(ClaimEvidenceReview),
  },
  $I.annote("ExplainClaimEvidence", {
    description: "Resolve exact-source validity and the applicability of a historical human approval.",
  })
) {}

/**
 * Approve one exact basis after verifying its currently resolved source.
 *
 * **Details**
 *
 * The application supplies its authenticated human principal. This portable
 * command is not an authentication boundary and cannot identify a user by itself.
 *
 * **Example** (Inspect the required human reviewer)
 *
 * ```ts
 * import { ApproveClaimEvidence } from "@beep/epistemic-use-cases/ClaimEvidenceReview"
 *
 * console.log(ApproveClaimEvidence.fields.reviewedBy !== undefined) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ApproveClaimEvidence extends S.Class<ApproveClaimEvidence>($I`ApproveClaimEvidence`)(
  {
    ...ResolvedClaimEvidence.fields,
    reviewedBy: UserPrincipal,
  },
  $I.annote("ApproveClaimEvidence", {
    description: "Human approval request bound to the exact assertion, evidence, and source presented.",
  })
) {}
