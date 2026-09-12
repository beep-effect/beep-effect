/**
 * Typed failures for Graft cache validation, filesystem, and refresh operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as S from "effect/Schema";
import { GraftDeepRefreshPhase } from "./Graft.schemas.ts";

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

/**
 * Refuses to start a refresh while another run holds the lock.
 *
 * **Details**
 *
 * A lock whose holder process is gone is replaced instead of reported, so this
 * failure always names a process that was alive when the lock was inspected.
 *
 * **Example** (Name the run holding the lock)
 *
 * ```ts import.meta.vitest name="Name the run holding the lock"
 * import { GraftDeepLockError } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftDeepLockError.make({ path: "/state/refresh.lock", holderPid: 4321 }).holderPid)
 * // 4321
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftDeepLockError extends S.TaggedError<GraftDeepLockError>($I`GraftDeepLockError`)(
  "GraftDeepLockError",
  { path: S.String, holderPid: S.Int, cause: S.optionalKey(Defect({ includeStack: true })) },
  $I.annoteError<GraftDeepLockError>("GraftDeepLockError", {
    description: "Refresh lock is held by a live process.",
  })
) {}

/**
 * Rejects an owner clone or operator environment a refresh must not touch.
 *
 * **Details**
 *
 * Preflight refuses before any Git or Graft work, so a rejected run leaves the
 * owner clone exactly as it found it.
 *
 * **Example** (Explain a dirty owner clone)
 *
 * ```ts import.meta.vitest name="Explain a dirty owner clone"
 * import { GraftDeepPreflightError } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftDeepPreflightError.make({ path: "/clones/a", message: "Working tree is dirty." })._tag)
 * // "GraftDeepPreflightError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftDeepPreflightError extends S.TaggedError<GraftDeepPreflightError>($I`GraftDeepPreflightError`)(
  "GraftDeepPreflightError",
  { path: S.String, message: S.String, cause: S.optionalKey(Defect({ includeStack: true })) },
  $I.annoteError<GraftDeepPreflightError>("GraftDeepPreflightError", {
    description: "Owner clone or operator environment is unfit for a refresh.",
  })
) {}

/**
 * Retains the phase, exit code, and log of a refresh step that failed.
 *
 * **Details**
 *
 * The log path is the run log the captured output was appended to, so the
 * operator never has to reproduce the step to read what it printed.
 *
 * **Example** (Point at the failing phase and log)
 *
 * ```ts import.meta.vitest name="Point at the failing phase and log"
 * import { GraftDeepStepError } from "@beep/repo-cli/commands/Graft"
 * const error = GraftDeepStepError.make({
 *   step: "build",
 *   exitCode: 1,
 *   log: "/state/beep-graft/runs/20260911T023000Z.log",
 *   message: "graft build --deep exited with 1.",
 * })
 * console.log(error.step) // build
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraftDeepStepError extends S.TaggedError<GraftDeepStepError>($I`GraftDeepStepError`)(
  "GraftDeepStepError",
  {
    step: GraftDeepRefreshPhase,
    exitCode: S.Int,
    log: S.String,
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<GraftDeepStepError>("GraftDeepStepError", {
    description: "A refresh step refused to spawn, timed out, or exited non-zero.",
  })
) {}
