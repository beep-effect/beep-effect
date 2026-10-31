/**
 * Vault sync engine server service.
 *
 * **Details**
 *
 * Implements the {@link VaultSyncEngine} port: one `syncOnce` pass recovers
 * leased outbox operations, scans the local vault, pumps the push outbox
 * against the DMS mirror, polls remote drift events, and returns the resulting
 * status snapshot.
 *
 * **Gotchas**
 *
 * Design posture (goals/legal-document-intake P3): the mirror is a one-way
 * push, so locally deleted items never trigger remote deletes; folder
 * move/rename is not inferred (files converge individually and empty remote
 * folders remain); a poll failure records the cursor error state but never
 * fails `syncOnce`, which still returns a status snapshot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { SyncItemKind, VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DmsMirrorAvailability,
  SyncOnceInput,
  VaultScanFailed,
  VaultSyncEngine,
  VaultSyncStatus,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepository,
  SyncConflictRepositoryNotFound,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { FindSyncCursorInput, SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  ListSyncItemsByWorkspaceInput,
  SyncItemRepository,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListQueuedSyncOperationsForItemInput,
  ListSyncOperationsByStatusInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepository,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { makeVaultSyncDrift } from "./VaultSync.drift.ts";
import { makeVaultSyncFileStore } from "./VaultSync.file-store.ts";
import { makeVaultSyncPush } from "./VaultSync.push.ts";
import type { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import type { MarkConflictReviewedInput } from "@beep/documents-use-cases/aggregates/Sync/server";
import type * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { ObservedFile, ObservedFolder } from "./VaultScan.model.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncEngine.service");

const BOX_PROVIDER = "box";

const SyncItemState = DomainSyncItem.SyncItemState;
const SyncOperationType = DomainSyncOperation.SyncOperationType;

const ZERO = S.Natural.make(0);
const GENERATION_ONE = S.Natural.make(1);

const scanFailed = (reason: string): VaultScanFailed => VaultScanFailed.make({ reason });

const relPathSegments = (relPath: VaultRelPath): A.NonEmptyArray<string> => Str.split(relPath, "/");

const baseNameOf = (relPath: VaultRelPath): string => A.lastNonEmpty(relPathSegments(relPath));

const parentRelPathOf = (relPath: VaultRelPath): O.Option<VaultRelPath> =>
  pipe(
    A.dropRight(relPathSegments(relPath), 1),
    O.liftPredicate(A.isArrayNonEmpty),
    O.map((segments) => VaultRelPath.make(A.join(segments, "/")))
  );

const depthOf = (relPath: VaultRelPath): number => A.length(relPathSegments(relPath));

/**
 * Deterministic outbox idempotency key:
 * `{provider}:{workspaceId}:{syncItemId}:{operationType}:{targetRelPath}:{inputGeneration}`.
 *
 * The item identity keeps keys from colliding when a later item reuses a
 * previously vacated path at the same generation (recurring intake names).
 */
const idempotencyKeyFor = (
  item: DomainSyncItem.SyncItem,
  operationType: DomainSyncOperation.SyncOperationType
): string =>
  `${item.provider}:${item.workspaceId}:${item.id}:${operationType}:${item.localRelPath}:${item.localGeneration}`;

/**
 * Threaded reconciliation state for the vault scan's file pass: the tracked
 * items keyed by local path, plus the still-missing file rows that remain
 * move/rename candidates.
 */
type ScanFileState = {
  readonly itemsByPath: HashMap.HashMap<string, DomainSyncItem.SyncItem>;
  readonly missingFileItems: ReadonlyArray<DomainSyncItem.SyncItem>;
};

const folderDepthOrder: Order.Order<ObservedFolder> = Order.combine(
  Order.mapInput(Order.Number, (folder: ObservedFolder) => depthOf(folder.relPath)),
  Order.mapInput(Order.String, (folder: ObservedFolder) => folder.relPath)
);

const fileRelPathOrder: Order.Order<ObservedFile> = Order.mapInput(Order.String, (file: ObservedFile) => file.relPath);

const itemRelPathOrder: Order.Order<DomainSyncItem.SyncItem> = Order.mapInput(
  Order.String,
  (item: DomainSyncItem.SyncItem) => item.localRelPath
);

/**
 * Duplicate-content move-candidate tie-break (documented v1 heuristic):
 * candidates sorted lexicographically by old path, preferring an exact
 * basename match with the observed new path.
 */
const pickMoveCandidate = (
  candidates: ReadonlyArray<DomainSyncItem.SyncItem>,
  file: ObservedFile
): O.Option<DomainSyncItem.SyncItem> => {
  const matching = pipe(
    candidates,
    A.filter((item) => O.exists(item.contentDigest, (digest) => digest === file.digest)),
    A.sort(itemRelPathOrder)
  );

  return O.orElse(
    A.findFirst(matching, (item) => baseNameOf(item.localRelPath) === baseNameOf(file.relPath)),
    () => A.head(matching)
  );
};

/**
 * Fresh push verb that re-converges a `pending` item stranded with no active
 * operation (the crash window between marking an operation `succeeded` and
 * writing the item row). A folder needs `createFolder` only while it has no
 * remote id; a file uploads its first version (`uploadFile`) or a new version
 * (`uploadFileVersion`) once it has one. A folder that already has a remote id
 * is fully pushed, so it yields `none`.
 */
const stalledOperationType = (item: DomainSyncItem.SyncItem): O.Option<DomainSyncOperation.SyncOperationType> =>
  SyncItemKind.match(item.itemKind, {
    file: () =>
      O.some(O.isNone(item.remoteId) ? SyncOperationType.Enum.uploadFile : SyncOperationType.Enum.uploadFileVersion),
    folder: () =>
      O.isNone(item.remoteId)
        ? O.some(SyncOperationType.Enum.createFolder)
        : O.none<DomainSyncOperation.SyncOperationType>(),
  });

/**
 * Build the vault sync engine from its repository, mirror, configuration, and
 * platform dependencies.
 *
 * **Example** (Construct with in-memory layers)
 *
 * ```ts
 * import { DmsMirrorFixtureLayer, makeVaultSyncEngine, VaultSyncConfigLayer } from "@beep/documents-server/aggregates/Sync"
 * import { SyncConflictRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncConflict"
 * import { SyncCursorRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncCursor"
 * import { SyncItemRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncItem"
 * import { SyncOperationRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncOperation"
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const program = makeVaultSyncEngine().pipe(
 *   Effect.provide(
 *     Layer.mergeAll(
 *       SyncConflictRepositoryInMemoryLayer,
 *       SyncCursorRepositoryInMemoryLayer,
 *       SyncItemRepositoryInMemoryLayer,
 *       SyncOperationRepositoryInMemoryLayer,
 *       DmsMirrorFixtureLayer,
 *       VaultSyncConfigLayer,
 *       BunFileSystem.layer,
 *       BunPath.layer
 *     )
 *   ),
 *   Effect.map((engine) => typeof engine.syncOnce === "function")
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Acquires the four sync repositories, the DMS mirror and its
 * availability probe, the vault sync configuration, and platform filesystem
 * and path services. `syncOnce` reads the local vault tree, mutates sync
 * repository state, and calls remote mirror verbs.
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncEngine = Effect.fn($I`makeVaultSyncEngine`)(function* () {
  const itemRepository = yield* SyncItemRepository;
  const operationRepository = yield* SyncOperationRepository;
  const cursorRepository = yield* SyncCursorRepository;
  const conflictRepository = yield* SyncConflictRepository;
  const availability = yield* DmsMirrorAvailability;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* makeVaultSyncFileStore();
  const drift = yield* makeVaultSyncDrift();
  const push = yield* makeVaultSyncPush();

  // One sync pass per workspace at a time. Every pass opens by requeuing all
  // leased operations, so two overlapping passes hand each other's in-flight
  // uploads back to the queue and run the same remote mutation twice. A disabled
  // button is only a hint — a second window, a repeated RPC, or a scheduled pass
  // can all arrive concurrently — so the guard belongs here, not in the UI.
  const syncLocks = yield* Ref.make(HashMap.empty<WorkspaceIdentity.WorkspaceId, Semaphore.Semaphore>());
  const lockFor = (workspaceId: WorkspaceIdentity.WorkspaceId): Effect.Effect<Semaphore.Semaphore> =>
    Ref.modify(syncLocks, (locks) =>
      pipe(
        HashMap.get(locks, workspaceId),
        O.match({
          onSome: (existing) => [existing, locks] as const,
          onNone: () => {
            const created = Semaphore.makeUnsafe(1);
            return [created, HashMap.set(locks, workspaceId, created)] as const;
          },
        })
      )
    );

  const queuedOperationsFor = (item: DomainSyncItem.SyncItem) =>
    operationRepository.listQueuedForItem(
      ListQueuedSyncOperationsForItemInput.make({
        syncItemId: item.id,
        workspaceId: item.workspaceId,
      })
    );

  const enqueueOrSquash = Effect.fn($I`enqueueOrSquash`)(function* (
    item: DomainSyncItem.SyncItem,
    operationType: DomainSyncOperation.SyncOperationType,
    inputContentDigest: O.Option<DocumentContentDigest>
  ) {
    const queued = yield* queuedOperationsFor(item);
    const existing = A.findFirst(queued, (operation) => operation.operationType === operationType);

    yield* O.match(existing, {
      onNone: () =>
        operationRepository
          .enqueue(
            SyncOperationSeed.make({
              attemptCount: ZERO,
              idempotencyKey: idempotencyKeyFor(item, operationType),
              inputContentDigest,
              inputGeneration: item.localGeneration,
              operationType,
              provider: item.provider,
              status: "queued",
              syncItemId: item.id,
              targetName: baseNameOf(item.localRelPath),
              targetParentRelPath: parentRelPathOf(item.localRelPath),
              targetRelPath: item.localRelPath,
              workspaceId: item.workspaceId,
            })
          )
          .pipe(
            Effect.asVoid,
            Effect.catchTag("SyncOperationRepositoryConflict", (conflict) =>
              Effect.logDebug("Documents vault sync treated a duplicate idempotency key as already queued").pipe(
                Effect.annotateLogs({ idempotencyKey: conflict.idempotencyKey })
              )
            )
          ),
      onSome: (operation) =>
        operationRepository
          .update(
            DomainSyncOperation.SyncOperation.make({
              ...operation,
              idempotencyKey: idempotencyKeyFor(item, operationType),
              inputContentDigest,
              inputGeneration: item.localGeneration,
              targetName: baseNameOf(item.localRelPath),
              targetParentRelPath: parentRelPathOf(item.localRelPath),
              targetRelPath: item.localRelPath,
            })
          )
          .pipe(Effect.asVoid),
    });
  });

  /**
   * Kind-change rule: queued operations enqueued for the previous item kind
   * cannot execute against the new kind, so they fail in place with an
   * explanatory reason instead of being retargeted.
   */
  const supersedeQueuedOperations = Effect.fn($I`supersedeQueuedOperations`)(function* (
    item: DomainSyncItem.SyncItem,
    reason: string
  ) {
    const queued = yield* queuedOperationsFor(item);
    yield* Effect.forEach(queued, (operation) =>
      operationRepository.update(
        DomainSyncOperation.SyncOperation.make({
          ...operation,
          lastError: O.some(reason),
          status: "failed",
        })
      )
    );
  });

  /**
   * Squash rule: retarget every queued (not leased) operation of the item to
   * its updated path and generation instead of enqueueing a duplicate.
   */
  const retargetQueuedOperations = Effect.fn($I`retargetQueuedOperations`)(function* (item: DomainSyncItem.SyncItem) {
    const queued = yield* queuedOperationsFor(item);
    yield* Effect.forEach(queued, (operation) =>
      operationRepository.update(
        DomainSyncOperation.SyncOperation.make({
          ...operation,
          idempotencyKey: idempotencyKeyFor(item, operation.operationType),
          inputGeneration: item.localGeneration,
          targetName: baseNameOf(item.localRelPath),
          targetParentRelPath: parentRelPathOf(item.localRelPath),
          targetRelPath: item.localRelPath,
        })
      )
    );
  });

  /**
   * Reconcile one observed folder against the tracked items, returning the
   * updated `itemsByPath`. A brand-new folder is tracked and its createFolder
   * op queued; a folder that replaced a tracked file repoints the row to the
   * folder kind, supersedes the file's queued ops, and pushes the folder.
   */
  const reconcileObservedFolder = Effect.fn($I`reconcileObservedFolder`)(function* (
    input: SyncOnceInput,
    folder: ObservedFolder,
    itemsByPath: HashMap.HashMap<string, DomainSyncItem.SyncItem>
  ) {
    const trackedAtPath = HashMap.get(itemsByPath, folder.relPath);
    if (O.isNone(trackedAtPath)) {
      const created = yield* itemRepository.create(
        SyncItemSeed.make({
          itemKind: SyncItemKind.Enum.folder,
          localGeneration: GENERATION_ONE,
          localRelPath: folder.relPath,
          provider: BOX_PROVIDER,
          syncState: SyncItemState.Enum.pending,
          workspaceId: input.workspaceId,
        })
      );
      const nextItemsByPath = HashMap.set(itemsByPath, folder.relPath, created);
      yield* enqueueOrSquash(created, SyncOperationType.Enum.createFolder, O.none());
      return nextItemsByPath;
    }
    if (SyncItemKind.is.file(trackedAtPath.value.itemKind)) {
      // A folder replaced a tracked file at the same path: repoint the row
      // to the new kind, drop the stale remote linkage, and push the folder.
      const replaced = yield* itemRepository.update(
        DomainSyncItem.SyncItem.make({
          ...trackedAtPath.value,
          contentDigest: O.none(),
          contentSizeBytes: O.none(),
          itemKind: SyncItemKind.Enum.folder,
          lastPushedDigest: O.none(),
          lastPushedGeneration: O.none(),
          localGeneration: S.Natural.make(trackedAtPath.value.localGeneration + 1),
          remoteId: O.none(),
          remoteName: O.none(),
          remoteParentId: O.none(),
          syncState: SyncItemState.Enum.pending,
        })
      );
      const nextItemsByPath = HashMap.set(itemsByPath, folder.relPath, replaced);
      yield* supersedeQueuedOperations(replaced, `superseded: ${folder.relPath} changed kind to folder`);
      yield* enqueueOrSquash(replaced, SyncOperationType.Enum.createFolder, O.none());
      return nextItemsByPath;
    }
    return itemsByPath;
  });

  /**
   * Queue the remote deltas for a moved/renamed file once it exists remotely:
   * a parent change queues `moveItem`, a base-name change queues `renameItem`
   * (a move that also renames queues both). A row with no remote id yet is a
   * no-op — the delta rides the eventual first upload.
   */
  const enqueueMoveDeltas = Effect.fn($I`enqueueMoveDeltas`)(function* (
    moved: DomainSyncItem.SyncItem,
    previousRelPath: VaultRelPath,
    nextRelPath: VaultRelPath
  ) {
    if (O.isNone(moved.remoteId)) {
      return;
    }
    const parentChanged = O.getOrNull(parentRelPathOf(previousRelPath)) !== O.getOrNull(parentRelPathOf(nextRelPath));
    const nameChanged = baseNameOf(previousRelPath) !== baseNameOf(nextRelPath);
    if (parentChanged) {
      yield* enqueueOrSquash(moved, SyncOperationType.Enum.moveItem, moved.contentDigest);
    }
    if (nameChanged) {
      yield* enqueueOrSquash(moved, SyncOperationType.Enum.renameItem, moved.contentDigest);
    }
  });

  /**
   * Reconcile one observed file against the threaded scan state, returning the
   * updated state. Branches, in order: a file that replaced a tracked folder
   * (repoint + supersede + upload); a same-path digest change (edit + upload);
   * a move/rename of a locally missing row (repoint + retarget + move/rename
   * deltas once remote); otherwise a brand-new file (track + initial upload).
   */
  const reconcileObservedFile = Effect.fn($I`reconcileObservedFile`)(function* (
    input: SyncOnceInput,
    file: ObservedFile,
    state: ScanFileState
  ) {
    const tracked = HashMap.get(state.itemsByPath, file.relPath);
    if (O.isSome(tracked) && SyncItemKind.is.folder(tracked.value.itemKind)) {
      // A file replaced a tracked folder at the same path: repoint the row
      // to the new kind, drop the stale remote linkage, and push the file.
      const replaced = yield* itemRepository.update(
        DomainSyncItem.SyncItem.make({
          ...tracked.value,
          contentDigest: O.some(file.digest),
          contentSizeBytes: O.some(file.sizeBytes),
          itemKind: SyncItemKind.Enum.file,
          lastPushedDigest: O.none(),
          lastPushedGeneration: O.none(),
          localGeneration: S.Natural.make(tracked.value.localGeneration + 1),
          remoteId: O.none(),
          remoteName: O.none(),
          remoteParentId: O.none(),
          syncState: SyncItemState.Enum.pending,
        })
      );
      const nextItemsByPath = HashMap.set(state.itemsByPath, file.relPath, replaced);
      yield* supersedeQueuedOperations(replaced, `superseded: ${file.relPath} changed kind to file`);
      yield* enqueueOrSquash(replaced, SyncOperationType.Enum.uploadFile, O.some(file.digest));
      return {
        itemsByPath: nextItemsByPath,
        missingFileItems: state.missingFileItems,
      };
    }
    if (O.isSome(tracked)) {
      // Same path: only a digest change queues a push.
      const item = tracked.value;
      if (O.exists(item.contentDigest, (digest) => digest === file.digest)) {
        return state;
      }
      const edited = yield* itemRepository.update(
        DomainSyncItem.SyncItem.make({
          ...item,
          contentDigest: O.some(file.digest),
          contentSizeBytes: O.some(file.sizeBytes),
          localGeneration: S.Natural.make(item.localGeneration + 1),
        })
      );
      const nextItemsByPath = HashMap.set(state.itemsByPath, file.relPath, edited);
      const operationType = O.isSome(edited.remoteId)
        ? SyncOperationType.Enum.uploadFileVersion
        : SyncOperationType.Enum.uploadFile;
      yield* enqueueOrSquash(edited, operationType, O.some(file.digest));
      return {
        itemsByPath: nextItemsByPath,
        missingFileItems: state.missingFileItems,
      };
    }

    const candidate = pickMoveCandidate(state.missingFileItems, file);
    if (O.isSome(candidate)) {
      // Move/rename: repoint the row, retarget queued ops, and (once the
      // item exists remotely) queue moveItem/renameItem for the delta.
      const source = candidate.value;
      const nextMissingFileItems = A.filter(state.missingFileItems, (item) => item.id !== source.id);
      const previousRelPath = source.localRelPath;
      const moved = yield* itemRepository.update(
        DomainSyncItem.SyncItem.make({
          ...source,
          contentSizeBytes: O.some(file.sizeBytes),
          localGeneration: S.Natural.make(source.localGeneration + 1),
          localRelPath: file.relPath,
        })
      );
      const nextItemsByPath = HashMap.set(HashMap.remove(state.itemsByPath, previousRelPath), file.relPath, moved);
      yield* retargetQueuedOperations(moved);
      yield* enqueueMoveDeltas(moved, previousRelPath, file.relPath);
      return {
        itemsByPath: nextItemsByPath,
        missingFileItems: nextMissingFileItems,
      };
    }

    // Brand-new file: track it and queue the initial upload.
    const created = yield* itemRepository.create(
      SyncItemSeed.make({
        contentDigest: O.some(file.digest),
        contentSizeBytes: O.some(file.sizeBytes),
        itemKind: SyncItemKind.Enum.file,
        localGeneration: GENERATION_ONE,
        localRelPath: file.relPath,
        provider: BOX_PROVIDER,
        syncState: SyncItemState.Enum.pending,
        workspaceId: input.workspaceId,
      })
    );
    const nextItemsByPath = HashMap.set(state.itemsByPath, file.relPath, created);
    yield* enqueueOrSquash(created, SyncOperationType.Enum.uploadFile, O.some(file.digest));
    return {
      itemsByPath: nextItemsByPath,
      missingFileItems: state.missingFileItems,
    };
  });

  const scanVault = Effect.fn($I`scanVault`)(function* (input: SyncOnceInput) {
    const observation = yield* files.scan(input.vaultRootPath);
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );

    let itemsByPath = HashMap.fromIterable<string, DomainSyncItem.SyncItem>(
      A.map(trackedItems, (item) => [item.localRelPath, item] as const)
    );
    const observedPathKeys = HashMap.fromIterable<string, boolean>(
      A.map(
        A.appendAll(
          A.map(observation.folders, (folder): string => folder.relPath),
          A.map(observation.files, (file): string => file.relPath)
        ),
        (relPath) => [relPath, true] as const
      )
    );

    // Ancestor folders first, depth order, so createFolder ops enqueue before
    // the uploads beneath them and FIFO pumping resolves parents first.
    for (const folder of A.sort(observation.folders, folderDepthOrder)) {
      itemsByPath = yield* reconcileObservedFolder(input, folder, itemsByPath);
    }

    // Locally missing file rows are move/rename candidates; anything left
    // unmatched stays untouched (one-way push: no remote delete, SPEC D4).
    let missingFileItems: ReadonlyArray<DomainSyncItem.SyncItem> = A.filter(
      trackedItems,
      (item) => SyncItemKind.is.file(item.itemKind) && O.isNone(HashMap.get(observedPathKeys, item.localRelPath))
    );

    for (const file of A.sort(observation.files, fileRelPathOrder)) {
      const next = yield* reconcileObservedFile(input, file, {
        itemsByPath,
        missingFileItems,
      });
      itemsByPath = next.itemsByPath;
      missingFileItems = next.missingFileItems;
    }
  });

  /**
   * Revive-eligibility for a failed operation: its item still sits at the
   * operation's target path, its type still matches the item kind, no queued
   * twin of the same type already exists, and the target file is still present
   * on disk. Each `false` mirrors a skip branch of the recovery loop, in order.
   */
  const reviveEligibility = Effect.fn($I`reviveEligibility`)(function* (
    input: SyncOnceInput,
    item: DomainSyncItem.SyncItem,
    operation: DomainSyncOperation.SyncOperation
  ) {
    const typeMatchesKind = SyncItemKind.is.folder(item.itemKind)
      ? SyncOperationType.is.createFolder(operation.operationType) ||
        SyncOperationType.is.moveItem(operation.operationType) ||
        SyncOperationType.is.renameItem(operation.operationType)
      : !SyncOperationType.is.createFolder(operation.operationType);
    if (item.localRelPath !== operation.targetRelPath || !typeMatchesKind) {
      return false;
    }
    const pending = yield* queuedOperationsFor(item);
    if (A.some(pending, (candidate) => candidate.operationType === operation.operationType)) {
      return false;
    }
    const stillPresent = yield* Effect.result(
      fs.stat(path.join(input.vaultRootPath, ...relPathSegments(operation.targetRelPath)))
    );
    return Result.isSuccess(stillPresent);
  });

  /**
   * Revive terminally-failed operations: while connected, a `failed` operation
   * whose item still exists locally at the operation's target path (with no
   * queued or leased twin of the same type, and a type still matching the item
   * kind) is revived to `queued` with a fresh attempt budget, and its item
   * returns from `error` to `pending`. One bad window (expired token, brief
   * outage) therefore never permanently blocks convergence.
   */
  const reviveFailedOperations = Effect.fn($I`reviveFailedOperations`)(function* (
    input: SyncOnceInput,
    itemsById: HashMap.HashMap<DocumentsIdentity.SyncItemId, DomainSyncItem.SyncItem>
  ) {
    const failed = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({
        provider: BOX_PROVIDER,
        status: "failed",
        workspaceId: input.workspaceId,
      })
    );
    // Two failed operations can share one item: thread each revived item back
    // so the next write starts from the row version the last one stored.
    let currentItems = itemsById;
    for (const operation of failed) {
      const tracked = HashMap.get(currentItems, operation.syncItemId);
      if (O.isNone(tracked)) {
        continue;
      }
      const item = tracked.value;
      const eligible = yield* reviveEligibility(input, item, operation);
      if (!eligible) {
        continue;
      }
      yield* operationRepository.update(
        DomainSyncOperation.SyncOperation.make({
          ...operation,
          attemptCount: ZERO,
          lastError: O.none(),
          status: "queued",
        })
      );
      if (SyncItemState.is.error(item.syncState)) {
        const revived = yield* itemRepository.update(
          DomainSyncItem.SyncItem.make({
            ...item,
            lastError: O.none(),
            syncState: SyncItemState.Enum.pending,
          })
        );
        currentItems = HashMap.set(currentItems, revived.id, revived);
      }
    }
  });

  /**
   * Heal the succeeded-op/stale-item crash window: leased ops were already
   * requeued this pass and a failed op leaves its item in `error`, so a
   * `pending` item with no queued op has no active operation at all. It gets a
   * fresh convergent push ({@link stalledOperationType}); the re-run verb is
   * idempotent, so a push that already landed remotely converges rather than
   * duplicating.
   */
  /**
   * Heal one tracked item: a `pending` item with a stalled operation type and
   * no queued or leased twin gets a fresh convergent push enqueued.
   */
  const healPendingItem = Effect.fn($I`healPendingItem`)(function* (item: DomainSyncItem.SyncItem) {
    if (!SyncItemState.is.pending(item.syncState)) {
      return;
    }
    const healType = stalledOperationType(item);
    if (O.isNone(healType)) {
      return;
    }
    const queued = yield* queuedOperationsFor(item);
    if (A.isReadonlyArrayNonEmpty(queued)) {
      return;
    }
    yield* enqueueOrSquash(
      item,
      healType.value,
      SyncOperationType.is.createFolder(healType.value) ? O.none() : item.contentDigest
    );
  });

  const healOrphanedPendingItems = Effect.fn($I`healOrphanedPendingItems`)(function* (
    trackedItems: ReadonlyArray<DomainSyncItem.SyncItem>
  ) {
    for (const item of trackedItems) {
      yield* healPendingItem(item);
    }
  });

  /**
   * Stalled-operation recovery, run while the mirror probe reports connected:
   * revive terminally-failed operations, then heal the succeeded-op/stale-item
   * crash window, over one shared tracked-item snapshot.
   */
  const recoverStalledOperations = Effect.fn($I`recoverStalledOperations`)(function* (
    input: SyncOnceInput,
    connected: boolean
  ) {
    if (!connected) {
      return;
    }
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const itemsById = HashMap.fromIterable(A.map(trackedItems, (item) => [item.id, item] as const));
    yield* reviveFailedOperations(input, itemsById);
    yield* healOrphanedPendingItems(trackedItems);
  });

  const readStatus = Effect.fn($I`readStatus`)(function* (input: VaultSyncStatusInput) {
    const items = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const queued = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({
        provider: BOX_PROVIDER,
        status: "queued",
        workspaceId: input.workspaceId,
      })
    );
    const failed = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({
        provider: BOX_PROVIDER,
        status: "failed",
        workspaceId: input.workspaceId,
      })
    );
    const conflicts = yield* conflictRepository.listOpen(
      ListOpenSyncConflictsInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    // forceProbe carries an operator's explicit retry: bypass the cached
    // probe answer and ask the provider now; passive reads stay cached.
    const probe = yield* input.forceProbe ? availability.refresh : availability.probe;
    const countItemsIn = (guard: (state: DomainSyncItem.SyncItemState) => boolean) =>
      S.Natural.make(A.length(A.filter(items, (item) => guard(item.syncState))));

    return VaultSyncStatus.make({
      conflictItems: countItemsIn(SyncItemState.is.conflict),
      connected: probe.connected,
      disconnectReason: probe.disconnectReason,
      currentItems: countItemsIn(SyncItemState.is.current),
      cursorPosition: O.map(cursor, (current) => current.streamPosition),
      errorItems: countItemsIn(SyncItemState.is.error),
      failedOperations: S.Natural.make(A.length(failed)),
      openConflicts: S.Natural.make(A.length(conflicts)),
      pendingItems: countItemsIn(SyncItemState.is.pending),
      probedAt: probe.probedAt,
      provider: probe.provider,
      queuedOperations: S.Natural.make(A.length(queued)),
    });
  });

  const requeueReviewedConflictItem = Effect.fn($I`requeueReviewedConflictItem`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    syncItemId: DocumentsIdentity.SyncItemId
  ) {
    const items = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({ provider: BOX_PROVIDER, workspaceId })
    );
    return yield* pipe(
      A.findFirst(items, (item) => item.id === syncItemId),
      O.filter((item) => SyncItemState.is.conflict(item.syncState)),
      O.map((item) =>
        itemRepository.update(
          DomainSyncItem.SyncItem.make({
            ...item,
            syncState: SyncItemState.Enum.pending,
          })
        )
      ),
      O.getOrElse(() => Effect.void)
    );
  });

  const markConflictReviewedLocked = Effect.fn($I`markConflictReviewedLocked`)(function* (
    input: MarkConflictReviewedInput
  ) {
    // Reviews are workspace-scoped: a conflict id from another workspace is
    // indistinguishable from a missing one.
    const openConflicts = yield* conflictRepository.listOpen(
      ListOpenSyncConflictsInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const reviewedConflict = A.findFirst(openConflicts, (conflict) => conflict.id === input.conflictId);
    if (O.isNone(reviewedConflict)) {
      return yield* SyncConflictRepositoryNotFound.make({ conflictId: input.conflictId });
    }
    const reviewed = yield* conflictRepository.markReviewed(
      MarkSyncConflictReviewedInput.make({ conflictId: input.conflictId })
    );

    // Reviewing used to touch only the conflict record, leaving the item
    // parked in `conflict` forever: the row vanished from the panel while the
    // conflict counter stayed up, with no remaining way to resolve it. The
    // mirror is a one-way push, so an acknowledged remote drift means the
    // local state wins — return the item to `pending` and let the next pass
    // re-converge it.
    yield* pipe(
      reviewedConflict.value.syncItemId,
      O.map((syncItemId) => requeueReviewedConflictItem(input.workspaceId, syncItemId)),
      O.getOrElse(() => Effect.void)
    );

    return reviewed;
  });

  return VaultSyncEngine.of({
    listOpenConflicts: Effect.fn($I`listOpenConflicts`)(function* (input) {
      return yield* conflictRepository.listOpen(
        ListOpenSyncConflictsInput.make({
          provider: BOX_PROVIDER,
          workspaceId: input.workspaceId,
        })
      );
    }),
    markConflictReviewed: Effect.fn($I`markConflictReviewed`)(function* (input) {
      // Reviewing takes the same per-workspace lock a sync pass takes. It reads the
      // open conflicts, marks one reviewed, and returns its item to `pending` — a
      // read-modify-write over exactly the rows a concurrent pass is scanning and
      // leasing. Without the lock, a pass running alongside the review could lease
      // the item between the review and the requeue and strand it right back in
      // `conflict`, so the row the user just resolved came straight back.
      const lock = yield* lockFor(input.workspaceId);
      return yield* lock.withPermit(markConflictReviewedLocked(input));
    }),
    status: readStatus,
    syncOnce: Effect.fn($I`syncOnce`)(function* (input) {
      const lock = yield* lockFor(input.workspaceId);
      return yield* lock.withPermit(
        Effect.gen(function* () {
          const canonicalRoot = yield* fs
            .realPath(input.vaultRootPath)
            .pipe(Effect.mapError(() => scanFailed(`vault sync could not resolve vault root ${input.vaultRootPath}`)));
          const canonicalInput = SyncOnceInput.make({
            ...input,
            vaultRootPath: canonicalRoot,
          });
          const probe = yield* availability.probe;
          yield* operationRepository.requeueLeased(
            RequeueLeasedSyncOperationsInput.make({
              provider: BOX_PROVIDER,
              workspaceId: input.workspaceId,
            })
          );
          yield* recoverStalledOperations(canonicalInput, probe.connected);
          yield* scanVault(canonicalInput);
          const pushRecords = yield* push.pumpQueue(canonicalInput);
          yield* drift
            .pollRemoteEvents(canonicalInput, pushRecords)
            .pipe(Effect.catchTag("DmsMirrorUnavailable", (error) => drift.recordPollFailure(canonicalInput, error)));
          return yield* readStatus(VaultSyncStatusInput.make({ workspaceId: input.workspaceId }));
        })
      );
    }),
  });
});
