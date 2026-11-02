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

import {
  DmsMirrorAvailability,
  SyncOnceInput,
  VaultScanFailed,
  VaultSyncEngine,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepository,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import { makeVaultSyncDrift } from "./VaultSync.drift.ts";
import { makeVaultSyncPush } from "./VaultSync.push.ts";
import { makeVaultSyncReconciliation } from "./VaultSync.reconcile.ts";
import { makeVaultSyncReview } from "./VaultSync.review.ts";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncEngine.service");
const BOX_PROVIDER = "box";
const scanFailed = (reason: string): VaultScanFailed => VaultScanFailed.make({ reason });

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
  const operationRepository = yield* SyncOperationRepository;
  const availability = yield* DmsMirrorAvailability;
  const fs = yield* FileSystem.FileSystem;
  const reconciliation = yield* makeVaultSyncReconciliation();
  const push = yield* makeVaultSyncPush();
  const drift = yield* makeVaultSyncDrift();
  const review = yield* makeVaultSyncReview(reconciliation.requeueReviewedConflict);

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

  return VaultSyncEngine.of({
    listOpenConflicts: review.listOpenConflicts,
    markConflictReviewed: Effect.fn($I`markConflictReviewed`)(function* (input) {
      // Reviewing takes the same per-workspace lock a sync pass takes. It reads the
      // open conflicts, marks one reviewed, and returns its item to `pending` — a
      // read-modify-write over exactly the rows a concurrent pass is scanning and
      // leasing. Without the lock, a pass running alongside the review could lease
      // the item between the review and the requeue and strand it right back in
      // `conflict`, so the row the user just resolved came straight back.
      const lock = yield* lockFor(input.workspaceId);
      return yield* lock.withPermit(review.markConflictReviewed(input));
    }),
    status: review.readStatus,
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
          yield* reconciliation.recoverStalledOperations(canonicalInput, probe.connected);
          yield* reconciliation.scanVault(canonicalInput);
          const pushRecords = yield* push.pumpQueue(canonicalInput);
          yield* drift
            .pollRemoteEvents(canonicalInput, pushRecords)
            .pipe(Effect.catchTag("DmsMirrorUnavailable", (error) => drift.recordPollFailure(canonicalInput, error)));
          return yield* review.readStatus(VaultSyncStatusInput.make({ workspaceId: input.workspaceId }));
        })
      );
    }),
  });
});
