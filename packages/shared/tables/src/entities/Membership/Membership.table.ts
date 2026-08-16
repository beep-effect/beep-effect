/**
 * Shared-kernel membership table metadata projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Membership } from "@beep/shared-domain/entities";

/**
 * Postgres Drizzle table metadata for shared organization memberships.
 *
 * **Details**
 *
 * The table is projected directly from `Membership.Model` and preserves its
 * schema-colocated SQL metadata.
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
export const Table = toPgTable(Membership.Model);
