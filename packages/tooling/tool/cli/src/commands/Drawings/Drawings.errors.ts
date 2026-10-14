/**
 * Command-boundary error for the drawings command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
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
   * import * as Effect from "effect/Effect";
   * console.log(Effect.isEffect(Effect.fail("x").pipe(DrawingsCommandError.mapError("failed"))))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Why `drawings intake` stopped.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { DrawingIntakeReason } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingIntakeReason.is.refused("refused")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DrawingIntakeReason = LiteralKit(["refused", "not-found", "mail", "io"]).pipe(
  $I.annoteSchema("DrawingIntakeReason", {
    description: "Why a drawing intake stopped: a refused request, a missing item, a mail failure or a file failure.",
  })
);

/**
 * Type for {@link DrawingIntakeReason}.
 *
 * **Example** (Type a reason)
 *
 * ```ts
 * import type { DrawingIntakeReason } from "@beep/repo-cli/commands/Drawings"
 *
 * const reason: DrawingIntakeReason = "not-found"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DrawingIntakeReason = typeof DrawingIntakeReason.Type;

/**
 * Failure raised by the `DrawingIntake` service.
 *
 * **Details**
 *
 * Messages name paths, ids and counts; they never carry message bodies or
 * attachment bytes.
 *
 * **Example** (Refuse a path)
 *
 * ```ts
 * import { DrawingIntakeError } from "@beep/repo-cli/commands/Drawings"
 *
 * const error = DrawingIntakeError.make({ reason: "refused", message: "Outside the corpus root." })
 * console.log(error.reason) // "refused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DrawingIntakeError extends S.TaggedError<DrawingIntakeError>($I`DrawingIntakeError`)(
  "DrawingIntakeError",
  {
    reason: DrawingIntakeReason,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<DrawingIntakeError>("DrawingIntakeError", {
    description: "A failure raised while pulling message attachments into a drawings intake directory.",
  })
) {}
