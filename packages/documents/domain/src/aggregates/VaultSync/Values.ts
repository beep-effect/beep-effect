import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import { SyncConflictId, SyncItemId, SyncOperationId } from "@beep/shared-domain/identity/Documents";
import * as S from "effect/Schema";

export { RemoteItemId, SyncItemKind, VaultRelPath } from "../../values/Sync/Sync.values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/Values");
/**
 * ItemId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemId } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemId;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ItemId = PublicEntityId.factory(SyncItemId);
/** Runtime value accepted by {@link ItemId}. @category vault-sync @since 0.0.0 */
export type ItemId = typeof ItemId.Type;
/**
 * OperationId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationId } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationId;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OperationId = PublicEntityId.factory(SyncOperationId);
/** Runtime value accepted by {@link OperationId}. @category vault-sync @since 0.0.0 */
export type OperationId = typeof OperationId.Type;
/**
 * ConflictId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictId } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictId;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ConflictId = PublicEntityId.factory(SyncConflictId);
/** Runtime value accepted by {@link ConflictId}. @category vault-sync @since 0.0.0 */
export type ConflictId = typeof ConflictId.Type;
/**
 * DestinationId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationId } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationId;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const DestinationId = S.NonEmptyString.pipe(
  S.brand("SyncDestinationId"),
  $I.annoteSchema("DestinationId", { description: "Stable vault sync destination identity." })
);
/** Runtime value accepted by {@link DestinationId}. @category vault-sync @since 0.0.0 */
export type DestinationId = typeof DestinationId.Type;
/**
 * ReservationKey vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReservationKey } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReservationKey;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ReservationKey = S.NonEmptyString.pipe(
  S.brand("DestinationNameReservationKey"),
  $I.annoteSchema("ReservationKey", { description: "Org-qualified normalized destination name." })
);
/** Runtime value accepted by {@link ReservationKey}. @category vault-sync @since 0.0.0 */
export type ReservationKey = typeof ReservationKey.Type;
/**
 * OrgKey vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OrgKey } from "@beep/documents-domain/aggregates/VaultSync";
 * void OrgKey;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OrgKey = S.NonEmptyString.pipe(
  S.brand("VaultSyncOrgKey"),
  $I.annoteSchema("OrgKey", { description: "Organization view key." })
);
/** Runtime value accepted by {@link OrgKey}. @category vault-sync @since 0.0.0 */
export type OrgKey = typeof OrgKey.Type;
/**
 * OperationType vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationType } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationType;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OperationType = LiteralKit([
  "ensureFolder",
  "uploadFile",
  "uploadFileVersion",
  "moveItem",
  "renameItem",
]).pipe(
  $I.annoteSchema("OperationType", { description: "One-way mirror operations; deletion is deliberately absent." })
);
/** Runtime value accepted by {@link OperationType}. @category vault-sync @since 0.0.0 */
export type OperationType = typeof OperationType.Type;
/**
 * OperationStatus vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationStatus } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationStatus;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OperationStatus = LiteralKit(["queued", "leased", "retrying", "succeeded", "failed", "superseded"]).pipe(
  $I.annoteSchema("OperationStatus", { description: "Distinct terminal failure and supersession." })
);
/** Runtime value accepted by {@link OperationStatus}. @category vault-sync @since 0.0.0 */
export type OperationStatus = typeof OperationStatus.Type;
/**
 * ItemStatus vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemStatus } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemStatus;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ItemStatus = LiteralKit(["pending", "synced", "drifted", "error"]).pipe(
  $I.annoteSchema("ItemStatus", { description: "Local mirror progress." })
);
/** Runtime value accepted by {@link ItemStatus}. @category vault-sync @since 0.0.0 */
export type ItemStatus = typeof ItemStatus.Type;
