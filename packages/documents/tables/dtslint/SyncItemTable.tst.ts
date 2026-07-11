import { describe, expect, it } from "tstyche";
import type * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import type { DbSchema } from "@beep/documents-tables";
import type * as SyncConflictTables from "@beep/documents-tables/entities/SyncConflict";
import type * as SyncCursorTables from "@beep/documents-tables/entities/SyncCursor";
import type * as SyncItemTables from "@beep/documents-tables/entities/SyncItem";
import type * as SyncOperationTables from "@beep/documents-tables/entities/SyncOperation";
import type { EntityTable } from "@beep/drizzle";

describe("SyncItem table types", () => {
  it("exports the DbSchema type from the package entrypoint", () => {
    expect<DbSchema>().type.toBe<{
      readonly syncConflict: typeof SyncConflictTables.syncConflictTable;
      readonly syncCursor: typeof SyncCursorTables.syncCursorTable;
      readonly syncItem: typeof SyncItemTables.syncItemTable;
      readonly syncOperation: typeof SyncOperationTables.syncOperationTable;
    }>();
  });

  it("preserves SyncItem table and descriptor metadata literals", () => {
    expect<typeof SyncItemTables.syncItemTable>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof DomainSyncItem.SyncItem>
    >();
    expect<typeof SyncItemTables.syncItemTable.definition.tableName>().type.toBe<"documents_sync_item">();
    expect<typeof SyncItemTables.syncItemTable.definition.entityId.entityType>().type.toBe<"DocumentsSyncItem">();
    expect<typeof SyncItemTables.syncItemTable.definition.persisted.contentDigest.storageKind>().type.toBe<"text">();
    expect<typeof SyncItemTables.syncItemTable.definition.persisted.itemKind.storageKind>().type.toBe<"literal">();
    expect<typeof SyncItemTables.syncItemTable.definition.persisted.localGeneration.storageKind>().type.toBe<"int">();
    expect<typeof SyncItemTables.syncItemTable.definition.persisted.workspaceId.storageKind>().type.toBe<"entityId">();
  });

  it("aligns the converter row types with the table inference", () => {
    expect<SyncItemTables.SyncItemRow>().type.toBe<typeof SyncItemTables.syncItemTable.$inferSelect>();
    expect<SyncItemTables.SyncItemInsert>().type.toBe<typeof SyncItemTables.syncItemTable.$inferInsert>();
    expect<typeof SyncItemTables.fromSyncItemRow>().type.toBe<
      (row: SyncItemTables.SyncItemRow) => DomainSyncItem.SyncItem
    >();
    expect<typeof SyncItemTables.toSyncItemInsert>().type.toBe<
      (syncItem: DomainSyncItem.SyncItem) => SyncItemTables.SyncItemInsert
    >();
  });
});
