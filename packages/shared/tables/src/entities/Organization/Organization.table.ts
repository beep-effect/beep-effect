/**
 * Shared-kernel organization table metadata projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Organization } from "@beep/shared-domain/entities";

/**
 * Postgres Drizzle table metadata for tenant organizations.
 *
 * **Details**
 *
 * The table is projected from `Organization.Model`, including the unique slug
 * index and license-tier lookup metadata defined in the shared domain entity.
 *
 * **Example** (Inspect organization table name)
 *
 * ```ts
 * import { getTableConfig } from "drizzle-orm/pg-core"
 * import { Organization } from "@beep/shared-tables/entities"
 *
 * const config = getTableConfig(Organization.Table)
 *
 * console.log(config.name) // "shared_organization"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Organization.Model);
