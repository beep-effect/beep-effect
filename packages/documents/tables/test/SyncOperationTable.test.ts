import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import {
  fromSyncOperationRow,
  SYNC_OPERATION_TABLE_NAME,
  syncOperationTable,
  toSyncOperationInsert,
} from "@beep/documents-tables/entities/SyncOperation";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const SyncOperationArbitrary = S.toArbitrary(DomainSyncOperation.SyncOperation)(fc);
const SyncOperationEquivalence = S.toEquivalence(DomainSyncOperation.SyncOperation);

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(syncOperationTable).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

const uploadRow = {
  ...baseEntityFixtureInput(DocumentsIdentity.SyncOperationId.entityType, 20),
  attemptCount: 0,
  idempotencyKey: "sync-item-1:uploadFile:4",
  inputContentDigest: "abc123",
  inputGeneration: 4,
  lastError: null,
  operationType: "uploadFile",
  provider: "box",
  status: "queued",
  syncItemId: 1,
  targetName: "complaint.pdf",
  targetParentRelPath: "matters/client-default",
  targetRelPath: "matters/client-default/complaint.pdf",
  workspaceId: 2,
};

describe("SyncOperation table", () => {
  it("materializes SyncOperation metadata without executing a live database", () => {
    const columns = getColumns(syncOperationTable);

    expect(getTableConfig(syncOperationTable).name).toBe("documents_sync_operation");
    expect(SYNC_OPERATION_TABLE_NAME).toBe("documents_sync_operation");
    expect(DomainSyncOperation.SyncOperation.sql.tableName).toBe("documents_sync_operation");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.attemptCount.name).toBe("attempt_count");
    expect(columns.attemptCount.columnType).toBe("PgInteger");
    expect(columns.idempotencyKey.name).toBe("idempotency_key");
    expect(columns.idempotencyKey.notNull).toBe(true);
    expect(columns.inputContentDigest.name).toBe("input_content_digest");
    expect(columns.inputContentDigest.notNull).toBe(false);
    expect(columns.operationType.name).toBe("operation_type");
    expect(columns.operationType.columnType).toBe("PgText");
    expect(columns.syncItemId.name).toBe("sync_item_id");
    expect(columns.syncItemId.columnType).toBe("PgInteger");
    expect(columns.syncItemId.notNull).toBe(true);
    expect(columns.targetParentRelPath.name).toBe("target_parent_rel_path");
    expect(columns.targetParentRelPath.notNull).toBe(false);
    expect(columns.workspaceId.name).toBe("workspace_id");
    expect(columns.workspaceId.notNull).toBe(true);
  });

  it("builds the SyncOperation indexes from schema-first hints", () => {
    const publicIdUnique = indexConfigNamed("documents_sync_operation_public_id_unique_idx");
    const idempotencyKeyUnique = indexConfigNamed("documents_sync_operation_idempotency_key_unique_idx");
    const statusLookup = indexConfigNamed("documents_sync_operation_status_lookup_idx");
    const syncItemIdLookup = indexConfigNamed("documents_sync_operation_sync_item_id_lookup_idx");
    const workspaceIdBtree = indexConfigNamed("documents_sync_operation_workspace_id_btree_idx");

    expect(O.getOrThrow(publicIdUnique).config.unique).toBe(true);
    expect(O.getOrThrow(idempotencyKeyUnique).config.unique).toBe(true);
    expect(O.getOrThrow(idempotencyKeyUnique).config.columns[0]).toMatchObject({ name: "idempotency_key" });
    expect(O.getOrThrow(statusLookup).config.columns[0]).toMatchObject({ name: "status" });
    expect(O.getOrThrow(syncItemIdLookup).config.columns[0]).toMatchObject({ name: "sync_item_id" });
    expect(O.getOrThrow(workspaceIdBtree).config.columns[0]).toMatchObject({ name: "workspace_id" });
  });

  it("round-trips SyncOperation rows through the converters", () => {
    const syncOperation = S.decodeUnknownSync(DomainSyncOperation.SyncOperation)(uploadRow);
    const insert = toSyncOperationInsert(syncOperation);

    expect("id" in insert).toBe(false);
    expect(insert.idempotencyKey).toBe("sync-item-1:uploadFile:4");
    expect(insert.status).toBe("queued");
    expect(insert.syncItemId).toBe(1);
    expect(insert.entityType).toBe("DocumentsSyncOperation");

    const roundTripped = fromSyncOperationRow({
      ...insert,
      id: 20,
      // $inferInsert types nullable columns as `value | null | undefined`; the
      // select-row converter expects `value | null`, so resolve absent
      // optionals to their concrete nulls before round-tripping.
      inputContentDigest: insert.inputContentDigest ?? null,
      lastError: insert.lastError ?? null,
      targetParentRelPath: insert.targetParentRelPath ?? null,
    });

    expect(roundTripped.inputContentDigest).toEqual(O.some("abc123"));
    expect(roundTripped.lastError).toEqual(O.none());
    expect(SyncOperationEquivalence(roundTripped, syncOperation)).toBe(true);
  });

  it("round-trips schema-derived SyncOperations through the row converters", () =>
    fc.assert(
      fc.property(SyncOperationArbitrary, (syncOperation) => {
        const insert = toSyncOperationInsert(syncOperation);
        const decoded = fromSyncOperationRow({
          ...insert,
          id: syncOperation.id,
          inputContentDigest: insert.inputContentDigest ?? null,
          lastError: insert.lastError ?? null,
          targetParentRelPath: insert.targetParentRelPath ?? null,
        });

        expect(SyncOperationEquivalence(decoded, syncOperation)).toBe(true);
      }),
      fcRuns(50)
    ));
});
