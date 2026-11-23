/**
 * Package entry point for `@beep/ontology-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

/**
 * Aggregate namespace exports for the ontology domain package.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.ts";
/**
 * @category aggregates
 * @since 0.0.0
 */
export * as Session from "./aggregates/Session/index.ts";
/**
 * Direct Session model exports for the ontology domain package.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/Session/index.ts";
