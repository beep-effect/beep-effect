/**
 * Command-boundary error for the drawings command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { OpaqueDefect } from "../../internal/schema/OpaqueDefect.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.errors");

/**
 * Failure raised while rendering or validating a figure set from the CLI.
 *
 * **Example** (Create a drawings command error)
 *
 * ```ts
 * import { DrawingsCommandError } from "@beep/repo-cli/commands/Drawings"
 *
 * const error = DrawingsCommandError.new(new Error("boom"), "Render failed.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DrawingsCommandError extends S.TaggedError<DrawingsCommandError>($I`DrawingsCommandError`)(
  "DrawingsCommandError",
  {
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<DrawingsCommandError>("DrawingsCommandError", {
    description: "A failure raised while rendering or validating design-figure sheets.",
  })
) {
  /**
   * Construct a drawings command error from an original cause and message.
   *
   * **Example** (Curried form)
   *
   * ```ts
   * import { DrawingsCommandError } from "@beep/repo-cli/commands/Drawings"
   *
   * console.log(DrawingsCommandError.new("Validation failed.")("cause").message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string): DrawingsCommandError;
    (message: string): (cause: unknown) => DrawingsCommandError;
  } = dual(2, (cause: unknown, message: string): DrawingsCommandError => DrawingsCommandError.make({ message, cause }));

  /**
   * Map any error into a {@link DrawingsCommandError} with a message.
   *
   * **Example** (Map an effect's error)
   *
   * ```ts
   * import { DrawingsCommandError } from "@beep/repo-cli/commands/Drawings"
   * import { Effect } from "effect"
   *
   * console.log(Effect.isEffect(Effect.fail("x").pipe(DrawingsCommandError.mapError("failed"))))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}
