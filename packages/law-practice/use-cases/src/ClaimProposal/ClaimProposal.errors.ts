/**
 * Claim proposal refusals: why a proposal path wrote no proposed record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimCoreInvalid } from "@beep/epistemics/ClaimCore";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ClaimProposal/ClaimProposal.errors");

/**
 * Why a proposal path wrote no proposed record: the document failed its
 * checked decode, the support did not verify, or the matter wall denied the
 * scope.
 *
 * **Example** (Refuse a denied scope)
 *
 * ```ts
 * import { ClaimProposalRefused } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * const refused = ClaimProposalRefused.cases.DeniedScope.make({})
 * console.log(refused._tag) // "DeniedScope"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimProposalRefused = S.TaggedUnion({
  InvalidDocument: {},
  SupportUnverified: { reason: ClaimCoreInvalid.fields.reason },
  DeniedScope: {},
}).pipe($I.annoteSchema("ClaimProposalRefused", { description: "Why a proposal path wrote no proposed record." }));

/**
 * @category errors
 * @since 0.0.0
 */
export type ClaimProposalRefused = typeof ClaimProposalRefused.Type;
