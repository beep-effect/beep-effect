/**
 * Failures at the local Codex Security process and artifact boundaries.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { Runtime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Codex/Security.errors");

/**
 * Reports an operator-safe security integration failure without raw scan output.
 *
 * **Details**
 * The message never reproduces bundle content or scanner output. The optional
 * `cause` keeps the original failure for `--json` consumers and debugging
 * without taking part in declared equivalence.
 *
 * **Example** (Reporting incomplete coverage)
 * ```ts import.meta.vitest name="Reporting incomplete coverage"
 * import { CodexSecurityError } from "@beep/repo-cli/commands/Codex/Security.errors"
 * import * as Runtime from "effect/Runtime"
 * const error = CodexSecurityError.make({ message: "Scan coverage is partial." })
 * error.message // => "Scan coverage is partial."
 * error[Runtime.errorExitCode] // => 2
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CodexSecurityError extends S.TaggedError<CodexSecurityError>($I`CodexSecurityError`)(
  "CodexSecurityError",
  {
    message: S.String,
    exitCode: S.optionalKey(S.Int),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<CodexSecurityError>("CodexSecurityError", {
    description: "Safe failure from a local security scan or bundle import.",
  })
) {
  /** Preserve the scanner's policy or incomplete-coverage exit code. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 2;
}

const isCodexSecurityError = S.is(CodexSecurityError);

/**
 * Translates a foreign failure into a safe `CodexSecurityError` while keeping
 * an existing one untouched.
 *
 * **Details**
 * Used as the trailing `Effect.mapError` of every Security pipeline. The
 * original error travels as `cause`; the operator-facing message is fixed and
 * never interpolates captured values.
 *
 * **Example** (Wrapping a decode failure)
 * ```ts import.meta.vitest name="Wrapping a decode failure"
 * import { CodexSecurityError, toCodexSecurityError } from "@beep/repo-cli/commands/Codex/Security.errors"
 * const wrapped = toCodexSecurityError("Bundle rejected.")(new Error("boom"))
 * wrapped.message // => "Bundle rejected."
 * const kept = toCodexSecurityError("Bundle rejected.")(CodexSecurityError.make({ message: "Original." }))
 * kept.message // => "Original."
 * ```
 * @param message - Safe message used when the failure is not already a `CodexSecurityError`.
 * @returns Mapper suitable for `Effect.mapError`.
 * @category errors
 * @since 0.0.0
 */
export const toCodexSecurityError =
  (message: string) =>
  (error: unknown): CodexSecurityError =>
    isCodexSecurityError(error) ? error : CodexSecurityError.make({ message, cause: error });
