/**
 * Typed failures of failure-preserving claim inspection.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimInspection.errors");
const failureReason = LiteralKit([
  "public-source-unavailable",
  "response-too-large",
  "response-encoding-failed",
  "invalid-cursor",
]).pipe(
  $I.annoteSchema("ClaimInspectionFailureReason", {
    description:
      "Source acquisition failed, or the complete response cannot be encoded or delivered within its size limit.",
  })
);

/**
 * Acquisition or response failure; per-record uncertainty remains in successful reports.
 *
 * **Example** (Construct a response-size failure)
 * ```ts
 * import { ClaimInspectionError } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(ClaimInspectionError.make({ reason: "response-too-large", message: "The complete report exceeds 1 MiB." }).reason) // response-too-large
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ClaimInspectionError extends S.TaggedError<ClaimInspectionError, { readonly brand: unique symbol }>(
  $I`ClaimInspectionError`
)(
  "ClaimInspectionError",
  {
    reason: failureReason,
    message: S.NonEmptyString,
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
  },
  $I.annoteError<ClaimInspectionError>("ClaimInspectionError", {
    description: "Failure acquiring public source records or delivering the complete advisory inspection response.",
  })
) {}
