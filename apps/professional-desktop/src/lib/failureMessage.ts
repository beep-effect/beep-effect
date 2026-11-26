/**
 * App-local helpers for turning unknown failure causes into user-facing text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { redactCauseForClient } from "@beep/observability/CauseRedaction";
import { EffectFailure } from "@xstate/effect";
import * as Cause from "effect/Cause";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("lib/failureMessage");

const MessageBearing = S.Struct({ message: S.NonEmptyString }).pipe(
  $I.annoteSchema("MessageBearing", {
    description: "Any failure object carrying a non-empty user-facing message string.",
  })
);

const isMessageBearing = S.is(MessageBearing);

const hasMessage = (cause: unknown): boolean =>
  P.isObject(cause) && isMessageBearing({ message: Reflect.get(cause, "message") });

const squashEffectActorFailure = (cause: unknown): unknown =>
  EffectFailure.is(cause) ? Cause.squash(cause.cause) : cause;

/**
 * Best-effort human-readable message from an unknown failure cause, falling
 * back to `fallback` when no non-empty `message` string can be read: any
 * non-array object whose own or inherited `message` is a non-empty string —
 * plain shapes, `Error`s, and prototype-getter errors such as Effect's
 * `SchemaError` — yields its redacted message, otherwise `fallback`.
 *
 * **Details**
 *
 * An `EffectFailure` from an `@xstate/effect` actor is unwrapped first, so the
 * message comes from the failure it carries rather than from its rendered
 * cause.
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
  (cause: unknown): string => {
    const failure = squashEffectActorFailure(cause);
    return hasMessage(failure) ? redactCauseForClient(failure).message : fallback;
  };
