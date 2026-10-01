import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  makeInMemorySyncItemRepository,
  SyncItemRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncItem";
import {
  FindSyncItemByPathInput,
  FindSyncItemByRemoteIdInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepository,
  SyncItemRepositoryConflict,
  SyncItemRepositoryNotFound,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownSyncItem = S.decodeUnknownEffect(DomainSyncItem.SyncItem);
const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const remoteId = RemoteItemId.make("9001");
const localGeneration = S.Natural.make(1);

const itemSeed = (localRelPath: string) =>
  SyncItemSeed.make({
    itemKind: "file",
    localGeneration,
    localRelPath: VaultRelPath.make(localRelPath),
    provider: "box",
    syncState: "pending",
    workspaceId,
  });

const byWorkspace = ListSyncItemsByWorkspaceInput.make({ provider: "box", workspaceId });

const detachedItemRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncItemId.entityType, 99),
  contentDigest: null,
  contentSizeBytes: null,
  itemKind: "file",
  lastError: null,
  lastPushedDigest: null,
  lastPushedGeneration: null,
  localGeneration: 1,
  localRelPath: "matters/client-default/ghost.pdf",
  provider: "box",
  remoteId: null,
  remoteName: null,
  remoteParentId: null,
  syncState: "pending",
  workspaceId: 2,
};
const encodeSyncItemSeed = S.encodeResult(SyncItemSeed);
const decodeSyncItemSeed = S.decodeUnknownResult(SyncItemSeed);
const equivalentSyncItemSeed = S.toEquivalence(SyncItemSeed);
const encodeSyncItem = S.encodeResult(DomainSyncItem.SyncItem);
const decodeSyncItem = S.decodeUnknownResult(DomainSyncItem.SyncItem);
const equivalentSyncItem = S.toEquivalence(DomainSyncItem.SyncItem);

describe("SyncItem server repository", () => {
  it.effect(
    "creates items and lists the workspace mirror in id order",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();
      const first = yield* repository.create(itemSeed("matters/client-default/zeta.pdf"));
      const second = yield* repository.create(itemSeed("matters/client-default/alpha.pdf"));

      expect(first.publicId).toBe("documents_sync_item_a1");
      expect(first.syncState).toBe("pending");

      const listed = yield* repository.listByWorkspace(byWorkspace);
      expect(A.map(listed, (item) => item.id)).toEqual([first.id, second.id]);

      const found = yield* repository.findByPath(
        FindSyncItemByPathInput.make({ localRelPath: first.localRelPath, provider: "box", workspaceId })
      );
      assertSome(
        O.map(found, (item) => item.id),
        first.id
      );
    })
  );

  it.effect(
    "rejects a duplicate workspace, provider, and path with a conflict",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();
      yield* repository.create(itemSeed("matters/client-default/complaint.pdf"));

      const error = yield* Effect.flip(repository.create(itemSeed("matters/client-default/complaint.pdf")));
      pipe(SyncItemRepositoryConflict.is(error), assertTrue);
      expect(error._tag).toBe("SyncItemRepositoryConflict");
    })
  );

  it.effect(
    "updates a tracked item and finds it by remote id",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();
      const created = yield* repository.create(itemSeed("matters/client-default/complaint.pdf"));

      const pushed = DomainSyncItem.SyncItem.make({
        ...created,
        remoteId: O.some(remoteId),
        remoteName: O.some("complaint.pdf"),
        syncState: "current",
      });
      const updated = yield* repository.update(pushed);
      expect(updated.syncState).toBe("current");

      const found = yield* repository.findByRemoteId(
        FindSyncItemByRemoteIdInput.make({ provider: "box", remoteId, workspaceId })
      );
      assertSome(
        O.map(found, (item) => item.id),
        created.id
      );
    })
  );

  it.effect(
    "fails update for an untracked item with not-found",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();
      const detachedItem = yield* decodeUnknownSyncItem(detachedItemRow);

      const error = yield* Effect.flip(repository.update(detachedItem));
      pipe(SyncItemRepositoryNotFound.is(error), assertTrue);
      if (SyncItemRepositoryNotFound.is(error)) {
        expect(error.syncItemId).toBe(detachedItem.id);
      }
    })
  );

  it.layer(Layer.fresh(SyncItemRepositoryInMemoryLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "resolves the repository through the in-memory layer",
      Effect.fnUntraced(function* () {
        const listed = yield* SyncItemRepository.pipe(
          Effect.flatMap((repository) => repository.listByWorkspace(byWorkspace))
        );

        expect(listed).toEqual([]);
      })
    );
  });

  describe("round-trips schema-derived sync items and seeds", () => {
    it.prop(
      "DomainSyncItem.SyncItem",
      { value: Arbitrary.schema(DomainSyncItem.SyncItem) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncItem(value));
        const decoded = Result.getOrThrow(decodeSyncItem(encoded));
        assertTrue(equivalentSyncItem(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
    it.prop(
      "SyncItemSeed",
      { value: Arbitrary.schema(SyncItemSeed) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncItemSeed(value));
        const decoded = Result.getOrThrow(decodeSyncItemSeed(encoded));
        assertTrue(equivalentSyncItemSeed(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
  });
});
