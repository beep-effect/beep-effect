import { describe, expect, it } from "tstyche";
import type * as SyncConflict from "@beep/documents-domain/entities/SyncConflict";
import type { SyncItemId } from "@beep/documents-domain/identity/Documents";
import type { DmsProvider, RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type * as O from "effect/Option";

declare const conflict: SyncConflict.SyncConflict;

describe("SyncConflict entity", () => {
  it("preserves identity metadata literals", () => {
    expect<typeof SyncConflict.SyncConflict.definition.entityId.tableName>().type.toBe<"documents_sync_conflict">();
    expect<typeof SyncConflict.SyncConflict.definition.entityId.entityType>().type.toBe<"DocumentsSyncConflict">();
    expect<
      typeof SyncConflict.SyncConflict.definition.persisted.conflictKind.columnName
    >().type.toBe<"conflict_kind">();
    expect<
      typeof SyncConflict.SyncConflict.definition.persisted.resolutionStatus.columnName
    >().type.toBe<"resolution_status">();
    expect<typeof SyncConflict.SyncConflict.definition.persisted.remotePayload.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves literal family types", () => {
    expect<SyncConflict.SyncConflictKind>().type.toBe<
      "remoteCreate" | "remoteEdit" | "remoteMove" | "remoteRename" | "remoteDelete" | "remoteUnknown"
    >();
    expect<SyncConflict.SyncConflictResolution>().type.toBe<"open" | "reviewed">();
    expect(conflict.provider).type.toBe<DmsProvider>();
    expect(conflict.conflictKind).type.toBe<SyncConflict.SyncConflictKind>();
    expect(conflict.resolutionStatus).type.toBe<SyncConflict.SyncConflictResolution>();
  });

  it("preserves field and Option types", () => {
    expect(conflict.workspaceId).type.toBe<WorkspaceIdentity.WorkspaceId>();
    expect(conflict.syncItemId).type.toBe<O.Option<SyncItemId>>();
    expect(conflict.remoteId).type.toBe<O.Option<RemoteItemId>>();
    expect(conflict.remoteEventId).type.toBe<O.Option<string>>();
    expect(conflict.localRelPath).type.toBe<O.Option<VaultRelPath>>();
    expect(conflict.remotePayload).type.toBeAssignableTo<{ readonly [key: string]: unknown }>();
  });
});
