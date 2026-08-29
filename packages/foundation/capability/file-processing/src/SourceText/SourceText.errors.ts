/**
 * Canonical source-text failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { Defect, LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $FileProcessingId.create("SourceText");

/**
 * Failure reasons exposed by source-text resolution and paging.
 *
 * **Example** (Check reason membership)
 *
 * ```ts import.meta.vitest name="Check reason membership"
 * import { SourceTextResolverErrorReason } from "@beep/file-processing/SourceText"
 *
 * SourceTextResolverErrorReason.is["source-digest-mismatch"]("source-digest-mismatch") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceTextResolverErrorReason = LiteralKit([
  "scope-unavailable",
  "locator-invalid",
  "source-unavailable",
  "source-digest-mismatch",
  "extractor-unavailable",
  "extraction-failed",
  "text-unavailable",
  "text-digest-mismatch",
  "page-out-of-range",
]).pipe(
  $I.annoteSchema("SourceTextResolverErrorReason", {
    description: "Fail-closed reasons emitted while resolving or paging canonical source text.",
  })
);

/**
 * Type for {@link SourceTextResolverErrorReason}.
 *
 * **Example** (Type a failure reason)
 *
 * ```ts
 * import type { SourceTextResolverErrorReason } from "@beep/file-processing/SourceText"
 *
 * const reason: SourceTextResolverErrorReason = "locator-invalid"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type SourceTextResolverErrorReason = typeof SourceTextResolverErrorReason.Type;

/**
 * Typed, fail-closed source-text resolution failure.
 *
 * **Example** (Create source-unavailable error)
 *
 * ```ts import.meta.vitest name="Create source-unavailable error"
 * import { SourceTextResolverError } from "@beep/file-processing/SourceText"
 *
 * const error = SourceTextResolverError.new("source-unavailable", "The source file could not be read.")
 * error.reason // => "source-unavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SourceTextResolverError extends S.TaggedError<SourceTextResolverError>($I`SourceTextResolverError`)(
  "SourceTextResolverError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })),
    message: S.NonEmptyString,
    reason: SourceTextResolverErrorReason,
  },
  $I.annoteError<SourceTextResolverError>("SourceTextResolverError", {
    description: "Typed, fail-closed failure emitted by canonical source-text resolution or paging.",
  })
) {
  /**
   * Construct a source-text resolver failure.
   *
   * **Example** (Create page-out-of-range error)
   *
   * ```ts import.meta.vitest name="Create page-out-of-range error"
   * import { SourceTextResolverError } from "@beep/file-processing/SourceText"
   *
   * const error = SourceTextResolverError.new("page-out-of-range", "Page 2 does not exist.")
   * error._tag // => "SourceTextResolverError"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (
    reason: SourceTextResolverErrorReason,
    message: string,
    cause?: unknown
  ): SourceTextResolverError =>
    SourceTextResolverError.make({
      cause: O.fromUndefinedOr(cause),
      message,
      reason,
    });
}
