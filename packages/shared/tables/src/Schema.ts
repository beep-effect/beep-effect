/**
 * Aggregate Drizzle schema metadata exported by the shared tables package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Membership, Organization, User } from "./entities/index.ts";

type DbSchemaShape = {
  readonly membership: typeof Membership.Table;
  readonly organization: typeof Organization.Table;
  readonly user: typeof User.Table;
};

/**
 * Metadata-only Drizzle schema aggregate for shared product tables.
 *
 * **Details**
 *
 * This aggregate is intended for callers that need the shared table set as one
 * object, such as Drizzle schema wiring. It does not create a connection,
 * repository, migration, or query executor.
 *
 * **Example** (List shared table names)
 *
 * ```ts
 * import { getTableConfig } from "drizzle-orm/pg-core"
 * import { DbSchema } from "@beep/shared-tables/Schema"
 *
 * const tableNames = [
 *   getTableConfig(DbSchema.membership).name,
 *   getTableConfig(DbSchema.organization).name,
 *   getTableConfig(DbSchema.user).name
 * ]
 *
 * console.log(tableNames.join(", "))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  organization: Organization.Table,
  membership: Membership.Table,
  user: User.Table,
};

/**
 * Type contract for the shared Drizzle schema aggregate.
 *
 * **Example** (Satisfy DbSchema type contract)
 *
 * ```ts
 * import { getTableConfig } from "drizzle-orm/pg-core"
 * import { DbSchema } from "@beep/shared-tables/Schema"
 * import type { DbSchema as DbSchemaContract } from "@beep/shared-tables/Schema"
 *
 * const schema = DbSchema satisfies DbSchemaContract
 *
 * console.log(getTableConfig(schema.organization).name)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
