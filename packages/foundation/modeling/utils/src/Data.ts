/**
 * Defines helpers for small immutable data models.
 *
 * This module helps create plain classes, tagged classes, tagged unions, and
 * typed errors with readonly fields. Tagged values carry a `_tag` field, which
 * makes them easy to narrow with pattern matching or simple checks. These
 * helpers are commonly used for domain values and errors in Effect programs.
 *
 * @since 0.0.0
 */

/**
 * Re-exports the `effect/Data` constructors and tagged-value helpers.
 *
 * **Example** (Import the re-exported module)
 *
 * ```ts
 * import * as Data from "@beep/utils/Data"
 *
 * console.log(Data)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "effect/Data";
