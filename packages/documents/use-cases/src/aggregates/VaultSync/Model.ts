import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as P from "./VaultSync.policy.ts";
/**
 * VaultSyncModel vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { VaultSyncModel } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void VaultSyncModel;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class VaultSyncModel extends Domain.Model("VaultSync", {
  aggregates: [V.SyncDestination, V.DestinationNameReservation, V.SyncItem, V.SyncOperation, V.SyncConflict],
  views: [
    V.SyncDestinationSnapshot,
    V.SyncItemSnapshot,
    V.SyncOperationSnapshot,
    V.VaultSyncStatus,
    V.OpenConflicts,
    V.DestinationList,
    V.OperationQueue,
  ],
  policies: [
    P.DestinationNames,
    P.ItemOperations,
    P.ConflictReviews,
    P.ItemHealing,
    P.OperationDeadlines,
    P.OperationFailures,
    P.DestinationRecovery,
  ],
}) {}
