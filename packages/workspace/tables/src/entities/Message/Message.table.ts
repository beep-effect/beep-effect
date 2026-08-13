/**
 * Workspace Message table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { Message } from "@beep/workspace-domain/entities/Message";
import { getTableName } from "drizzle-orm";

/**
 * PGLite/Postgres Drizzle table for the workspace Message entity.
 *
 * **Example** (Read table name and content storage)
 *
 * ```ts
 * import { Message } from "@beep/workspace-tables/entities"
 *
 * const tableName = Message.TABLE_NAME
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(Message);

/**
 * Physical Postgres table name derived from the Message entity.
 *
 * @category tables
 * @since 0.0.0
 */
export const TABLE_NAME = getTableName(Table);
