import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
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
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SyncItemRepositoryShape } from "@beep/documents-use-cases/entities/SyncItem/server";

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
const localRelPath = S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf");
const localGeneration = S.decodeUnknownSync(NonNegativeInt)(1);
const remoteId9001 = S.decodeUnknownSync(RemoteItemId)("9001");
const decodeSyncItem = S.decodeUnknownSync(DomainSyncItem.SyncItem);
const decodeSyncItemEffect = S.decodeUnknownEffect(DomainSyncItem.SyncItem);
const encodeSyncItemEffect = S.encodeEffect(DomainSyncItem.SyncItem);

const fileSeed = SyncItemSeed.make({
  itemKind: "file",
  localGeneration,
  localRelPath,
  provider: "box",
  syncState: "pending",
  workspaceId,
});

const syncItemRow = (seed: SyncItemSeed, id: number) => ({
  ...baseEntityFixtureInput(DomainSyncItem.SyncItemId.entityType, id),
  contentDigest: O.getOrNull(seed.contentDigest),
  contentSizeBytes: O.getOrNull(seed.contentSizeBytes),
  itemKind: seed.itemKind,
  lastError: O.getOrNull(seed.lastError),
  lastPushedDigest: O.getOrNull(seed.lastPushedDigest),
  lastPushedGeneration: O.getOrNull(seed.lastPushedGeneration),
  localGeneration: seed.localGeneration,
  localRelPath: seed.localRelPath,
  provider: seed.provider,
  remoteId: O.getOrNull(seed.remoteId),
  remoteName: O.getOrNull(seed.remoteName),
  remoteParentId: O.getOrNull(seed.remoteParentId),
  syncState: seed.syncState,
  workspaceId: seed.workspaceId,
});

const makeRepository = (): SyncItemRepositoryShape => {
  let items: ReadonlyArray<DomainSyncItem.SyncItem> = A.empty();
  let nextId = 1;

  const tracksSeedPath = (seed: SyncItemSeed) => (item: DomainSyncItem.SyncItem) =>
    item.workspaceId === seed.workspaceId && item.provider === seed.provider && item.localRelPath === seed.localRelPath;

  return {
    create: (seed) =>
      A.some(items, tracksSeedPath(seed))
        ? Effect.fail(
            SyncItemRepositoryConflict.make({
              localRelPath: seed.localRelPath,
              reason: "sync item already tracked for path",
            })
          )
        : Effect.sync(() => {
            const created = decodeSyncItem(syncItemRow(seed, nextId));
            nextId = nextId + 1;
            items = A.append(items, created);
            return created;
          }),
    update: (item) =>
      A.some(items, (existing) => existing.id === item.id)
        ? Effect.sync(() => {
            items = A.map(items, (existing) => (existing.id === item.id ? item : existing));
            return item;
          })
        : Effect.fail(SyncItemRepositoryNotFound.make({ syncItemId: item.id })),
    findByPath: (input) =>
      Effect.sync(() =>
        A.findFirst(
          items,
          (item) =>
            item.workspaceId === input.workspaceId &&
            item.provider === input.provider &&
            item.localRelPath === input.localRelPath
        )
      ),
    findByRemoteId: (input) =>
      Effect.sync(() =>
        A.findFirst(
          items,
          (item) =>
            item.workspaceId === input.workspaceId &&
            item.provider === input.provider &&
            O.exists(item.remoteId, (remoteId) => remoteId === input.remoteId)
        )
      ),
    listByWorkspace: (input) =>
      Effect.sync(() =>
        A.filter(items, (item) => item.workspaceId === input.workspaceId && item.provider === input.provider)
      ),
  };
};

describe("SyncItem repository port", () => {
  it.effect(
    "creates a tracking row and finds it by path and remote id",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const created = yield* repository.create(fileSeed);

      expect(created.localRelPath).toBe(fileSeed.localRelPath);
      expect(created.syncState).toBe("pending");

      const byPath = yield* repository.findByPath(
        FindSyncItemByPathInput.make({ localRelPath, provider: "box", workspaceId })
      );
      expect(O.map(byPath, (item) => item.id)).toEqual(O.some(created.id));

      const encoded = yield* encodeSyncItemEffect(created);
      const pushed = yield* decodeSyncItemEffect({ ...encoded, remoteId: "9001", syncState: "current" });
      yield* repository.update(pushed);

      const byRemoteId = yield* repository.findByRemoteId(
        FindSyncItemByRemoteIdInput.make({
          provider: "box",
          remoteId: remoteId9001,
          workspaceId,
        })
      );
      expect(O.map(byRemoteId, (item) => item.syncState)).toEqual(O.some("current"));

      const listed = yield* repository.listByWorkspace(
        ListSyncItemsByWorkspaceInput.make({ provider: "box", workspaceId })
      );
      expect(A.map(listed, (item) => item.localRelPath)).toEqual([fileSeed.localRelPath]);
    })
  );

  it.effect(
    "rejects a duplicate tracking row for the same workspace, provider, and path",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      yield* repository.create(fileSeed);
      const error = yield* repository.create(fileSeed).pipe(Effect.flip);

      const conflict = O.liftPredicate(error, SyncItemRepositoryConflict.is);
      expect(O.map(conflict, (found) => found.localRelPath)).toEqual(O.some(fileSeed.localRelPath));
    })
  );

  it.effect(
    "fails update with not-found for unknown rows",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const unknown = decodeSyncItem(syncItemRow(fileSeed, 99));
      const error = yield* repository.update(unknown).pipe(Effect.flip);

      expect(SyncItemRepositoryNotFound.is(error)).toBe(true);
    })
  );

  it.effect(
    "resolves the repository port through its context tag",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const resolved = yield* SyncItemRepository.pipe(Effect.provideService(SyncItemRepository, repository));

      expect(resolved).toBe(repository);
    })
  );

  it("round-trips schema-derived seeds and lookup inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncItemSeed);
    assertSchemaArbitraryRoundTrip(FindSyncItemByPathInput);
    assertSchemaArbitraryRoundTrip(FindSyncItemByRemoteIdInput);
    assertSchemaArbitraryRoundTrip(ListSyncItemsByWorkspaceInput);
  });
});
