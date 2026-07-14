/**
 * Agents entity table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ProviderInstance table metadata namespace.
 *
 * @example
 * ```ts
 * import { ProviderInstance } from "@beep/agents-tables/entities"
 *
 * console.log(ProviderInstance.providerInstanceTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as ProviderInstance from "./ProviderInstance/index.ts";
