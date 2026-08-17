/**
 * Agents entity table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ProviderInstance table metadata namespace.
 *
 * **Example** (Log ProviderInstance table name)
 *
 * ```ts
 * import { ProviderInstance } from "@beep/agents-tables/entities"
 *
 * console.log(ProviderInstance.PROVIDER_INSTANCE_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as ProviderInstance from "./ProviderInstance/index.ts";
