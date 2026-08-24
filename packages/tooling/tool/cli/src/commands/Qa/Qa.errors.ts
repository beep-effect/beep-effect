/**
 * Recorded-QA command error types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Qa/Qa.errors");

const QaCommandErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameQaCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("QaCommandError", {
    message: QaCommandErrorFields.message,
  })
);
const sameQaCommandError = (self: QaCommandError, that: QaCommandError): boolean =>
  sameQaCommandErrorFields(self, that);

/**
 * Error raised by `beep qa` capture, extraction, and judge commands.
 *
 * **Example** (Create QA command error)
 *
 * ```ts
 * import { QaCommandError } from "@beep/repo-cli/commands/Qa/index"
 *
 * const error = QaCommandError.make({ message: "No live QA session" })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class QaCommandError extends S.TaggedError<QaCommandError>($I`QaCommandError`)(
  "QaCommandError",
  QaCommandErrorFields,
  $I.annoteClass<S.declare<QaCommandError>, readonly [S.TaggedStruct<"QaCommandError", typeof QaCommandErrorFields>]>(
    "QaCommandError",
    {
      description: "A failure raised while recording, extracting, or judging a QA capture round.",
      toEquivalence: () => sameQaCommandError,
    }
  )
) {
  /**
   * Construct a QA command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): QaCommandError;
    (message: string): (cause: unknown) => QaCommandError;
  } = dual(
    2,
    (cause: unknown, message: string): QaCommandError =>
      QaCommandError.make({
        message,
        cause,
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}
