/**
 * ProviderInstance table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainProviderInstance from "@beep/agents-domain/entities/ProviderInstance";
import { EntityTable } from "@beep/drizzle";

/**
 * Drizzle table projection for agents ProviderInstance entities.
 *
 * The projected row carries instance metadata (label, kind, binary/HOME
 * paths, token-safe env vars) and the latest auth-probe snapshot — never
 * provider tokens.
 *
 * @example
 * ```ts
 * import { providerInstanceTable } from "@beep/agents-tables/entities/ProviderInstance"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(providerInstanceTable)
 * const tableName = getTableName(providerInstanceTable)
 * if (tableName !== "agents_provider_instance" || columns.binaryPath.name !== "binary_path") {
 *   throw new Error("unexpected ProviderInstance table projection")
 * }
 *
 * console.log(`${tableName}:${columns.binaryPath.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const providerInstanceTable = EntityTable.pgTableFrom(DomainProviderInstance.ProviderInstance);

/**
 * Physical Postgres table name derived from the ProviderInstance entity
 * definition.
 *
 * @example
 * ```ts
 * import { PROVIDER_INSTANCE_TABLE_NAME } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * const tableName = PROVIDER_INSTANCE_TABLE_NAME
 * if (tableName !== "agents_provider_instance") {
 *   throw new Error("unexpected ProviderInstance table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const PROVIDER_INSTANCE_TABLE_NAME = providerInstanceTable.definition.tableName;
