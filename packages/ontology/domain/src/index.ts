/**
 * Package entry point for `@beep/ontology-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

/**
 * Package version for the ontology domain role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/ontology-domain"
 *
 * const expectedVersion: typeof VERSION = "0.0.0"
 * const isExpectedVersion = VERSION === expectedVersion
 *
 * console.log(isExpectedVersion)
 *
 * if (VERSION !== expectedVersion) {
 *   throw new Error("unexpected ontology domain version")
 * }
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Aggregate namespace exports for the ontology domain package.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.js";
/**
 * Direct Session aggregate namespace export.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Session from "./aggregates/Session/index.js";
/**
 * Direct Session model exports for the ontology domain package.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/Session/index.js";
