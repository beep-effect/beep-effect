/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Struct from "effect/Struct";
import * as C from "./SyncItem.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
import type { SyncRule } from "./SyncRuleViolation.rejection.ts";

const repushType = (s: C.ItemRecord): V.OperationType => {
  if (s.observation.kind === "folder") return "ensureFolder";
  return s.remoteId === null ? "uploadFile" : "uploadFileVersion";
};
const refused = (rule: SyncRule) => SyncRuleViolation.make({ rule, evidence: "item state" });
const observed = (s: C.ItemState, e: { readonly observation: C.ItemObservation }): C.ItemRecord =>
  C.ItemRecord.make({
    observation: e.observation,
    remoteId: s?.observation.kind === e.observation.kind ? s.remoteId : null,
    status: "pending",
    slots: H.set(
      s?.observation.kind === e.observation.kind ? s.slots : H.empty(),
      e.observation.type,
      e.observation.operationId
    ),
  });
const sameItemScope = (s: C.ItemRecord, o: C.ItemObservation): boolean =>
  s.observation.destinationId === o.destinationId && s.observation.workspaceId === o.workspaceId;
const slotHeldByOther = (s: C.ItemRecord, o: C.ItemObservation): boolean =>
  O.exists(H.get(s.slots, o.type), (id) => id !== o.operationId);
const replaceItemKind = (s: C.ItemRecord, o: C.ItemObservation) =>
  H.some(s.slots, (id) => id === o.operationId)
    ? refused("operation-slot-held")
    : [C.ItemKindReplaced.make({ observation: o, previousSlots: s.slots })];
/**
 * SyncItem vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.SyncItem.ref(V.ItemId.make("documents_sync_item_a1"));
 * console.log(ref.id);
 * ```
 * @category aggregates
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
      if (!sameItemScope(s, o)) return refused("item-scope");
      if (o.generation <= s.observation.generation) return [];
      if (s.observation.kind !== o.kind) return replaceItemKind(s, o);
      if (slotHeldByOther(s, o)) return refused("operation-slot-held");
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
      s === null
        ? refused("not-tracked")
        : c.generation !== s.observation.generation
          ? []
          : [C.ItemPushFailed.make(Struct.omit(c, ["_tag"]))],
    FlagItemDrift: (s) => (s === null ? refused("not-tracked") : [C.ItemDriftFlagged.make({})]),
    ReturnItemToPending: (s, c) =>
      s === null
        ? refused("not-tracked")
        : [
            C.ItemReturnedToPending.make({
              previousSlots: s.slots,
              observation: {
                ...s.observation,
                operationId: c.operationId,
                generation: s.observation.generation + 1,
                type: c.type ?? repushType(s),
              },
            }),
          ],
  },
  evolve: {
    ItemTracked: observed,
    ItemEdited: observed,
    ItemMoved: observed,
    ItemKindReplaced: observed,
    ItemPushed: (s, e): C.ItemState =>
      s === null
        ? s
        : { ...s, remoteId: e.remoteId, status: "synced", slots: H.filter(s.slots, (id) => id !== e.operationId) },
    ItemPushFailed: (s, e): C.ItemState => (s === null ? s : { ...s, status: e.terminal ? "error" : "pending" }),
    ItemDriftFlagged: (s): C.ItemState => (s === null ? s : { ...s, status: "drifted" }),
    ItemReturnedToPending: (s, e): C.ItemState => {
      const next = observed(s, e);
      return { ...next, slots: H.make([e.observation.type, e.observation.operationId]) };
    },
  },
}) {}
