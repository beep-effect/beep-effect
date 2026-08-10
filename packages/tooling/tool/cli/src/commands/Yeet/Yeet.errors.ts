/**
 * Tagged errors for the Yeet command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/Yeet.errors");

type YeetCommandErrorOptions =
  | undefined
  | {
      readonly command?: string;
      readonly exitCode?: number;
      readonly file?: string;
    };

/**
 * Operational error raised by the yeet command.
 *
 * **Example** (Make yeet command error)
 *
 * ```ts
 * import { YeetCommandError } from "@beep/repo-cli/commands/Yeet"
 *
 * const error = YeetCommandError.make({ message: "failed" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class YeetCommandError extends TaggedErrorClass<YeetCommandError>($I`YeetCommandError`)(
  "YeetCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    file: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("YeetCommandError", {
    description: "Failure raised while planning or executing a yeet run.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a yeet command error from a cause and optional command context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: YeetCommandErrorOptions): YeetCommandError;
    (message: string, opts?: YeetCommandErrorOptions): (cause: unknown) => YeetCommandError;
  } = dual(
    3,
    (cause: unknown, message: string, { command, exitCode, file } = {}): YeetCommandError =>
      YeetCommandError.make({
        cause,
        message,
        ...O.getSomesStruct({
          command: O.fromUndefinedOr(command),
          exitCode: O.fromUndefinedOr(exitCode),
          file: O.fromUndefinedOr(file),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}
