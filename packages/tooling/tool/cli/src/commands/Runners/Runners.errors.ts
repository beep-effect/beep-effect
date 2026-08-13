/**
 * Typed runner bake failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Runners/Runners.errors");

/**
 * Operational failure raised while planning, checking, or baking a runner AMI.
 *
 * **Example** (Create a runner bake error)
 *
 * ```ts
 * import { RunnersCommandError } from "@beep/repo-cli/commands/Runners"
 *
 * const error = RunnersCommandError.make({ message: "aws failed", exitCode: 1 })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RunnersCommandError extends TaggedErrorClass<RunnersCommandError>($I`RunnersCommandError`)(
  "RunnersCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("RunnersCommandError", { description: "Failure raised by the runner AMI bake command family." })
) {
  /**
   * Exit status returned when the error reaches the CLI runtime.
   *
   * @category errors
   * @since 0.0.0
   */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a runner error from an unknown boundary cause.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string): RunnersCommandError;
    (message: string): (cause: unknown) => RunnersCommandError;
  } = dual(2, (cause: unknown, message: string) => RunnersCommandError.make({ cause, message }));

  /**
   * Map an unknown boundary cause into a runner bake error.
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}
