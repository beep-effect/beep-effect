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
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const RegressionTestLayer = DocumentsSyncFixtureLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const workspaceId = WorkspaceIdentity.WorkspaceId.make(21);
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
        FindSyncItemByPathInput.make({ localRelPath: VaultRelPath.make(relPath), provider: "box", workspaceId })
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
  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
        expect(R.keys(tree)).toContain("inbox/scan.pdf");
        expect(R.keys(tree)).toContain("matters/scan.pdf");
        assertSome<string>(
          pipe(
            O.fromUndefinedOr(tree["matters/scan.pdf"]),
            O.flatMap((node) => node.contentDigest)
          ),
          "2277f3ddd80c30d9a85a324facb482ab3c54062a30ebcf7956c4dc57670b82b2"
        );
        assertSome<string>(
          pipe(
            O.fromUndefinedOr(tree["inbox/scan.pdf"]),
            O.flatMap((node) => node.contentDigest)
          ),
          "4be69c01167b8eb92398b5cd9dab7cdc955fc45888a1450db6e7e35b54c8c0c5"
        );
        const second = yield* findTrackedItem("inbox/scan.pdf");
        expect(second.syncState).toBe("current");
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
            localGeneration: S.Natural.make(1),
            localRelPath: VaultRelPath.make("ghost.txt"),
            provider: "box",
            syncState: "pending",
            workspaceId,
          })
        );
        yield* operationRepository.enqueue(
          SyncOperationSeed.make({
            attemptCount: S.Natural.make(0),
            idempotencyKey: `box:${workspaceId}:${seeded.id}:uploadFile:ghost.txt:1`,
            inputGeneration: S.Natural.make(1),
            operationType: "uploadFile",
            provider: "box",
            status: "queued",
            syncItemId: seeded.id,
            targetName: "ghost.txt",
            targetRelPath: VaultRelPath.make("ghost.txt"),
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
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
        pipe(O.contains(conflict.remoteEventId, "foreign-in-place-edit"), assertTrue);
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
        expect(R.keys(tree)).toContain("resilient.txt");
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "revives two failed operations of one item without a version conflict on the item",
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const itemRepository = yield* SyncItemRepository;
        const operationRepository = yield* SyncOperationRepository;
        const root = yield* makeVaultRoot();
        yield* writeVaultFile(root, "twice-failed.txt", "twice failed body");
        const seeded = yield* itemRepository.create(
          SyncItemSeed.make({
            itemKind: "file",
            localGeneration: S.Natural.make(1),
            localRelPath: VaultRelPath.make("twice-failed.txt"),
            provider: "box",
            syncState: "error",
            workspaceId,
          })
        );
        // Both operations pass revive eligibility, so one pass revives the
        // item twice: the second revive must start from the first's write.
        yield* Effect.forEach(["uploadFile", "renameItem"] as const, (operationType) =>
          operationRepository.enqueue(
            SyncOperationSeed.make({
              attemptCount: S.Natural.make(3),
              idempotencyKey: `box:${workspaceId}:${seeded.id}:${operationType}:twice-failed.txt:1`,
              inputGeneration: S.Natural.make(1),
              lastError: O.some("mirror rejected the push"),
              operationType,
              provider: "box",
              status: "failed",
              syncItemId: seeded.id,
              targetName: "twice-failed.txt",
              targetRelPath: VaultRelPath.make("twice-failed.txt"),
              workspaceId,
            })
          )
        );

        const status = yield* engine.syncOnce(syncInput(root));

        expect(status.failedOperations).toBe(0);
        expect(status.errorItems).toBe(0);
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
        expect(R.keys(tree)).toEqual(["tracked.txt"]);
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
        pipe(O.contains(conflict.remoteEventId, "under-root-create"), assertTrue);
        expect(conflict.conflictKind).toBe("remoteCreate");
      })
    );
  });

  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
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
            payload: { blob: Str.repeat(32768)("x"), origin: "test" },
            remoteId: O.some(RemoteItemId.make("fx-huge")),
          })
        );
        yield* engine.syncOnce(syncInput(root));

        const conflicts = yield* engine.listOpenConflicts(listConflictsInput);
        const conflict = yield* Effect.fromOption(A.head(conflicts));
        pipe(conflict.remotePayload.truncated, assertTrue);
        expect(String(conflict.remotePayload.head).length).toBeLessThanOrEqual(8192);
        // The first nine JSON characters are {"blob":"; the remaining prefix is the injected blob.
        expect(conflict.remotePayload.head).toBe(`{"blob":"${Str.repeat(8183)("x")}`);
      })
    );
  });
});

for (const previousKind of ["file", "folder"] as const) {
  describe(`Vault kind replacement from ${previousKind}`, () => {
    it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
      it.effect(
        "supersedes incompatible queued work and converges the replacement kind",
        Effect.fnUntraced(function* () {
          const engine = yield* VaultSyncEngine;
          const items = yield* SyncItemRepository;
          const operations = yield* SyncOperationRepository;
          const mirror = yield* DmsMirrorFixtureHandle;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* makeVaultRoot();
          const target = "replaced";
          const replacementKind = previousKind === "file" ? "folder" : "file";
          const seeded = yield* items.create(
            SyncItemSeed.make({
              itemKind: previousKind,
              localGeneration: S.Natural.make(1),
              localRelPath: VaultRelPath.make(target),
              provider: "box",
              syncState: "pending",
              workspaceId,
            })
          );
          const oldOperation = yield* operations.enqueue(
            SyncOperationSeed.make({
              attemptCount: S.Natural.make(0),
              idempotencyKey: `replace-${previousKind}`,
              inputGeneration: S.Natural.make(1),
              operationType: previousKind === "file" ? "uploadFile" : "createFolder",
              provider: "box",
              status: "queued",
              syncItemId: seeded.id,
              targetName: target,
              targetRelPath: VaultRelPath.make(target),
              workspaceId,
            })
          );
          if (replacementKind === "folder") {
            yield* fs.makeDirectory(path.join(root, target));
          } else {
            yield* writeVaultFile(root, target, "replacement bytes");
          }
          const status = yield* engine.syncOnce(syncInput(root));
          const failed = yield* listOperationsByStatus("failed");
          expect(A.map(failed, (operation) => operation.id)).toEqual([oldOperation.id]);
          expect(O.getOrNull(failed[0]?.lastError ?? O.none())).toBe(
            `superseded: ${target} changed kind to ${replacementKind}`
          );
          const replacement = yield* findTrackedItem(target);
          expect(replacement.id).toBe(seeded.id);
          expect(replacement.itemKind).toBe(replacementKind);
          expect(replacement.localGeneration).toBe(2);
          expect(replacement.syncState).toBe("current");
          expect((yield* mirror.snapshotTree)[target]?.itemKind).toBe(replacementKind);
          expect(status.queuedOperations).toBe(0);
          const again = yield* engine.syncOnce(syncInput(root));
          expect(again.failedOperations).toBe(1);
          expect(again.queuedOperations).toBe(0);
        })
      );
    });
  });
}

it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "does not recover or execute operations pointing into another workspace",
    Effect.fnUntraced(function* () {
      const engine = yield* VaultSyncEngine;
      const items = yield* SyncItemRepository;
      const operations = yield* SyncOperationRepository;
      const mirror = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      const foreignWorkspace = WorkspaceIdentity.WorkspaceId.make(22);
      const foreign = yield* items.create(
        SyncItemSeed.make({
          itemKind: "file",
          localGeneration: S.Natural.make(1),
          localRelPath: VaultRelPath.make("foreign.txt"),
          provider: "box",
          syncState: "pending",
          workspaceId: foreignWorkspace,
        })
      );
      for (const status of ["queued", "failed"] as const) {
        yield* operations.enqueue(
          SyncOperationSeed.make({
            attemptCount: S.Natural.make(0),
            idempotencyKey: `foreign-operation-${status}`,
            inputGeneration: S.Natural.make(1),
            operationType: "uploadFile",
            provider: "box",
            status,
            syncItemId: foreign.id,
            targetName: "foreign.txt",
            targetRelPath: VaultRelPath.make("foreign.txt"),
            workspaceId,
          })
        );
      }
      const status = yield* engine.syncOnce(syncInput(root));
      expect(status.queuedOperations).toBe(1);
      expect(status.failedOperations).toBe(1);
      expect((yield* mirror.counts).uploadFile).toBe(0);
      const after = yield* items.findByPath(
        FindSyncItemByPathInput.make({
          localRelPath: foreign.localRelPath,
          provider: "box",
          workspaceId: foreignWorkspace,
        })
      );
      expect(O.getOrNull(after)).toEqual(foreign);
    })
  );
});

for (const missing of ["remote-id", "parent"] as const) {
  it.layer(Layer.fresh(RegressionTestLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      `leaves an operation queued without burning attempts when its ${missing} is missing`,
      Effect.fnUntraced(function* () {
        const engine = yield* VaultSyncEngine;
        const items = yield* SyncItemRepository;
        const operations = yield* SyncOperationRepository;
        const mirror = yield* DmsMirrorFixtureHandle;
        const root = yield* makeVaultRoot();
        const localRelPath = VaultRelPath.make("waiting.txt");
        const item = yield* items.create(
          SyncItemSeed.make({
            itemKind: "file",
            localGeneration: S.Natural.make(1),
            localRelPath,
            provider: "box",
            syncState: "pending",
            workspaceId,
          })
        );
        const seed = SyncOperationSeed.make({
          attemptCount: S.Natural.make(0),
          idempotencyKey: `waiting-${missing}`,
          inputGeneration: S.Natural.make(1),
          operationType: missing === "remote-id" ? "renameItem" : "uploadFile",
          provider: "box",
          status: "queued",
          syncItemId: item.id,
          targetName: "waiting.txt",
          targetParentRelPath: missing === "parent" ? O.some(VaultRelPath.make("absent")) : O.none(),
          targetRelPath: localRelPath,
          workspaceId,
        });
        const queued = yield* operations.enqueue(seed);
        if (missing === "remote-id") {
          yield* operations.enqueue(
            SyncOperationSeed.make({ ...seed, idempotencyKey: "failed-twin", status: "failed" })
          );
        }
        yield* engine.syncOnce(syncInput(root));
        const remaining = yield* listOperationsByStatus("queued");
        expect(A.map(remaining, (operation) => operation.id)).toEqual([queued.id]);
        expect(remaining[0]?.attemptCount).toBe(0);
        expect(yield* listOperationsByStatus("leased")).toEqual([]);
        expect((yield* mirror.counts).uploadFile).toBe(0);
        expect((yield* mirror.counts).renameItem).toBe(0);
        expect(A.length(yield* listOperationsByStatus("failed"))).toBe(missing === "remote-id" ? 1 : 0);
      })
    );
  });
}
