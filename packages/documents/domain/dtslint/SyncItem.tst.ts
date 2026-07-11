import { describe, expect, it } from "tstyche";
import type { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import type * as SyncItem from "@beep/documents-domain/entities/SyncItem";
import type { DmsProvider, RemoteItemId, SyncItemKind, VaultRelPath } from "@beep/documents-domain/values/Sync";
import type { NonNegativeInt } from "@beep/schema";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type * as O from "effect/Option";

declare const item: SyncItem.SyncItem;

describe("SyncItem entity", () => {
  it("preserves identity metadata literals", () => {
    expect<typeof SyncItem.SyncItem.definition.entityId.tableName>().type.toBe<"documents_sync_item">();
    expect<typeof SyncItem.SyncItem.definition.entityId.entityType>().type.toBe<"DocumentsSyncItem">();
    expect<typeof SyncItem.SyncItem.definition.persisted.workspaceId.columnName>().type.toBe<"workspace_id">();
    expect<typeof SyncItem.SyncItem.definition.persisted.syncState.columnName>().type.toBe<"sync_state">();
    expect<typeof SyncItem.SyncItem.definition.persisted.localRelPath.storageKind>().type.toBe<"text">();
  });

  it("preserves literal family types", () => {
    expect<SyncItem.SyncItemState>().type.toBe<"pending" | "current" | "error" | "conflict">();
    expect(item.provider).type.toBe<DmsProvider>();
    expect(item.itemKind).type.toBe<SyncItemKind>();
    expect(item.syncState).type.toBe<SyncItem.SyncItemState>();
  });

  it("preserves field and Option types", () => {
    expect(item.workspaceId).type.toBe<WorkspaceIdentity.WorkspaceId>();
    expect(item.localRelPath).type.toBe<VaultRelPath>();
    expect(item.localGeneration).type.toBe<NonNegativeInt>();
    expect(item.contentDigest).type.toBe<O.Option<DocumentContentDigest>>();
    expect(item.contentSizeBytes).type.toBe<O.Option<NonNegativeInt>>();
    expect(item.lastPushedDigest).type.toBe<O.Option<DocumentContentDigest>>();
    expect(item.lastPushedGeneration).type.toBe<O.Option<NonNegativeInt>>();
    expect(item.remoteId).type.toBe<O.Option<RemoteItemId>>();
    expect(item.remoteParentId).type.toBe<O.Option<RemoteItemId>>();
    expect(item.remoteName).type.toBe<O.Option<string>>();
    expect(item.lastError).type.toBe<O.Option<string>>();
  });
});
