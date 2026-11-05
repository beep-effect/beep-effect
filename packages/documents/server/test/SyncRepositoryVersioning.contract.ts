/**
 * Optimistic-concurrency scenarios shared by the in-memory and Drizzle sync
 * repository suites, so both adapters prove the same `rowVersion` contract.
 */
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepositoryVersionConflict,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import {
  FindSyncCursorInput,
  SyncCursorRepositoryVersionConflict,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  FindSyncItemByPathInput,
  SyncItemRepositoryVersionConflict,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListQueuedSyncOperationsInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepositoryVersionConflict,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SyncConflictRepositoryShape } from "@beep/documents-use-cases/entities/SyncConflict/server";
import type { SyncCursorRepositoryShape } from "@beep/documents-use-cases/entities/SyncCursor/server";
import type { SyncItemRepositoryShape } from "@beep/documents-use-cases/entities/SyncItem/server";
import type { SyncOperationRepositoryShape } from "@beep/documents-use-cases/entities/SyncOperation/server";

const workspaceId = WorkspaceIdentity.WorkspaceId.make(7);
const generationOne = S.Natural.make(1);
const mirror = { provider: "box", workspaceId } as const;

/**
 * A full-entity `update` from a stale read fails with a version conflict that
 * names both versions, and leaves the winning write in place.
 */
export const staleSyncItemUpdate = Effect.fnUntraced(function* (repository: SyncItemRepositoryShape) {
  const created = yield* repository.create(
    SyncItemSeed.make({
      itemKind: "file",
      localGeneration: generationOne,
      localRelPath: VaultRelPath.make("matters/versioned/brief.pdf"),
      ...mirror,
      syncState: "pending",
    })
  );
  expect(created.rowVersion).toBe(1);

  const winner = yield* repository.update(DomainSyncItem.SyncItem.make({ ...created, syncState: "current" }));
  expect(winner.rowVersion).toBe(2);

  const stale = yield* Effect.flip(repository.update(DomainSyncItem.SyncItem.make({ ...created, syncState: "error" })));
  pipe(SyncItemRepositoryVersionConflict.is(stale), assertTrue);
  expect(stale).toMatchObject({ actualRowVersion: 2, expectedRowVersion: 1, syncItemId: created.id });

  const stored = yield* repository.findByPath(
    FindSyncItemByPathInput.make({ localRelPath: created.localRelPath, ...mirror })
  );
  assertSome(
    O.map(stored, (item) => [item.syncState, item.rowVersion] as const),
    ["current", 2] as const
  );

  // The winner's own copy is current, so it can keep writing.
  const next = yield* repository.update(DomainSyncItem.SyncItem.make({ ...winner, syncState: "pending" }));
  expect(next.rowVersion).toBe(3);
});

/**
 * `requeueLeased` advances `rowVersion`, so a worker still holding the leased
 * copy cannot write a result over the requeue.
 */
export const staleSyncOperationAfterRequeue = Effect.fnUntraced(function* (repository: SyncOperationRepositoryShape) {
  const enqueued = yield* repository.enqueue(
    SyncOperationSeed.make({
      attemptCount: S.Natural.make(0),
      idempotencyKey: "versioned-item:uploadFile:1",
      inputGeneration: generationOne,
      operationType: "uploadFile",
      ...mirror,
      status: "queued",
      syncItemId: Documents.SyncItemId.make(1),
      targetName: "brief.pdf",
      targetRelPath: VaultRelPath.make("matters/versioned/brief.pdf"),
    })
  );
  const leased = yield* repository.update(DomainSyncOperation.SyncOperation.make({ ...enqueued, status: "leased" }));
  expect(leased.rowVersion).toBe(2);

  const requeueLeased1 = yield* repository.requeueLeased(RequeueLeasedSyncOperationsInput.make(mirror));
  expect(requeueLeased1).toBe(1);
  const requeued = yield* repository.listQueued(ListQueuedSyncOperationsInput.make(mirror));
  expect(A.map(requeued, (operation) => [operation.id, operation.rowVersion] as const)).toEqual([[leased.id, 3]]);

  const stale = yield* Effect.flip(
    repository.update(DomainSyncOperation.SyncOperation.make({ ...leased, status: "succeeded" }))
  );
  pipe(SyncOperationRepositoryVersionConflict.is(stale), assertTrue);
  expect(stale).toMatchObject({ actualRowVersion: 3, expectedRowVersion: 2, syncOperationId: leased.id });

  const stillQueued = yield* repository.listQueued(ListQueuedSyncOperationsInput.make(mirror));
  expect(A.map(stillQueued, (operation) => operation.id)).toEqual([leased.id]);
});

const conflictSeed = (scope: typeof mirror, remoteEventId: string) =>
  SyncConflictSeed.make({
    conflictKind: "remoteEdit",
    ...scope,
    remoteEventId: O.some(remoteEventId),
    remotePayload: { eventType: "ITEM_MODIFY" },
    resolutionStatus: "open",
  });

/**
 * Each review advances the conflict's `rowVersion`.
 */
export const reviewAdvancesSyncConflictVersion = Effect.fnUntraced(function* (repository: SyncConflictRepositoryShape) {
  const recorded = yield* repository.record(conflictSeed(mirror, "versioned-evt-review"));
  expect(recorded.rowVersion).toBe(1);
  const reviewed = yield* repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: recorded.id }));
  expect([reviewed.resolutionStatus, reviewed.rowVersion]).toEqual(["reviewed", 2]);
  const listOpen2 = yield* repository.listOpen(ListOpenSyncConflictsInput.make(mirror));
  expect(listOpen2).toEqual([]);
});

/**
 * A review that loses the race to a write landing between its read and its
 * write fails with a version conflict instead of re-writing over it.
 *
 * `racing` builds the repository whose next write against the given row loses
 * that race.
 */
export const racedSyncConflictReview = Effect.fnUntraced(function* <R>(
  repository: SyncConflictRepositoryShape,
  racing: (conflictId: Documents.SyncConflictId) => Effect.Effect<SyncConflictRepositoryShape, never, R>
) {
  const scope = { provider: "box", workspaceId: WorkspaceIdentity.WorkspaceId.make(8) } as const;
  const recorded = yield* repository.record(conflictSeed(scope, "versioned-evt-race"));
  const raced = yield* racing(recorded.id);

  const lost = yield* Effect.flip(raced.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: recorded.id })));
  pipe(SyncConflictRepositoryVersionConflict.is(lost), assertTrue);
  expect(lost).toMatchObject({ actualRowVersion: 2, conflictId: recorded.id, expectedRowVersion: 1 });

  // The competing writer's row is untouched: still open, at its version.
  const open = yield* repository.listOpen(ListOpenSyncConflictsInput.make(scope));
  expect(A.map(open, (conflict) => [conflict.id, conflict.rowVersion] as const)).toEqual([[recorded.id, 2]]);
});

const cursorSeed = (scope: typeof mirror, streamPosition: string) =>
  SyncCursorSeed.make({ ...scope, status: "active", streamPosition });

/**
 * Each replacing upsert advances the cursor's `rowVersion`.
 */
export const upsertAdvancesSyncCursorVersion = Effect.fnUntraced(function* (repository: SyncCursorRepositoryShape) {
  const created = yield* repository.upsert(cursorSeed(mirror, "now"));
  const replaced = yield* repository.upsert(cursorSeed(mirror, "position-2"));
  expect([created.rowVersion, replaced.id, replaced.rowVersion]).toEqual([1, created.id, 2]);
});

/**
 * A replacing upsert that loses the race to a write landing between its read
 * and its write fails with a version conflict, so a stream position is never
 * overwritten by a writer that did not see it.
 */
export const racedSyncCursorUpsert = Effect.fnUntraced(function* <R>(
  repository: SyncCursorRepositoryShape,
  racing: (syncCursorId: Documents.SyncCursorId) => Effect.Effect<SyncCursorRepositoryShape, never, R>
) {
  const scope = { provider: "box", workspaceId: WorkspaceIdentity.WorkspaceId.make(8) } as const;
  const created = yield* repository.upsert(cursorSeed(scope, "now"));
  const raced = yield* racing(created.id);

  const lost = yield* Effect.flip(raced.upsert(cursorSeed(scope, "position-from-stale-read")));
  pipe(SyncCursorRepositoryVersionConflict.is(lost), assertTrue);
  expect(lost).toMatchObject({ actualRowVersion: 2, expectedRowVersion: 1, syncCursorId: created.id });

  const stored = yield* repository.find(FindSyncCursorInput.make(scope));
  assertSome(
    O.map(stored, (cursor) => [cursor.streamPosition, cursor.rowVersion] as const),
    ["now", 2] as const
  );
});
