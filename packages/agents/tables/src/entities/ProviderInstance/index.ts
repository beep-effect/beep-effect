/**
 * Agents ProviderInstance table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ProviderInstance row converter exports.
 *
 * **Example** (Import insert converter)
 *
 * ```ts
 * import * as ProviderInstance from "@beep/agents-tables/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.toProviderInstanceInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ProviderInstance.converters.ts";
/**
 * ProviderInstance table exports.
 *
 * **Example** (Access table entity type)
 *
 * ```ts
 * import * as ProviderInstance from "@beep/agents-tables/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.providerInstanceTable.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ProviderInstance.table.ts";
