/**
 * Package entry point for `@beep/agents-tables`.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Package version for `@beep/agents-tables`.
 *
 * @category tables
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Agents entity table metadata namespaces.
 *
 * @example
 * ```ts
 * import { Entities } from "@beep/agents-tables"
 *
 * console.log(Entities.ProviderInstance.providerInstanceTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Table collection exports.
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./tables.js";
