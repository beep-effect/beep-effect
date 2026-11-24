/**
 * Tagged errors for the `beep decisions` command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import * as Inspectable from "effect/Inspectable";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Decisions/Decisions.errors");

/**
 * Failure raised when `beep decisions` cannot locate the repository, list the
 * git index or read a tracked file.
 *
 * **Example** (Read a decisions execution error)
 *
 * ```ts
 * import { CodeDecisionsExecutionError } from "@beep/repo-cli/commands/Decisions"
 *
 * const error = CodeDecisionsExecutionError.new("Could not list tracked files.")
 * console.log(error.message) // "Could not list tracked files."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodeDecisionsExecutionError extends S.TaggedError<
  CodeDecisionsExecutionError,
  { readonly brand: unique symbol }
>($I`CodeDecisionsExecutionError`)(
  "CodeDecisionsExecutionError",
  {
    message: S.String,
  },
  $I.annoteError<CodeDecisionsExecutionError>("CodeDecisionsExecutionError", {
    description: "beep decisions could not locate the repository, list the git index or read a tracked file.",
  })
) {
  static readonly new = (message: string): CodeDecisionsExecutionError => CodeDecisionsExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<CodeDecisionsExecutionError, [message: string]>((cause, message) =>
    CodeDecisionsExecutionError.new(`${message}: ${Inspectable.toStringUnknown(cause, 0)}`)
  );
}
