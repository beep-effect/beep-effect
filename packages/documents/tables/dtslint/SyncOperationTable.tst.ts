import { describe, expect, it } from "tstyche";
import type * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import type * as SyncOperationTables from "@beep/documents-tables/entities/SyncOperation";
import type { EntityTable } from "@beep/drizzle";

describe("SyncOperation table types", () => {
  it("preserves SyncOperation table and descriptor metadata literals", () => {
    expect<typeof SyncOperationTables.syncOperationTable>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof DomainSyncOperation.SyncOperation>
    >();
    expect<
      typeof SyncOperationTables.syncOperationTable.definition.tableName
    >().type.toBe<"documents_sync_operation">();
    expect<
      typeof SyncOperationTables.syncOperationTable.definition.entityId.entityType
    >().type.toBe<"DocumentsSyncOperation">();
    expect<
      typeof SyncOperationTables.syncOperationTable.definition.persisted.idempotencyKey.storageKind
    >().type.toBe<"text">();
    expect<
      typeof SyncOperationTables.syncOperationTable.definition.persisted.operationType.storageKind
    >().type.toBe<"literal">();
    expect<
      typeof SyncOperationTables.syncOperationTable.definition.persisted.syncItemId.storageKind
    >().type.toBe<"entityId">();
  });

  it("aligns the converter row types with the table inference", () => {
    expect<SyncOperationTables.SyncOperationRow>().type.toBe<
      typeof SyncOperationTables.syncOperationTable.$inferSelect
    >();
    expect<SyncOperationTables.SyncOperationInsert>().type.toBe<
      typeof SyncOperationTables.syncOperationTable.$inferInsert
    >();
    expect<typeof SyncOperationTables.fromSyncOperationRow>().type.toBe<
      (row: SyncOperationTables.SyncOperationRow) => DomainSyncOperation.SyncOperation
    >();
    expect<typeof SyncOperationTables.toSyncOperationInsert>().type.toBe<
      (syncOperation: DomainSyncOperation.SyncOperation) => SyncOperationTables.SyncOperationInsert
    >();
  });
});
