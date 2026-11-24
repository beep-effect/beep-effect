/**
 * Typed failures of the claim-element decomposer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.errors");

/**
 * Closed reasons a claim cannot be decomposed into a claim-element tree.
 *
 * **Details**
 *
 * - `claim-not-in-claims`: the claim's number is not one of the claims it was
 *   given as context, so its dependency chain cannot be read;
 * - `unsupported-claim-text`: the claim text has no segmentable structure the
 *   decomposer can anchor elements to;
 * - `incoherent-tree`: the decomposed elements and edges fail the
 *   `ClaimElementTree` coherence check.
 *
 * Phrasing that no antecedent rule covers is not a decomposition failure; it
 * surfaces later as a `pattern-not-covered` finding.
 *
 * **Example** (Inspect decomposition reasons)
 *
 * ```ts
 * import { ClaimDecompositionReason } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimDecompositionReason.is["incoherent-tree"]("incoherent-tree")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimDecompositionReason = LiteralKit([
  "claim-not-in-claims",
  "unsupported-claim-text",
  "incoherent-tree",
]).pipe(
  $I.annoteSchema("ClaimDecompositionReason", {
    description: "Missing claim context, unsegmentable claim text, or an incoherent decomposed tree.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ClaimDecompositionReason = typeof ClaimDecompositionReason.Type;

/**
 * **Example** (Construct a missing-context failure)
 *
 * ```ts
 * import { ClaimDecompositionError } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const error = ClaimDecompositionError.make({
 *   claimNumber: 4,
 *   message: "Claim 4 is not among the claims supplied as context.",
 *   reason: "claim-not-in-claims"
 * })
 * console.log(error.reason) // "claim-not-in-claims"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimDecompositionError extends S.TaggedError<ClaimDecompositionError, { readonly brand: unique symbol }>(
  $I`ClaimDecompositionError`
)(
  "ClaimDecompositionError",
  {
    claimNumber: PosInt.annotateKey({
      description: "Number of the claim that could not be decomposed.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Actionable explanation of why the claim could not be decomposed.",
    }),
    reason: ClaimDecompositionReason.annotateKey({
      description: "Closed decomposition failure category suitable for exhaustive handling.",
    }),
  },
  $I.annoteError<ClaimDecompositionError>("ClaimDecompositionError", {
    description: "Typed failure raised while decomposing one patent claim into a claim-element tree.",
  })
) {}
