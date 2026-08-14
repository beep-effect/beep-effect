/**
 * Error representing a file or directory that could not be found.
 *
 * Typically raised when traversing the filesystem for markers like `.git`
 * or `bun.lock` and reaching the root without success, or when an expected
 * file path does not exist on disk.
 *
 * @category error-handling
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("errors/NoSuchFileError");

/**
 * Raised when a required file or directory cannot be located.
 *
 * **Example** (Construct missing file error)
 *
 * ```ts
 * import { NoSuchFileError } from "@beep/repo-utils/errors/NoSuchFileError"
 * const error = NoSuchFileError.make({
 *   message: "Path does not exist",
 *   path: "/missing"
 * })
 * console.log(error.path)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class NoSuchFileError extends S.TaggedError<NoSuchFileError>($I`NoSuchFileError`)(
  "NoSuchFileError",
  {
    path: S.String,
    message: S.String,
  },
  $I.annote("NoSuchFileError", {
    title: "No Such File Error",
    description: "Raised when a required file or directory cannot be located on the filesystem.",
  })
) {}
