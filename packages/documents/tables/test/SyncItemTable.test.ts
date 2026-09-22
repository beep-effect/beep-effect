import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { DbSchema, Entities } from "@beep/documents-tables";
import {
  fromSyncItemRow,
  SYNC_ITEM_TABLE_NAME,
  syncItemTable,
  toSyncItemInsert,
} from "@beep/documents-tables/entities/SyncItem";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SyncItemInsert, SyncItemRow } from "@beep/documents-tables/entities/SyncItem";

const decodeUnknownSyncItem = S.decodeUnknownEffect(DomainSyncItem.SyncItem);

const SyncItemEquivalence = S.toEquivalence(DomainSyncItem.SyncItem);

const absentAsNull = <A>(value: A | null | undefined): A | null => value ?? null;

const syncItemRow = (insert: SyncItemInsert, id: number): SyncItemRow => ({
  ...insert,
  id,
  contentDigest: absentAsNull(insert.contentDigest),
  contentSizeBytes: absentAsNull(insert.contentSizeBytes),
  lastError: absentAsNull(insert.lastError),
  lastPushedDigest: absentAsNull(insert.lastPushedDigest),
  lastPushedGeneration: absentAsNull(insert.lastPushedGeneration),
  remoteId: absentAsNull(insert.remoteId),
  remoteName: absentAsNull(insert.remoteName),
  remoteParentId: absentAsNull(insert.remoteParentId),
});

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(syncItemTable).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

const fileRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncItemId.entityType, 10),
  contentDigest: "abc123",
  contentSizeBytes: 2048,
  itemKind: "file",
  lastError: null,
  lastPushedDigest: "abc122",
  lastPushedGeneration: 3,
  localGeneration: 4,
  localRelPath: "matters/client-default/complaint.pdf",
  provider: "box",
  remoteId: "9001",
  remoteName: "complaint.pdf",
  remoteParentId: "9000",
  syncState: "pending",
  workspaceId: 2,
};

describe("SyncItem table", () => {
  it("materializes SyncItem metadata without executing a live database", () => {
    const columns = getColumns(syncItemTable);

    expect(getTableConfig(syncItemTable).name).toBe("documents_sync_item");
    expect(SYNC_ITEM_TABLE_NAME).toBe("documents_sync_item");
    expect(DomainSyncItem.SyncItem.sql.tableName).toBe("documents_sync_item");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.publicId.name).toBe("public_id");
    expect(columns.contentDigest.name).toBe("content_digest");
    expect(columns.contentDigest.notNull).toBe(false);
    expect(columns.contentSizeBytes.name).toBe("content_size_bytes");
    expect(columns.contentSizeBytes.columnType).toBe("PgInteger");
    expect(columns.itemKind.name).toBe("item_kind");
    expect(columns.itemKind.columnType).toBe("PgText");
    expect(columns.itemKind.notNull).toBe(true);
    expect(columns.localRelPath.name).toBe("local_rel_path");
    expect(columns.localRelPath.notNull).toBe(true);
    expect(columns.syncState.name).toBe("sync_state");
    expect(columns.workspaceId.name).toBe("workspace_id");
    expect(columns.workspaceId.columnType).toBe("PgInteger");
    expect(columns.workspaceId.notNull).toBe(true);
  });

  it("builds the SyncItem indexes from schema-first hints", () => {
    const publicIdUnique = indexConfigNamed("documents_sync_item_public_id_unique_idx");
    const localRelPathLookup = indexConfigNamed("documents_sync_item_local_rel_path_lookup_idx");
    const remoteIdLookup = indexConfigNamed("documents_sync_item_remote_id_lookup_idx");
    const syncStateLookup = indexConfigNamed("documents_sync_item_sync_state_lookup_idx");
    const workspaceIdBtree = indexConfigNamed("documents_sync_item_workspace_id_btree_idx");

    expect(O.getOrThrow(publicIdUnique).config.unique).toBe(true);
    expect(O.getOrThrow(localRelPathLookup).config.columns[0]).toMatchObject({ name: "local_rel_path" });
    expect(O.getOrThrow(remoteIdLookup).config.columns[0]).toMatchObject({ name: "remote_id" });
    expect(O.getOrThrow(syncStateLookup).config.columns[0]).toMatchObject({ name: "sync_state" });
    expect(O.getOrThrow(workspaceIdBtree).config.columns[0]).toMatchObject({ name: "workspace_id" });
  });

  it("exports the metadata aggregate and entity namespaces", () => {
    expect(DbSchema.syncConflict).toBe(Entities.SyncConflict.syncConflictTable);
    expect(DbSchema.syncCursor).toBe(Entities.SyncCursor.syncCursorTable);
    expect(DbSchema.syncItem).toBe(syncItemTable);
    expect(DbSchema.syncOperation).toBe(Entities.SyncOperation.syncOperationTable);
    expect(Entities.SyncItem.syncItemTable).toBe(syncItemTable);
  });

  it.effect(
    "round-trips SyncItem rows through the converters",
    Effect.fnUntraced(function* () {
      const syncItem = yield* decodeUnknownSyncItem(fileRow);
      const insert = yield* Effect.fromResult(toSyncItemInsert(syncItem));

      expect("id" in insert).toBe(false);
      expect(insert.localRelPath).toBe("matters/client-default/complaint.pdf");
      expect(insert.syncState).toBe("pending");
      expect(insert.workspaceId).toBe(2);
      expect(insert.entityType).toBe("DocumentsSyncItem");

      const roundTripped = yield* Effect.fromResult(fromSyncItemRow(syncItemRow(insert, 10)));

      expect(roundTripped.contentDigest).toEqual(O.some("abc123"));
      expect(roundTripped.lastError).toEqual(O.none());
      expect(SyncItemEquivalence(roundTripped, syncItem)).toBe(true);
    })
  );

  it.effect.prop(
    "round-trips schema-derived SyncItems through the row converters",
    [S.toType(DomainSyncItem.SyncItem)],
    Effect.fnUntraced(function* ([syncItem]) {
      const insert = yield* Effect.fromResult(toSyncItemInsert(syncItem));
      const decoded = yield* Effect.fromResult(fromSyncItemRow(syncItemRow(insert, syncItem.id)));

      expect(SyncItemEquivalence(decoded, syncItem)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );
});
