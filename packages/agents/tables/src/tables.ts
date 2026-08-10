/**
 * Agents Drizzle schema aggregate.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as ProviderInstance from "./entities/ProviderInstance/index.ts";

type DbSchemaShape = {
  readonly providerInstance: typeof ProviderInstance.providerInstanceTable;
};

/**
 * Drizzle schema object containing the agents table projections.
 *
 * **Example** (Validate provider instance table name)
 *
 * ```ts
 * import { DbSchema } from "@beep/agents-tables/tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const providerInstanceTableName = getTableName(DbSchema.providerInstance)
 * if (providerInstanceTableName !== "agents_provider_instance") {
 *   throw new Error("unexpected agents schema")
 * }
 *
 * console.log(providerInstanceTableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  providerInstance: ProviderInstance.providerInstanceTable,
};

/**
 * Type-level view of the agents Drizzle schema object.
 *
 * **Example** (Access typed table name)
 *
 * ```ts
 * import { DbSchema, type DbSchema as DbSchemaType } from "@beep/agents-tables/tables"
 *
 * const schema: DbSchemaType = DbSchema
 * const tableName: "agents_provider_instance" = schema.providerInstance.definition.tableName
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
