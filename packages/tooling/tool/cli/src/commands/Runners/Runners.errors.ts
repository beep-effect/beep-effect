/**
 * Typed runner bake failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { commandErrorFields } from "../../internal/cli/CommandErrorFields.ts";

const $I = $RepoCliId.create("commands/Runners/Runners.errors");

// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameRunnersCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("RunnersCommandError", {
    message: commandErrorFields.message,
    command: commandErrorFields.command,
    exitCode: commandErrorFields.exitCode,
  })
);
const sameRunnersCommandError = (self: RunnersCommandError, that: RunnersCommandError): boolean =>
  sameRunnersCommandErrorFields(self, that);

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
export class RunnersCommandError extends S.TaggedError<RunnersCommandError>($I`RunnersCommandError`)(
  "RunnersCommandError",
  commandErrorFields,
  $I.annoteClass<
    S.declare<RunnersCommandError>,
    readonly [S.TaggedStruct<"RunnersCommandError", typeof commandErrorFields>]
  >("RunnersCommandError", {
    description: "Failure raised by the runner AMI bake command family.",
    toEquivalence: () => sameRunnersCommandError,
  })
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
   * **Example** (Wrap a boundary failure)
   *
   * ```ts
   * import { RunnersCommandError } from "@beep/repo-cli/commands/Runners"
   *
   * const error = RunnersCommandError.new("aws unavailable")("Unable to reach AWS.")
   * console.log(error.message) // "Unable to reach AWS."
   * ```
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
   * **Example** (Create an Effect error mapper)
   *
   * ```ts
   * import { RunnersCommandError } from "@beep/repo-cli/commands/Runners"
   * import { Effect } from "effect"
   *
   * const program = Effect.fail("aws unavailable").pipe(
   *   RunnersCommandError.mapError("Unable to reach AWS."),
   * )
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}
