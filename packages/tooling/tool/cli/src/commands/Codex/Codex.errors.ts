/**
 * Tagged errors for the Codex command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Codex/Codex.errors");

type CodexCommandErrorOptions =
  | undefined
  | {
      readonly exitCode?: undefined | number;
    };

/**
 * Typed failure for Codex helper commands.
 *
 * **Example** (Construct Codex command error)
 *
 * ```ts
 * import { CodexCommandError } from "@beep/repo-cli/commands/Codex"
 * const error = new CodexCommandError({ message: "failed" })
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodexCommandError extends S.TaggedError<CodexCommandError>($I`CodexCommandError`)(
  "CodexCommandError",
  {
    message: S.String,
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<CodexCommandError>("CodexCommandError", {
    description: "Failure raised by Codex helper commands.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a Codex command error from an original cause and options.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: CodexCommandErrorOptions): CodexCommandError;
    (message: string, opts?: CodexCommandErrorOptions): (cause: unknown) => CodexCommandError;
  } = dual(
    3,
    (cause: unknown, message: string, { exitCode } = {}): CodexCommandError =>
      CodexCommandError.make({
        cause,
        message,
        ...O.getSomesStruct({ exitCode: O.fromUndefinedOr(exitCode) }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}
