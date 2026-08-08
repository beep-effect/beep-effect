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

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { RemoteItemId, SyncItemKind, VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorUnavailable,
  EnsureFolderInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  SyncOnceInput,
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
  SyncConflictRepositoryNotFound,
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
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, HashMap, identity, Order, Path, pipe, Ref, Result, Semaphore } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { VaultSyncConfig } from "./VaultSync.config.ts";
import type {
  DmsRemoteEvent,
  DmsRemoteItem,
  MarkConflictReviewedInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import type { UnknownRecord } from "@beep/schema";
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

/**
 * Cap for stored drift payload snapshots: an account-wide provider event can
 * carry arbitrarily large payloads, and conflict rows must stay bounded.
 */
const PAYLOAD_SNAPSHOT_LIMIT = 8192;

const truncatedPayload = (payload: UnknownRecord): UnknownRecord => {
  const encoded = JSON.stringify(payload);
  return encoded.length <= PAYLOAD_SNAPSHOT_LIMIT
    ? payload
    : { head: encoded.slice(0, PAYLOAD_SNAPSHOT_LIMIT), truncated: true };
};

const scanFailed = (reason: string): VaultScanFailed => VaultScanFailed.make({ reason });

const isPathWithinRoot = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return !path.isAbsolute(relative) && !Str.startsWith("..")(relative);
};

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

/**
 * Threaded reconciliation state for the vault scan's file pass: the tracked
 * items keyed by local path, plus the still-missing file rows that remain
 * move/rename candidates.
 */
type ScanFileState = {
  readonly itemsByPath: HashMap.HashMap<string, DomainSyncItem.SyncItem>;
  readonly missingFileItems: ReadonlyArray<DomainSyncItem.SyncItem>;
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

/**
 * Fresh push verb that re-converges a `pending` item stranded with no active
 * operation (the crash window between marking an operation `succeeded` and
 * writing the item row). A folder needs `createFolder` only while it has no
 * remote id; a file uploads its first version (`uploadFile`) or a new version
 * (`uploadFileVersion`) once it has one. A folder that already has a remote id
 * is fully pushed, so it yields `none`.
 */
const stalledOperationType = (item: DomainSyncItem.SyncItem): O.Option<DomainSyncOperation.SyncOperationType> =>
  SyncItemKind.$match(item.itemKind, {
    file: () =>
      O.some(O.isNone(item.remoteId) ? SyncOperationType.Enum.uploadFile : SyncOperationType.Enum.uploadFileVersion),
    folder: () =>
      O.isNone(item.remoteId)
        ? O.some(SyncOperationType.Enum.createFolder)
        : O.none<DomainSyncOperation.SyncOperationType>(),
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
 * Echo equivalence class linking push verbs to the provider event types they
 * emit: `content` covers create/upload/version pushes (providers report them
 * as `created` or `edited`); `moved` and `renamed` map one-to-one.
 */
const EchoClass = LiteralKit(["content", "moved", "renamed"]).pipe(
  $I.annoteSchema("EchoClass", {
    description:
      "Echo equivalence class linking push verbs to the provider event types they\nemit: `content` covers create/upload/version pushes (providers report them\nas `created` or `edited`); `moved` and `renamed` map one-to-one.",
  })
);
type EchoClass = typeof EchoClass.Type;

const echoClassForOperation = (operationType: DomainSyncOperation.SyncOperationType): EchoClass =>
  SyncOperationType.$match(operationType, {
    createFolder: EchoClass.thunk.content,
    moveItem: EchoClass.thunk.moved,
    renameItem: EchoClass.thunk.renamed,
    uploadFile: EchoClass.thunk.content,
    uploadFileVersion: EchoClass.thunk.content,
  });

const echoClassForEvent = (eventType: DmsEventType): O.Option<EchoClass> =>
  DmsEventType.$match(eventType, {
    created: () => O.some<EchoClass>(EchoClass.Enum.content),
    deleted: O.none<EchoClass>,
    edited: () => O.some<EchoClass>(EchoClass.Enum.content),
    moved: () => O.some<EchoClass>(EchoClass.Enum.moved),
    renamed: () => O.some<EchoClass>(EchoClass.Enum.renamed),
    unknown: O.none<EchoClass>,
  });

/**
 * One successful push recorded during the current pass; polled events consume
 * these to suppress the provider echoing our own verbs.
 */
class ContentPushRecord extends S.Class<ContentPushRecord>($I`ContentPushRecord`)(
  {
    echoClass: S.tag("content"),
    remoteId: RemoteItemId,
  },
  $I.annote("ContentPushRecord", {
    description: "A successful content push awaiting its provider echo.",
  })
) {}

class MovedPushRecord extends S.Class<MovedPushRecord>($I`MovedPushRecord`)(
  {
    echoClass: S.tag("moved"),
    remoteId: RemoteItemId,
  },
  $I.annote("MovedPushRecord", {
    description: "A successful move awaiting its provider echo.",
  })
) {}

class RenamedPushRecord extends S.Class<RenamedPushRecord>($I`RenamedPushRecord`)(
  {
    echoClass: S.tag("renamed"),
    remoteId: RemoteItemId,
  },
  $I.annote("RenamedPushRecord", {
    description: "A successful rename awaiting its provider echo.",
  })
) {}

const PushRecord = S.Union([ContentPushRecord, MovedPushRecord, RenamedPushRecord]).pipe(
  S.toTaggedUnion("echoClass"),
  $I.annoteSchema("PushRecord", {
    description:
      "One successful push recorded during the current pass; polled events consume these to suppress the provider echoing our own verbs",
  })
);
type PushRecord = typeof PushRecord.Type;

const makePushRecord = (echoClass: EchoClass, remoteId: RemoteItemId): PushRecord =>
  EchoClass.$match(echoClass, {
    content: () => ContentPushRecord.make({ remoteId }),
    moved: () => MovedPushRecord.make({ remoteId }),
    renamed: () => RenamedPushRecord.make({ remoteId }),
  });

const strictFieldMatches = <Value>(field: O.Option<Value>, current: O.Option<Value>): boolean =>
  O.match(field, {
    onNone: () => O.isNone(current),
    onSome: (value) => O.exists(current, (candidate) => candidate === value),
  });

/**
 * Crash-window echo fallback for events with no same-pass push record: a
 * `created`/`moved`/`renamed` event whose observed `(name, parent)` exactly
 * equals the item's recorded pushed state describes no drift. Missing event
 * fields count as a mismatch (conservative: surface a conflict rather than
 * swallow drift), and `edited` events never match — a content change is
 * invisible in `(name, parent)`, so an unexplained edit is always drift.
 */
const matchesPushedState = (
  event: DmsRemoteEvent,
  item: DomainSyncItem.SyncItem,
  rootRemoteId: O.Option<RemoteItemId>
): boolean => {
  if (DmsEventType.is.edited(event.eventType) || O.isNone(echoClassForEvent(event.eventType))) {
    return false;
  }
  const normalizedParent = O.filter(
    event.parentRemoteId,
    (parent) => !O.exists(rootRemoteId, (root) => root === parent)
  );
  return strictFieldMatches(event.name, item.remoteName) && strictFieldMatches(normalizedParent, item.remoteParentId);
};

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

  const readRegularFileWithinRoot = Effect.fn($I`readRegularFileWithinRoot`)(function* (
    canonicalRoot: string,
    candidatePath: string,
    displayPath: string
  ) {
    const initialLink = yield* Effect.result(fs.readLink(candidatePath));
    if (Result.isSuccess(initialLink)) {
      return yield* scanFailed(`vault sync refused symbolic link ${displayPath}`);
    }

    return yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* fs
          .open(candidatePath, { flag: "r" })
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not open local file ${displayPath}`)));
        const info = yield* file.stat.pipe(
          Effect.mapError(() => scanFailed(`vault sync could not inspect open local file ${displayPath}`))
        );
        if (info.type !== "File") {
          return yield* scanFailed(`vault sync refused non-regular file ${displayPath}`);
        }

        // `File` no longer exposes a descriptor, so the opened path cannot be read back
        // from `/proc/self/fd`. Binding the canonical path to the open descriptor by
        // device + inode is the portable equivalent and keeps the same TOCTOU guarantee.
        const openedPath = yield* fs
          .realPath(candidatePath)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not resolve open local file ${displayPath}`)));
        const candidateInfo = yield* fs
          .stat(openedPath)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not inspect local file ${displayPath}`)));
        const inodeMatches = O.getOrElse(O.zipWith(info.ino, candidateInfo.ino, Eq.equals), F.constFalse);
        if (!Eq.equals(info.dev, candidateInfo.dev) || !inodeMatches || candidateInfo.type !== "File") {
          return yield* scanFailed(`vault sync refused changed local file ${displayPath}`);
        }
        if (!isPathWithinRoot(path, canonicalRoot, openedPath)) {
          return yield* scanFailed(`vault sync refused file outside the configured vault ${displayPath}`);
        }

        const finalLink = yield* Effect.result(fs.readLink(candidatePath));
        if (Result.isSuccess(finalLink)) {
          return yield* scanFailed(`vault sync refused symbolic link ${displayPath}`);
        }

        const bytes = yield* file
          .readAlloc(info.size)
          .pipe(Effect.mapError(() => scanFailed(`vault sync could not read local file ${displayPath}`)));
        return O.getOrElse(bytes, () => new Uint8Array());
      })
    );
  });

  const walkDirectory = (
    canonicalRoot: string,
    absolutePath: string,
    relSegments: ReadonlyArray<string>
  ): Effect.Effect<VaultScanObservation, VaultScanFailed> =>
    Effect.gen(function* () {
      const names = yield* fs
        .readDirectory(absolutePath)
        .pipe(Effect.mapError(() => scanFailed(`vault scan could not read directory ${absolutePath}`)));
      const visible = pipe(names, A.filter(P.not(Str.startsWith("."))), A.sort(Order.String));
      const observations = yield* Effect.forEach(
        visible,
        Effect.fnUntraced(function* (name) {
          const childAbsolutePath = path.join(absolutePath, name);
          const childSegments = A.append(relSegments, name);
          // Symlinks are never followed: a link out of the vault must not leak
          // into the mirror, and a dangling link must not abort the scan.
          // `readLink` succeeds exactly when the entry is a symlink.
          const symlinkTarget = yield* Effect.result(fs.readLink(childAbsolutePath));
          if (Result.isSuccess(symlinkTarget)) {
            yield* Effect.logDebug("Documents vault scan skipped a symlink").pipe(
              Effect.annotateLogs({ path: childAbsolutePath })
            );
            return emptyObservation;
          }
          const canonicalChildPath = yield* fs
            .realPath(childAbsolutePath)
            .pipe(Effect.mapError(() => scanFailed(`vault scan could not resolve ${childAbsolutePath}`)));
          if (!isPathWithinRoot(path, canonicalRoot, canonicalChildPath)) {
            return yield* scanFailed(`vault scan refused path outside the configured vault ${childAbsolutePath}`);
          }
          const info = yield* fs
            .stat(canonicalChildPath)
            .pipe(Effect.mapError(() => scanFailed(`vault scan could not stat ${childAbsolutePath}`)));
          if (info.type === "Directory") {
            const nested = yield* walkDirectory(canonicalRoot, canonicalChildPath, childSegments);
            const folder: ObservedFolder = { relPath: VaultRelPath.make(A.join(childSegments, "/")) };
            return mergeObservations([{ files: [], folders: [folder] }, nested]);
          }
          if (info.type === "File") {
            const bytes = yield* readRegularFileWithinRoot(
              canonicalRoot,
              childAbsolutePath,
              A.join(childSegments, "/")
            );
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
          localGeneration: NonNegativeInt.make(trackedAtPath.value.localGeneration + 1),
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
          localGeneration: NonNegativeInt.make(tracked.value.localGeneration + 1),
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
          localGeneration: NonNegativeInt.make(item.localGeneration + 1),
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
          localGeneration: NonNegativeInt.make(source.localGeneration + 1),
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
    const observation = yield* walkDirectory(input.vaultRootPath, input.vaultRootPath, A.empty<string>());
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

  const readVaultFileBytes = Effect.fn($I`readVaultFileBytes`)(function* (
    vaultRootPath: string,
    relPath: VaultRelPath
  ) {
    const absolutePath = path.join(vaultRootPath, ...relPathSegments(relPath));
    return yield* readRegularFileWithinRoot(vaultRootPath, absolutePath, relPath);
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
        readVaultFileBytes(input.vaultRootPath, operation.targetRelPath).pipe(
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
          readVaultFileBytes(input.vaultRootPath, operation.targetRelPath).pipe(
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
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>>,
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    operation: DomainSyncOperation.SyncOperation,
    item: DomainSyncItem.SyncItem,
    remote: DmsRemoteItem
  ) {
    yield* operationRepository.update(
      DomainSyncOperation.SyncOperation.make({
        ...operation,
        lastError: O.none(),
        status: "succeeded",
      })
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
    yield* Ref.update(pushRecordsRef, (records) =>
      A.append(records, makePushRecord(echoClassForOperation(operation.operationType), remote.remoteId))
    );
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
    itemsByIdRef: Ref.Ref<HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>>,
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
      remotePayload: truncatedPayload(event.payload),
      resolutionStatus: "open",
      syncItemId: O.map(item, (tracked) => tracked.id),
      workspaceId,
    });

  /**
   * Consume one same-pass push record explaining this event as our own echo.
   * Returns `true` (and burns the record) when a record with the event's
   * remote id and echo class is outstanding.
   */
  const consumePushEcho = (
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    remoteId: RemoteItemId,
    eventClass: EchoClass
  ): Effect.Effect<boolean> =>
    Ref.modify(pushRecordsRef, (records) =>
      pipe(
        A.findFirstIndex(records, (record) => record.remoteId === remoteId && record.echoClass === eventClass),
        O.match({
          onNone: () => [false, records] as const,
          onSome: (index) => [true, A.remove(records, index)] as const,
        })
      )
    );

  /**
   * Classify one polled remote event against the drift rules:
   *
   * - no remote id → unattributable account noise, ignored (v1 posture);
   * - unknown remote id → conflict only when the event's parent is the mirror
   *   root or a tracked folder (activity outside the mirror is invisible);
   * - tracked item → same-pass push records (then the crash-window pushed-state
   *   fallback) suppress our own echoes; anything else records drift and marks
   *   the item conflicted.
   */
  const classifyRemoteEvent = Effect.fn($I`classifyRemoteEvent`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    pushRecordsRef: Ref.Ref<ReadonlyArray<PushRecord>>,
    trackedFolderRemoteIds: HashMap.HashMap<RemoteItemId, boolean>,
    rootRemoteId: O.Option<RemoteItemId>,
    event: DmsRemoteEvent
  ) {
    if (O.isNone(event.remoteId)) {
      yield* Effect.logDebug("Documents vault sync ignored an unattributable remote event").pipe(
        Effect.annotateLogs({ eventId: event.eventId })
      );
      return;
    }
    const tracked = yield* itemRepository.findByRemoteId(
      FindSyncItemByRemoteIdInput.make({
        provider: BOX_PROVIDER,
        remoteId: event.remoteId.value,
        workspaceId,
      })
    );
    if (O.isNone(tracked)) {
      const underMirror = O.exists(
        event.parentRemoteId,
        (parent) =>
          O.exists(rootRemoteId, (root) => root === parent) || O.isSome(HashMap.get(trackedFolderRemoteIds, parent))
      );
      if (!underMirror) {
        yield* Effect.logDebug("Documents vault sync ignored a remote event outside the mirror").pipe(
          Effect.annotateLogs({
            eventId: event.eventId,
            remoteId: event.remoteId.value,
          })
        );
        return;
      }
      yield* conflictRepository.record(
        conflictSeedFor(workspaceId, event, unknownItemConflictKind(event.eventType), O.none())
      );
      return;
    }
    const item = tracked.value;
    const eventClass = echoClassForEvent(event.eventType);
    if (O.isSome(eventClass)) {
      const consumed = yield* consumePushEcho(pushRecordsRef, event.remoteId.value, eventClass.value);
      if (consumed || matchesPushedState(event, item, rootRemoteId)) {
        yield* Effect.logDebug("Documents vault sync ignored a push echo event").pipe(
          Effect.annotateLogs({
            eventId: event.eventId,
            remoteId: event.remoteId.value,
          })
        );
        return;
      }
    }
    yield* conflictRepository.record(
      conflictSeedFor(workspaceId, event, knownItemConflictKind(event.eventType), tracked)
    );
    yield* itemRepository.update(
      DomainSyncItem.SyncItem.make({
        ...item,
        syncState: SyncItemState.Enum.conflict,
      })
    );
  });

  /**
   * Poll remote drift. A `none` cursor bootstraps via `pollEvents(none)`,
   * which returns the provider's current position with (per port contract)
   * empty entries; any returned entries are classified with the same rules.
   * The page loop is bounded by `eventPageLimit` per sync pass.
   */
  const pollRemoteEvents = Effect.fn($I`pollRemoteEvents`)(function* (
    input: SyncOnceInput,
    pushRecords: ReadonlyArray<PushRecord>
  ) {
    const probe = yield* availability.probe;
    const trackedItems = yield* itemRepository.listByWorkspace(
      ListSyncItemsByWorkspaceInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    const trackedFolderRemoteIds = HashMap.fromIterable<RemoteItemId, boolean>(
      pipe(
        trackedItems,
        A.filter((item) => SyncItemKind.is.folder(item.itemKind)),
        A.flatMap((item) =>
          O.match(item.remoteId, {
            onNone: A.empty<readonly [RemoteItemId, boolean]>,
            onSome: (remoteId) => [[remoteId, true] as const],
          })
        )
      )
    );
    const pushRecordsRef = yield* Ref.make(pushRecords);
    const cursor = yield* cursorRepository.find(
      FindSyncCursorInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
    let streamPosition = O.map(cursor, (current) => current.streamPosition);
    let lastEventId = O.flatMap(cursor, (current) => current.lastEventId);
    for (let page = 0; page < config.eventPageLimit; page += 1) {
      const events = yield* mirror.pollEvents(PollEventsInput.make({ streamPosition }));
      yield* Effect.forEach(events.entries, (event) =>
        classifyRemoteEvent(input.workspaceId, pushRecordsRef, trackedFolderRemoteIds, probe.rootRemoteId, event)
      );
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
      const drained = A.match(events.entries, {
        onEmpty: F.constTrue,
        onNonEmpty: F.constFalse,
      });
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
      FindSyncCursorInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
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
    itemsById: HashMap.HashMap<DomainSyncItem.SyncItemId, DomainSyncItem.SyncItem>
  ) {
    const failed = yield* operationRepository.listByStatus(
      ListSyncOperationsByStatusInput.make({
        provider: BOX_PROVIDER,
        status: "failed",
        workspaceId: input.workspaceId,
      })
    );
    for (const operation of failed) {
      const tracked = HashMap.get(itemsById, operation.syncItemId);
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
        yield* itemRepository.update(
          DomainSyncItem.SyncItem.make({
            ...item,
            lastError: O.none(),
            syncState: SyncItemState.Enum.pending,
          })
        );
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
  const healOrphanedPendingItems = Effect.fn($I`healOrphanedPendingItems`)(function* (
    trackedItems: ReadonlyArray<DomainSyncItem.SyncItem>
  ) {
    for (const item of trackedItems) {
      if (!SyncItemState.is.pending(item.syncState)) {
        continue;
      }
      const healType = stalledOperationType(item);
      if (O.isNone(healType)) {
        continue;
      }
      const queued = yield* queuedOperationsFor(item);
      if (A.isReadonlyArrayNonEmpty(queued)) {
        continue;
      }
      yield* enqueueOrSquash(
        item,
        healType.value,
        SyncOperationType.is.createFolder(healType.value) ? O.none() : item.contentDigest
      );
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

  const requeueReviewedConflictItem = Effect.fn($I`requeueReviewedConflictItem`)(function* (
    workspaceId: WorkspaceIdentity.WorkspaceId,
    syncItemId: DomainSyncItem.SyncItemId
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
          const pushRecords = yield* pumpQueue(canonicalInput);
          yield* pollRemoteEvents(canonicalInput, pushRecords).pipe(
            Effect.catchTag("DmsMirrorUnavailable", (error) => recordPollFailure(canonicalInput, error))
          );
          return yield* readStatus(VaultSyncStatusInput.make({ workspaceId: input.workspaceId }));
        })
      );
    }),
  });
});
