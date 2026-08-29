/**
 * Documents sync db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { SYNC_CONFLICT_TABLE_NAME } from "@beep/documents-tables/entities/SyncConflict";
import { SYNC_CURSOR_TABLE_NAME } from "@beep/documents-tables/entities/SyncCursor";
import { SYNC_ITEM_TABLE_NAME } from "@beep/documents-tables/entities/SyncItem";
import { SYNC_OPERATION_TABLE_NAME } from "@beep/documents-tables/entities/SyncOperation";
import { DbSchema as DocumentsDbSchema } from "@beep/documents-tables/tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Documents sync migration target used to prove DMS sync-state persistence.
 *
 * **Example** (Log migration target tables)
 *
 * ```ts
 * import { DocumentsSyncMigrationTarget } from "@beep/db-admin/migrations/DocumentsSync"
 *
 * console.log(DocumentsSyncMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DocumentsSyncMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "documents-sync",
  schemaName: "documents",
  tables: [SYNC_ITEM_TABLE_NAME, SYNC_OPERATION_TABLE_NAME, SYNC_CURSOR_TABLE_NAME, SYNC_CONFLICT_TABLE_NAME],
  drizzleSchema: {
    syncConflict: DocumentsDbSchema.syncConflict,
    syncCursor: DocumentsDbSchema.syncCursor,
    syncItem: DocumentsDbSchema.syncItem,
    syncOperation: DocumentsDbSchema.syncOperation,
  },
});
