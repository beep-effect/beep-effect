/**
 * Vault sync engine server service.
 *
 * Implements the {@link VaultSyncEngine} port: one `syncOnce` pass recovers
 * leased outbox operations, scans the local vault, pumps the push outbox
 * against the DMS mirror, polls remote drift events, and returns the resulting
 * status snapshot.
 *
 * @remarks
 * Design posture (goals/legal-document-intake P3): the mirror is a one-way
 * push, so locally deleted items never trigger remote deletes; folder
 * move/rename is not inferred (files converge individually and empty remote
 * folders remain); a poll failure records the cursor error state but never
 * fails `syncOnce`, which still returns a status snapshot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { SyncItemKind, VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorUnavailable,
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
  VaultScanFailed,
  VaultSyncEngine,
  VaultSyncStatus,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepository,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import {
  FindSyncCursorInput,
  SyncCursorRepository,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  FindSyncItemByPathInput,
  FindSyncItemByRemoteIdInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepository,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListQueuedSyncOperationsForItemInput,
  ListQueuedSyncOperationsInput,
  ListSyncOperationsByStatusInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepository,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, HashMap, identity, Order, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { VaultSyncConfig } from "./VaultSync.config.js";
import type { RemoteItemId } from "@beep/documents-domain/values/Sync";
import type { DmsRemoteEvent, DmsRemoteItem, SyncOnceInput } from "@beep/documents-use-cases/aggregates/Sync/server";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncEngine.service");

const BOX_PROVIDER = "box";

const SyncConflictKind = DomainSyncConflict.SyncConflictKind;
const SyncItemState = DomainSyncItem.SyncItemState;
const SyncOperationType = DomainSyncOperation.SyncOperationType;

const ZERO = NonNegativeInt.make(0);
const GENERATION_ONE = NonNegativeInt.make(1);

const contentDigestOf = (bytes: Uint8Array): DocumentContentDigest =>
  DocumentContentDigest.make(bytesToHex(sha256(bytes)));

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
 * `{provider}:{workspaceId}:{operationType}:{targetRelPath}:{inputGeneration}`.
 */
const idempotencyKeyFor = (
  item: DomainSyncItem.SyncItem,
  operationType: DomainSyncOperation.SyncOperationType
): string => `${item.provider}:${item.workspaceId}:${operationType}:${item.localRelPath}:${item.localGeneration}`;

type ObservedFile = {
  readonly digest: DocumentContentDigest;
  readonly relPath: VaultRelPath;
  readonly sizeBytes: NonNegativeInt;
};

type ObservedFolder = {
  readonly relPath: VaultRelPath;
};

type VaultScanObservation = {
  readonly files: ReadonlyArray<ObservedFile>;
  readonly folders: ReadonlyArray<ObservedFolder>;
};

const emptyObservation: VaultScanObservation = { files: [], folders: [] };

const mergeObservations = (observations: ReadonlyArray<VaultScanObservation>): VaultScanObservation => ({
  files: A.flatMap(observations, (observation) => observation.files),
  folders: A.flatMap(observations, (observation) => observation.folders),
});

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

const requiresRemoteId = (operationType: DomainSyncOperation.SyncOperationType): boolean =>
  SyncOperationType.$match(operationType, {
    createFolder: F.constFalse,
    moveItem: F.constTrue,
    renameItem: F.constTrue,
    uploadFile: F.constFalse,
    uploadFileVersion: F.constTrue,
  });

const knownItemConflictKind = (eventType: DmsEventType): DomainSyncConflict.SyncConflictKind =>
  DmsEventType.$match(eventType, {
    created: () => SyncConflictKind.Enum.remoteEdit,
    deleted: () => SyncConflictKind.Enum.remoteDelete,
    edited: () => SyncConflictKind.Enum.remoteEdit,
    moved: () => SyncConflictKind.Enum.remoteMove,
    renamed: () => SyncConflictKind.Enum.remoteRename,
    unknown: () => SyncConflictKind.Enum.remoteUnknown,
  });

const unknownItemConflictKind = (eventType: DmsEventType): DomainSyncConflict.SyncConflictKind =>
  DmsEventType.$match(eventType, {
    created: () => SyncConflictKind.Enum.remoteCreate,
    deleted: () => SyncConflictKind.Enum.remoteUnknown,
    edited: () => SyncConflictKind.Enum.remoteCreate,
    moved: () => SyncConflictKind.Enum.remoteUnknown,
    renamed: () => SyncConflictKind.Enum.remoteUnknown,
    unknown: () => SyncConflictKind.Enum.remoteUnknown,
  });

/**
 * Event types our own push verbs emit; a matching event of one of these types
 * is an echo of the engine's own push and is ignored.
 */
const isEchoCapableEventType = (eventType: DmsEventType): boolean =>
  DmsEventType.$match(eventType, {
    created: F.constTrue,
    deleted: F.constFalse,
    edited: F.constTrue,
    moved: F.constTrue,
    renamed: F.constTrue,
    unknown: F.constFalse,
  });

const matchesEventField = <Value>(field: O.Option<Value>, current: O.Option<Value>): boolean =>
  O.match(field, {
    onNone: F.constTrue,
    onSome: (value) => O.exists(current, (candidate) => candidate === value),
  });

/**
 * Echo check: an event whose type is push-emitted and whose `(name, parent)`
 * both match the item's last pushed remote state (missing event fields count
 * as a match) is the provider echoing our own push.
 */
const isEchoOf = (event: DmsRemoteEvent, item: DomainSyncItem.SyncItem): boolean =>
  isEchoCapableEventType(event.eventType) &&
  matchesEventField(event.name, item.remoteName) &&
  matchesEventField(event.parentRemoteId, item.remoteParentId);

/**
 * Build the vault sync engine from its repository, mirror, configuration, and
 * platform dependencies.
 *
 * @example
 * ```ts
 * import { DmsMirrorFixtureLayer, makeVaultSyncEngine, VaultSyncConfigLayer } from "@beep/documents-server/aggregates/Sync"
 * import { SyncConflictRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncConflict"
 * import { SyncCursorRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncCursor"
 * import { SyncItemRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncItem"
 * import { SyncOperationRepositoryInMemoryLayer } from "@beep/documents-server/entities/SyncOperation"
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { Effect, Layer } from "effect"
 *
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
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncEngine = Effect.fn($I`makeVaultSyncEngine`)(function* () {
  const itemRepository = yield* SyncItemRepository;
  const operationRepository = yield* SyncOperationRepository;
  const cursorRepository = yield* SyncCursorRepository;
  const conflictRepository = yield* SyncConflictRepository;
  const mirror = yield* DmsMirror;
  const availability = yield* DmsMirrorAvailability;
  const config = yield* VaultSyncConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walkDirectory = (
    absolutePath: string,
    relSegments: ReadonlyArray<string>
  ): Effect.Effect<VaultScanObservation, VaultScanFailed> =>
    Effect.gen(function* () {
      const names = yield* fs
        .readDirectory(absolutePath)
        .pipe(Effect.mapError(() => scanFailed(`vault scan could not read directory ${absolutePath}`)));
      const visible = pipe(names, A.filter(P.not(Str.startsWith("."))), A.sort(Order.String));
      const observations = yield* Effect.forEach(visible, (name) =>
        Effect.gen(function* () {
          const childAbsolutePath = path.join(absolutePath, name);
          const childSegments = A.append(relSegments, name);
          const info = yield* fs
            .stat(childAbsolutePath)
            .pipe(Effect.mapError(() => scanFailed(`vault scan could not stat ${childAbsolutePath}`)));
          if (info.type === "Directory") {
            const nested = yield* walkDirectory(childAbsolutePath, childSegments);
            const folder: ObservedFolder = { relPath: VaultRelPath.make(A.join(childSegments, "/")) };
            return mergeObservations([{ files: [], folders: [folder] }, nested]);
          }
          if (info.type === "File") {
            const bytes = yield* fs
              .readFile(childAbsolutePath)
              .pipe(Effect.mapError(() => scanFailed(`vault scan could not read file ${childAbsolutePath}`)));
            const file: ObservedFile = {
              digest: contentDigestOf(bytes),
              relPath: VaultRelPath.make(A.join(childSegments, "/")),
              sizeBytes: NonNegativeInt.make(bytes.byteLength),
            };
            return mergeObservations([{ files: [file], folders: [] }]);
          }
          return emptyObservation;
        })
      );

      return mergeObservations(observations);
    }).pipe(Effect.withSpan($I`walkDirectory`));

  const enqueueOrSquash = Effect.fn($I`enqueueOrSquash`)(function* (
    item: DomainSyncItem.SyncItem,
    operationType: DomainSyncOperation.SyncOperationType,
    inputContentDigest: O.Option<DocumentContentDigest>
  ) {
    const queued = yield* operationRepository.listQueuedForItem(
      ListQueuedSyncOperationsForItemInput.make({ syncItemId: item.id, workspaceId: item.workspaceId })
    );
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
   * Squash rule: retarget every queued (not leased) operation of the item to
   * its updated path and generation instead of enqueueing a duplicate.
   */
  const retargetQueuedOperations = Effect.fn($I`retargetQueuedOperations`)(function* (item: DomainSyncItem.SyncItem) {
    const queued = yield* operationRepository.listQueuedForItem(
      ListQueuedSyncOperationsForItemInput.make({ syncItemId: item.id, workspaceId: item.workspaceId })
    );
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

  const scanVault = Effect.fn($I`scanVault`)(function* (input: SyncOnceInput) {
    const observation = yield* walkDirectory(input.vaultRootPath, A.empty<string>());
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
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
      if (O.isNone(HashMap.get(itemsByPath, folder.relPath))) {
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
        itemsByPath = HashMap.set(itemsByPath, folder.relPath, created);
        yield* enqueueOrSquash(created, SyncOperationType.Enum.createFolder, O.none());
      }
    }

    // Locally missing file rows are move/rename candidates; anything left
    // unmatched stays untouched (one-way push: no remote delete, SPEC D4).
    let missingFileItems = A.filter(
      trackedItems,
      (item) => SyncItemKind.is.file(item.itemKind) && O.isNone(HashMap.get(observedPathKeys, item.localRelPath))
    );

    for (const file of A.sort(observation.files, fileRelPathOrder)) {
      const tracked = HashMap.get(itemsByPath, file.relPath);
      if (O.isSome(tracked)) {
        // Same path: only a digest change queues a push.
        const item = tracked.value;
        if (!O.exists(item.contentDigest, (digest) => digest === file.digest)) {
          const edited = yield* itemRepository.update(
            DomainSyncItem.SyncItem.make({
              ...item,
              contentDigest: O.some(file.digest),
              contentSizeBytes: O.some(file.sizeBytes),
              localGeneration: NonNegativeInt.make(item.localGeneration + 1),
            })
          );
          itemsByPath = HashMap.set(itemsByPath, file.relPath, edited);
          const operationType = O.isSome(edited.remoteId)
            ? SyncOperationType.Enum.uploadFileVersion
            : SyncOperationType.Enum.uploadFile;
          yield* enqueueOrSquash(edited, operationType, O.some(file.digest));
        }
        continue;
      }

      const candidate = pickMoveCandidate(missingFileItems, file);
      if (O.isSome(candidate)) {
        // Move/rename: repoint the row, retarget queued ops, and (once the
        // item exists remotely) queue moveItem/renameItem for the delta.
        const source = candidate.value;
        missingFileItems = A.filter(missingFileItems, (item) => item.id !== source.id);
        const previousRelPath = source.localRelPath;
        const moved = yield* itemRepository.update(
          DomainSyncItem.SyncItem.make({
            ...source,
            contentSizeBytes: O.some(file.sizeBytes),
            localGeneration: NonNegativeInt.make(source.localGeneration + 1),
            localRelPath: file.relPath,
          })
        );
        itemsByPath = HashMap.set(HashMap.remove(itemsByPath, previousRelPath), file.relPath, moved);
        yield* retargetQueuedOperations(moved);
        if (O.isSome(moved.remoteId)) {
          const parentChanged =
            O.getOrNull(parentRelPathOf(previousRelPath)) !== O.getOrNull(parentRelPathOf(file.relPath));
          const nameChanged = baseNameOf(previousRelPath) !== baseNameOf(file.relPath);
          if (parentChanged) {
            yield* enqueueOrSquash(moved, SyncOperationType.Enum.moveItem, moved.contentDigest);
          }
          if (nameChanged) {
            yield* enqueueOrSquash(moved, SyncOperationType.Enum.renameItem, moved.contentDigest);
          }
        }
        continue;
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
      itemsByPath = HashMap.set(itemsByPath, file.relPath, created);
      yield* enqueueOrSquash(created, SyncOperationType.Enum.uploadFile, O.some(file.digest));
    }
  });

  const readVaultFileBytes = Effect.fn($I`readVaultFileBytes`)(function* (
    vaultRootPath: string,
    relPath: VaultRelPath
  ) {
    const absolutePath = path.join(vaultRootPath, ...relPathSegments(relPath));
    return yield* fs
      .readFile(absolutePath)
      .pipe(Effect.mapError(() => scanFailed(`vault sync could not read local file ${relPath}`)));
  });

  /**
   * Resolve an operation's remote parent. The outer `none` means the parent
   * folder has no remote identifier yet and the operation must stay queued;
   * the inner option is the port-facing parent (`none` targets the mirror root).
   */
  const resolveParentRemoteId = Effect.fn($I`resolveParentRemoteId`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    targetParentRelPath: O.Option<VaultRelPath>
  ) {
    return yield* O.match(targetParentRelPath, {
      onNone: () => Effect.succeedSome(O.none<RemoteItemId>()),
      onSome: (parentRelPath) =>
        itemRepository
          .findByPath(
            FindSyncItemByPathInput.make({ localRelPath: parentRelPath, provider: BOX_PROVIDER, workspaceId })
          )
          .pipe(
            Effect.map((parent) =>
              O.map(
                O.flatMap(parent, (folder) => folder.remoteId),
                O.some
              )
            )
          ),
    });
  });

  const withItemRemoteId = <Value, Error>(
    item: DomainSyncItem.SyncItem,
    use: (remoteId: RemoteItemId) => Effect.Effect<Value, Error>
  ): Effect.Effect<Value, Error | DmsMirrorUnavailable> =>
    O.match(item.remoteId, {
      // Defensive: runOperation skips these operations before leasing.
      onNone: () =>
        Effect.fail(
          DmsMirrorUnavailable.make({
            provider: BOX_PROVIDER,
            reason: `sync item ${item.localRelPath} has no remote identifier yet`,
            retryable: true,
          })
        ),
      onSome: use,
    });

  const mirrorVerbFor = (
    input: SyncOnceInput,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    parentRemoteId: O.Option<RemoteItemId>
  ): Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable | VaultScanFailed> =>
    SyncOperationType.$match(operation.operationType, {
      createFolder: () => mirror.ensureFolder(EnsureFolderInput.make({ name: operation.targetName, parentRemoteId })),
      moveItem: () =>
        withItemRemoteId(item, (remoteId) =>
          mirror.moveItem(MoveItemInput.make({ itemKind: item.itemKind, newParentRemoteId: parentRemoteId, remoteId }))
        ),
      renameItem: () =>
        withItemRemoteId(item, (remoteId) =>
          mirror.renameItem(RenameItemInput.make({ itemKind: item.itemKind, newName: operation.targetName, remoteId }))
        ),
      uploadFile: () =>
        readVaultFileBytes(input.vaultRootPath, operation.targetRelPath).pipe(
          Effect.flatMap((content) =>
            mirror.uploadFile(UploadFileInput.make({ content, name: operation.targetName, parentRemoteId }))
          )
        ),
      uploadFileVersion: () =>
        withItemRemoteId(item, (remoteId) =>
          readVaultFileBytes(input.vaultRootPath, operation.targetRelPath).pipe(
            Effect.flatMap((content) =>
              mirror.uploadFileVersion(UploadFileVersionInput.make({ content, name: operation.targetName, remoteId }))
            )
          )
        ),
    });

  const recordPushSuccess = Effect.fn($I`recordPushSuccess`)(function* (
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>>,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    remote: DmsRemoteItem
  ) {
    yield* operationRepository.update(
      DomainSyncOperation.SyncOperation.make({ ...operation, lastError: O.none(), status: "succeeded" })
    );
    const updated = yield* itemRepository.update(
      DomainSyncItem.SyncItem.make({
        ...item,
        lastError: O.none(),
        lastPushedDigest: operation.inputContentDigest,
        lastPushedGeneration: O.some(operation.inputGeneration),
        remoteId: O.some(remote.remoteId),
        remoteName: O.some(remote.name),
        remoteParentId: remote.parentRemoteId,
        syncState: SyncItemState.Enum.current,
      })
    );
    yield* Ref.update(itemsByIdRef, HashMap.set(updated.id, updated));
  });

  const recordPushFailure = Effect.fn($I`recordPushFailure`)(function* (
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>>,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    error: DmsMirrorUnavailable
  ) {
    const attemptCount = NonNegativeInt.make(operation.attemptCount + 1);
    const requeue = error.retryable && attemptCount < config.maxAttempts;
    yield* operationRepository.update(
      DomainSyncOperation.SyncOperation.make({
        ...operation,
        attemptCount,
        lastError: O.some(error.reason),
        status: requeue ? "queued" : "failed",
      })
    );
    if (!requeue) {
      const updated = yield* itemRepository.update(
        DomainSyncItem.SyncItem.make({ ...item, lastError: O.some(error.reason), syncState: SyncItemState.Enum.error })
      );
      yield* Ref.update(itemsByIdRef, HashMap.set(updated.id, updated));
    }
  });

  /**
   * Attempt one queued operation. Returns `false` (no attempt burned, stays
   * queued) when the operation is not yet executable: its parent folder or its
   * own item has no remote identifier.
   */
  const runOperation = Effect.fn($I`runOperation`)(function* (
    input: SyncOnceInput,
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>>,
    operation: DomainSyncOperation.SyncOperation
  ) {
    const items = yield* Ref.get(itemsByIdRef);
    const tracked = HashMap.get(items, operation.syncItemId);
    if (O.isNone(tracked)) {
      yield* Effect.logDebug("Documents vault sync skipped an operation without a tracked item").pipe(
        Effect.annotateLogs({ syncItemId: operation.syncItemId, syncOperationId: operation.id })
      );
      return false;
    }
    const item = tracked.value;
    if (requiresRemoteId(operation.operationType) && O.isNone(item.remoteId)) {
      return false;
    }
    const parentResolution = yield* resolveParentRemoteId(input.workspaceId, operation.targetParentRelPath);
    if (O.isNone(parentResolution)) {
      return false;
    }
    const leased = yield* operationRepository.update(
      DomainSyncOperation.SyncOperation.make({ ...operation, status: "leased" })
    );
    yield* mirrorVerbFor(input, leased, item, parentResolution.value).pipe(
      Effect.flatMap((remote) => recordPushSuccess(itemsByIdRef, leased, item, remote)),
      Effect.catchTag("DmsMirrorUnavailable", (error) => recordPushFailure(itemsByIdRef, leased, item, error))
    );
    return true;
  });

  /**
   * Pump passes over the queued outbox in id (FIFO) order until the queue is
   * empty or a full pass makes no progress (every remaining op is blocked on a
   * parent without a remote identifier).
   */
  const pumpQueue = Effect.fn($I`pumpQueue`)(function* (input: SyncOnceInput) {
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    const itemsByIdRef = yield* Ref.make(HashMap.fromIterable(A.map(trackedItems, (item) => [item.id, item] as const)));
    let progressed = true;
    while (progressed) {
      const queue = yield* operationRepository.listQueued(
        ListQueuedSyncOperationsInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
      );
      const outcomes = yield* Effect.forEach(queue, (operation) => runOperation(input, itemsByIdRef, operation));
      progressed = A.some(outcomes, identity);
    }
  });

  const conflictSeedFor = (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    event: DmsRemoteEvent,
    conflictKind: DomainSyncConflict.SyncConflictKind,
    item: O.Option<DomainSyncItem.SyncItem>
  ): SyncConflictSeed =>
    SyncConflictSeed.make({
      conflictKind,
      localRelPath: O.map(item, (tracked) => tracked.localRelPath),
      provider: BOX_PROVIDER,
      remoteEventId: O.some(event.eventId),
      remoteId: event.remoteId,
      remotePayload: event.payload,
      resolutionStatus: "open",
      syncItemId: O.map(item, (tracked) => tracked.id),
      workspaceId,
    });

  const classifyRemoteEvent = Effect.fn($I`classifyRemoteEvent`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    event: DmsRemoteEvent
  ) {
    if (O.isNone(event.remoteId)) {
      yield* conflictRepository.record(
        conflictSeedFor(workspaceId, event, SyncConflictKind.Enum.remoteUnknown, O.none())
      );
      return;
    }
    const tracked = yield* itemRepository.findByRemoteId(
      FindSyncItemByRemoteIdInput.make({ provider: BOX_PROVIDER, remoteId: event.remoteId.value, workspaceId })
    );
    if (O.isNone(tracked)) {
      yield* conflictRepository.record(
        conflictSeedFor(workspaceId, event, unknownItemConflictKind(event.eventType), O.none())
      );
      return;
    }
    const item = tracked.value;
    if (isEchoOf(event, item)) {
      yield* Effect.logDebug("Documents vault sync ignored a push echo event").pipe(
        Effect.annotateLogs({ eventId: event.eventId, remoteId: event.remoteId.value })
      );
      return;
    }
    yield* conflictRepository.record(
      conflictSeedFor(workspaceId, event, knownItemConflictKind(event.eventType), tracked)
    );
    yield* itemRepository.update(DomainSyncItem.SyncItem.make({ ...item, syncState: SyncItemState.Enum.conflict }));
  });

  /**
   * Poll remote drift. A `none` cursor bootstraps via `pollEvents(none)`,
   * which returns the provider's current position with (per port contract)
   * empty entries; any returned entries are classified with the same rules.
   * The page loop is bounded by `eventPageLimit` per sync pass.
   */
  const pollRemoteEvents = Effect.fn($I`pollRemoteEvents`)(function* (input: SyncOnceInput) {
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    let streamPosition = O.map(cursor, (current) => current.streamPosition);
    let lastEventId = O.flatMap(cursor, (current) => current.lastEventId);
    for (let page = 0; page < config.eventPageLimit; page += 1) {
      const events = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition }));
      yield* Effect.forEach(events.entries, (event) => classifyRemoteEvent(input.workspaceId, event));
      lastEventId = O.orElse(
        O.map(A.last(events.entries), (event) => event.eventId),
        () => lastEventId
      );
      yield* cursorRepository.upsert(
        SyncCursorSeed.make({
          lastError: O.none(),
          lastEventId,
          provider: BOX_PROVIDER,
          status: "active",
          streamPosition: events.nextStreamPosition,
          workspaceId: input.workspaceId,
        })
      );
      streamPosition = O.some(events.nextStreamPosition);
      const drained = A.match(events.entries, { onEmpty: F.constTrue, onNonEmpty: F.constFalse });
      if (drained) {
        return;
      }
    }
  });

  /**
   * A mirror failure while polling records the cursor error state instead of
   * failing `syncOnce`; before the cursor bootstraps there is no durable row
   * to mark, so the failure is only logged.
   */
  const recordPollFailure = Effect.fn($I`recordPollFailure`)(function* (
    input: SyncOnceInput,
    error: DmsMirrorUnavailable
  ) {
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    yield* O.match(cursor, {
      onNone: () =>
        Effect.logDebug("Documents vault sync poll failed before the cursor bootstrapped").pipe(
          Effect.annotateLogs({ reason: error.reason })
        ),
      onSome: (current) =>
        cursorRepository
          .upsert(
            SyncCursorSeed.make({
              lastError: O.some(error.reason),
              lastEventId: current.lastEventId,
              provider: BOX_PROVIDER,
              status: "error",
              streamPosition: current.streamPosition,
              workspaceId: input.workspaceId,
            })
          )
          .pipe(Effect.asVoid),
    });
  });

  const readStatus = Effect.fn($I`readStatus`)(function* (input: VaultSyncStatusInput) {
    const items = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    const queued = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({ provider: BOX_PROVIDER, status: "queued", workspaceId: input.workspaceId })
    );
    const failed = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({ provider: BOX_PROVIDER, status: "failed", workspaceId: input.workspaceId })
    );
    const conflicts = yield* conflictRepository.listOpen(
      ListOpenSyncConflictsInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
    );
    const probe = yield* availability.probe;
    const countItemsIn = (guard: (state: DomainSyncItem.SyncItemState) => boolean) =>
      NonNegativeInt.make(A.length(A.filter(items, (item) => guard(item.syncState))));

    return VaultSyncStatus.make({
      conflictItems: countItemsIn(SyncItemState.is.conflict),
      connected: probe.connected,
      currentItems: countItemsIn(SyncItemState.is.current),
      cursorPosition: O.map(cursor, (current) => current.streamPosition),
      errorItems: countItemsIn(SyncItemState.is.error),
      failedOperations: NonNegativeInt.make(A.length(failed)),
      openConflicts: NonNegativeInt.make(A.length(conflicts)),
      pendingItems: countItemsIn(SyncItemState.is.pending),
      provider: probe.provider,
      queuedOperations: NonNegativeInt.make(A.length(queued)),
    });
  });

  return VaultSyncEngine.of({
    listOpenConflicts: Effect.fn($I`listOpenConflicts`)(function* (input) {
      return yield* conflictRepository.listOpen(
        ListOpenSyncConflictsInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
      );
    }),
    markConflictReviewed: Effect.fn($I`markConflictReviewed`)(function* (input) {
      return yield* conflictRepository.markReviewed(
        MarkSyncConflictReviewedInput.make({ conflictId: input.conflictId })
      );
    }),
    status: readStatus,
    syncOnce: Effect.fn($I`syncOnce`)(function* (input) {
      yield* operationRepository.requeueLeased(
        RequeueLeasedSyncOperationsInput.make({ provider: BOX_PROVIDER, workspaceId: input.workspaceId })
      );
      yield* scanVault(input);
      yield* pumpQueue(input);
      yield* pollRemoteEvents(input).pipe(
        Effect.catchTag("DmsMirrorUnavailable", (error) => recordPollFailure(input, error))
      );
      return yield* readStatus(VaultSyncStatusInput.make({ workspaceId: input.workspaceId }));
    }),
  });
});
