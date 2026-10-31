import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DMS_MIRROR_FIXTURE_ROOT_ID,
  DmsMirrorFixtureHandle,
  makeVaultSyncEngine,
} from "@beep/documents-server/aggregates/Sync";
import { DocumentsSyncFixtureLive } from "@beep/documents-server/layer";
import {
  DmsMirror,
  DmsRemoteEvent,
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  MoveItemInput,
  RenameItemInput,
  SyncOnceInput,
  VaultSyncEngine,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  SyncConflictRepository,
  SyncConflictRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { FindSyncCursorInput, SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import { FindSyncItemByPathInput, SyncItemRepository } from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListSyncOperationsByStatusInput,
  SyncOperationRepository,
  SyncOperationRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";

const SyncDriftTestLayer = DocumentsSyncFixtureLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const workspaceId = WorkspaceIdentity.WorkspaceId.make(11);
const syncInput = (vaultRootPath: string) => SyncOnceInput.make({ vaultRootPath, workspaceId });
const listConflictsInput = ListOpenConflictsInput.make({ workspaceId });

const makeVaultRoot = Effect.fn("VaultSyncDriftTest.makeVaultRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-drift-" });
});

const writeVaultFile = Effect.fn("VaultSyncDriftTest.writeVaultFile")(function* (
  root: string,
  relPath: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, ...Str.split(relPath, "/"));
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, contents);
});

const findTrackedItem = (relPath: string) =>
  SyncItemRepository.pipe(
    Effect.flatMap((repository) =>
      repository.findByPath(
        FindSyncItemByPathInput.make({ localRelPath: VaultRelPath.make(relPath), provider: "box", workspaceId })
      )
    ),
    Effect.flatMap(Effect.fromOption)
  );

describe("@beep/documents-server VaultSyncEngine drift detection", () => {
  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "classifies unattributed remote delete, move, rename and unknown events inside the mirror",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* engine.syncOnce(syncInput(root));
        const eventTypes: ReadonlyArray<"deleted" | "moved" | "renamed" | "unknown"> = [
          "deleted",
          "moved",
          "renamed",
          "unknown",
        ];
        for (const eventType of eventTypes) {
          yield* handle.injectRemoteEvent(
            DmsRemoteEvent.make({
              eventId: `foreign-${eventType}`,
              eventType,
              itemKind: O.some("file"),
              name: O.some(`${eventType}.txt`),
              parentRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID),
              remoteId: O.some(RemoteItemId.make(`untracked-${eventType}`)),
              payload: { origin: "foreign" },
            })
          );
        }
        const status = yield* engine.syncOnce(syncInput(root));
        const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
        expect(status.openConflicts).toBe(4);
        expect(A.map(conflicts, (conflict) => [O.getOrNull(conflict.remoteEventId), conflict.conflictKind])).toEqual(
          expect.arrayContaining(A.map(eventTypes, (eventType) => [`foreign-${eventType}`, "remoteUnknown"]))
        );
        expect(A.length(conflicts)).toBe(4);
      })
    );
  });

  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "classifies foreign remote events, ignores echoes, and dedupes across polls",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "watched.txt", "watched body");
        const pushStatus = yield* engine.syncOnce(syncInput(root));
        expect(pushStatus.openConflicts).toBe(0);

        const tracked = yield* findTrackedItem("watched.txt");
        // Foreign edit of an unknown remote item under the mirror root.
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-create",
            eventType: "edited",
            itemKind: O.some("file"),
            name: O.some("mystery.txt"),
            parentRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID),
            payload: { origin: "test" },
            remoteId: O.some(RemoteItemId.make("fx-9999")),
          })
        );
        // Remote event without any item identifier: unattributable account
        // noise, ignored by design (never recorded as a conflict).
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({ eventId: "foreign-evt-unknown", eventType: "unknown", payload: { origin: "test" } })
        );
        // Unknown remote item whose parent is outside the mirror: invisible.
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-outside",
            eventType: "created",
            itemKind: O.some("file"),
            name: O.some("elsewhere.txt"),
            parentRemoteId: O.some(RemoteItemId.make("fx-elsewhere")),
            payload: { origin: "test" },
            remoteId: O.some(RemoteItemId.make("fx-8888")),
          })
        );
        // Remote rename of the tracked item that mismatches our pushed state.
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-rename",
            eventType: "renamed",
            itemKind: O.some("file"),
            name: O.some("hijacked.txt"),
            payload: { origin: "test" },
            remoteId: tracked.remoteId,
          })
        );

        const status = yield* engine.syncOnce(syncInput(root));
        const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
        const kindByEventId = A.map(conflicts, (conflict) => [
          O.getOrNull(conflict.remoteEventId),
          conflict.conflictKind,
        ]);

        expect(status.openConflicts).toBe(2);
        expect(status.conflictItems).toBe(1);
        expect(kindByEventId).toContainEqual(["foreign-evt-create", "remoteCreate"]);
        expect(kindByEventId).toContainEqual(["foreign-evt-rename", "remoteRename"]);
        // Unattributable and outside-mirror events never become conflicts.
        expect(A.map(kindByEventId, ([eventId]) => eventId)).not.toContain("foreign-evt-unknown");
        expect(A.map(kindByEventId, ([eventId]) => eventId)).not.toContain("foreign-evt-outside");
        const renameConflict = yield* Effect.fromOption(
          A.findFirst(conflicts, (conflict) => O.contains(conflict.remoteEventId, "foreign-evt-rename"))
        );
        expect(O.getOrNull(renameConflict.localRelPath)).toBe("watched.txt");
        expect(O.getOrNull(renameConflict.syncItemId)).toBe(tracked.id);

        // Replaying the same provider event id must not open a second conflict.
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-rename",
            eventType: "renamed",
            itemKind: O.some("file"),
            name: O.some("hijacked.txt"),
            payload: { origin: "test" },
            remoteId: tracked.remoteId,
          })
        );
        const replayStatus = yield* engine.syncOnce(syncInput(root));
        expect(replayStatus.openConflicts).toBe(2);
      })
    );
  });

  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "flags a remote delete as a conflict and keeps the local file untouched",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const fs = yield* FileSystem.FileSystem;
        const handle = yield* DmsMirrorFixtureHandle;
        const path = yield* Path.Path;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "kept.txt", "kept body");
        yield* engine.syncOnce(syncInput(root));

        const tracked = yield* findTrackedItem("kept.txt");
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-delete",
            eventType: "deleted",
            itemKind: O.some("file"),
            name: O.some("kept.txt"),
            payload: { origin: "test" },
            remoteId: tracked.remoteId,
          })
        );

        const status = yield* engine.syncOnce(syncInput(root));
        const conflicts = yield* engine.listOpenConflicts(listConflictsInput);

        expect(status.openConflicts).toBe(1);
        expect(A.map(conflicts, (conflict) => conflict.conflictKind)).toEqual(["remoteDelete"]);
        // One-way push posture: remote drift never mutates the local vault.
        expect(yield* fs.readFileString(path.join(root, "kept.txt"))).toBe("kept body");
      })
    );
  });

  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "marks a reviewed conflict and removes it from the open listing",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "reviewed.txt", "reviewed body");
        yield* engine.syncOnce(syncInput(root));
        const tracked = yield* findTrackedItem("reviewed.txt");
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-evt-review",
            eventType: "moved",
            itemKind: O.some("file"),
            name: O.some("reviewed.txt"),
            parentRemoteId: O.some(RemoteItemId.make("fx-8888")),
            payload: { origin: "test" },
            remoteId: tracked.remoteId,
          })
        );
        yield* engine.syncOnce(syncInput(root));
        const open = yield* engine.listOpenConflicts(listConflictsInput);
        const conflict = yield* Effect.fromOption(A.head(open));
        expect(conflict.conflictKind).toBe("remoteMove");

        const reviewed = yield* engine.markConflictReviewed(
          MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId })
        );

        expect(reviewed.resolutionStatus).toBe("reviewed");
        expect(yield* engine.listOpenConflicts(listConflictsInput)).toEqual([]);
      })
    );
  });

  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "survives an engine restart without duplicate pushes and resumes the stored cursor",
      Effect.fnUntraced(function* () {
        const cursorRepository = yield* SyncCursorRepository;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "matters/persisted.txt", "persisted body");

        const engineA = yield* makeVaultSyncEngine();
        const first = yield* engineA.syncOnce(syncInput(root));
        expect(first.currentItems).toBe(2);
        const storedCursor = yield* cursorRepository
          .find(FindSyncCursorInput.make({ provider: "box", workspaceId }))
          .pipe(Effect.flatMap(Effect.fromOption));

        // A fresh engine instance over the same repositories and remote fixture.
        const engineB = yield* makeVaultSyncEngine();
        const second = yield* engineB.syncOnce(syncInput(root));
        const counts = yield* handle.counts;
        const positions = yield* handle.requestedStreamPositions;

        expect(second.currentItems).toBe(2);
        expect(second.queuedOperations).toBe(0);
        expect(counts.ensureFolder).toBe(1);
        expect(counts.uploadFile).toBe(1);
        expect(counts.uploadFileVersion).toBe(0);
        deepStrictEqual(positions, [O.none(), O.some(storedCursor.streamPosition)]);
      })
    );
  });

  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "records a remote poll failure on the durable cursor without failing the sync pass",
      Effect.fnUntraced(function* () {
        const cursorRepository = yield* SyncCursorRepository;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        const engine = yield* makeVaultSyncEngine();

        yield* engine.syncOnce(syncInput(root));
        yield* handle.failNext("pollEvents", false);
        yield* engine.syncOnce(syncInput(root));

        const cursor = yield* cursorRepository
          .find(FindSyncCursorInput.make({ provider: "box", workspaceId }))
          .pipe(Effect.flatMap(Effect.fromOption));

        expect(cursor.status).toBe("error");
        assertSome<string>(cursor.lastError, "fixture injected pollEvents failure");
      })
    );
  });
});

describe("Vault review ownership and detached conflicts", () => {
  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects another workspace review and permits an unattached conflict to be reviewed once",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* engine.syncOnce(syncInput(root));
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "unattached-review",
            eventType: "created",
            parentRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID),
            remoteId: O.some(RemoteItemId.make("foreign-unattached")),
            payload: {},
          })
        );
        yield* engine.syncOnce(syncInput(root));
        const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
        assertNone(conflict.syncItemId);
        const foreign = MarkConflictReviewedInput.make({
          conflictId: conflict.id,
          workspaceId: WorkspaceIdentity.WorkspaceId.make(12),
        });
        const rejection = yield* Effect.flip(engine.markConflictReviewed(foreign));
        expect(rejection).toMatchObject({ _tag: "SyncConflictRepositoryNotFound", conflictId: conflict.id });
        expect(A.map(yield* engine.listOpenConflicts(listConflictsInput), (entry) => entry.id)).toEqual([conflict.id]);
        const own = MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId });
        expect((yield* engine.markConflictReviewed(own)).resolutionStatus).toBe("reviewed");
        expect(yield* engine.listOpenConflicts(listConflictsInput)).toEqual([]);
        expect(yield* Effect.flip(engine.markConflictReviewed(own))).toMatchObject({
          _tag: "SyncConflictRepositoryNotFound",
        });
        const status = yield* engine.status(VaultSyncStatusInput.make({ workspaceId, forceProbe: true }));
        expect(status.connected).toBe(true);
        expect(status.queuedOperations).toBe(0);
      })
    );
  });
  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "preserves a current item when reviewing an earlier unknown event",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const repository = yield* SyncItemRepository;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "current.txt", "local");
        yield* engine.syncOnce(syncInput(root));
        const tracked = yield* findTrackedItem("current.txt");
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "old-conflict",
            eventType: "unknown",
            remoteId: tracked.remoteId,
            payload: {},
          })
        );
        yield* engine.syncOnce(syncInput(root));
        const conflicted = yield* findTrackedItem("current.txt");
        expect(conflicted.syncState).toBe("conflict");
        const current = yield* repository.update(DomainSyncItem.SyncItem.make({ ...conflicted, syncState: "current" }));
        const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
        yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId }));
        const after = yield* findTrackedItem("current.txt");
        expect(after).toEqual(current);
        expect((yield* engine.status(VaultSyncStatusInput.make({ workspaceId }))).queuedOperations).toBe(0);
      })
    );
  });
  it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "classifies a conflicting remote create for an already tracked item as an edit",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const handle = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "tracked.txt", "local");
        yield* engine.syncOnce(syncInput(root));
        const tracked = yield* findTrackedItem("tracked.txt");
        yield* handle.injectRemoteEvent(
          DmsRemoteEvent.make({
            eventId: "foreign-recreate",
            eventType: "created",
            remoteId: tracked.remoteId,
            payload: {},
          })
        );
        yield* engine.syncOnce(syncInput(root));
        const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
        expect(conflict.conflictKind).toBe("remoteEdit");
        expect(O.getOrNull(conflict.syncItemId)).toBe(tracked.id);
      })
    );
  });
});

it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "recovers when the first remote poll fails before a cursor exists",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const cursors = yield* SyncCursorRepository;
      const root = yield* makeVaultRoot();
      yield* handle.failNext("pollEvents", false);
      const failedBootstrap = yield* engine.syncOnce(syncInput(root));
      assertNone(failedBootstrap.cursorPosition);
      assertNone(yield* cursors.find(FindSyncCursorInput.make({ provider: "box", workspaceId })));
      const recovered = yield* engine.syncOnce(syncInput(root));
      pipe(recovered.cursorPosition, O.isSome, assertTrue);
      expect(recovered.failedOperations).toBe(0);
    })
  );
});

it.layer(Layer.fresh(SyncDriftTestLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "restores a remotely renamed folder and its children after reviewing the drift",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const mirror = yield* DmsMirror;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "original/nested.txt", "retained child");
      yield* writeVaultFile(root, "other/keep.txt", "unaffected child");
      yield* engine.syncOnce(syncInput(root));
      const folder = yield* findTrackedItem("original");
      const remoteId = yield* Effect.fromOption(folder.remoteId);
      yield* mirror.renameItem(RenameItemInput.make({ itemKind: "folder", remoteId, newName: "renamed" }));
      expect((yield* handle.snapshotTree)["renamed/nested.txt"]).toBeDefined();
      yield* engine.syncOnce(syncInput(root));
      const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
      expect(conflict.conflictKind).toBe("remoteRename");
      yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId }));
      const recovered = yield* engine.syncOnce(syncInput(root));
      expect(recovered.pendingItems).toBe(0);
      expect(recovered.openConflicts).toBe(0);
      const tree = yield* handle.snapshotTree;
      assertSome((yield* findTrackedItem("original")).remoteId, remoteId);
      expect(tree.original?.itemKind).toBe("folder");
      expect(tree["original/nested.txt"]).toBeDefined();
      expect(tree["renamed/nested.txt"]).toBeUndefined();
      // A later review needs fresh intent, and two drift kinds must both be
      // queued even after the first review has moved the item to pending.
      const other = yield* findTrackedItem("other");
      yield* mirror.moveItem(MoveItemInput.make({ itemKind: "folder", remoteId, newParentRemoteId: other.remoteId }));
      yield* mirror.renameItem(RenameItemInput.make({ itemKind: "folder", remoteId, newName: "again" }));
      yield* engine.syncOnce(syncInput(root));
      const repeated = yield* engine.listOpenConflicts(listConflictsInput);
      expect(A.map(repeated, (entry) => entry.conflictKind)).toEqual(["remoteMove", "remoteRename"]);
      for (const entry of repeated) {
        yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: entry.id, workspaceId }));
        yield* engine.syncOnce(syncInput(root));
      }
      const restored = yield* engine.syncOnce(syncInput(root));
      expect(restored.pendingItems).toBe(0);
      expect(restored.openConflicts).toBe(0);
      const after = yield* handle.snapshotTree;
      expect(after["original/nested.txt"]).toBeDefined();
      expect(after["other/keep.txt"]).toBeDefined();
      expect(after["other/again/nested.txt"]).toBeUndefined();
      assertSome((yield* findTrackedItem("original")).remoteId, remoteId);
    })
  );
});

const FailedReviewEnqueueLayer = Layer.effect(
  SyncOperationRepository,
  Effect.map(SyncOperationRepository, (repository) =>
    SyncOperationRepository.of({
      ...repository,
      enqueue: Effect.fn("VaultReviewFailureTest.enqueue")((seed) =>
        Str.includes(":review:")(seed.idempotencyKey)
          ? Effect.fail(SyncOperationRepositoryUnavailable.make({ reason: "injected review queue failure" }))
          : repository.enqueue(seed)
      ),
    })
  )
).pipe(Layer.provideMerge(SyncDriftTestLayer));
const FailedReviewEngineLayer = Layer.effect(VaultSyncEngine, makeVaultSyncEngine()).pipe(
  Layer.provideMerge(FailedReviewEnqueueLayer)
);

it.layer(Layer.fresh(FailedReviewEngineLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "keeps the conflict visible when persisting its correction fails",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const mirror = yield* DmsMirror;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "unchanged.txt", "local content");
      yield* engine.syncOnce(syncInput(root));
      const item = yield* findTrackedItem("unchanged.txt");
      const remoteId = yield* Effect.fromOption(item.remoteId);
      yield* mirror.renameItem(RenameItemInput.make({ itemKind: "file", remoteId, newName: "drifted.txt" }));
      yield* engine.syncOnce(syncInput(root));
      const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
      const error = yield* Effect.flip(
        engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId }))
      );
      expect(error).toMatchObject({
        _tag: "SyncOperationRepositoryUnavailable",
        reason: "injected review queue failure",
      });
      const open = yield* engine.listOpenConflicts(listConflictsInput);
      expect(A.map(open, (entry) => entry.id)).toEqual([conflict.id]);
      expect((yield* findTrackedItem("unchanged.txt")).syncState).toBe("conflict");
    })
  );
});

const FailedReviewCloseLayer = Layer.effect(
  SyncConflictRepository,
  Effect.gen(function* () {
    const repository = yield* SyncConflictRepository;
    const failNextClose = yield* Ref.make(true);
    return SyncConflictRepository.of({
      ...repository,
      markReviewed: Effect.fn("VaultReviewCloseFailureTest.markReviewed")((input) =>
        Ref.getAndSet(failNextClose, false).pipe(
          Effect.flatMap((fail) =>
            fail
              ? Effect.fail(SyncConflictRepositoryUnavailable.make({ reason: "injected review close failure" }))
              : repository.markReviewed(input)
          )
        )
      ),
    });
  })
).pipe(Layer.provideMerge(SyncDriftTestLayer));
const UniqueReviewOperationLayer = Layer.effect(
  SyncOperationRepository,
  Effect.gen(function* () {
    const repository = yield* SyncOperationRepository;
    return SyncOperationRepository.of({
      ...repository,
      update: Effect.fn("VaultReviewIdentityTest.update")(function* (operation) {
        for (const status of ["queued", "leased", "succeeded", "failed"] as const) {
          const recorded = yield* repository.listByStatus(
            ListSyncOperationsByStatusInput.make({ provider: "box", workspaceId, status })
          );
          if (
            A.some(recorded, (other) => other.id !== operation.id && other.idempotencyKey === operation.idempotencyKey)
          ) {
            return yield* SyncOperationRepositoryUnavailable.make({ reason: "duplicate operation identity" });
          }
        }
        return yield* repository.update(operation);
      }),
    });
  })
).pipe(Layer.provideMerge(FailedReviewCloseLayer));
const FailedReviewCloseEngineLayer = Layer.effect(VaultSyncEngine, makeVaultSyncEngine()).pipe(
  Layer.provideMerge(UniqueReviewOperationLayer)
);

for (const laterReview of [false, true]) {
  for (const itemKind of ["file", "folder"] as const) {
    for (const correction of ["rename", "move"] as const) {
      it.layer(Layer.fresh(FailedReviewCloseEngineLayer), { timeout: "10 seconds" })((it) => {
        it.effect(
          `preserves ${laterReview ? "a newer queued review" : "the current item"} when retrying ${itemKind} ${correction} review close`,
          Effect.fnUntraced(function* () {
            const engine = yield* VaultSyncEngine;
            const mirror = yield* DmsMirror;
            const handle = yield* DmsMirrorFixtureHandle;
            const root = yield* makeVaultRoot();
            const originalPath = itemKind === "file" ? "original.txt" : "original";
            yield* writeVaultFile(root, itemKind === "file" ? originalPath : "original/child.txt", "unchanged bytes");
            yield* writeVaultFile(root, "other/keep.txt", "unrelated bytes");
            yield* engine.syncOnce(syncInput(root));
            const item = yield* findTrackedItem(originalPath);
            const remoteId = yield* Effect.fromOption(item.remoteId);
            if (correction === "rename") {
              yield* mirror.renameItem(RenameItemInput.make({ itemKind, remoteId, newName: "renamed" }));
            } else {
              const other = yield* findTrackedItem("other");
              yield* mirror.moveItem(MoveItemInput.make({ itemKind, remoteId, newParentRemoteId: other.remoteId }));
            }
            yield* engine.syncOnce(syncInput(root));
            const conflict = yield* Effect.fromOption(A.head(yield* engine.listOpenConflicts(listConflictsInput)));
            const review = MarkConflictReviewedInput.make({ conflictId: conflict.id, workspaceId });
            const failure = yield* Effect.flip(engine.markConflictReviewed(review));
            expect(failure).toMatchObject({
              _tag: "SyncConflictRepositoryUnavailable",
              reason: "injected review close failure",
            });
            expect((yield* engine.status(VaultSyncStatusInput.make({ workspaceId }))).queuedOperations).toBe(1);
            yield* engine.syncOnce(syncInput(root));
            const corrected = yield* findTrackedItem(originalPath);
            expect(corrected.syncState).toBe("current");
            const counts = yield* handle.counts;
            const operations = yield* SyncOperationRepository;
            const queuedInput = ListSyncOperationsByStatusInput.make({
              provider: "box",
              workspaceId,
              status: "queued",
            });
            if (laterReview) {
              if (correction === "rename") {
                yield* mirror.renameItem(RenameItemInput.make({ itemKind, remoteId, newName: "later-drift" }));
              } else {
                const other = yield* findTrackedItem("other");
                yield* mirror.moveItem(MoveItemInput.make({ itemKind, remoteId, newParentRemoteId: other.remoteId }));
              }
              yield* engine.syncOnce(syncInput(root));
              const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
              const next = yield* Effect.fromOption(A.findFirst(conflicts, (entry) => entry.id !== conflict.id));
              yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: next.id, workspaceId }));
            }
            const queuedBeforeRetry = yield* operations.listByStatus(queuedInput);
            const itemBeforeRetry = yield* findTrackedItem(originalPath);
            expect((yield* engine.markConflictReviewed(review)).resolutionStatus).toBe("reviewed");
            expect(yield* findTrackedItem(originalPath)).toEqual(itemBeforeRetry);
            expect(yield* operations.listByStatus(queuedInput)).toEqual(queuedBeforeRetry);
            const afterRetry = yield* engine.status(VaultSyncStatusInput.make({ workspaceId }));
            expect(afterRetry.pendingItems).toBe(laterReview ? 1 : 0);
            expect(afterRetry.queuedOperations).toBe(laterReview ? 1 : 0);
            expect(afterRetry.openConflicts).toBe(0);
            const converged = yield* engine.syncOnce(syncInput(root));
            expect(converged.pendingItems).toBe(0);
            expect(converged.queuedOperations).toBe(0);
            const afterCounts = yield* handle.counts;
            expect(afterCounts.uploadFileVersion).toBe(counts.uploadFileVersion);
            expect(afterCounts.renameItem).toBe(counts.renameItem + (laterReview && correction === "rename" ? 2 : 0));
            expect(afterCounts.moveItem).toBe(counts.moveItem + (laterReview && correction === "move" ? 2 : 0));
          })
        );
      });
    }
  }
}

for (const pathChange of ["rename", "move"] as const) {
  it.layer(Layer.fresh(FailedReviewCloseEngineLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      `retains two queued review identities when the local file is ${pathChange}d before pushing`,
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const mirror = yield* DmsMirror;
        const operations = yield* SyncOperationRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "original.txt", "unchanged bytes");
        yield* writeVaultFile(root, "other/keep.txt", "other bytes");
        yield* engine.syncOnce(syncInput(root));
        // The ordinary completed rename key ends in :review:2. Review2 must
        // have a distinct namespace rather than collide with this valid path.
        yield* fs.rename(path.join(root, "original.txt"), path.join(root, "review"));
        yield* engine.syncOnce(syncInput(root));
        const item = yield* findTrackedItem("review");
        const remoteId = yield* Effect.fromOption(item.remoteId);
        for (const newName of ["first-drift.txt", "second-drift.txt"]) {
          yield* mirror.renameItem(RenameItemInput.make({ itemKind: "file", remoteId, newName }));
        }
        yield* engine.syncOnce(syncInput(root));
        const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
        expect(A.length(conflicts)).toBe(2);
        const first = yield* Effect.fromOption(A.head(conflicts));
        yield* Effect.flip(
          engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: first.id, workspaceId }))
        );
        const second = yield* Effect.fromOption(A.last(conflicts));
        yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: second.id, workspaceId }));
        const queuedInput = ListSyncOperationsByStatusInput.make({ provider: "box", workspaceId, status: "queued" });
        const queued = yield* operations.listByStatus(queuedInput);
        expect(A.length(queued)).toBe(2);
        const destination = pathChange === "rename" ? "renamed.txt" : "other/review";
        yield* fs.rename(path.join(root, "review"), path.join(root, ...Str.split(destination, "/")));
        const status = yield* engine.syncOnce(syncInput(root));
        const succeeded = yield* operations.listByStatus(
          ListSyncOperationsByStatusInput.make({ provider: "box", workspaceId, status: "succeeded" })
        );
        for (const original of queued) {
          const stored = yield* Effect.fromOption(A.findFirst(succeeded, (operation) => operation.id === original.id));
          expect(stored.idempotencyKey).toBe(original.idempotencyKey);
          expect(stored.targetRelPath).toBe(destination);
        }
        expect(status.pendingItems).toBe(0);
        expect(status.queuedOperations).toBe(0);
        const current = yield* findTrackedItem(destination);
        expect(current.id).toBe(item.id);
        expect(current.remoteId).toEqual(item.remoteId);
        expect(current.syncState).toBe("current");
        // A retry after the path/generation changed still addresses A's
        // original recorded identity instead of creating a third correction.
        yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: first.id, workspaceId }));
        expect(yield* operations.listByStatus(queuedInput)).toEqual([]);
        expect(yield* findTrackedItem(destination)).toEqual(current);
      })
    );
  });
}
