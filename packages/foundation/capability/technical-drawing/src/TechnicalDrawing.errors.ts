/**
 * Typed errors for the technical-drawing capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $TechnicalDrawingId.create("TechnicalDrawing.errors");
const DrawingErrorReasonBase = LiteralKit(["spec", "geometry", "projection", "omission", "pdf", "io"]);

/**
 * Where a drawing operation failed.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { DrawingErrorReason } from "@beep/technical-drawing"
 *
 * console.log(DrawingErrorReason.literals)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DrawingErrorReason = DrawingErrorReasonBase.pipe(
  $I.annoteSchema("DrawingErrorReason", {
    description:
      "Failure site: spec decoding, geometry engine, projection, an omission claim that the render disproved, the PDF backend, or file I/O.",
  }),
  SchemaUtils.withLiteralKitStatics(DrawingErrorReasonBase)
);

/**
 * Type for {@link DrawingErrorReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { DrawingErrorReason } from "@beep/technical-drawing"
 *
 * const reason: DrawingErrorReason = "omission"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DrawingErrorReason = typeof DrawingErrorReason.Type;

// shared error-boundary idiom; no in-family home, future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared error-boundary idiom; no in-family home, future foundation capability candidate
const causeText = (cause: unknown): O.Option<string> =>
  P.isString(cause) ? O.some(cause) : P.isError(cause) ? O.some(cause.message) : O.none();

const isDrawingError = (cause: unknown): cause is DrawingError => S.is(DrawingError)(cause);

/**
 * Failure raised by the technical-drawing capability.
 *
 * **Example** (Create an error from an unknown cause)
 *
 * ```ts
 * import { DrawingError } from "@beep/technical-drawing"
 *
 * const error = DrawingError.fromUnknown("pdf", "Conversion failed.", new Error("rsvg"))
 * console.log(error.reason, error.cause)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DrawingError extends S.TaggedError<DrawingError>($I`DrawingError`)(
  "DrawingError",
  {
    reason: DrawingErrorReason.annotateKey({ description: "Where the operation failed." }),
    message: S.NonEmptyString.annotateKey({ description: "Operator-facing description." }),
    cause: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Underlying engine, backend, or validation message when available." })
    ),
  },
  $I.annote("DrawingError", {
    description: "Typed failure from the technical-drawing capability.",
  })
) {
  /**
   * Build an error from a thrown value, port error, or schema issue. A thrown
   * {@link DrawingError} passes through unchanged.
   *
   * **Example** (Wrap a port error)
   *
   * ```ts
   * import { DrawingError } from "@beep/technical-drawing"
   *
   * console.log(DrawingError.fromUnknown("projection", "HLR failed.", "kernel message").cause)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (reason: DrawingErrorReason, message: string, cause: unknown): DrawingError =>
    isDrawingError(cause) ? cause : DrawingError.make({ reason, message, cause: causeText(cause) });
}
