import { describe, expect, it } from "tstyche";
import type { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import type * as SyncOperation from "@beep/documents-domain/entities/SyncOperation";
import type { SyncItemId } from "@beep/documents-domain/identity/Documents";
import type { DmsProvider, VaultRelPath } from "@beep/documents-domain/values/Sync";
import type { NonNegativeInt } from "@beep/schema";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type * as O from "effect/Option";

declare const operation: SyncOperation.SyncOperation;

describe("SyncOperation entity", () => {
  it("preserves identity metadata literals", () => {
    expect<typeof SyncOperation.SyncOperation.definition.entityId.tableName>().type.toBe<"documents_sync_operation">();
    expect<typeof SyncOperation.SyncOperation.definition.entityId.entityType>().type.toBe<"DocumentsSyncOperation">();
    expect<
      typeof SyncOperation.SyncOperation.definition.persisted.idempotencyKey.columnName
    >().type.toBe<"idempotency_key">();
    expect<
      typeof SyncOperation.SyncOperation.definition.persisted.operationType.columnName
    >().type.toBe<"operation_type">();
    expect<typeof SyncOperation.SyncOperation.definition.persisted.syncItemId.storageKind>().type.toBe<"entityId">();
  });

  it("preserves literal family types", () => {
    expect<SyncOperation.SyncOperationType>().type.toBe<
      "createFolder" | "uploadFile" | "uploadFileVersion" | "moveItem" | "renameItem"
    >();
    expect<SyncOperation.SyncOperationStatus>().type.toBe<"queued" | "leased" | "succeeded" | "failed">();
    expect(operation.provider).type.toBe<DmsProvider>();
    expect(operation.operationType).type.toBe<SyncOperation.SyncOperationType>();
    expect(operation.status).type.toBe<SyncOperation.SyncOperationStatus>();
  });

  it("preserves field and Option types", () => {
    expect(operation.workspaceId).type.toBe<WorkspaceIdentity.WorkspaceId>();
    expect(operation.syncItemId).type.toBe<SyncItemId>();
    expect(operation.idempotencyKey).type.toBe<string>();
    expect(operation.attemptCount).type.toBe<NonNegativeInt>();
    expect(operation.inputGeneration).type.toBe<NonNegativeInt>();
    expect(operation.targetName).type.toBe<string>();
    expect(operation.targetRelPath).type.toBe<VaultRelPath>();
    expect(operation.targetParentRelPath).type.toBe<O.Option<VaultRelPath>>();
    expect(operation.inputContentDigest).type.toBe<O.Option<DocumentContentDigest>>();
    expect(operation.lastError).type.toBe<O.Option<string>>();
  });
});
