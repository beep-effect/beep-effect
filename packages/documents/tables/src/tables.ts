/**
 * Documents Drizzle schema aggregate.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as SyncConflict from "./entities/SyncConflict/index.ts";
import * as SyncCursor from "./entities/SyncCursor/index.ts";
import * as SyncItem from "./entities/SyncItem/index.ts";
import * as SyncOperation from "./entities/SyncOperation/index.ts";

type DbSchemaShape = {
  readonly syncConflict: typeof SyncConflict.syncConflictTable;
  readonly syncCursor: typeof SyncCursor.syncCursorTable;
  readonly syncItem: typeof SyncItem.syncItemTable;
  readonly syncOperation: typeof SyncOperation.syncOperationTable;
};

/**
 * Drizzle schema object containing the documents sync-state table projections.
 *
 * **Example** (Validate sync table names)
 *
 * ```ts
 * import { DbSchema } from "@beep/documents-tables/tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const syncItemTableName = getTableName(DbSchema.syncItem)
 * const syncOperationTableName = DbSchema.syncOperation.definition.tableName
 * if (syncItemTableName !== "documents_sync_item" || syncOperationTableName !== "documents_sync_operation") {
 *   throw new Error("unexpected documents schema")
 * }
 *
 * console.log(`${syncItemTableName}:${syncOperationTableName}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  syncConflict: SyncConflict.syncConflictTable,
  syncCursor: SyncCursor.syncCursorTable,
  syncItem: SyncItem.syncItemTable,
  syncOperation: SyncOperation.syncOperationTable,
};

/**
 * Type-level view of the documents Drizzle schema object.
 *
 * **Example** (Type-safe schema assignment)
 *
 * ```ts
 * import { DbSchema, type DbSchema as DbSchemaType } from "@beep/documents-tables/tables"
 *
 * const schema: DbSchemaType = DbSchema
 * const syncCursorTableName: "documents_sync_cursor" = schema.syncCursor.definition.tableName
 *
 * console.log(syncCursorTableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
