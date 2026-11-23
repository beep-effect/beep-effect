/**
 * Agents ProviderInstance table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
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
 * **Example** (Import converter error)
 *
 * ```ts
 * import * as ProviderInstance from "@beep/agents-tables/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.ProviderInstanceConverterError._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./ProviderInstance.errors.ts";
/**
 * **Example** (Access table entity type)
 *
 * ```ts
 * import * as ProviderInstance from "@beep/agents-tables/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.PROVIDER_INSTANCE_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./ProviderInstance.table.ts";
