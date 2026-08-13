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
import { NonNegativeInt } from "@beep/schema";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { baseEntityFixtureInput, fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
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

const workspaceId = S.decodeSync(WorkspaceIdentity.WorkspaceId)(2);
const decodeVaultRelPath = S.decodeUnknownSync(VaultRelPath);
const remoteId = S.decodeSync(RemoteItemId)("9001");
const localGeneration = S.decodeSync(NonNegativeInt)(1);

const itemSeed = (localRelPath: string) =>
  SyncItemSeed.make({
    itemKind: "file",
    localGeneration,
    localRelPath: decodeVaultRelPath(localRelPath),
    provider: "box",
    syncState: "pending",
    workspaceId,
  });

const byWorkspace = ListSyncItemsByWorkspaceInput.make({ provider: "box", workspaceId });

const detachedItem = S.decodeUnknownSync(DomainSyncItem.SyncItem)({
  ...baseEntityFixtureInput(DocumentsIdentity.SyncItemId.entityType, 99),
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
});

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
      expect(O.map(found, (item) => item.id)).toEqual(O.some(first.id));
    })
  );

  it.effect(
    "rejects a duplicate workspace, provider, and path with a conflict",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();
      yield* repository.create(itemSeed("matters/client-default/complaint.pdf"));

      const error = yield* Effect.flip(repository.create(itemSeed("matters/client-default/complaint.pdf")));
      expect(SyncItemRepositoryConflict.is(error)).toBe(true);
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
      expect(O.map(found, (item) => item.id)).toEqual(O.some(created.id));
    })
  );

  it.effect(
    "fails update for an untracked item with not-found",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncItemRepository();

      const error = yield* Effect.flip(repository.update(detachedItem));
      expect(SyncItemRepositoryNotFound.is(error)).toBe(true);
      if (SyncItemRepositoryNotFound.is(error)) {
        expect(error.syncItemId).toBe(detachedItem.id);
      }
    })
  );

  it.effect(
    "resolves the repository through the in-memory layer",
    Effect.fnUntraced(function* () {
      const listed = yield* SyncItemRepository.pipe(
        Effect.flatMap((repository) => repository.listByWorkspace(byWorkspace)),
        provideScopedLayer(SyncItemRepositoryInMemoryLayer)
      );

      expect(listed).toEqual([]);
    })
  );

  it("round-trips schema-derived sync items and seeds", () => {
    assertSchemaArbitraryRoundTrip(DomainSyncItem.SyncItem);
    assertSchemaArbitraryRoundTrip(SyncItemSeed);
  });
});
