import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ItemObservation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemObservation } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemObservation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ItemObservation = S.Struct({
  destinationId: V.DestinationId,
  workspaceId: S.Int,
  path: V.VaultRelPath,
  kind: V.SyncItemKind,
  digest: S.NullOr(S.String),
  generation: S.Int,
  operationId: V.OperationId,
  type: V.OperationType,
  parentRequired: S.Boolean,
});
/** Runtime value accepted by {@link ItemObservation}. @category vault-sync @since 0.0.0 */
export type ItemObservation = typeof ItemObservation.Type;
/**
 * ItemState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemState } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemState;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ItemState = S.NullOr(
  S.Struct({
    observation: ItemObservation,
    remoteId: S.NullOr(V.RemoteItemId),
    status: V.ItemStatus,
    slots: S.HashMap(V.OperationType, V.OperationId),
  })
);
/** Runtime value accepted by {@link ItemState}. @category vault-sync @since 0.0.0 */
export type ItemState = typeof ItemState.Type;
/**
 * ItemTracked vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemTracked } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemTracked;
 * ```
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemPushed extends Domain.Event("ItemPushed", { remoteId: V.RemoteItemId, generation: S.Int }) {
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
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemPushFailed extends Domain.Event("ItemPushFailed", { terminal: S.Boolean }) {
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
 * @category vault-sync
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
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemReturnedToPending extends Domain.Event("ItemReturnedToPending", {}) {
  static readonly schemaVersion = 1;
}
/**
 * ObserveItem vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ObserveItem } from "@beep/documents-domain/aggregates/VaultSync";
 * void ObserveItem;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ObserveItem extends Domain.Command("ObserveItem", {
  target: V.ItemId,
  input: { observation: ItemObservation },
  events: [ItemTracked, ItemEdited, ItemMoved, ItemKindReplaced],
  rejects: [SyncRuleViolation],
}) {}
/**
 * MarkItemPushed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { MarkItemPushed } from "@beep/documents-domain/aggregates/VaultSync";
 * void MarkItemPushed;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class MarkItemPushed extends Domain.Command("MarkItemPushed", {
  target: V.ItemId,
  input: { remoteId: V.RemoteItemId, generation: S.Int },
  events: [ItemPushed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * MarkItemPushFailed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { MarkItemPushFailed } from "@beep/documents-domain/aggregates/VaultSync";
 * void MarkItemPushFailed;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class MarkItemPushFailed extends Domain.Command("MarkItemPushFailed", {
  target: V.ItemId,
  input: { terminal: S.Boolean },
  events: [ItemPushFailed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * FlagItemDrift vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { FlagItemDrift } from "@beep/documents-domain/aggregates/VaultSync";
 * void FlagItemDrift;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class FlagItemDrift extends Domain.Command("FlagItemDrift", {
  target: V.ItemId,
  input: {},
  events: [ItemDriftFlagged],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ReturnItemToPending vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReturnItemToPending } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReturnItemToPending;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ReturnItemToPending extends Domain.Command("ReturnItemToPending", {
  target: V.ItemId,
  input: {},
  events: [ItemReturnedToPending],
  rejects: [SyncRuleViolation],
}) {}
