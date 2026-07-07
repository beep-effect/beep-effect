/**
 * Tagged errors for the Ci command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/Ci.errors");

/**
 * Typed failure for CI helper commands.
 *
 * @example
 * ```ts
 * import { CiCommandError } from "@beep/repo-cli/commands/Ci"
 *
 * const brokenParityFixture: number = "does not compile"
 * const error = CiCommandError.make({ message: "Turbo summary not found" })
 * console.log(error.message) // "Turbo summary not found"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CiCommandError extends TaggedErrorClass<CiCommandError>($I`CiCommandError`)(
  "CiCommandError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("CiCommandError", {
    description: "Failure raised by CI helper commands.",
  })
) {
  /**
   * Construct a CI command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): CiCommandError;
    (message: string): (cause: unknown) => CiCommandError;
  } = dual(2, (cause: unknown, message: string): CiCommandError => CiCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}
