/**
 * Workspace Thread table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Thread } from "@beep/workspace-domain/entities/Thread";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the workspace Thread entity.
 *
 * **Example** (Table name and storage)
 *
 * ```ts
 * import { Thread } from "@beep/workspace-tables/entities"
 *
 * const tableName = Thread.TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(Thread);

/**
 * Physical Postgres table name derived from the Thread entity.
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
