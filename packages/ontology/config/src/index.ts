/**
 * Package entry point for `@beep/ontology-config`.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

/**
 * Package version for `@beep/ontology-config`.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/ontology-config"
 *
 * const isInitialVersion = VERSION === "0.0.0"
 * console.log(isInitialVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Browser-safe public configuration exports.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./public.ts";
