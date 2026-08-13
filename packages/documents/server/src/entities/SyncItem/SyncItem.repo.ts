/**
 * SyncItem repository adapters.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import {
  fromSyncItemRow,
  SYNC_ITEM_TABLE_NAME,
  syncItemTable,
  toSyncItemInsert,
} from "@beep/documents-tables/entities/SyncItem";
import {
  SyncItemRepository,
  SyncItemRepositoryConflict,
  SyncItemRepositoryNotFound,
  SyncItemRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import { PostgresDrizzle } from "@beep/postgres";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { A, N } from "@beep/utils";
import { and, asc, eq } from "drizzle-orm";
import { Effect, HashMap, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { byIdAscending, makeEntityStore, nextEntityId, SYSTEM_PRINCIPAL } from "../internal/RepoSupport.ts";
import type { DmsProvider, RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import type { SyncItemSeed } from "@beep/documents-use-cases/entities/SyncItem/server";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const decodeSyncItem = S.decodeUnknownSync(DomainSyncItem.SyncItem);

/**
 * Build a full SyncItem entity from a creation seed and an assigned id.
 *
 * BaseEntity bookkeeping fields mirrors the repository's application-write
 * posture: system principal audit fields, epoch timestamps, and a
 * sequence-shaped public id derived from the table name.
 */
const syncItemFromSeed = (id: number, seed: SyncItemSeed): DomainSyncItem.SyncItem =>
  decodeSyncItem({
    contentDigest: O.getOrNull(seed.contentDigest),
    contentSizeBytes: O.getOrNull(seed.contentSizeBytes),
    createdAt: 0,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: DocumentsIdentity.SyncItemId.entityType,
    id,
    itemKind: seed.itemKind,
    lastError: O.getOrNull(seed.lastError),
    lastPushedDigest: O.getOrNull(seed.lastPushedDigest),
    lastPushedGeneration: O.getOrNull(seed.lastPushedGeneration),
    localGeneration: seed.localGeneration,
    localRelPath: seed.localRelPath,
    orgId: 1,
    provider: seed.provider,
    publicId: `${SYNC_ITEM_TABLE_NAME}_a${id}`,
    remoteId: O.getOrNull(seed.remoteId),
    remoteName: O.getOrNull(seed.remoteName),
    remoteParentId: O.getOrNull(seed.remoteParentId),
    rowVersion: 1,
    schemaVersion: "0.1.0",
    source: "Application",
    syncState: seed.syncState,
    updatedAt: 0,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
    workspaceId: seed.workspaceId,
  });

type MirrorScope = {
  readonly provider: DmsProvider;
  readonly workspaceId: WorkspaceIdentity.WorkspaceId;
};

const matchesMirror = (input: MirrorScope) => (syncItem: DomainSyncItem.SyncItem) =>
  syncItem.workspaceId === input.workspaceId && syncItem.provider === input.provider;

const matchesPath =
  (input: MirrorScope & { readonly localRelPath: VaultRelPath }) => (syncItem: DomainSyncItem.SyncItem) =>
    matchesMirror(input)(syncItem) && syncItem.localRelPath === input.localRelPath;

const matchesRemoteId =
  (input: MirrorScope & { readonly remoteId: RemoteItemId }) => (syncItem: DomainSyncItem.SyncItem) =>
    matchesMirror(input)(syncItem) && O.exists(syncItem.remoteId, (candidate) => candidate === input.remoteId);

const duplicatePathConflict = (seed: SyncItemSeed): SyncItemRepositoryConflict =>
  SyncItemRepositoryConflict.make({
    localRelPath: seed.localRelPath,
    reason: `${SYNC_ITEM_TABLE_NAME} already tracks ${seed.localRelPath}`,
  });

/**
 * Build the in-memory SyncItem repository used by deterministic sync tests.
 *
 * **Example** (In-memory repository import)
 *
 * ```ts
 * import { makeInMemorySyncItemRepository } from "@beep/documents-server/entities/SyncItem"
 *
 * console.log(makeInMemorySyncItemRepository)
 * ```
 *
 * @effects Allocates an in-memory `Ref` store plus an id counter and mutates
 * that process-local state for create, update, find, and list repository
 * calls.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemorySyncItemRepository = Effect.fn("Documents.SyncItemRepository.makeInMemory")(function* () {
  const { counter, snapshot, store } = yield* makeEntityStore(
    HashMap.empty<DocumentsIdentity.SyncItemId, DomainSyncItem.SyncItem>()
  );

  return SyncItemRepository.of({
    create: Effect.fn("Documents.SyncItemRepository.create")(function* (seed) {
      const syncItems = yield* snapshot;
      if (A.some(syncItems, matchesPath(seed))) {
        return yield* duplicatePathConflict(seed);
      }
      const id = yield* Ref.getAndUpdate(counter, N.increment);
      const syncItem = syncItemFromSeed(id, seed);
      yield* Ref.update(store, HashMap.set(syncItem.id, syncItem));
      return syncItem;
    }),
    findByPath: Effect.fn("Documents.SyncItemRepository.findByPath")(function* (input) {
      const syncItems = yield* snapshot;
      return A.findFirst(syncItems, matchesPath(input));
    }),
    findByRemoteId: Effect.fn("Documents.SyncItemRepository.findByRemoteId")(function* (input) {
      const syncItems = yield* snapshot;
      return A.findFirst(syncItems, matchesRemoteId(input));
    }),
    listByWorkspace: Effect.fn("Documents.SyncItemRepository.listByWorkspace")(function* (input) {
      const syncItems = yield* snapshot;
      return pipe(syncItems, A.filter(matchesMirror(input)), A.sort(byIdAscending<DomainSyncItem.SyncItem>()));
    }),
    update: Effect.fn("Documents.SyncItemRepository.update")(function* (syncItem) {
      const syncItems = yield* Ref.get(store);
      if (O.isNone(HashMap.get(syncItems, syncItem.id))) {
        return yield* SyncItemRepositoryNotFound.make({ syncItemId: syncItem.id });
      }
      yield* Ref.update(store, HashMap.set(syncItem.id, syncItem));
      return syncItem;
    }),
  });
});

const repositoryUnavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, SyncItemRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Documents SyncItem repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: SYNC_ITEM_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        SyncItemRepositoryUnavailable.make({
          reason: `${operation} failed against ${SYNC_ITEM_TABLE_NAME}`,
        })
      )
    );

/**
 * Build a Drizzle-backed SyncItem repository used by live persistence tests.
 *
 * **Example** (Drizzle repository import)
 *
 * ```ts
 * import { makeDrizzleSyncItemRepository } from "@beep/documents-server/entities/SyncItem"
 *
 * console.log(makeDrizzleSyncItemRepository)
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select`, `insert`, and
 * `update` statements against the SyncItem table and redacts driver failures
 * to `SyncItemRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleSyncItemRepository = Effect.fn("Documents.SyncItemRepository.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  const findRowByPath = Effect.fn("Documents.SyncItemRepository.drizzleFindRowByPath")(function* (
    input: MirrorScope & { readonly localRelPath: VaultRelPath }
  ) {
    const rows = yield* db
      .select()
      .from(syncItemTable)
      .where(
        and(
          eq(syncItemTable.workspaceId, input.workspaceId),
          eq(syncItemTable.provider, input.provider),
          eq(syncItemTable.localRelPath, input.localRelPath)
        )
      )
      .limit(1)
      .pipe(repositoryUnavailable("select SyncItem by path"));
    return pipe(rows, A.head, O.map(fromSyncItemRow));
  });

  return SyncItemRepository.of({
    create: Effect.fn("Documents.SyncItemRepository.drizzleCreate")(function* (seed) {
      const existing = yield* findRowByPath(seed);
      if (O.isSome(existing)) {
        return yield* duplicatePathConflict(seed);
      }
      const currentRows = yield* db.select().from(syncItemTable).pipe(repositoryUnavailable("list SyncItem"));
      const syncItem = syncItemFromSeed(nextEntityId(currentRows), seed);
      const rows = yield* db
        .insert(syncItemTable)
        .values(toSyncItemInsert(syncItem))
        .returning()
        .pipe(repositoryUnavailable("insert SyncItem"));
      return pipe(
        rows,
        A.head,
        O.map(fromSyncItemRow),
        O.getOrElse(() => syncItem)
      );
    }),
    findByPath: Effect.fn("Documents.SyncItemRepository.drizzleFindByPath")(function* (input) {
      return yield* findRowByPath(input);
    }),
    findByRemoteId: Effect.fn("Documents.SyncItemRepository.drizzleFindByRemoteId")(function* (input) {
      const rows = yield* db
        .select()
        .from(syncItemTable)
        .where(
          and(
            eq(syncItemTable.workspaceId, input.workspaceId),
            eq(syncItemTable.provider, input.provider),
            eq(syncItemTable.remoteId, input.remoteId)
          )
        )
        .limit(1)
        .pipe(repositoryUnavailable("select SyncItem by remote id"));
      return pipe(rows, A.head, O.map(fromSyncItemRow));
    }),
    listByWorkspace: Effect.fn("Documents.SyncItemRepository.drizzleListByWorkspace")(function* (input) {
      const rows = yield* db
        .select()
        .from(syncItemTable)
        .where(and(eq(syncItemTable.workspaceId, input.workspaceId), eq(syncItemTable.provider, input.provider)))
        .orderBy(asc(syncItemTable.id))
        .pipe(repositoryUnavailable("list SyncItem"));
      return A.map(rows, fromSyncItemRow);
    }),
    update: Effect.fn("Documents.SyncItemRepository.drizzleUpdate")(function* (syncItem) {
      const rows = yield* db
        .update(syncItemTable)
        .set(toSyncItemInsert(syncItem))
        .where(eq(syncItemTable.id, syncItem.id))
        .returning()
        .pipe(repositoryUnavailable("update SyncItem"));
      const updated = A.head(rows);
      if (O.isNone(updated)) {
        return yield* SyncItemRepositoryNotFound.make({ syncItemId: syncItem.id });
      }
      return fromSyncItemRow(updated.value);
    }),
  });
});
