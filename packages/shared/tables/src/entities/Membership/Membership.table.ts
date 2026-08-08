/**
 * Shared-kernel membership table metadata projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Membership } from "@beep/shared-domain/entities";

/**
 * Postgres Drizzle table metadata for shared organization memberships.
 *
 * **Details**
 *
 * The table is projected from `Membership.Model`, preserving the shared-domain
 * entity definition on `Table.definition` for schema and index inspection.
 *
 * **Example** (Inspect membership table name)
 *
 * ```ts
 * import { getTableConfig } from "drizzle-orm/pg-core"
 * import { Membership } from "@beep/shared-tables/entities"
 *
 * const config = getTableConfig(Membership.Table)
 *
 * console.log(config.name) // "shared_membership"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Membership.Model);
