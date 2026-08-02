/**
 * Package entry point for `@beep/epistemic-ui`.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */

/**
 * Package version for `@beep/epistemic-ui`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/epistemic-ui"
 *
 * const expectedVersion: typeof VERSION = "0.0.0"
 * const isExpectedVersion = VERSION === expectedVersion
 * console.log(isExpectedVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Contradiction-triage presentation components.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./ContradictionTriage/index.ts";
