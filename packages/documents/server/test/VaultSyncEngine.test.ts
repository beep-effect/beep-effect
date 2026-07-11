import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DmsMirrorFixtureCounts,
  DmsMirrorFixtureHandle,
  DmsMirrorFixtureNode,
  VaultSyncConfigValue,
} from "@beep/documents-server/aggregates/Sync";
import { DocumentsSyncFixtureLive } from "@beep/documents-server/layer";
import { SyncOnceInput, VaultSyncEngine, VaultSyncStatusInput } from "@beep/documents-use-cases/aggregates/Sync/server";
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
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import type * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import type * as Documents from "@beep/documents-domain/identity/Documents";

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

const SyncEngineTestLayer = DocumentsSyncFixtureLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const workspaceId = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(7);
const decodeVaultRelPath = S.decodeUnknownSync(VaultRelPath);
const encodeText = (text: string) => new TextEncoder().encode(text);
const digestOf = (text: string) => DocumentContentDigest.make(bytesToHex(sha256(encodeText(text))));
const syncInput = (vaultRootPath: string) => SyncOnceInput.make({ vaultRootPath, workspaceId });
const statusInput = VaultSyncStatusInput.make({ workspaceId });

const nodeDigest = (node: DmsMirrorFixtureNode | undefined): string | null =>
  node === undefined ? null : O.getOrNull(node.contentDigest);

const makeVaultRoot = Effect.fn("VaultSyncEngineTest.makeVaultRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-sync-" });
});

const writeVaultFile = Effect.fn("VaultSyncEngineTest.writeVaultFile")(function* (
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

const renameVaultEntry = Effect.fn("VaultSyncEngineTest.renameVaultEntry")(function* (
  root: string,
  fromRelPath: string,
  toRelPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, ...Str.split(toRelPath, "/"));
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.rename(path.join(root, ...Str.split(fromRelPath, "/")), target);
});

const rootFileSeed = (relPath: string, contents: string) =>
  SyncItemSeed.make({
    contentDigest: O.some(digestOf(contents)),
    contentSizeBytes: O.some(NonNegativeInt.make(encodeText(contents).byteLength)),
    itemKind: "file",
    localGeneration: NonNegativeInt.make(1),
    localRelPath: decodeVaultRelPath(relPath),
    provider: "box",
    syncState: "pending",
    workspaceId,
  });

const rootUploadSeed = (
  syncItemId: Documents.SyncItemId,
  relPath: string,
  contents: string,
  status: DomainSyncOperation.SyncOperationStatus
) =>
  SyncOperationSeed.make({
    attemptCount: NonNegativeInt.make(0),
    idempotencyKey: `box:${workspaceId}:uploadFile:${relPath}:1`,
    inputContentDigest: O.some(digestOf(contents)),
    inputGeneration: NonNegativeInt.make(1),
    operationType: "uploadFile",
    provider: "box",
    status,
    syncItemId,
    targetName: relPath,
    targetRelPath: decodeVaultRelPath(relPath),
    workspaceId,
  });

const listOperationsByStatus = (status: DomainSyncOperation.SyncOperationStatus) =>
  SyncOperationRepository.pipe(
    Effect.flatMap((repository) =>
      repository.listByStatus(ListSyncOperationsByStatusInput.make({ provider: "box", status, workspaceId }))
    )
  );

describe("@beep/documents-server VaultSyncEngine", () => {
  it.effect("converges a nested local tree into the remote mirror", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "matters/client-a/complaint.pdf", "complaint body");
      yield* writeVaultFile(root, "notes.txt", "note body");

      const status = yield* engine.syncOnce(syncInput(root));
      const tree = yield* handle.snapshotTree;
      const counts = yield* handle.counts;

      expect(tree.matters?.itemKind).toBe("folder");
      expect(tree["matters/client-a"]?.itemKind).toBe("folder");
      expect(nodeDigest(tree["matters/client-a/complaint.pdf"])).toBe(digestOf("complaint body"));
      expect(nodeDigest(tree["notes.txt"])).toBe(digestOf("note body"));
      expect(counts.ensureFolder).toBe(2);
      expect(counts.uploadFile).toBe(2);
      expect(status.currentItems).toBe(4);
      expect(status.pendingItems).toBe(0);
      expect(status.queuedOperations).toBe(0);
      expect(status.failedOperations).toBe(0);
      expect(status.openConflicts).toBe(0);
      expect(status.connected).toBe(true);
      expect(status.provider).toBe("box");
      expect(O.isSome(status.cursorPosition)).toBe(true);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("converges a local rename without re-uploading content", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "brief.txt", "brief body");
      yield* engine.syncOnce(syncInput(root));

      yield* renameVaultEntry(root, "brief.txt", "amended-brief.txt");
      const status = yield* engine.syncOnce(syncInput(root));
      const tree = yield* handle.snapshotTree;
      const counts = yield* handle.counts;

      expect(nodeDigest(tree["amended-brief.txt"])).toBe(digestOf("brief body"));
      expect(tree["brief.txt"]).toBeUndefined();
      expect(counts.uploadFile).toBe(1);
      expect(counts.renameItem).toBe(1);
      expect(counts.moveItem).toBe(0);
      expect(status.currentItems).toBe(1);
      expect(status.openConflicts).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("converges a local move by repointing the remote parent", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "inbox/filing.txt", "filing body");
      yield* engine.syncOnce(syncInput(root));

      yield* renameVaultEntry(root, "inbox/filing.txt", "archive/filing.txt");
      const status = yield* engine.syncOnce(syncInput(root));
      const tree = yield* handle.snapshotTree;
      const counts = yield* handle.counts;

      expect(nodeDigest(tree["archive/filing.txt"])).toBe(digestOf("filing body"));
      expect(tree["archive/filing.txt"]?.version).toBe(1);
      expect(tree["inbox/filing.txt"]).toBeUndefined();
      // One-way push keeps the now-empty remote source folder (no delete verbs).
      expect(tree.inbox?.itemKind).toBe("folder");
      expect(counts.uploadFile).toBe(1);
      expect(counts.moveItem).toBe(1);
      expect(counts.renameItem).toBe(0);
      expect(counts.ensureFolder).toBe(2);
      expect(status.openConflicts).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("pushes a local edit as a new remote file version", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "contract.txt", "first draft");
      yield* engine.syncOnce(syncInput(root));

      yield* writeVaultFile(root, "contract.txt", "second draft");
      const status = yield* engine.syncOnce(syncInput(root));
      const tree = yield* handle.snapshotTree;
      const counts = yield* handle.counts;

      expect(counts.uploadFile).toBe(1);
      expect(counts.uploadFileVersion).toBe(1);
      expect(nodeDigest(tree["contract.txt"])).toBe(digestOf("second draft"));
      expect(tree["contract.txt"]?.version).toBe(2);
      expect(status.currentItems).toBe(1);
      // The provider echo of our own version upload is ignored, not a conflict.
      expect(status.openConflicts).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("squashes a rename-while-queued into a single upload at the final path", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const itemRepository = yield* SyncItemRepository;
      const operationRepository = yield* SyncOperationRepository;
      const root = yield* makeVaultRoot();
      // A previous scan tracked "original.txt" and queued its upload; the file
      // was renamed locally before the queue was pumped.
      const seeded = yield* itemRepository.create(rootFileSeed("original.txt", "stable body"));
      yield* operationRepository.enqueue(rootUploadSeed(seeded.id, "original.txt", "stable body", "queued"));
      yield* writeVaultFile(root, "renamed.txt", "stable body");

      const status = yield* engine.syncOnce(syncInput(root));
      const tree = yield* handle.snapshotTree;
      const counts = yield* handle.counts;
      const succeeded = yield* listOperationsByStatus("succeeded");

      expect(counts.uploadFile).toBe(1);
      expect(counts.renameItem).toBe(0);
      expect(nodeDigest(tree["renamed.txt"])).toBe(digestOf("stable body"));
      expect(tree["original.txt"]).toBeUndefined();
      expect(A.map(succeeded, (operation) => operation.targetRelPath)).toEqual(["renamed.txt"]);
      expect(A.map(succeeded, (operation) => operation.inputGeneration)).toEqual([2]);
      expect(status.currentItems).toBe(1);
      expect(status.queuedOperations).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("retries a retryable mirror failure within the same pass and succeeds", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "retry.txt", "retry body");
      yield* handle.failNext("uploadFile", true);

      const status = yield* engine.syncOnce(syncInput(root));
      const counts = yield* handle.counts;
      const succeeded = yield* listOperationsByStatus("succeeded");

      expect(counts.uploadFile).toBe(2);
      expect(status.currentItems).toBe(1);
      expect(status.failedOperations).toBe(0);
      expect(A.map(succeeded, (operation) => operation.attemptCount)).toEqual([1]);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("fails an operation terminally on a non-retryable mirror failure", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const itemRepository = yield* SyncItemRepository;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "doomed.txt", "doomed body");
      yield* handle.failNext("uploadFile", false);

      const status = yield* engine.syncOnce(syncInput(root));
      const counts = yield* handle.counts;
      const failed = yield* listOperationsByStatus("failed");
      const tracked = yield* itemRepository.findByPath(
        FindSyncItemByPathInput.make({ localRelPath: decodeVaultRelPath("doomed.txt"), provider: "box", workspaceId })
      );

      expect(counts.uploadFile).toBe(1);
      expect(status.errorItems).toBe(1);
      expect(status.currentItems).toBe(0);
      expect(status.failedOperations).toBe(1);
      expect(A.map(failed, (operation) => operation.attemptCount)).toEqual([1]);
      expect(O.flatMap(tracked, (item) => item.lastError)).toEqual(O.some("fixture injected uploadFile failure"));
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("fails an operation after exhausting the configured attempt budget", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "exhausted.txt", "exhausted body");
      // DOCUMENTS_SYNC_MAX_ATTEMPTS defaults to 3.
      yield* handle.failNext("uploadFile", true);
      yield* handle.failNext("uploadFile", true);
      yield* handle.failNext("uploadFile", true);

      const status = yield* engine.syncOnce(syncInput(root));
      const counts = yield* handle.counts;
      const failed = yield* listOperationsByStatus("failed");

      expect(counts.uploadFile).toBe(3);
      expect(status.errorItems).toBe(1);
      expect(status.failedOperations).toBe(1);
      expect(A.map(failed, (operation) => operation.attemptCount)).toEqual([3]);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("recovers a leased operation on the next pass and pushes it once", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;
      const handle = yield* DmsMirrorFixtureHandle;
      const itemRepository = yield* SyncItemRepository;
      const operationRepository = yield* SyncOperationRepository;
      const root = yield* makeVaultRoot();
      yield* writeVaultFile(root, "leased.txt", "leased body");
      // A crashed engine left the operation leased mid-push.
      const seeded = yield* itemRepository.create(rootFileSeed("leased.txt", "leased body"));
      yield* operationRepository.enqueue(rootUploadSeed(seeded.id, "leased.txt", "leased body", "leased"));

      const status = yield* engine.syncOnce(syncInput(root));
      const counts = yield* handle.counts;
      const tree = yield* handle.snapshotTree;
      const succeeded = yield* listOperationsByStatus("succeeded");

      expect(counts.uploadFile).toBe(1);
      expect(nodeDigest(tree["leased.txt"])).toBe(digestOf("leased body"));
      expect(A.length(succeeded)).toBe(1);
      expect(status.currentItems).toBe(1);
      expect(status.queuedOperations).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it.effect("reports an idle status snapshot before any sync pass", () =>
    Effect.gen(function* () {
      const engine = yield* VaultSyncEngine;

      const status = yield* engine.status(statusInput);

      expect(status.conflictItems).toBe(0);
      expect(status.connected).toBe(true);
      expect(status.currentItems).toBe(0);
      expect(status.cursorPosition).toEqual(O.none());
      expect(status.errorItems).toBe(0);
      expect(status.failedOperations).toBe(0);
      expect(status.openConflicts).toBe(0);
      expect(status.pendingItems).toBe(0);
      expect(status.provider).toBe("box");
      expect(status.queuedOperations).toBe(0);
    }).pipe(provideScopedLayer(SyncEngineTestLayer))
  );

  it("round-trips schema-derived sync configuration and fixture read models", () => {
    assertSchemaArbitraryRoundTrip(VaultSyncConfigValue);
    assertSchemaArbitraryRoundTrip(DmsMirrorFixtureCounts);
    assertSchemaArbitraryRoundTrip(DmsMirrorFixtureNode);
  });
});
