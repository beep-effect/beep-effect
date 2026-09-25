/**
 * Typed reference-workspace boundary failures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Refs/Refs.errors");

/**
 * Retains the path and cause of a failed manifest, filesystem, or process operation.
 *
 * **Example** (Explain a missing reference root)
 * ```ts
 * import { ReferenceWorkspaceError } from "@beep/repo-cli/commands/Refs"
 * ReferenceWorkspaceError.make({ path: "/refs", message: "Reference root is missing." }).path // => "/refs"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ReferenceWorkspaceError extends S.TaggedError<ReferenceWorkspaceError>($I`ReferenceWorkspaceError`)(
  "ReferenceWorkspaceError",
  { path: S.String, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<ReferenceWorkspaceError>("ReferenceWorkspaceError", {
    description: "Reference workspace operation refused or failed.",
  })
) {}
