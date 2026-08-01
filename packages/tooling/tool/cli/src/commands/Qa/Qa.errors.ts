/**
 * Recorded-QA command error types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Qa/Qa.errors");

/**
 * Error raised by `beep qa` capture, extraction, and judge commands.
 *
 * @example
 * ```ts
 * import { QaCommandError } from "@beep/repo-cli/commands/Qa/index"
 *
 * const error = QaCommandError.make({ message: "No live QA session" })
 * console.log(error.message)
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class QaCommandError extends TaggedErrorClass<QaCommandError>($I`QaCommandError`)(
  "QaCommandError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("QaCommandError", {
    description: "A failure raised while recording, extracting, or judging a QA capture round.",
  })
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
