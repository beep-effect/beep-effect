/**
 * Cache command error shared by the cache tool and the task runners that
 * route ordinary Turbo steps through the cache runtime.
 *
 * **Details**
 *
 * Split from `Cache.schemas.ts` so the quality task runner and CI lanes carry
 * the cache error channel without importing the cache tool's schemas
 * (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.errors");

/**
 * Cache command failure safe to render at the CLI boundary.
 *
 * **Example** (Create a typed command failure)
 *
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheCommandError.make({ message: "cache probe failed" })._tag) // "CacheCommandError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CacheCommandError extends S.TaggedError<CacheCommandError, { readonly brand: unique symbol }>(
  $I`CacheCommandError`
)(
  "CacheCommandError",
  { message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<CacheCommandError>("CacheCommandError", {
    description: "A cache command precondition or subprocess failure.",
  })
) {
  /**
   * Map an unknown failure into a cache command error.
   *
   * @param message - Human-readable failure context.
   * @param cause - Optional underlying failure.
   * @returns A typed cache command error.
   */
  static readonly new = (message: string, cause?: unknown): CacheCommandError =>
    cause === undefined ? CacheCommandError.make({ message }) : CacheCommandError.make({ message, cause });

  /**
   * Map an Effect error into a cache command error with context.
   *
   * @param message - Human-readable failure context.
   * @returns A transform mapping an Effect error into a cache command error.
   */
  static readonly mapError =
    (message: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.mapError((cause) => (isCacheCommandError(cause) ? cause : CacheCommandError.new(message, cause)))
      );
}

const isCacheCommandError = S.is(CacheCommandError);
