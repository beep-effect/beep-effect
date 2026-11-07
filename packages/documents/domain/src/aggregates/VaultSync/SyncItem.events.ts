/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncItem.command");
/**
 * ItemObservation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemObservation } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemObservation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemObservation extends S.Opaque<ItemObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    destinationId: V.DestinationId,
    workspaceId: S.Int,
    path: V.VaultRelPath,
    kind: V.SyncItemKind,
    digest: S.NullOr(S.String),
    contentSizeBytes: S.optionalKey(S.Natural),
    generation: S.Int,
    operationId: V.OperationId,
    type: V.OperationType,
    parentRequired: S.Boolean,
  }).pipe($I.annoteSchema("ItemObservation", { description: "ItemObservation persisted vault sync value." }))
) {}

/**
 * Persisted non-empty state of the ItemState aggregate.
 *
 * **Example** (Inspect persisted state fields)
 * ```ts
 * import { ItemRecord } from "@beep/documents-domain/aggregates/VaultSync";
 * console.log(ItemRecord.fields);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemRecord extends S.Opaque<ItemRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    observation: ItemObservation,
    remoteId: S.NullOr(V.RemoteItemId),
    status: V.ItemStatus,
    slots: S.HashMap(V.OperationType, V.OperationId),
  }).pipe($I.annoteSchema("ItemRecord", { description: "Persisted non-empty vault sync state." }))
) {}
/**
 * ItemState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemState } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemState;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const ItemState = S.NullOr(ItemRecord).pipe(
  $I.annoteSchema("ItemState", { description: "ItemState persisted vault sync value." })
);
/**
 * Runtime value accepted by {@link ItemState}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type ItemState = typeof ItemState.Type;
/**
 * ItemTracked vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemTracked } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemTracked;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemTracked extends Domain.Event("ItemTracked", { observation: ItemObservation }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemEdited vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemEdited } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemEdited;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemEdited extends Domain.Event("ItemEdited", { observation: ItemObservation }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemMoved vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemMoved } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemMoved;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemMoved extends Domain.Event("ItemMoved", { observation: ItemObservation }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemKindReplaced vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemKindReplaced } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemKindReplaced;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemKindReplaced extends Domain.Event("ItemKindReplaced", {
  observation: ItemObservation,
  previousSlots: S.HashMap(V.OperationType, V.OperationId),
}) {
  static readonly schemaVersion = 1;
}
/**
 * ItemPushed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemPushed } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemPushed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemPushed extends Domain.Event("ItemPushed", {
  remoteId: V.RemoteItemId,
  remoteName: S.optionalKey(S.String),
  remoteParentId: V.RemoteItemId.pipe(S.NullOr, S.optionalKey),
  generation: S.Int,
  operationId: V.OperationId,
}) {
  static readonly schemaVersion = 1;
}
/**
 * ItemPushFailed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemPushFailed } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemPushFailed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemPushFailed extends Domain.Event("ItemPushFailed", { terminal: S.Boolean, generation: S.Int }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemDriftFlagged vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemDriftFlagged } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemDriftFlagged;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemDriftFlagged extends Domain.Event("ItemDriftFlagged", {}) {
  static readonly schemaVersion = 1;
}
/**
 * ItemReturnedToPending vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemReturnedToPending } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemReturnedToPending;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemReturnedToPending extends Domain.Event("ItemReturnedToPending", {
  observation: ItemObservation,
  previousSlots: S.HashMap(V.OperationType, V.OperationId),
}) {
  static readonly schemaVersion = 1;
}
