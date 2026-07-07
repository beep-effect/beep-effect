/**
 * Shared CLI exit-code sentinel errors.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Effect, Runtime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/ExitCodeError");

// parity fixture: documentation stripped
export class CliReportedExit extends TaggedErrorClass<CliReportedExit>($I`CliReportedExit`)(
  "CliReportedExit",
  {
    message: S.String,
    exitCode: S.Finite,
  },
  $I.annote("CliReportedExit", {
    description: "Silent non-zero process exit requested after command output was rendered.",
  })
) {
  /** Process exit code reported when this sentinel reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode;

  /** Suppress duplicate runtime reporting after command output has already been rendered. */
  override readonly [Runtime.errorReported] = false;
}

// parity fixture: documentation stripped
export const failWithReportedExit = (message: string, exitCode = 1): Effect.Effect<never, CliReportedExit> =>
  Effect.fail(CliReportedExit.make({ message, exitCode }));
