/**
 * Package entry point for `@beep/ontology-client`.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */

/**
 * Package version for `@beep/ontology-client`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/ontology-client"
 *
 * console.log(VERSION)
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Session client atoms for the ontology workbench.
 *
 * @category atoms
 * @since 0.0.0
 */
export * from "./aggregates/Session/index.ts";
