import { fileURLToPath } from "node:url";
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import * as Documents from "@beep/documents-domain/identity/Documents";
import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { makeDrizzleSyncConflictRepository } from "@beep/documents-server/entities/SyncConflict";
import { makeDrizzleSyncCursorRepository } from "@beep/documents-server/entities/SyncCursor";
import { makeDrizzleSyncItemRepository } from "@beep/documents-server/entities/SyncItem";
import { makeDrizzleSyncOperationRepository } from "@beep/documents-server/entities/SyncOperation";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { FindSyncCursorInput, SyncCursorSeed } from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  FindSyncItemByPathInput,
  FindSyncItemByRemoteIdInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepositoryConflict,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListQueuedSyncOperationsForItemInput,
  ListQueuedSyncOperationsInput,
  ListSyncOperationsByStatusInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepositoryConflict,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { NonNegativeInt } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, makePgliteIntegrationGate, TestDatabaseInfo } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis, makePgliteLayer } = makePgliteIntegrationGate();

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(10)
  );
};

const workspaceId = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(2);
const decodeVaultRelPath = S.decodeUnknownSync(VaultRelPath);
const remoteId = S.decodeUnknownSync(RemoteItemId)("9001");
const syncItemOne = S.decodeUnknownSync(Documents.SyncItemId)(1);
const zeroAttempts = S.decodeUnknownSync(NonNegativeInt)(0);
const generationOne = S.decodeUnknownSync(NonNegativeInt)(1);

const itemSeed = (localRelPath: string) =>
  SyncItemSeed.make({
    itemKind: "file",
    localGeneration: generationOne,
    localRelPath: decodeVaultRelPath(localRelPath),
    provider: "box",
    syncState: "pending",
    workspaceId,
  });

const operationSeed = (idempotencyKey: string) =>
  SyncOperationSeed.make({
    attemptCount: zeroAttempts,
    idempotencyKey,
    inputGeneration: generationOne,
    operationType: "uploadFile",
    provider: "box",
    status: "queued",
    syncItemId: syncItemOne,
    targetName: "complaint.pdf",
    targetRelPath: decodeVaultRelPath("matters/client-default/complaint.pdf"),
    workspaceId,
  });

const conflictSeed = (remoteEventId: O.Option<string>) =>
  SyncConflictSeed.make({
    conflictKind: "remoteEdit",
    provider: "box",
    remoteEventId,
    remotePayload: { eventType: "ITEM_MODIFY" },
    resolutionStatus: "open",
    workspaceId,
  });

const migrateDocumentsSync = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const SyncRepositoriesDrizzleLayer = makeDrizzleLayer().pipe(Layer.provideMerge(makePgliteLayer()));

describe("Documents sync repository seeds", () => {
  it("round-trips schema-derived repository seeds", () => {
    assertSchemaArbitraryRoundTrip(SyncItemSeed);
    assertSchemaArbitraryRoundTrip(SyncOperationSeed);
    assertSchemaArbitraryRoundTrip(SyncCursorSeed);
    assertSchemaArbitraryRoundTrip(SyncConflictSeed);
  });
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Documents sync repositories Drizzle PgLite integration", () => {});
} else {
  describe("Documents sync repositories Drizzle PgLite integration", { concurrent: false }, () => {
    layer(SyncRepositoriesDrizzleLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "creates, deduplicates, updates, and finds sync items",
        Effect.fnUntraced(function* () {
          yield* migrateDocumentsSync();
          const repository = yield* makeDrizzleSyncItemRepository();

          const first = yield* repository.create(itemSeed("matters/client-default/zeta.pdf"));
          const second = yield* repository.create(itemSeed("matters/client-default/alpha.pdf"));
          expect(second.id).not.toBe(first.id);

          const duplicate = yield* Effect.flip(repository.create(itemSeed("matters/client-default/zeta.pdf")));
          expect(SyncItemRepositoryConflict.is(duplicate)).toBe(true);

          const pushed = yield* repository.update(
            DomainSyncItem.SyncItem.make({
              ...first,
              remoteId: O.some(remoteId),
              remoteName: O.some("zeta.pdf"),
              syncState: "current",
            })
          );
          expect(pushed.syncState).toBe("current");
          expect(pushed.remoteId).toEqual(O.some(remoteId));

          const foundByPath = yield* repository.findByPath(
            FindSyncItemByPathInput.make({ localRelPath: second.localRelPath, provider: "box", workspaceId })
          );
          expect(O.map(foundByPath, (item) => item.id)).toEqual(O.some(second.id));

          const foundByRemoteId = yield* repository.findByRemoteId(
            FindSyncItemByRemoteIdInput.make({ provider: "box", remoteId, workspaceId })
          );
          expect(O.map(foundByRemoteId, (item) => item.id)).toEqual(O.some(first.id));

          const listed = yield* repository.listByWorkspace(
            ListSyncItemsByWorkspaceInput.make({ provider: "box", workspaceId })
          );
          expect(A.map(listed, (item) => item.id)).toEqual([first.id, second.id]);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "enqueues FIFO and requeues leases",
        Effect.fnUntraced(function* () {
          yield* migrateDocumentsSync();
          const repository = yield* makeDrizzleSyncOperationRepository();

          const first = yield* repository.enqueue(operationSeed("item-1:uploadFile:1"));
          const second = yield* repository.enqueue(operationSeed("item-1:uploadFile:2"));

          const queued = yield* repository.listQueued(
            ListQueuedSyncOperationsInput.make({ provider: "box", workspaceId })
          );
          expect(A.map(queued, (operation) => operation.id)).toEqual([first.id, second.id]);

          yield* repository.update(DomainSyncOperation.SyncOperation.make({ ...first, status: "leased" }));
          const requeued = yield* repository.requeueLeased(
            RequeueLeasedSyncOperationsInput.make({ provider: "box", workspaceId })
          );
          expect(requeued).toBe(1);

          const afterRecovery = yield* repository.listQueued(
            ListQueuedSyncOperationsInput.make({ provider: "box", workspaceId })
          );
          expect(A.map(afterRecovery, (operation) => operation.id)).toEqual([first.id, second.id]);

          const forItem = yield* repository.listQueuedForItem(
            ListQueuedSyncOperationsForItemInput.make({ syncItemId: syncItemOne, workspaceId })
          );
          expect(A.map(forItem, (operation) => operation.id)).toEqual([first.id, second.id]);

          yield* repository.update(DomainSyncOperation.SyncOperation.make({ ...second, status: "failed" }));
          const failedOperations = yield* repository.listByStatus(
            ListSyncOperationsByStatusInput.make({ provider: "box", status: "failed", workspaceId })
          );
          expect(A.map(failedOperations, (operation) => operation.id)).toEqual([second.id]);
          const queuedAfterFailure = yield* repository.listByStatus(
            ListSyncOperationsByStatusInput.make({ provider: "box", status: "queued", workspaceId })
          );
          expect(A.map(queuedAfterFailure, (operation) => operation.id)).toEqual([first.id]);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "upserts one cursor row per workspace mirror",
        Effect.fnUntraced(function* () {
          yield* migrateDocumentsSync();
          const repository = yield* makeDrizzleSyncCursorRepository();

          const created = yield* repository.upsert(
            SyncCursorSeed.make({ provider: "box", status: "active", streamPosition: "now", workspaceId })
          );
          const replaced = yield* repository.upsert(
            SyncCursorSeed.make({
              lastEventId: O.some("evt-2"),
              provider: "box",
              status: "active",
              streamPosition: "stream-position-2",
              workspaceId,
            })
          );

          expect(replaced.id).toBe(created.id);
          expect(replaced.streamPosition).toBe("stream-position-2");
          expect(replaced.lastEventId).toEqual(O.some("evt-2"));

          const found = yield* repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId }));
          expect(O.map(found, (cursor) => cursor.streamPosition)).toEqual(O.some("stream-position-2"));
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "dedupes drift records by remote event and marks them reviewed",
        Effect.fnUntraced(function* () {
          yield* migrateDocumentsSync();
          const repository = yield* makeDrizzleSyncConflictRepository();

          const recorded = yield* repository.record(conflictSeed(O.some("evt-1")));
          const replay = yield* repository.record(conflictSeed(O.some("evt-1")));
          expect(replay.id).toBe(recorded.id);

          const open = yield* repository.listOpen(ListOpenSyncConflictsInput.make({ provider: "box", workspaceId }));
          expect(A.map(open, (conflict) => conflict.id)).toEqual([recorded.id]);

          const reviewed = yield* repository.markReviewed(
            MarkSyncConflictReviewedInput.make({ conflictId: recorded.id })
          );
          expect(reviewed.resolutionStatus).toBe("reviewed");

          const openAfterReview = yield* repository.listOpen(
            ListOpenSyncConflictsInput.make({ provider: "box", workspaceId })
          );
          expect(openAfterReview).toEqual([]);
        }),
        pgliteIntegrationTimeoutMillis
      );

      // Keep this test LAST: on implicit-transaction pglite hosts the failed
      // duplicate statement aborts the shared session's transaction chain, so
      // no other suite statement may follow it.
      it.effect(
        "rejects duplicate idempotency keys at the database boundary",
        Effect.fnUntraced(function* () {
          yield* migrateDocumentsSync();
          const repository = yield* makeDrizzleSyncOperationRepository();

          yield* repository.enqueue(operationSeed("item-9:uploadFile:1"));
          const duplicate = yield* Effect.flip(repository.enqueue(operationSeed("item-9:uploadFile:1")));

          expect(SyncOperationRepositoryConflict.is(duplicate)).toBe(true);
          expect(duplicate._tag).toBe("SyncOperationRepositoryConflict");
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
