import { describe, expect, it } from "tstyche";
import type * as SyncCursor from "@beep/documents-domain/entities/SyncCursor";
import type { DmsProvider } from "@beep/documents-domain/values/Sync";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type * as O from "effect/Option";

declare const cursor: SyncCursor.SyncCursor;

describe("SyncCursor entity", () => {
  it("preserves identity metadata literals", () => {
    expect<typeof SyncCursor.SyncCursor.definition.entityId.tableName>().type.toBe<"documents_sync_cursor">();
    expect<typeof SyncCursor.SyncCursor.definition.entityId.entityType>().type.toBe<"DocumentsSyncCursor">();
    expect<
      typeof SyncCursor.SyncCursor.definition.persisted.streamPosition.columnName
    >().type.toBe<"stream_position">();
    expect<typeof SyncCursor.SyncCursor.definition.persisted.lastEventId.columnName>().type.toBe<"last_event_id">();
    expect<typeof SyncCursor.SyncCursor.definition.persisted.workspaceId.storageKind>().type.toBe<"entityId">();
  });

  it("preserves literal family types", () => {
    expect<SyncCursor.SyncCursorStatus>().type.toBe<"active" | "error">();
    expect(cursor.provider).type.toBe<DmsProvider>();
    expect(cursor.status).type.toBe<SyncCursor.SyncCursorStatus>();
  });

  it("preserves field and Option types", () => {
    expect(cursor.workspaceId).type.toBe<WorkspaceIdentity.WorkspaceId>();
    expect(cursor.streamPosition).type.toBe<string>();
    expect(cursor.lastEventId).type.toBe<O.Option<string>>();
    expect(cursor.lastError).type.toBe<O.Option<string>>();
  });
});
