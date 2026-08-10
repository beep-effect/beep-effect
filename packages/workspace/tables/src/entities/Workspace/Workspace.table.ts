/**
 * Workspace table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Workspace } from "@beep/workspace-domain/entities/Workspace";

/**
 * Workspace persistence table.
 *
 * **Example** (Read workspace table name)
 *
 * ```ts
 * import { Table } from "@beep/workspace-tables/entities/Workspace"
 *
 * const tableName: "workspace_workspace" = Table.definition.tableName
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Workspace);
