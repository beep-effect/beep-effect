/**
 * Typed technical errors for the PDF tools driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PdfToolsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $PdfToolsId.create("PdfTools.errors");
const PdfToolsErrorReasonBase = LiteralKit(["invalid-request", "tool-unavailable", "tool-failed", "parse", "io"]);

/**
 * Technical PDF tools failure reasons.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { PdfToolsErrorReason } from "@beep/pdf-tools"
 *
 * console.log(PdfToolsErrorReason.literals)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PdfToolsErrorReason = PdfToolsErrorReasonBase.pipe(
  $I.annoteSchema("PdfToolsErrorReason", {
    description: "Where a PDF tools call failed: request validation, a missing or failing tool, parsing, or file I/O.",
  }),
  SchemaUtils.withLiteralKitStatics(PdfToolsErrorReasonBase)
);

/**
 * Type for {@link PdfToolsErrorReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { PdfToolsErrorReason } from "@beep/pdf-tools"
 *
 * const reason: PdfToolsErrorReason = "tool-failed"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PdfToolsErrorReason = typeof PdfToolsErrorReason.Type;

// shared error-boundary idiom; no in-family home, future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared error-boundary idiom; no in-family home, future foundation capability candidate
const causeText = (cause: unknown): O.Option<string> =>
  P.isString(cause) ? O.some(cause) : P.isError(cause) ? O.some(cause.message) : O.none();

const isPdfToolsError = (cause: unknown): cause is PdfToolsError => S.is(PdfToolsError)(cause);

/**
 * Technical failure raised inside the PDF tools driver boundary.
 *
 * **Example** (Create an error from an unknown cause)
 *
 * ```ts
 * import { PdfToolsError } from "@beep/pdf-tools"
 *
 * const error = PdfToolsError.fromUnknown("tool-failed", "rsvg-convert exited 1.", "stderr text")
 * console.log(error.reason, error.cause)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PdfToolsError extends S.TaggedError<PdfToolsError>($I`PdfToolsError`)(
  "PdfToolsError",
  {
    reason: PdfToolsErrorReason.annotateKey({ description: "Where the call failed." }),
    message: S.NonEmptyString.annotateKey({ description: "Operator-facing description of the failure." }),
    cause: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Tool stderr, parser message, or validation issue when available." })
    ),
  },
  $I.annote("PdfToolsError", {
    description: "Typed technical failure from the PDF tools driver.",
  })
) {
  /**
   * Build an error from a thrown value, tool output, or schema issue. A thrown
   * {@link PdfToolsError} passes through unchanged.
   *
   * **Example** (Wrap a parser message)
   *
   * ```ts
   * import { PdfToolsError } from "@beep/pdf-tools"
   *
   * console.log(PdfToolsError.fromUnknown("parse", "Bad PPM header.", new Error("P6 expected")).cause)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (reason: PdfToolsErrorReason, message: string, cause: unknown): PdfToolsError =>
    isPdfToolsError(cause) ? cause : PdfToolsError.make({ reason, message, cause: causeText(cause) });
}
