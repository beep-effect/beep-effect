/**
 * Typed failures for Graft cache validation and filesystem operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Graft/Graft.errors");

/**
 * Rejects a source clone that cannot supply a safe meaning tier.
 *
 * **Details**
 *
 * A missing summaries cache is fatal even if concept or wiring files exist.
 *
 * **Example** (Explain a missing meaning tier)
 *
 * ```ts import.meta.vitest name="Explain a missing meaning tier"
 * import { GraftCacheSourceError } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftCacheSourceError.make({ path: "/clones/a", message: "Missing summaries.json" })._tag)
 * // "GraftCacheSourceError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftCacheSourceError extends S.TaggedError<GraftCacheSourceError>($I`GraftCacheSourceError`)(
  "GraftCacheSourceError",
  { path: S.String, message: S.String, cause: S.optionalKey(Defect({ includeStack: true })) },
  $I.annoteError<GraftCacheSourceError>("GraftCacheSourceError", {
    description: "Invalid or unreadable source meaning tier.",
  })
) {}

/**
 * Rejects unsafe destinations, stale plans, or conflicting target flags.
 *
 * **Details**
 *
 * The command prints planned refusals before failing with this error.
 *
 * **Example** (Explain a target refusal)
 *
 * ```ts import.meta.vitest name="Explain a target refusal"
 * import { GraftCacheTargetError } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftCacheTargetError.make({ path: "/clones/a", message: "Source is also a target" }).path)
 * // "/clones/a"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftCacheTargetError extends S.TaggedError<GraftCacheTargetError>($I`GraftCacheTargetError`)(
  "GraftCacheTargetError",
  { path: S.String, message: S.String, cause: S.optionalKey(Defect({ includeStack: true })) },
  $I.annoteError<GraftCacheTargetError>("GraftCacheTargetError", {
    description: "Unsafe target selection or stale sync plan.",
  })
) {}

/**
 * Retains the cause of a failed filesystem operation or report encoding.
 *
 * **Details**
 *
 * The path identifies the failed operation; partial application is never reported as success.
 *
 * **Example** (Attach an encoding failure)
 *
 * ```ts import.meta.vitest name="Attach an encoding failure"
 * import { GraftCacheIoError } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftCacheIoError.make({ path: "/clones/a", message: "Encoding failed", cause: "invalid count" })._tag)
 * // "GraftCacheIoError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftCacheIoError extends S.TaggedError<GraftCacheIoError>($I`GraftCacheIoError`)(
  "GraftCacheIoError",
  { path: S.String, message: S.String, cause: Defect({ includeStack: true }) },
  $I.annoteError<GraftCacheIoError>("GraftCacheIoError", {
    description: "Filesystem or schema encoding failure during cache sync.",
  })
) {}
