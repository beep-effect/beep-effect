import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Struct from "effect/Struct";
import * as C from "./SyncItem.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";

const refused = (rule: string) => SyncRuleViolation.make({ rule, evidence: "item state" });
const observed = (s: C.ItemState, e: { readonly observation: C.ItemObservation }): C.ItemState => ({
  observation: e.observation,
  remoteId: s?.observation.kind === e.observation.kind ? s.remoteId : null,
  status: "pending",
  slots: H.set(
    s?.observation.kind === e.observation.kind ? s.slots : H.empty(),
    e.observation.type,
    e.observation.operationId
  ),
});
/**
 * SyncItem vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SyncItem } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncItem;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class SyncItem extends Domain.Aggregate("SyncItem", {
  id: V.ItemId,
  state: C.ItemState,
  initial: null,
  commands: [C.ObserveItem, C.MarkItemPushed, C.MarkItemPushFailed, C.FlagItemDrift, C.ReturnItemToPending],
  decide: {
    ObserveItem: (s, c) => {
      const o = c.observation;
      if (s === null) return [C.ItemTracked.make(Struct.omit(c, ["_tag"]))];
      if (s.observation.destinationId !== o.destinationId || s.observation.workspaceId !== o.workspaceId)
        return refused("item-scope");
      if (o.generation <= s.observation.generation) return [];
      if (s.observation.kind !== o.kind)
        return [C.ItemKindReplaced.make({ observation: c.observation, previousSlots: s.slots })];
      const slot = H.get(s.slots, o.type);
      if (O.isSome(slot) && slot.value !== o.operationId) return refused("operation-slot-held");
      return s.observation.path !== o.path
        ? [C.ItemMoved.make(Struct.omit(c, ["_tag"]))]
        : [C.ItemEdited.make(Struct.omit(c, ["_tag"]))];
    },
    MarkItemPushed: (s, c) =>
      s === null
        ? refused("not-tracked")
        : c.generation !== s.observation.generation
          ? refused("stale-generation")
          : [C.ItemPushed.make(Struct.omit(c, ["_tag"]))],
    MarkItemPushFailed: (s, c) =>
      s === null ? refused("not-tracked") : [C.ItemPushFailed.make(Struct.omit(c, ["_tag"]))],
    FlagItemDrift: (s) => (s === null ? refused("not-tracked") : [C.ItemDriftFlagged.make({})]),
    ReturnItemToPending: (s) => (s === null ? refused("not-tracked") : [C.ItemReturnedToPending.make({})]),
  },
  evolve: {
    ItemTracked: observed,
    ItemEdited: observed,
    ItemMoved: observed,
    ItemKindReplaced: observed,
    ItemPushed: (s, e): C.ItemState => (s === null ? s : { ...s, remoteId: e.remoteId, status: "synced" }),
    ItemPushFailed: (s, e): C.ItemState => (s === null ? s : { ...s, status: e.terminal ? "error" : "pending" }),
    ItemDriftFlagged: (s): C.ItemState => (s === null ? s : { ...s, status: "drifted" }),
    ItemReturnedToPending: (s): C.ItemState => (s === null ? s : { ...s, status: "pending" }),
  },
}) {}
