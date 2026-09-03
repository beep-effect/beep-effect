/**
 * App-local helpers for turning unknown failure causes into user-facing text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { redactCauseForClient } from "@beep/observability/CauseRedaction";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("lib/failureMessage");

const MessageBearing = S.Struct({ message: S.NonEmptyString }).pipe(
  $I.annoteSchema("MessageBearing", {
    description: "Any failure object carrying a non-empty user-facing message string.",
  })
);

const isMessageBearing = S.is(MessageBearing);

// Struct parsing reads fields with own-property semantics (`Object.hasOwn`), but
// the failures that reach this boundary carry `message` on the prototype: every
// `Error` subclass that overrides `get message()`, and Effect's own
// `SchemaError` / `PlatformError` / `Config.Error`. Projecting the own-or-
// inherited read into a fresh carrier keeps the schema as the message contract
// without losing those causes to the fallback.
const hasMessage = (cause: unknown): boolean =>
  P.isObject(cause) && isMessageBearing({ message: Reflect.get(cause, "message") });

/**
 * Best-effort human-readable message from an unknown failure cause, falling
 * back to `fallback` when no non-empty `message` string can be read: any
 * non-array object whose own or inherited `message` is a non-empty string —
 * plain shapes, `Error`s, and prototype-getter errors such as Effect's
 * `SchemaError` — yields its redacted message, otherwise `fallback`.
 *
 * **Example** (Render an unknown failure)
 *
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
