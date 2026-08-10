/**
 * Shared-kernel user table metadata projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { User } from "@beep/shared-domain/entities";

/**
 * Postgres Drizzle table metadata for shared human user accounts.
 *
 * **Details**
 *
 * The table is projected from `User.Model`, so the Drizzle table and
 * `Table.definition` stay aligned with the shared-domain account entity.
 *
 * **Example** (Inspect user table name)
 *
 * ```ts
 * import { getTableConfig } from "drizzle-orm/pg-core"
 * import { User } from "@beep/shared-tables/entities"
 *
 * const config = getTableConfig(User.Table)
 *
 * console.log(config.name) // "shared_user"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(User.Model);
