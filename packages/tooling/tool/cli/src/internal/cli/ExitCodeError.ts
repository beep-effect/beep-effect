/**
 * Shared CLI exit-code sentinel errors.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { P } from "@beep/utils";
import { Effect, Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/ExitCodeError");

const CliReportedExitFields = {
  message: S.String,
  exitCode: S.Finite,
} satisfies S.Struct.Fields;
const sameCliReportedExitFields = S.toEquivalence(S.TaggedStruct("CliReportedExit", CliReportedExitFields));
const sameCliReportedExit = (self: CliReportedExit, that: CliReportedExit): boolean =>
  sameCliReportedExitFields(self, that);

/**
 * Silent non-zero process exit requested after command output was rendered.
 *
 * **Example** (Make CliReportedExit instance)
 *
 * ```ts
 * import { CliReportedExit } from "@beep/repo-cli/internal/cli/ExitCodeError"
 *
 * const error = CliReportedExit.make({ message: "check failed", exitCode: 1 })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CliReportedExit extends S.TaggedError<CliReportedExit>($I`CliReportedExit`)(
  "CliReportedExit",
  CliReportedExitFields,
  $I.annoteClass<
    S.declare<CliReportedExit>,
    readonly [S.TaggedStruct<"CliReportedExit", typeof CliReportedExitFields>]
  >("CliReportedExit", {
    description: "Silent non-zero process exit requested after command output was rendered.",
    toEquivalence: () => sameCliReportedExit,
  })
) {
  /** Process exit code reported when this sentinel reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode;

  /** Suppress duplicate runtime reporting after command output has already been rendered. */
  override readonly [Runtime.errorReported] = false;
}

/**
 * Fail with a reported CLI exit sentinel.
 *
 * **Example** (Create reported exit Effect)
 *
 * ```ts
 * import { failWithReportedExit } from "@beep/repo-cli/internal/cli/ExitCodeError"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(failWithReportedExit("check failed")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const failWithReportedExit: {
  (exitCode?: number): (message: string) => Effect.Effect<never, CliReportedExit>;
  (message: string, exitCode?: number): Effect.Effect<never, CliReportedExit>;
} = dual(
  (args: IArguments) => P.isString(args[0]),
  (message: string, exitCode = 1): Effect.Effect<never, CliReportedExit> =>
    Effect.fail(CliReportedExit.make({ message, exitCode }))
);
