/**
 * App-local helpers for turning unknown failure causes into user-facing text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";

/**
 * Best-effort human-readable message from an unknown failure cause, falling
 * back to `fallback` when no non-empty `message` string can be read: a real
 * `Error` with a non-empty message, then any object carrying a non-empty
 * `message` string, otherwise `fallback`.
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
 * @category utils
 * @since 0.0.0
 */
export const failureMessageOr =
  (fallback: string) =>
  (cause: unknown): string =>
    P.isError(cause) && cause.message.length > 0
      ? cause.message
      : P.isObject(cause) && P.hasProperty(cause, "message") && P.isString(cause.message) && cause.message.length > 0
        ? cause.message
        : fallback;
