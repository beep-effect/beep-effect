/**
 * Execute queued vault mirror operations and persist their outcomes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import {
  DmsMirror,
  DmsMirrorUnavailable,
  EnsureFolderInput,
  MoveItemInput,
  RenameItemInput,
  UploadFileInput,
  UploadFileVersionInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  FindSyncItemByPathInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepository,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListQueuedSyncOperationsInput,
  SyncOperationRepository,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { echoClassForOperation, makePushRecord } from "./VaultPush.model.ts";
import { VaultSyncConfig } from "./VaultSync.config.ts";
import { makeVaultSyncFileStore } from "./VaultSync.file-store.ts";
import type { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import type { DmsRemoteItem, SyncOnceInput, VaultScanFailed } from "@beep/documents-use-cases/aggregates/Sync/server";
import type * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { PushRecord } from "./VaultPush.model.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.push");
const BOX_PROVIDER = "box";
const SyncItemState = DomainSyncItem.SyncItemState;
const SyncOperationType = DomainSyncOperation.SyncOperationType;

const requiresRemoteId = (operationType: DomainSyncOperation.SyncOperationType): boolean =>
  SyncOperationType.match(operationType, {
    createFolder: F.constFalse,
    moveItem: F.constTrue,
    renameItem: F.constTrue,
    uploadFile: F.constFalse,
    uploadFileVersion: F.constTrue,
  });

/**
 * Build the queue executor from existing repositories, mirror and safe file reads.
 *
 * **Details**
 *
 * The engine owns the workspace lock and recovery. This phase leases only
 * executable operations, preserves the configured attempt budget, and returns
 * successful push observations for the subsequent remote-drift poll. Per-pass
 * item snapshots and echo observations never survive into another pass.
 *
 * **Example** (Execute a prepared queue under the engine lock)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import type { SyncOnceInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { makeVaultSyncPush } from "./VaultSync.push.ts"
 * const executePreparedQueue = (input: SyncOnceInput) => Effect.gen(function* () {
 *   const push = yield* makeVaultSyncPush()
 *   return yield* push.pumpQueue(input)
 * })
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncPush = Effect.fn($I`makeVaultSyncPush`)(function* () {
  const itemRepository = yield* SyncItemRepository;
  const operationRepository = yield* SyncOperationRepository;
  const mirror = yield* DmsMirror;
  const config = yield* VaultSyncConfig;
  const files = yield* makeVaultSyncFileStore();

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
            FindSyncItemByPathInput.make({
              localRelPath: parentRelPath,
              provider: BOX_PROVIDER,
              workspaceId,
            })
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
    // runOperation checks the captured immutable item before leasing.
    use(O.getOrThrow(item.remoteId));

  const mirrorVerbFor = (
    input: SyncOnceInput,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    parentRemoteId: O.Option<RemoteItemId>
  ): Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable | VaultScanFailed> =>
    SyncOperationType.match(operation.operationType, {
      createFolder: () =>
        mirror.ensureFolder(
          EnsureFolderInput.make({
            name: operation.targetName,
            parentRemoteId,
          })
        ),
      moveItem: () =>
        withItemRemoteId(item, (remoteId) =>
          mirror.moveItem(
            MoveItemInput.make({
              itemKind: item.itemKind,
              newParentRemoteId: parentRemoteId,
              remoteId,
            })
          )
        ),
      renameItem: () =>
        withItemRemoteId(item, (remoteId) =>
          mirror.renameItem(
            RenameItemInput.make({
              itemKind: item.itemKind,
              newName: operation.targetName,
              remoteId,
            })
          )
        ),
      uploadFile: () =>
        files.read(input.vaultRootPath, operation.targetRelPath).pipe(
          Effect.flatMap((content) =>
            mirror.uploadFile(
              UploadFileInput.make({
                content,
                name: operation.targetName,
                parentRemoteId,
              })
            )
          )
        ),
      uploadFileVersion: () =>
        withItemRemoteId(item, (remoteId) =>
          files.read(input.vaultRootPath, operation.targetRelPath).pipe(
            Effect.flatMap((content) =>
              mirror.uploadFileVersion(
                UploadFileVersionInput.make({
                  content,
                  name: operation.targetName,
                  remoteId,
                })
              )
            )
          )
        ),
    });

  const recordPushSuccess = Effect.fn($I`recordPushSuccess`)(function* (
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DocumentsIdentity.SyncItemId, DomainSyncItem.SyncItem>>,
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    remote: DmsRemoteItem
  ) {
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
    // Keep the operation leased until the item is durable. A failed item write
    // can then use ordinary lease recovery on restart, including folder moves.
    yield* operationRepository.update(
      DomainSyncOperation.SyncOperation.make({
        ...operation,
        lastError: O.none(),
        status: "succeeded",
      })
    );
    yield* Ref.update(itemsByIdRef, HashMap.set(updated.id, updated));
    yield* Ref.update(pushRecordsRef, (records) =>
      A.append(records, makePushRecord(echoClassForOperation(operation.operationType), remote.remoteId))
    );
  });

  const recordPushFailure = Effect.fn($I`recordPushFailure`)(function* (
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DocumentsIdentity.SyncItemId, DomainSyncItem.SyncItem>>,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    error: DmsMirrorUnavailable
  ) {
    const attemptCount = S.Natural.make(operation.attemptCount + 1);
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
        DomainSyncItem.SyncItem.make({
          ...item,
          lastError: O.some(error.reason),
          syncState: SyncItemState.Enum.error,
        })
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
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DocumentsIdentity.SyncItemId, DomainSyncItem.SyncItem>>,
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    operation: DomainSyncOperation.SyncOperation
  ) {
    const items = yield* Ref.get(itemsByIdRef);
    const tracked = HashMap.get(items, operation.syncItemId);
    if (O.isNone(tracked)) {
      yield* Effect.logDebug("Documents vault sync skipped an operation without a tracked item").pipe(
        Effect.annotateLogs({
          syncItemId: operation.syncItemId,
          syncOperationId: operation.id,
        })
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
      Effect.flatMap((remote) => recordPushSuccess(itemsByIdRef, pushRecordsRef, leased, item, remote)),
      Effect.catchTags({
        DmsMirrorUnavailable: (error) => recordPushFailure(itemsByIdRef, leased, item, error),
        // A vanished local file must fail the operation, not escape the pump:
        // an escape would strand the row leased and wedge every later pass.
        VaultScanFailed: (error) =>
          recordPushFailure(
            itemsByIdRef,
            leased,
            item,
            DmsMirrorUnavailable.make({
              provider: BOX_PROVIDER,
              reason: error.reason,
              retryable: false,
            })
          ),
      })
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
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const itemsByIdRef = yield* Ref.make(HashMap.fromIterable(A.map(trackedItems, (item) => [item.id, item] as const)));
    const pushRecordsRef = yield* Ref.make<ReadonlyArray<PushRecord>>(A.empty());
    let progressed = true;
    while (progressed) {
      const queue = yield* operationRepository.listQueued(
        ListQueuedSyncOperationsInput.make({
          provider: BOX_PROVIDER,
          workspaceId: input.workspaceId,
        })
      );
      const outcomes = yield* Effect.forEach(queue, (operation) =>
        runOperation(input, itemsByIdRef, pushRecordsRef, operation)
      );
      progressed = A.some(outcomes, identity);
    }
    return yield* Ref.get(pushRecordsRef);
  });

  return { pumpQueue };
});
