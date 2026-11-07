/**
 * Typed GitHub command boundary failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Github/Github.errors");

/**
 * A GitHub command could not read its policy data or start its loopback server.
 *
 * **Details**
 *
 * The message never carries credential material; secrets stay inside the
 * registration callback and the `op` process's stdin.
 *
 * **Example** (Explain an unreadable manifest)
 *
 * ```ts
 * import { GithubCommandError } from "@beep/repo-cli/commands/Github"
 *
 * const error = GithubCommandError.make({ path: "manifest.json", message: "Cannot read the App manifest." })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GithubCommandError extends S.TaggedError<GithubCommandError, { readonly brand: unique symbol }>(
  $I`GithubCommandError`
)(
  "GithubCommandError",
  { path: S.String, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<GithubCommandError>("GithubCommandError", {
    description: "A GitHub command could not read its policy data or start its loopback server.",
  })
) {}
