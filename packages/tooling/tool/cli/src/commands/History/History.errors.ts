/**
 * Typed failures of the commit-message overlay commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/History/History.errors");

/**
 * The commit-message map could not be read or does not decode.
 *
 * **Example** (Explain an undecodable map)
 *
 * ```ts
 * import { HistoryMapError } from "@beep/repo-cli/commands/History"
 *
 * const error = HistoryMapError.make({ path: "docs/history/commit-message-map.json", message: "Bad row." })
 * console.log(error.path) // "docs/history/commit-message-map.json"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HistoryMapError extends S.TaggedError<HistoryMapError, { readonly brand: unique symbol }>(
  $I`HistoryMapError`
)(
  "HistoryMapError",
  { path: S.String, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<HistoryMapError>("HistoryMapError", {
    description: "The commit-message map could not be read or does not decode.",
  })
) {}

/**
 * A git read the overlay check depends on failed.
 *
 * **Example** (Explain a failed ancestry read)
 *
 * ```ts
 * import { HistoryGitError } from "@beep/repo-cli/commands/History"
 *
 * const error = HistoryGitError.make({ operation: "rev-list", message: "Cannot list origin/main." })
 * console.log(error.operation) // "rev-list"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HistoryGitError extends S.TaggedError<HistoryGitError, { readonly brand: unique symbol }>(
  $I`HistoryGitError`
)(
  "HistoryGitError",
  { operation: S.String, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<HistoryGitError>("HistoryGitError", {
    description: "A git read the commit-message overlay check depends on failed.",
  })
) {}

/**
 * The overlay check ran and found problems: unreachable map keys, notes
 * drift, or an unpublished ref under `--require-published`.
 *
 * **Example** (Explain a failed check)
 *
 * ```ts
 * import { HistoryNotesCheckError } from "@beep/repo-cli/commands/History"
 *
 * const error = HistoryNotesCheckError.make({ message: "2 notes differ from the map." })
 * console.log(error.message) // "2 notes differ from the map."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HistoryNotesCheckError extends S.TaggedError<HistoryNotesCheckError, { readonly brand: unique symbol }>(
  $I`HistoryNotesCheckError`
)(
  "HistoryNotesCheckError",
  { message: S.String },
  $I.annoteError<HistoryNotesCheckError>("HistoryNotesCheckError", {
    description: "The commit-message overlay check found problems.",
  })
) {}
