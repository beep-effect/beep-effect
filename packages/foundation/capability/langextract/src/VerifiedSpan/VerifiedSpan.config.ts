/**
 * Verified-span normalization contract version and defensive bounds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Version of the locator-only normalization contract implemented here.
 *
 * **Example** (Log normalization version constant)
 *
 * ```ts import.meta.vitest name="Log normalization version constant"
 * import { VERIFIED_SPAN_NORMALIZATION_VERSION } from "@beep/langextract/VerifiedSpan"
 *
 * VERIFIED_SPAN_NORMALIZATION_VERSION // => "1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERIFIED_SPAN_NORMALIZATION_VERSION = "1";

/**
 * Maximum source-text length accepted by strict locator mapping.
 *
 * **Details**
 *
 * Longer sources fail closed as `limit-exceeded` before normalization runs, so
 * unbounded documents can never occupy the per-code-unit offset maps.
 *
 * **Example** (Log the source text bound)
 *
 * ```ts import.meta.vitest name="Log the source text bound"
 * import { MAX_SOURCE_TEXT_LENGTH } from "@beep/langextract/VerifiedSpan"
 *
 * MAX_SOURCE_TEXT_LENGTH // => 1000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_SOURCE_TEXT_LENGTH = 1_000_000;

/**
 * Maximum locator length accepted by strict locator mapping.
 *
 * **Details**
 *
 * Longer locators fail closed as `limit-exceeded` before any raw or
 * normalized search runs.
 *
 * **Example** (Log the locator bound)
 *
 * ```ts import.meta.vitest name="Log the locator bound"
 * import { MAX_LOCATOR_LENGTH } from "@beep/langextract/VerifiedSpan"
 *
 * MAX_LOCATOR_LENGTH // => 4096
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LOCATOR_LENGTH = 4_096;
