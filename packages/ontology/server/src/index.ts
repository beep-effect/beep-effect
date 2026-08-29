/**
 * Package entry point for `@beep/ontology-server`.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

/**
 * Package version for the ontology server role.
 *
 * **Example** (Read package version)
 *
 * ```ts
 * import { VERSION } from "@beep/ontology-server"
 *
 * const version = VERSION
 *
 * console.log(version === "0.0.0") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Direct Session server namespace export.
 *
 * @category handlers
 * @since 0.0.0
 */
export * as Session from "./aggregates/Session/index.ts";
/**
 * Architecture lab server layer export.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
