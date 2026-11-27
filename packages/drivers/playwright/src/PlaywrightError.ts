/**
 * Typed errors produced when Playwright operations fail.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { errors } from "playwright";

const $I = $PlaywrightId.create("PlaywrightError");

const PlaywrightErrorReasonBase = LiteralKit(["Timeout", "Unknown"]);

/**
 * **Details**
 *
 * Playwright reports little about a failure beyond whether a timeout was
 * reached, so every other failure is grouped under `"Unknown"`.
 *
 * **Example** (Check a failure reason)
 *
 * ```ts import.meta.vitest name="Check a failure reason"
 * import { PlaywrightErrorReason } from "@beep/playwright"
 *
 * PlaywrightErrorReason.is.Timeout("Timeout") // => true
 * PlaywrightErrorReason.is.Timeout("Unknown") // => false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PlaywrightErrorReason = PlaywrightErrorReasonBase.pipe(
  $I.annoteSchema("PlaywrightErrorReason", {
    description: "Why a Playwright operation failed: a timeout was reached, or anything else.",
  }),
  SchemaUtils.withLiteralKitStatics(PlaywrightErrorReasonBase)
);

/**
 * @category errors
 * @since 0.0.0
 */
export type PlaywrightErrorReason = typeof PlaywrightErrorReason.Type;

/**
 * **Example** (Recover from a timeout)
 *
 * ```ts import.meta.vitest name="Recover from a timeout"
 * import { PlaywrightError } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(PlaywrightError.make({ reason: "Timeout", cause: "waited 30s" })).pipe(
 *   Effect.catchTag("PlaywrightError", ({ reason }) => Effect.succeed(reason))
 * )
 * Effect.runSync(outcome) // => "Timeout"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PlaywrightError extends S.TaggedError<PlaywrightError, { readonly brand: unique symbol }>(
  $I`PlaywrightError`
)(
  "PlaywrightError",
  {
    reason: PlaywrightErrorReason.pipe(
      $I.annoteKey("PlaywrightError.reason", {
        description: "Whether the operation timed out or failed for any other reason.",
      })
    ),
    cause: S.Defect({ includeStack: true }).pipe(
      S.overrideToEquivalence(SchemaUtils.alwaysEquivalent),
      $I.annoteKey("PlaywrightError.cause", {
        description: "The value Playwright threw.",
      })
    ),
  },
  $I.annoteError<PlaywrightError>("PlaywrightError", {
    description: "A Playwright operation failed, either by reaching a timeout or for any other reason.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PlaywrightError {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PlaywrightError.Encoded;
}

/**
 * Classifies a value thrown by Playwright as a timeout or an unknown failure.
 *
 * **Example** (Wrap a thrown value)
 *
 * ```ts import.meta.vitest name="Wrap a thrown value"
 * import { wrapError } from "@beep/playwright"
 *
 * wrapError("navigation refused").reason // => "Unknown"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const wrapError = (cause: unknown): PlaywrightError =>
  PlaywrightError.make({ reason: cause instanceof errors.TimeoutError ? "Timeout" : "Unknown", cause });
