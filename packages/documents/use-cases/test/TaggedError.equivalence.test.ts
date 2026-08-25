import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DocumentIntakeActionError,
  DocumentMaterializationFailed,
  FilingDecisionUnavailable,
} from "@beep/documents-use-cases/aggregates/Document/server";
import {
  DmsMirrorUnavailable,
  VaultScanFailed,
  VaultSyncActionError,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  SyncConflictRepositoryNotFound,
  SyncConflictRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { SyncCursorRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  SyncItemRepositoryConflict,
  SyncItemRepositoryNotFound,
  SyncItemRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  SyncOperationRepositoryConflict,
  SyncOperationRepositoryNotFound,
  SyncOperationRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import * as Documents from "@beep/shared-domain/identity/Documents";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  a: Schema["Type"],
  b: Schema["Type"],
  c: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(a, b)).toBe(true);
  expect(same(a, c)).toBe(false);
};

const conflictId = Documents.SyncConflictId.make(1);
const otherConflictId = Documents.SyncConflictId.make(2);
const syncItemId = Documents.SyncItemId.make(1);
const otherSyncItemId = Documents.SyncItemId.make(2);
const syncOperationId = Documents.SyncOperationId.make(1);
const otherSyncOperationId = Documents.SyncOperationId.make(2);
const localRelPath = VaultRelPath.make("matters/client-default/complaint.pdf");
const otherLocalRelPath = VaultRelPath.make("matters/client-default/answer.pdf");

describe("documents-use-cases tagged-error declared equivalence", () => {
  it("compares document and sync action errors by their declared fields", () => {
    expectDeclaredEquivalence(
      FilingDecisionUnavailable,
      FilingDecisionUnavailable.make({ reason: "classifier unavailable" }),
      FilingDecisionUnavailable.make({ reason: "classifier unavailable" }),
      FilingDecisionUnavailable.make({ reason: "taxonomy unavailable" })
    );
    expectDeclaredEquivalence(
      DocumentMaterializationFailed,
      DocumentMaterializationFailed.make({ reason: "vault write failed" }),
      DocumentMaterializationFailed.make({ reason: "vault write failed" }),
      DocumentMaterializationFailed.make({ reason: "vault root missing" })
    );
    expectDeclaredEquivalence(
      DocumentIntakeActionError,
      DocumentIntakeActionError.new("Workspace vault is not configured."),
      DocumentIntakeActionError.new("Workspace vault is not configured."),
      DocumentIntakeActionError.new("Document intake is unavailable.")
    );
    expectDeclaredEquivalence(
      DmsMirrorUnavailable,
      DmsMirrorUnavailable.make({ provider: "box", reason: "rate limited", retryable: true }),
      DmsMirrorUnavailable.make({ provider: "box", reason: "rate limited", retryable: true }),
      DmsMirrorUnavailable.make({ provider: "box", reason: "permission denied", retryable: false })
    );
    expectDeclaredEquivalence(
      VaultScanFailed,
      VaultScanFailed.make({ reason: "vault root unreadable" }),
      VaultScanFailed.make({ reason: "vault root unreadable" }),
      VaultScanFailed.make({ reason: "vault root missing" })
    );
    expectDeclaredEquivalence(
      VaultSyncActionError,
      VaultSyncActionError.new("Vault sync is unavailable."),
      VaultSyncActionError.new("Vault sync is unavailable."),
      VaultSyncActionError.new("Vault sync timed out.")
    );
  });

  it("compares SyncConflict and SyncCursor repository errors by their declared fields", () => {
    expectDeclaredEquivalence(
      SyncConflictRepositoryNotFound,
      SyncConflictRepositoryNotFound.make({ conflictId }),
      SyncConflictRepositoryNotFound.make({ conflictId }),
      SyncConflictRepositoryNotFound.make({ conflictId: otherConflictId })
    );
    expectDeclaredEquivalence(
      SyncConflictRepositoryUnavailable,
      SyncConflictRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncConflictRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncConflictRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
    expectDeclaredEquivalence(
      SyncCursorRepositoryUnavailable,
      SyncCursorRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncCursorRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncCursorRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
  });

  it("compares SyncItem repository errors by their declared fields", () => {
    expectDeclaredEquivalence(
      SyncItemRepositoryConflict,
      SyncItemRepositoryConflict.make({ localRelPath, reason: "already tracked" }),
      SyncItemRepositoryConflict.make({ localRelPath, reason: "already tracked" }),
      SyncItemRepositoryConflict.make({ localRelPath: otherLocalRelPath, reason: "already tracked" })
    );
    expectDeclaredEquivalence(
      SyncItemRepositoryNotFound,
      SyncItemRepositoryNotFound.make({ syncItemId }),
      SyncItemRepositoryNotFound.make({ syncItemId }),
      SyncItemRepositoryNotFound.make({ syncItemId: otherSyncItemId })
    );
    expectDeclaredEquivalence(
      SyncItemRepositoryUnavailable,
      SyncItemRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncItemRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncItemRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
  });

  it("compares SyncOperation repository errors by their declared fields", () => {
    expectDeclaredEquivalence(
      SyncOperationRepositoryConflict,
      SyncOperationRepositoryConflict.make({ idempotencyKey: "item-1:upload:1", reason: "already enqueued" }),
      SyncOperationRepositoryConflict.make({ idempotencyKey: "item-1:upload:1", reason: "already enqueued" }),
      SyncOperationRepositoryConflict.make({ idempotencyKey: "item-2:upload:1", reason: "already enqueued" })
    );
    expectDeclaredEquivalence(
      SyncOperationRepositoryNotFound,
      SyncOperationRepositoryNotFound.make({ syncOperationId }),
      SyncOperationRepositoryNotFound.make({ syncOperationId }),
      SyncOperationRepositoryNotFound.make({ syncOperationId: otherSyncOperationId })
    );
    expectDeclaredEquivalence(
      SyncOperationRepositoryUnavailable,
      SyncOperationRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncOperationRepositoryUnavailable.make({ reason: "database unavailable" }),
      SyncOperationRepositoryUnavailable.make({ reason: "transaction aborted" })
    );
  });
});
