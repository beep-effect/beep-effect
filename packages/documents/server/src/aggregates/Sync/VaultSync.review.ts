/**
 * Read vault synchronization status and apply workspace-scoped conflict reviews.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { DmsMirrorAvailability, VaultSyncStatus } from "@beep/documents-use-cases/aggregates/Sync/server";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepository,
  SyncConflictRepositoryNotFound,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { FindSyncCursorInput, SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import { ListSyncItemsByWorkspaceInput, SyncItemRepository } from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  ListSyncOperationsByStatusInput,
  SyncOperationRepository,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import type {
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  VaultSyncError,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.review");
const BOX_PROVIDER = "box";
const SyncItemState = DomainSyncItem.SyncItemState;

/**
 * Build status queries and conflict-review operations over existing repositories.
 *
 * **Details**
 *
 * The engine must hold its workspace lock while marking a conflict reviewed.
 * Reviews validate workspace ownership and return the affected item to pending;
 * the next sync pass performs the remote convergence. Passive status reads use
 * the cached availability probe, while explicit retries request a refresh.
 *
 * **Example** (Read a status snapshot)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import type { VaultSyncStatusInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { makeVaultSyncReview } from "./VaultSync.review.ts"
 * import { makeVaultSyncReconciliation } from "./VaultSync.reconcile.ts"
 * const readSnapshot = (input: VaultSyncStatusInput) => Effect.gen(function* () {
 *   const reconciliation = yield* makeVaultSyncReconciliation()
 *   const review = yield* makeVaultSyncReview(reconciliation.requeueReviewedConflict)
 *   return yield* review.readStatus(input)
 * })
 * ```
 * @param requeueReviewedConflict - Persist reconciliation intent before the conflict is marked reviewed.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeVaultSyncReview = Effect.fn($I`makeVaultSyncReview`)(function* (
  requeueReviewedConflict: (conflict: DomainSyncConflict.SyncConflict) => Effect.Effect<void, VaultSyncError>
) {
  const itemRepository = yield* SyncItemRepository;
  const operationRepository = yield* SyncOperationRepository;
  const cursorRepository = yield* SyncCursorRepository;
  const conflictRepository = yield* SyncConflictRepository;
  const availability = yield* DmsMirrorAvailability;

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
    // Queue durable correction before closing the review. A failed queue write
    // leaves the conflict visible; retries use the same conflict-scoped key.
    yield* requeueReviewedConflict(reviewedConflict.value);
    return yield* conflictRepository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: input.conflictId }));
  });

  const listOpenConflicts = Effect.fn($I`listOpenConflicts`)(function* (input: ListOpenConflictsInput) {
    return yield* conflictRepository.listOpen(
      ListOpenSyncConflictsInput.make({
        provider: BOX_PROVIDER,
        workspaceId: input.workspaceId,
      })
    );
  });

  return { listOpenConflicts, markConflictReviewed: markConflictReviewedLocked, readStatus };
});
