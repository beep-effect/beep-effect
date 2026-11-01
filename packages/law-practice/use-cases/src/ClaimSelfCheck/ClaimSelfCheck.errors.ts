/**
 * Typed failures of the claim self-check: the USPTO claims port failure and
 * the self-check action failure it is translated into.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../internal/PosInt.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimSelfCheck.errors");

/**
 * Closed reasons the USPTO claims port can fail.
 *
 * **Details**
 *
 * - `not-found`: no record or document matches the requested source;
 * - `no-full-text-claims`: the record has claims only as OCR text, which the
 *   adapter excludes rather than repairs;
 * - `malformed-claims`: the full-text claims do not normalize into a valid
 *   patent claim set;
 * - `unavailable`: the USPTO service could not be reached or answered with an
 *   error.
 *
 * **Example** (Inspect port failure reasons)
 *
 * ```ts
 * import { UsptoClaimsFailureReason } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(UsptoClaimsFailureReason.is["no-full-text-claims"]("no-full-text-claims")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const UsptoClaimsFailureReason = LiteralKit([
  "not-found",
  "no-full-text-claims",
  "malformed-claims",
  "unavailable",
]).pipe(
  $I.annoteSchema("UsptoClaimsFailureReason", {
    description: "Missing record, OCR-only claims, unnormalizable claims, or an unreachable USPTO service.",
  })
);

/**
 * Runtime reason type produced by {@link UsptoClaimsFailureReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UsptoClaimsFailureReason = typeof UsptoClaimsFailureReason.Type;

/**
 * Port failure of the USPTO claims port; server-only.
 *
 * **Details**
 *
 * The server adapter translates every `@beep/uspto` driver error into this
 * failure; driver errors never cross the port. `ClaimSelfCheck` translates it
 * in turn into {@link ClaimSelfCheckError}.
 *
 * **Example** (Make an OCR-only failure)
 *
 * ```ts
 * import { UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const error = UsptoClaimsError.make({
 *   message: "Application 16138242 has OCR-only claims.",
 *   reason: "no-full-text-claims"
 * })
 * console.log(error.reason) // "no-full-text-claims"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UsptoClaimsError extends S.TaggedError<UsptoClaimsError, { readonly brand: unique symbol }>(
  $I`UsptoClaimsError`
)(
  "UsptoClaimsError",
  {
    message: S.NonEmptyString.annotateKey({
      description: "Short technical explanation of the port failure; never claim content.",
    }),
    reason: UsptoClaimsFailureReason.annotateKey({
      description: "Closed port failure category suitable for exhaustive handling.",
    }),
  },
  $I.annoteError<UsptoClaimsError>("UsptoClaimsError", {
    description: "Failure of the USPTO claims port to return full-text public claims.",
  })
) {}

/**
 * Closed reasons a claim self-check can fail.
 *
 * **Details**
 *
 * - `decomposition-failed`: no claim of the set could be decomposed into a
 *   tree (a single undecomposable claim is reported in the report instead);
 * - `public-claims-unavailable`: the USPTO claims port failed;
 * - `candidate-mapping-failed`: a finding could not be located in the source
 *   text or rejected by the epistemic entity schemas.
 *
 * Antecedent findings are never failures: they are advisory results.
 *
 * **Example** (Inspect self-check failure reasons)
 *
 * ```ts
 * import { ClaimSelfCheckFailureReason } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(ClaimSelfCheckFailureReason.is["decomposition-failed"]("decomposition-failed")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimSelfCheckFailureReason = LiteralKit([
  "decomposition-failed",
  "public-claims-unavailable",
  "candidate-mapping-failed",
  "review-response-too-large",
]).pipe(
  $I.annoteSchema("ClaimSelfCheckFailureReason", {
    description:
      "No decomposable claim, unavailable public claims, failed candidate mapping, or an oversized review response.",
  })
);

/**
 * Runtime reason type produced by {@link ClaimSelfCheckFailureReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSelfCheckFailureReason = typeof ClaimSelfCheckFailureReason.Type;

/**
 * Action failure of the `ClaimSelfCheck` service.
 *
 * **Details**
 *
 * The service translates the port's {@link UsptoClaimsError}, and the domain
 * `ClaimDecompositionError` when no claim of the set decomposes, into this
 * one failure, carrying the original as `cause` for diagnostics only.
 * `claimNumber` names the claim when the failure belongs to one, such as a
 * finding that could not become a candidate.
 *
 * **Example** (Make a decomposition failure)
 *
 * ```ts
 * import { ClaimSelfCheckError } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const error = ClaimSelfCheckError.make({
 *   message: "No claim of the set could be decomposed.",
 *   reason: "decomposition-failed"
 * })
 * console.log(error._tag) // "ClaimSelfCheckError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimSelfCheckError extends S.TaggedError<ClaimSelfCheckError, { readonly brand: unique symbol }>(
  $I`ClaimSelfCheckError`
)(
  "ClaimSelfCheckError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    claimNumber: S.optionalKey(PosInt).annotateKey({
      description: "Claim the failure belongs to, when it belongs to one.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Actionable explanation of the failed self-check.",
    }),
    reason: ClaimSelfCheckFailureReason.annotateKey({
      description: "Closed self-check failure category suitable for exhaustive handling.",
    }),
  },
  $I.annoteError<ClaimSelfCheckError>("ClaimSelfCheckError", {
    description: "Failure decomposing, fetching, or mapping claims during an antecedent self-check.",
  })
) {}
