/**
 * ProviderInstance table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainProviderInstance from "@beep/agents-domain/entities/ProviderInstance";
import { toPgTable } from "@beep/effect-drizzle/pg";
import { getTableName } from "drizzle-orm";

/**
 * Drizzle table projection for agents ProviderInstance entities.
 *
 * **Details**
 *
 * The projected row carries instance metadata (label, kind, binary/HOME
 * paths, token-safe env vars) and the latest auth-probe snapshot — never
 * provider tokens.
 *
 * **Example** (Validate table projection shape)
 *
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
export const providerInstanceTable = toPgTable(DomainProviderInstance.ProviderInstance);

/**
 * Physical Postgres table name derived from the ProviderInstance entity
 * definition.
 *
 * **Example** (Validate physical table name)
 *
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
export const PROVIDER_INSTANCE_TABLE_NAME = getTableName(providerInstanceTable);
