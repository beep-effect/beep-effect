/**
 * Typed errors raised by the `@beep/qa-capture` pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { Defect, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $QaCaptureId.create("QaCapture.errors");
const QaCaptureDefect = Defect({ includeStack: true });
const isQaCaptureDefect = S.is(QaCaptureDefect);
type QaCaptureErrorContextInput = {
  readonly cause?: unknown;
  readonly path?: string;
};

const causeFromUnknown = (cause: unknown): O.Option<typeof QaCaptureDefect.Type> =>
  P.hasInspectableObjectShape(cause) && isQaCaptureDefect(cause) ? O.some(cause) : O.none();

const existingQaCaptureError = (cause: unknown): O.Option<QaCaptureError> =>
  QaCaptureError.is(cause) ? O.some(cause) : O.none();

/**
 * Technical failure raised by the `@beep/qa-capture` pipeline boundary.
 *
 * **Example** (Make error with operation)
 *
 * ```ts
 * import { QaCaptureError } from "@beep/qa-capture"
 * const error = QaCaptureError.make({ message: "collector failed to bind", operation: "collectorServe" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QaCaptureError extends S.TaggedError<QaCaptureError>($I`QaCaptureError`)(
  "QaCaptureError",
  {
    cause: S.OptionFromOptionalKey(QaCaptureDefect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("QaCaptureError.cause", {
        description: "Inspectable originating defect, when available.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("QaCaptureError.message", {
        description: "Human-readable QA capture failure summary.",
      })
    ),
    operation: S.String.pipe(
      $I.annoteKey("QaCaptureError.operation", {
        description: "Pipeline operation that emitted the failure.",
      })
    ),
    path: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("QaCaptureError.path", {
        description: "File-system path involved in the failure, when available.",
      })
    ),
  },
  $I.annoteError<QaCaptureError>("QaCaptureError", {
    description: "Technical QA capture failure scoped to a pipeline operation.",
  })
) {
  static readonly is = S.is(QaCaptureError);

  /**
   * Normalize an unknown platform failure into a {@link QaCaptureError}.
   *
   * **Example** (Normalize unknown with cause)
   *
   * ```ts
   * import { QaCaptureError } from "@beep/qa-capture"
   * const error = QaCaptureError.fromUnknown("sessionStore", "could not read session.json", {
   *   cause: new Error("boom")
   * })
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: string, message: string, options: QaCaptureErrorContextInput): QaCaptureError;
    (message: string, options: QaCaptureErrorContextInput): (operation: string) => QaCaptureError;
  } = dual(
    3,
    (operation: string, message: string, options: QaCaptureErrorContextInput): QaCaptureError =>
      O.getOrElse(existingQaCaptureError(options.cause), () =>
        QaCaptureError.make({
          cause: causeFromUnknown(options.cause),
          message,
          operation,
          path: O.fromUndefinedOr(options.path),
        })
      )
  );
}
