/**
 * Workspace Turn table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Turn } from "@beep/workspace-domain/entities/Turn";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the workspace Turn entity.
 *
 * **Example** (Table name and storage)
 *
 * ```ts
 * import { Turn } from "@beep/workspace-tables/entities"
 *
 * const tableName = Turn.TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(Turn);

/**
 * Physical Postgres table name derived from the Turn entity.
 *
 * **Example** (Read the table name)
 *
 * ```ts
 * import { TABLE_NAME } from "@beep/workspace-tables/entities/Turn"
 *
 * console.log(TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
