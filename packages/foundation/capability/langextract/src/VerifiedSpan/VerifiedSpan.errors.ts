/**
 * Typed fail-closed errors for strict locator-to-raw-source mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("VerifiedSpan");

/**
 * Machine-readable strict-span mapping failures.
 *
 * **Example** (Check error reason membership)
 *
 * ```ts
 * import { VerifiedSpanErrorReason } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(VerifiedSpanErrorReason.is.ambiguous("ambiguous")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VerifiedSpanErrorReason = LiteralKit([
  "absent-text",
  "ambiguous",
  "invalid-offset",
  "limit-exceeded",
  "malformed-source",
  "not-found",
]).pipe(
  $I.annoteSchema("VerifiedSpanErrorReason", {
    description: "Fail-closed reasons emitted by strict locator-to-raw-source mapping.",
  })
);

/**
 * Type for {@link VerifiedSpanErrorReason}.
 *
 * **Example** (Annotate error reason type)
 *
 * ```ts
 * import type { VerifiedSpanErrorReason } from "@beep/langextract/VerifiedSpan"
 *
 * const reason: VerifiedSpanErrorReason = "not-found"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VerifiedSpanErrorReason = typeof VerifiedSpanErrorReason.Type;

/**
 * Sanitized strict-span mapping failure.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { VerifiedSpanError } from "@beep/langextract/VerifiedSpan"
 *
 * console.log(VerifiedSpanError.fromReason("ambiguous").reason) // "ambiguous"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerifiedSpanError extends TaggedErrorClass<VerifiedSpanError>($I`VerifiedSpanError`)(
  "VerifiedSpanError",
  {
    candidateIndex: S.optionalKey(NonNegativeInt),
    message: S.String,
    reason: VerifiedSpanErrorReason,
  },
  $I.annote("VerifiedSpanError", {
    description: "Sanitized failure from bounded strict source-text reconstruction or locator mapping.",
  })
) {
  /**
   * Construct a failure without retaining raw source or locator text.
   *
   * @param reason - Machine-readable closed-failure reason.
   * @param candidateIndex - Optional index into a direct `GroundedExtraction[]` input.
   * @returns A sanitized verified-span error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: VerifiedSpanErrorReason, candidateIndex?: NonNegativeInt): VerifiedSpanError =>
    VerifiedSpanError.make({
      ...O.getSomesStruct({
        candidateIndex: O.fromUndefinedOr(candidateIndex),
      }),
      message: `Verified span rejected: ${reason}.`,
      reason,
    });
}
