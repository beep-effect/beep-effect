/**
 * Workspace Thread table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Thread } from "@beep/workspace-domain/entities/Thread";

/**
 * PGLite/Postgres Drizzle table for the workspace Thread entity.
 *
 * **Example** (Table name and storage)
 *
 * ```ts
 * import { Thread } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_thread" = Thread.Table.definition.tableName
 * const workspaceIdStorage: "entityId" = Thread.Table.definition.persisted.workspaceId.storageKind
 *
 * console.log(`${tableName}:${workspaceIdStorage}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Thread);
