/**
 * Legacy SQL read models rebuilt from the event-derived snapshots.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * Consumes SyncItem events into its legacy read table.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncItem } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void LegacySyncItem;
 * ```
 * @category projections
 * @since 0.0.0
 */
export class LegacySyncItem extends Domain.Projection("LegacySyncItem", {
  from: [V.SyncItemSnapshot],
  key: V.SyncItem,
  on: [
    V.ItemTracked,
    V.ItemEdited,
    V.ItemMoved,
    V.ItemKindReplaced,
    V.ItemPushed,
    V.ItemPushFailed,
    V.ItemDriftFlagged,
    V.ItemReturnedToPending,
  ],
}) {}
/**
 * Consumes SyncOperation events into its legacy read table.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncOperation } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void LegacySyncOperation;
 * ```
 * @category projections
 * @since 0.0.0
 */
export class LegacySyncOperation extends Domain.Projection("LegacySyncOperation", {
  from: [V.SyncOperationSnapshot],
  key: V.SyncOperation,
  on: [
    V.OperationQueued,
    V.OperationRetargeted,
    V.OperationSquashed,
    V.OperationLeased,
    V.OperationLeaseExpired,
    V.OperationSucceeded,
    V.OperationRetryScheduled,
    V.OperationFailed,
    V.OperationSuperseded,
    V.OperationRevived,
    V.OperationRequeued,
  ],
}) {}
/**
 * Consumes SyncConflict events into its legacy read table.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncConflict } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void LegacySyncConflict;
 * ```
 * @category projections
 * @since 0.0.0
 */
export class LegacySyncConflict extends Domain.Projection("LegacySyncConflict", {
  from: [V.SyncConflict],
  key: V.SyncConflict,
  on: [V.ConflictRecorded, V.ConflictReviewed],
}) {}
/**
 * Consumes SyncDestination events into its legacy read table.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncCursor } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void LegacySyncCursor;
 * ```
 * @category projections
 * @since 0.0.0
 */
export class LegacySyncCursor extends Domain.Projection("LegacySyncCursor", {
  from: [V.SyncDestinationSnapshot],
  key: V.SyncDestination,
  on: [
    V.DestinationRegistered,
    V.DestinationRenamed,
    V.RootFolderResolved,
    V.DestinationPaused,
    V.DestinationConnected,
    V.CursorAdvanced,
    V.CursorFailed,
    V.ItemPathClaimed,
    V.ItemPathReleased,
  ],
}) {}
