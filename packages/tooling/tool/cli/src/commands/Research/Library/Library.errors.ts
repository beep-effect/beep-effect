/**
 * Typed research library failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Research/Library/Library.errors");
/**
 * Failure at a library I/O or validation boundary.
 * **Example** (Make a failure)
 * ```ts
 * import { LibraryError } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryError.make({ message: "Locked", cause: "writer active" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryError extends S.TaggedError<LibraryError>($I`LibraryError`)(
  "LibraryError",
  {
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("LibraryError", { description: "Failure at a research library boundary." })
) {}
