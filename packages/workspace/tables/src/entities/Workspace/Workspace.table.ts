/**
 * Workspace table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Workspace } from "@beep/workspace-domain/entities/Workspace";
import { getTableName } from "drizzle-orm";

/**
 * Workspace persistence table.
 *
 * **Example** (Read workspace table name)
 *
 * ```ts
 * import { TABLE_NAME } from "@beep/workspace-tables/entities/Workspace"
 *
 * const tableName = TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(Workspace);

/**
 * Physical Postgres table name derived from the Workspace entity.
 *
 * **Example** (Read the table name)
 *
 * ```ts
 * import { TABLE_NAME } from "@beep/workspace-tables/entities/Workspace"
 *
 * console.log(TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
