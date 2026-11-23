/**
 * Package entry point for `@beep/agents-tables`.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Agents entity table metadata namespaces.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { Entities } from "@beep/agents-tables"
 *
 * console.log(Entities.ProviderInstance.PROVIDER_INSTANCE_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * @category tables
 * @since 0.0.0
 */
export * from "./tables.ts";
