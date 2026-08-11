import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { DMS_MIRROR_FIXTURE_ROOT_ID, DmsMirrorFixtureHandle } from "@beep/documents-server/aggregates/Sync";
import { DocumentsSyncFixtureLive } from "@beep/documents-server/layer";
import {
  DmsRemoteEvent,
  ListOpenConflictsInput,
  SyncOnceInput,
  VaultSyncEngine,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  FindSyncItemByPathInput,
  SyncItemRepository,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListSyncOperationsByStatusInput,
  SyncOperationRepository,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { NonNegativeInt } from "@beep/schema";
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

const RegressionTestLayer = DocumentsSyncFixtureLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const workspaceId = S.decodeSync(WorkspaceIdentity.WorkspaceId)(21);
const decodeVaultRelPath = S.decodeUnknownSync(VaultRelPath);
const syncInput = (vaultRootPath: string) => SyncOnceInput.make({ vaultRootPath, workspaceId });
const listConflictsInput = ListOpenConflictsInput.make({ workspaceId });

const makeVaultRoot = Effect.fn("VaultSyncReviewRegressionsTest.makeVaultRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-regression-" });
});

const vaultAbsolutePath = Effect.fn("VaultSyncReviewRegressionsTest.vaultAbsolutePath")(function* (
  root: string,
  relPath: string
) {
  const path = yield* Path.Path;
  return path.join(root, ...Str.split(relPath, "/"));
});

const writeVaultFile = Effect.fn("VaultSyncReviewRegressionsTest.writeVaultFile")(function* (
  root: string,
  relPath: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = yield* vaultAbsolutePath(root, relPath);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, contents);
});

const removeVaultPath = Effect.fn("VaultSyncReviewRegressionsTest.removeVaultPath")(function* (
  root: string,
  relPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const target = yield* vaultAbsolutePath(root, relPath);
  yield* fs.remove(target, { recursive: true });
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

const listOperationsByStatus = (status: "failed" | "leased" | "queued") =>
  SyncOperationRepository.pipe(
    Effect.flatMap((repository) =>
      repository.listByStatus(ListSyncOperationsByStatusInput.make({ provider: "box", status, workspaceId }))
    )
  );

describe("@beep/documents-server VaultSyncEngine review regressions", () => {
  it.effect(
    "does not self-conflict when a file is moved and renamed between scans",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "inbox/scan.pdf", "scan body");
      yield* engine.syncOnce(syncInput(root));

      // Move + rename in one step: inbox/scan.pdf -> matters/acme-complaint.pdf.
      yield* writeVaultFile(root, "matters/acme-complaint.pdf", "scan body");
      yield* removeVaultPath(root, "inbox/scan.pdf");
      const afterMove = yield* engine.syncOnce(syncInput(root));

      expect(afterMove.openConflicts).toBe(0);
      expect(afterMove.conflictItems).toBe(0);
      expect(afterMove.errorItems).toBe(0);
      const moved = yield* findTrackedItem("matters/acme-complaint.pdf");
      expect(O.getOrNull(moved.remoteName)).toBe("acme-complaint.pdf");
      expect(moved.syncState).toBe("current");
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "uploads a new file created at a previously vacated path",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "inbox/scan.pdf", "first scan");
      yield* engine.syncOnce(syncInput(root));

      // File the first scan away, then a new document lands under the same name.
      yield* writeVaultFile(root, "matters/scan.pdf", "first scan");
      yield* removeVaultPath(root, "inbox/scan.pdf");
      yield* engine.syncOnce(syncInput(root));
      yield* writeVaultFile(root, "inbox/scan.pdf", "second scan with different content");
      const status = yield* engine.syncOnce(syncInput(root));

      expect(status.pendingItems).toBe(0);
      expect(status.queuedOperations).toBe(0);
      const tree = yield* handle.snapshotTree;
      expect(Object.keys(tree)).toContain("inbox/scan.pdf");
      expect(Object.keys(tree)).toContain("matters/scan.pdf");
      const second = yield* findTrackedItem("inbox/scan.pdf");
      expect(second.syncState).toBe("current");
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "fails the operation instead of wedging the pass when a queued upload's file vanished",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const itemRepository = yield* SyncItemRepository;
      const operationRepository = yield* SyncOperationRepository;
      const root = yield* makeVaultRoot();
      // Seed a tracked file plus its queued upload whose local bytes are gone
      // (crash between scan and pump, then the user deleted the file).
      const seeded = yield* itemRepository.create(
        SyncItemSeed.make({
          itemKind: "file",
          localGeneration: NonNegativeInt.make(1),
          localRelPath: decodeVaultRelPath("ghost.txt"),
          provider: "box",
          syncState: "pending",
          workspaceId,
        })
      );
      yield* operationRepository.enqueue(
        SyncOperationSeed.make({
          attemptCount: NonNegativeInt.make(0),
          idempotencyKey: `box:${workspaceId}:${seeded.id}:uploadFile:ghost.txt:1`,
          inputGeneration: NonNegativeInt.make(1),
          operationType: "uploadFile",
          provider: "box",
          status: "queued",
          syncItemId: seeded.id,
          targetName: "ghost.txt",
          targetRelPath: decodeVaultRelPath("ghost.txt"),
          workspaceId,
        })
      );

      const status = yield* engine.syncOnce(syncInput(root));

      expect(status.queuedOperations).toBe(0);
      const leased = yield* listOperationsByStatus("leased");
      expect(leased).toEqual([]);
      const failed = yield* listOperationsByStatus("failed");
      expect(A.length(failed)).toBe(1);
      // The engine keeps returning status snapshots afterwards (no wedge), and
      // recovery does not revive an operation whose file is still absent.
      const again = yield* engine.syncOnce(syncInput(root));
      expect(again.queuedOperations).toBe(0);
      expect(again.failedOperations).toBe(1);
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "surfaces a foreign in-place remote edit as drift even when name and parent match",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "watched.txt", "watched body");
      yield* engine.syncOnce(syncInput(root));
      const tracked = yield* findTrackedItem("watched.txt");

      // A third party edits the file's content in place: name and parent still
      // match our pushed state, so only the event class can reveal the drift.
      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({
          eventId: "foreign-in-place-edit",
          eventType: "edited",
          itemKind: O.some("file"),
          name: tracked.remoteName,
          parentRemoteId: tracked.remoteParentId,
          payload: { origin: "test" },
          remoteId: tracked.remoteId,
        })
      );
      const status = yield* engine.syncOnce(syncInput(root));

      expect(status.openConflicts).toBe(1);
      const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
      const conflict = yield* Effect.fromOption(A.head(conflicts));
      expect(conflict.conflictKind).toBe("remoteEdit");
      expect(O.contains(conflict.remoteEventId, "foreign-in-place-edit")).toBe(true);
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "revives terminally failed operations once the mirror is reachable again",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "resilient.txt", "resilient body");
      // Non-retryable failure exhausts the operation immediately.
      yield* handle.failNext("uploadFile", false);
      const failedStatus = yield* engine.syncOnce(syncInput(root));
      expect(failedStatus.failedOperations).toBe(1);
      expect(failedStatus.errorItems).toBe(1);

      // Next pass with a healthy mirror revives and converges.
      const recovered = yield* engine.syncOnce(syncInput(root));

      expect(recovered.failedOperations).toBe(0);
      expect(recovered.errorItems).toBe(0);
      expect(recovered.currentItems).toBe(1);
      const tree = yield* handle.snapshotTree;
      expect(Object.keys(tree)).toContain("resilient.txt");
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "skips symlinks entirely: no mirror leak and no scan abort on dangling links",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeVaultRoot();
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-outside-" });
      yield* fs.writeFileString(path.join(outside, "secret.txt"), "outside the vault");
      yield* writeVaultFile(root, "tracked.txt", "tracked body");
      yield* fs.symlink(path.join(outside, "secret.txt"), path.join(root, "leak.txt"));
      yield* fs.symlink(path.join(root, "missing.txt"), path.join(root, "dangling.txt"));

      const status = yield* engine.syncOnce(syncInput(root));

      expect(status.currentItems).toBe(1);
      expect(status.errorItems).toBe(0);
      const tree = yield* handle.snapshotTree;
      expect(Object.keys(tree)).toEqual(["tracked.txt"]);
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "ignores unknown remote events outside the mirror and records those under the root",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "anchor.txt", "anchor body");
      yield* engine.syncOnce(syncInput(root));

      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({
          eventId: "under-root-create",
          eventType: "created",
          itemKind: O.some("file"),
          name: O.some("dropped.txt"),
          parentRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID),
          payload: { origin: "test" },
          remoteId: O.some(RemoteItemId.make("fx-under-root")),
        })
      );
      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({
          eventId: "outside-create",
          eventType: "created",
          itemKind: O.some("file"),
          name: O.some("unrelated.txt"),
          parentRemoteId: O.some(RemoteItemId.make("fx-unrelated-parent")),
          payload: { origin: "test" },
          remoteId: O.some(RemoteItemId.make("fx-outside")),
        })
      );
      const status = yield* engine.syncOnce(syncInput(root));

      expect(status.openConflicts).toBe(1);
      const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
      const conflict = yield* Effect.fromOption(A.head(conflicts));
      expect(O.contains(conflict.remoteEventId, "under-root-create")).toBe(true);
      expect(conflict.conflictKind).toBe("remoteCreate");
    }, provideScopedLayer(RegressionTestLayer))
  );

  it.effect(
    "truncates oversized drift payload snapshots",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "payload.txt", "payload body");
      yield* engine.syncOnce(syncInput(root));

      yield* handle.injectRemoteEvent(
        DmsRemoteEvent.make({
          eventId: "oversized-payload",
          eventType: "created",
          itemKind: O.some("file"),
          name: O.some("huge.txt"),
          parentRemoteId: O.some(DMS_MIRROR_FIXTURE_ROOT_ID),
          payload: { blob: "x".repeat(32768), origin: "test" },
          remoteId: O.some(RemoteItemId.make("fx-huge")),
        })
      );
      yield* engine.syncOnce(syncInput(root));

      const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
      const conflict = yield* Effect.fromOption(A.head(conflicts));
      expect(conflict.remotePayload.truncated).toBe(true);
      expect(String(conflict.remotePayload.head).length).toBeLessThanOrEqual(8192);
    }, provideScopedLayer(RegressionTestLayer))
  );
});
