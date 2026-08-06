/**
 * App-local helpers for turning unknown failure causes into user-facing text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { redactCauseForClient } from "@beep/observability";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("lib/failureMessage");

const MessageBearing = S.Struct({ message: S.NonEmptyString }).pipe(
  $I.annoteSchema("MessageBearing", {
    description: "Any failure object carrying a non-empty user-facing message string.",
  })
);

const hasMessage = S.is(MessageBearing);

/**
 * Best-effort human-readable message from an unknown failure cause, falling
 * back to `fallback` when no non-empty `message` string can be read: any
 * object carrying a non-empty `message` string (including `Error`s) yields
 * its redacted message, otherwise `fallback`.
 *
 * @example
 * ```ts
 * import { failureMessageOr } from "@/lib/failureMessage"
 *
 * const orDefault = failureMessageOr("Something went wrong.")
 * console.log(orDefault(new Error("boom"))) // "boom"
 * console.log(orDefault({})) // "Something went wrong."
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const failureMessageOr =
  (fallback: string) =>
  (cause: unknown): string =>
    hasMessage(cause) ? redactCauseForClient(cause).message : fallback;
