import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { DocumentsDbSchema } from "@beep/db-admin/schema";
import { fromSyncConflictRow, toSyncConflictInsert } from "@beep/documents-tables/entities/SyncConflict";
import { fromSyncCursorRow, toSyncCursorInsert } from "@beep/documents-tables/entities/SyncCursor";
import { fromSyncItemRow, toSyncItemInsert } from "@beep/documents-tables/entities/SyncItem";
import { fromSyncOperationRow, toSyncOperationInsert } from "@beep/documents-tables/entities/SyncOperation";
import { makeDrizzle, migrate } from "@beep/postgres";
import { baseEntityFixtureInput, makePgliteIntegrationGate, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const { shouldRunPgliteIntegration, makePgliteLayer } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

const decodeSyncItem = S.decodeUnknownEffect(DocumentsDbSchema.syncItem.entitySchema);
const decodeSyncOperation = S.decodeUnknownEffect(DocumentsDbSchema.syncOperation.entitySchema);
const decodeSyncCursor = S.decodeUnknownEffect(DocumentsDbSchema.syncCursor.entitySchema);
const decodeSyncConflict = S.decodeUnknownEffect(DocumentsDbSchema.syncConflict.entitySchema);

const syncOperationFixture = (id: number, publicId: string) => ({
  ...baseEntityFixtureInput(DocumentsDbSchema.syncOperation.definition.entityId.entityType, id),
  attemptCount: 0,
  idempotencyKey: "sync-item-1:uploadFile:4",
  inputContentDigest: "abc123",
  inputGeneration: 4,
  lastError: null,
  operationType: "uploadFile",
  provider: "box",
  publicId,
  status: "queued",
  syncItemId: 1,
  targetName: "complaint.pdf",
  targetParentRelPath: "matters/client-default",
  targetRelPath: "matters/client-default/complaint.pdf",
  workspaceId: 2,
});

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin documents-sync migration PgLite integration", () => {});
} else {
  describe.concurrent("db-admin documents-sync migration PgLite integration", () => {
    layer(makePgliteLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the documents-sync migration target SQL",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const syncItem = yield* decodeSyncItem({
            ...baseEntityFixtureInput(DocumentsDbSchema.syncItem.definition.entityId.entityType, 1),
            contentDigest: "abc123",
            contentSizeBytes: 2048,
            itemKind: "file",
            lastError: null,
            lastPushedDigest: null,
            lastPushedGeneration: null,
            localGeneration: 4,
            localRelPath: "matters/client-default/complaint.pdf",
            provider: "box",
            remoteId: "9001",
            remoteName: "complaint.pdf",
            remoteParentId: "9000",
            syncState: "pending",
            workspaceId: 2,
          });
          const syncOperation = yield* decodeSyncOperation(syncOperationFixture(1, "documents_sync_operation_a1"));
          const syncCursor = yield* decodeSyncCursor({
            ...baseEntityFixtureInput(DocumentsDbSchema.syncCursor.definition.entityId.entityType, 1),
            lastError: null,
            lastEventId: "evt-1",
            provider: "box",
            status: "active",
            streamPosition: "now",
            workspaceId: 2,
          });
          const syncConflict = yield* decodeSyncConflict({
            ...baseEntityFixtureInput(DocumentsDbSchema.syncConflict.definition.entityId.entityType, 1),
            conflictKind: "remoteEdit",
            localRelPath: "matters/client-default/complaint.pdf",
            provider: "box",
            remoteEventId: "evt-1",
            remoteId: "9001",
            remotePayload: { eventType: "ITEM_MODIFY", itemId: "9001" },
            resolutionStatus: "open",
            syncItemId: 1,
            workspaceId: 2,
          });

          yield* db.insert(DocumentsDbSchema.syncItem).values(toSyncItemInsert(syncItem));
          yield* db.insert(DocumentsDbSchema.syncOperation).values(toSyncOperationInsert(syncOperation));
          yield* db.insert(DocumentsDbSchema.syncCursor).values(toSyncCursorInsert(syncCursor));
          yield* db.insert(DocumentsDbSchema.syncConflict).values(toSyncConflictInsert(syncConflict));

          const itemRows = yield* db.select().from(DocumentsDbSchema.syncItem);
          const operationRows = yield* db.select().from(DocumentsDbSchema.syncOperation);
          const cursorRows = yield* db.select().from(DocumentsDbSchema.syncCursor);
          const conflictRows = yield* db.select().from(DocumentsDbSchema.syncConflict);

          const items = A.map(itemRows, fromSyncItemRow);
          const operations = A.map(operationRows, fromSyncOperationRow);
          const cursors = A.map(cursorRows, fromSyncCursorRow);
          const conflicts = A.map(conflictRows, fromSyncConflictRow);

          expect(A.map(items, (item) => item.localRelPath)).toEqual(["matters/client-default/complaint.pdf"]);
          expect(A.map(items, (item) => item.contentDigest)).toEqual([O.some("abc123")]);
          expect(A.map(operations, (operation) => operation.idempotencyKey)).toEqual(["sync-item-1:uploadFile:4"]);
          expect(A.map(cursors, (cursor) => cursor.streamPosition)).toEqual(["now"]);
          expect(A.map(conflicts, (conflict) => conflict.remotePayload)).toEqual([
            { eventType: "ITEM_MODIFY", itemId: "9001" },
          ]);

          const duplicateOperation = yield* decodeSyncOperation(syncOperationFixture(2, "documents_sync_operation_a2"));
          const uniqueViolation = yield* Effect.flip(
            db.insert(DocumentsDbSchema.syncOperation).values(toSyncOperationInsert(duplicateOperation))
          );

          // The duplicate probe stays LAST: the migration property under test
          // is the unique index rejecting the duplicate (asserted via the
          // violation naming it). What happens to sibling rows afterwards is
          // driver transaction semantics — implicit-transaction pglite hosts
          // roll the whole session chain back — so no statement may follow the
          // intentional failure.
          expect(inspect(uniqueViolation, { depth: 10 })).toContain(
            "documents_sync_operation_idempotency_key_unique_idx"
          );
        }),
        120_000
      );
    });
  });
}
