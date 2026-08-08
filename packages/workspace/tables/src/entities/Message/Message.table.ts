/**
 * Workspace Message table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Message } from "@beep/workspace-domain/entities/Message";

/**
 * PGLite/Postgres Drizzle table for the workspace Message entity.
 *
 * **Example** (Read table name and content storage)
 *
 * ```ts
 * import { Message } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_message" = Message.Table.definition.tableName
 * const contentStorage: "jsonb" = Message.Table.definition.persisted.content.storageKind
 *
 * console.log(`${tableName}:${contentStorage}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Message);
