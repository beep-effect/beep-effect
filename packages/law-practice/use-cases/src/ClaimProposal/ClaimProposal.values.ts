/**
 * Claim proposal request: the annotation document, the proposition and the
 * candidate annotations that support it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnnotationId } from "@beep/annotation/AnnotationId";
import { ExtractionDocument } from "@beep/annotation/Kinds";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { DistinctionProposition } from "@beep/law-practice-domain/values/LawClaim";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ClaimProposal/ClaimProposal.values");

const ProposalCandidates = CanonicalHashSet(AnnotationId).check(
  S.makeFilter(
    (candidates: HashSet.HashSet<AnnotationId>) => HashSet.size(candidates) >= 1,
    $I.annote("ProposalCandidatesNonEmpty", {
      title: "Proposal Candidates",
      description: "A proposal names at least one candidate annotation.",
      message: "Expected at least one candidate annotation.",
    })
  )
);

/**
 * **Details**
 *
 * The document travels in its own encoding and passes the annotation
 * package's checked decode again before anything is proposed, so a forged key
 * is refused as `InvalidDocument`. `candidates` names the annotations whose
 * occurrences support the claim.
 *
 * **Example** (Name the request fields)
 *
 * ```ts
 * import { ClaimProposalRequest } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * console.log(Object.keys(ClaimProposalRequest.fields))
 * // ["document", "proposition", "candidates"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimProposalRequest extends S.Opaque<ClaimProposalRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    document: ExtractionDocument,
    proposition: DistinctionProposition,
    candidates: ProposalCandidates,
  }).pipe(
    $I.annoteSchema("ClaimProposalRequest", {
      description: "A request to propose one distinction claim from the candidate annotations of a document.",
    })
  )
) {}
