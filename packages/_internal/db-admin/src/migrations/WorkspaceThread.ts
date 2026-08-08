/**
 * Workspace thread db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as WorkspaceDbSchema } from "@beep/workspace-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Workspace thread migration target used to prove conversation persistence.
 *
 * **Example** (Log migration target tables)
 *
 * ```ts
 * import { WorkspaceThreadMigrationTarget } from "@beep/db-admin/migrations/WorkspaceThread"
 *
 * console.log(WorkspaceThreadMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const WorkspaceThreadMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "workspace-thread",
  schemaName: "workspace",
  tables: [
    WorkspaceDbSchema.workspace.definition.tableName,
    WorkspaceDbSchema.thread.definition.tableName,
    WorkspaceDbSchema.turn.definition.tableName,
    WorkspaceDbSchema.message.definition.tableName,
  ],
  drizzleSchema: {
    message: WorkspaceDbSchema.message,
    thread: WorkspaceDbSchema.thread,
    turn: WorkspaceDbSchema.turn,
    workspace: WorkspaceDbSchema.workspace,
  },
});
