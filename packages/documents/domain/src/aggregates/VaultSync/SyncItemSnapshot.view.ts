/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { SyncItem } from "./SyncItem.aggregate.ts";
import { ItemState } from "./SyncItem.command.ts";
/**
 * SyncItemSnapshot pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { SyncItemSnapshot } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncItemSnapshot.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncItemSnapshot extends Domain.View("SyncItemSnapshot", {
  from: [SyncItem],
  key: SyncItem,
  state: ItemState,
  initial: SyncItem.definition.initial,
  evolve: {
    ItemGenesisImported: (_s, e) => e.record,
    ItemTracked: (s, e, c) => SyncItem.definition.evolve.ItemTracked(s, e, { ...c.envelope, id: c.source.id }),
    ItemEdited: (s, e, c) => SyncItem.definition.evolve.ItemEdited(s, e, { ...c.envelope, id: c.source.id }),
    ItemMoved: (s, e, c) => SyncItem.definition.evolve.ItemMoved(s, e, { ...c.envelope, id: c.source.id }),
    ItemKindReplaced: (s, e, c) =>
      SyncItem.definition.evolve.ItemKindReplaced(s, e, { ...c.envelope, id: c.source.id }),
    ItemPushed: (s, e, c) => SyncItem.definition.evolve.ItemPushed(s, e, { ...c.envelope, id: c.source.id }),
    ItemPushFailed: (s, e, c) => SyncItem.definition.evolve.ItemPushFailed(s, e, { ...c.envelope, id: c.source.id }),
    ItemDriftFlagged: (s, e, c) =>
      SyncItem.definition.evolve.ItemDriftFlagged(s, e, { ...c.envelope, id: c.source.id }),
    ItemReturnedToPending: (s, e, c) =>
      SyncItem.definition.evolve.ItemReturnedToPending(s, e, { ...c.envelope, id: c.source.id }),
  },
}) {}
