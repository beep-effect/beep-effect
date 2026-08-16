/**
 * Workspace thread db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as WorkspaceDbSchema } from "@beep/workspace-tables";
import { TABLE_NAME as MESSAGE_TABLE_NAME } from "@beep/workspace-tables/entities/Message";
import { TABLE_NAME as THREAD_TABLE_NAME } from "@beep/workspace-tables/entities/Thread";
import { TABLE_NAME as TURN_TABLE_NAME } from "@beep/workspace-tables/entities/Turn";
import { TABLE_NAME as WORKSPACE_TABLE_NAME } from "@beep/workspace-tables/entities/Workspace";
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
  tables: [WORKSPACE_TABLE_NAME, THREAD_TABLE_NAME, TURN_TABLE_NAME, MESSAGE_TABLE_NAME],
  drizzleSchema: {
    message: WorkspaceDbSchema.message,
    thread: WorkspaceDbSchema.thread,
    turn: WorkspaceDbSchema.turn,
    workspace: WorkspaceDbSchema.workspace,
  },
});
