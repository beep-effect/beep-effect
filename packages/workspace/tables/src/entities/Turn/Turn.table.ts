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
 * const tableName: "workspace_turn" = Turn.TABLE_NAME
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
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
