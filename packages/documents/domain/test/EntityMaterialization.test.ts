import { SyncConflict, SyncCursor, SyncItem, SyncOperation } from "@beep/documents-domain/entities";
import { toPgTable } from "@beep/effect-drizzle/pg";
import { describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

const indexNames = (config: { indexes: ReadonlyArray<{ config: { name?: string } }> }) =>
  config.indexes.map((index) => index.config.name);

describe("documents entity materialization", () => {
  it("materializes model extras into table indexes", () => {
    const conflict = SyncConflict.SyncConflict.pipe(toPgTable, getTableConfig);
    const cursor = SyncCursor.SyncCursor.pipe(toPgTable, getTableConfig);
    const item = SyncItem.SyncItem.pipe(toPgTable, getTableConfig);
    const operation = SyncOperation.SyncOperation.pipe(toPgTable, getTableConfig);

    expect(indexNames(conflict)).toEqual(
      expect.arrayContaining([
        "documents_sync_conflict_conflict_kind_lookup_idx",
        "documents_sync_conflict_remote_event_id_lookup_idx",
        "documents_sync_conflict_resolution_status_lookup_idx",
        "documents_sync_conflict_workspace_id_btree_idx",
      ])
    );
    expect(indexNames(cursor)).toEqual(expect.arrayContaining(["documents_sync_cursor_workspace_id_btree_idx"]));
    expect(indexNames(item)).toEqual(
      expect.arrayContaining([
        "documents_sync_item_local_rel_path_lookup_idx",
        "documents_sync_item_remote_id_lookup_idx",
        "documents_sync_item_sync_state_lookup_idx",
        "documents_sync_item_workspace_id_btree_idx",
      ])
    );
    expect(indexNames(operation)).toEqual(
      expect.arrayContaining([
        "documents_sync_operation_idempotency_key_unique_idx",
        "documents_sync_operation_status_lookup_idx",
        "documents_sync_operation_sync_item_id_lookup_idx",
        "documents_sync_operation_workspace_id_btree_idx",
      ])
    );
  });
});
