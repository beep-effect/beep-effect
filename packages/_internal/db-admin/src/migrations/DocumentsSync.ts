/**
 * Documents sync db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

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
  tables: [
    DocumentsDbSchema.syncItem.definition.tableName,
    DocumentsDbSchema.syncOperation.definition.tableName,
    DocumentsDbSchema.syncCursor.definition.tableName,
    DocumentsDbSchema.syncConflict.definition.tableName,
  ],
  drizzleSchema: {
    syncConflict: DocumentsDbSchema.syncConflict,
    syncCursor: DocumentsDbSchema.syncCursor,
    syncItem: DocumentsDbSchema.syncItem,
    syncOperation: DocumentsDbSchema.syncOperation,
  },
});
