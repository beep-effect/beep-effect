/**
 * Workspace Turn table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Turn } from "@beep/workspace-domain/entities/Turn";

/**
 * PGLite/Postgres Drizzle table for the workspace Turn entity.
 *
 * **Example** (Table name and storage)
 *
 * ```ts
 * import { Turn } from "@beep/workspace-tables/entities"
 *
 * const tableName: "workspace_turn" = Turn.Table.definition.tableName
 * const itemsStorage: "jsonb" = Turn.Table.definition.persisted.items.storageKind
 *
 * console.log(`${tableName}:${itemsStorage}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Turn);
