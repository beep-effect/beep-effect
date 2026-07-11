import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { DmsMirrorFixtureHandle, makeVaultSyncEngine } from "@beep/documents-server/aggregates/Sync";
import { DocumentsSyncFixtureLive } from "@beep/documents-server/layer";
import {
  DmsRemoteEvent,
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  SyncOnceInput,
  VaultSyncEngine,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { FindSyncCursorInput, SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import { FindSyncItemByPathInput, SyncItemRepository } from "@beep/documents-use-cases/entities/SyncItem/server";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const SyncDriftTestLayer = DocumentsSyncFixtureLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const workspaceId = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(11);
const decodeVaultRelPath = S.decodeUnknownSync(VaultRelPath);
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
        FindSyncItemByPathInput.make({ localRelPath: decodeVaultRelPath(relPath), provider: "box", workspaceId })
      )
    ),
    Effect.flatMap(Effect.fromOption)
  );

describe("@beep/documents-server VaultSyncEngine drift detection", () => {
  it.effect("classifies foreign remote events, ignores echoes, and dedupes across polls", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "watched.txt", "watched body");
      const pushStatus = yield* engine.syncOnce(syncInput(root));
      expect(pushStatus.openConflicts).toBe(0);

      const tracked = yield* findTrackedItem("watched.txt");
      // Foreign edit of a remote item the mirror never pushed.
      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({
          eventId: "foreign-evt-create",
          eventType: "edited",
          itemKind: O.some("file"),
          name: O.some("mystery.txt"),
          payload: { origin: "test" },
          remoteId: O.some(RemoteItemId.make("fx-9999")),
        })
      );
      // Remote event without any item identifier.
      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({ eventId: "foreign-evt-unknown", eventType: "unknown", payload: { origin: "test" } })
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

      expect(status.openConflicts).toBe(3);
      expect(status.conflictItems).toBe(1);
      expect(kindByEventId).toContainEqual(["foreign-evt-create", "remoteCreate"]);
      expect(kindByEventId).toContainEqual(["foreign-evt-unknown", "remoteUnknown"]);
      expect(kindByEventId).toContainEqual(["foreign-evt-rename", "remoteRename"]);
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
      expect(replayStatus.openConflicts).toBe(3);
    }).pipe(provideScopedLayer(SyncDriftTestLayer))
  );

  it.effect("flags a remote delete as a conflict and keeps the local file untouched", () =>
    Effect.gen(function* () {
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
    }).pipe(provideScopedLayer(SyncDriftTestLayer))
  );

  it.effect("marks a reviewed conflict and removes it from the open listing", () =>
    Effect.gen(function* () {
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

      const reviewed = yield* engine.markConflictReviewed(MarkConflictReviewedInput.make({ conflictId: conflict.id }));

      expect(reviewed.resolutionStatus).toBe("reviewed");
      expect(yield* engine.listOpenConflicts(listConflictsInput)).toEqual([]);
    }).pipe(provideScopedLayer(SyncDriftTestLayer))
  );

  it.effect("survives an engine restart without duplicate pushes and resumes the stored cursor", () =>
    Effect.gen(function* () {
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
      expect(positions).toEqual([O.none(), O.some(storedCursor.streamPosition)]);
    }).pipe(provideScopedLayer(SyncDriftTestLayer))
  );
});
