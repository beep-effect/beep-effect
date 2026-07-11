import { describe, expect, it } from "tstyche";
import type * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import type * as SyncCursorTables from "@beep/documents-tables/entities/SyncCursor";
import type { EntityTable } from "@beep/drizzle";

describe("SyncCursor table types", () => {
  it("preserves SyncCursor table and descriptor metadata literals", () => {
    expect<typeof SyncCursorTables.syncCursorTable>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof DomainSyncCursor.SyncCursor>
    >();
    expect<typeof SyncCursorTables.syncCursorTable.definition.tableName>().type.toBe<"documents_sync_cursor">();
    expect<typeof SyncCursorTables.syncCursorTable.definition.entityId.entityType>().type.toBe<"DocumentsSyncCursor">();
    expect<
      typeof SyncCursorTables.syncCursorTable.definition.persisted.streamPosition.storageKind
    >().type.toBe<"text">();
    expect<typeof SyncCursorTables.syncCursorTable.definition.persisted.status.storageKind>().type.toBe<"literal">();
    expect<
      typeof SyncCursorTables.syncCursorTable.definition.persisted.workspaceId.storageKind
    >().type.toBe<"entityId">();
  });

  it("aligns the converter row types with the table inference", () => {
    expect<SyncCursorTables.SyncCursorRow>().type.toBe<typeof SyncCursorTables.syncCursorTable.$inferSelect>();
    expect<SyncCursorTables.SyncCursorInsert>().type.toBe<typeof SyncCursorTables.syncCursorTable.$inferInsert>();
    expect<typeof SyncCursorTables.fromSyncCursorRow>().type.toBe<
      (row: SyncCursorTables.SyncCursorRow) => DomainSyncCursor.SyncCursor
    >();
    expect<typeof SyncCursorTables.toSyncCursorInsert>().type.toBe<
      (syncCursor: DomainSyncCursor.SyncCursor) => SyncCursorTables.SyncCursorInsert
    >();
  });
});
