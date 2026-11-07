/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
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
 * @category use-cases
 * @since 0.0.0
 */
export class VaultSyncModel extends Domain.Model("VaultSync", {
  aggregates: [
    V.ConflictEventRegistry,
    V.SyncDestination,
    V.DestinationNameReservation,
    V.SyncItem,
    V.SyncOperation,
    V.SyncConflict,
  ],
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
    P.ConflictRegistration,
    P.DestinationNames,
    P.ItemOperations,
    P.ConflictReviews,
    P.ItemHealing,
    P.OperationDeadlines,
    P.OperationFailures,
    P.DestinationRecovery,
  ],
}) {}
