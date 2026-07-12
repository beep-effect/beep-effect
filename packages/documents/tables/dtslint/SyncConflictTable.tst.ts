import { describe, expect, it } from "tstyche";
import type * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import type * as SyncConflictTables from "@beep/documents-tables/entities/SyncConflict";
import type { EntityTable } from "@beep/drizzle";

describe("SyncConflict table types", () => {
  it("preserves SyncConflict table and descriptor metadata literals", () => {
    expect<typeof SyncConflictTables.syncConflictTable>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof DomainSyncConflict.SyncConflict>
    >();
    expect<typeof SyncConflictTables.syncConflictTable.definition.tableName>().type.toBe<"documents_sync_conflict">();
    expect<
      typeof SyncConflictTables.syncConflictTable.definition.entityId.entityType
    >().type.toBe<"DocumentsSyncConflict">();
    expect<
      typeof SyncConflictTables.syncConflictTable.definition.persisted.conflictKind.storageKind
    >().type.toBe<"literal">();
    expect<
      typeof SyncConflictTables.syncConflictTable.definition.persisted.remotePayload.storageKind
    >().type.toBe<"jsonb">();
    expect<
      typeof SyncConflictTables.syncConflictTable.definition.persisted.syncItemId.storageKind
    >().type.toBe<"entityId">();
  });

  it("aligns the converter row types with the table inference", () => {
    expect<SyncConflictTables.SyncConflictRow>().type.toBe<typeof SyncConflictTables.syncConflictTable.$inferSelect>();
    expect<SyncConflictTables.SyncConflictInsert>().type.toBe<
      typeof SyncConflictTables.syncConflictTable.$inferInsert
    >();
    expect<typeof SyncConflictTables.fromSyncConflictRow>().type.toBe<
      (row: SyncConflictTables.SyncConflictRow) => DomainSyncConflict.SyncConflict
    >();
    expect<typeof SyncConflictTables.toSyncConflictInsert>().type.toBe<
      (syncConflict: DomainSyncConflict.SyncConflict) => SyncConflictTables.SyncConflictInsert
    >();
  });
});
