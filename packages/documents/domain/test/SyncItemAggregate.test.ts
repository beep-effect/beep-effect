import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as H from "effect/HashMap";
import * as O from "effect/Option";

const { decide, evolve } = V.SyncItem.definition;
const destination = V.DestinationId.make("documents_sync_destination_aitemunit");
const otherDestination = V.DestinationId.make("documents_sync_destination_aitemother");
const itemId = V.ItemId.make("documents_sync_item_aunit");
const op1 = V.OperationId.make("documents_sync_operation_aone");
const op2 = V.OperationId.make("documents_sync_operation_atwo");
const op3 = V.OperationId.make("documents_sync_operation_athree");
const remote = V.RemoteItemId.make("box-item-1");
const ctx = {
  id: itemId,
  commandId: "cmd",
  stream: `SyncItem/${itemId}`,
  version: 1,
  now: DateTime.makeUnsafe(1000),
};
const envelope = { id: itemId, stream: ctx.stream, seq: 1, at: ctx.now, commandId: "cmd", correlationId: "cmd" };

const slots = (...entries: ReadonlyArray<readonly [V.OperationType, V.OperationId]>) =>
  H.fromIterable<V.OperationType, V.OperationId>(entries);

const observation = (overrides: Partial<V.ItemObservation> = {}): V.ItemObservation =>
  V.ItemObservation.make({
    destinationId: destination,
    workspaceId: 1,
    path: V.VaultRelPath.make("matters/brief.txt"),
    kind: "file",
    digest: "sha256:a",
    generation: 1,
    operationId: op1,
    type: "uploadFile",
    parentRequired: false,
    ...overrides,
  });

const record = (overrides: Partial<V.ItemRecord> = {}): V.ItemRecord =>
  V.ItemRecord.make({
    observation: observation(),
    remoteId: null,
    status: "pending",
    slots: slots(["uploadFile", op1]),
    ...overrides,
  });

const observe = (s: V.ItemState, o: V.ItemObservation) =>
  decide.ObserveItem(s, V.ObserveItem.make({ observation: o }), ctx);

describe("SyncItem aggregate decide", () => {
  it("tracks the first observation of an empty stream", () => {
    const o = observation();
    expect(observe(null, o)).toEqual([V.ItemTracked.make({ observation: o })]);
  });

  it("refuses an observation from another destination or workspace", () => {
    expect(observe(record(), observation({ destinationId: otherDestination, generation: 2 }))).toMatchObject({
      _tag: "SyncRuleViolation",
      rule: "item-scope",
    });
    expect(observe(record(), observation({ workspaceId: 2, generation: 2 }))).toMatchObject({ rule: "item-scope" });
  });

  it("ignores an observation that is not newer than the current generation", () => {
    expect(observe(record(), observation({ generation: 1, digest: "sha256:b" }))).toEqual([]);
    expect(observe(record({ observation: observation({ generation: 3 }) }), observation({ generation: 2 }))).toEqual(
      []
    );
  });

  it("replaces the item kind unless the new operation already holds a slot", () => {
    const folder = observation({ kind: "folder", generation: 2, operationId: op2, type: "ensureFolder" });
    const current = record();
    expect(observe(current, folder)).toEqual([
      V.ItemKindReplaced.make({ observation: folder, previousSlots: current.slots }),
    ]);
    const reused = observation({ kind: "folder", generation: 2, operationId: op1, type: "ensureFolder" });
    expect(observe(current, reused)).toMatchObject({ rule: "operation-slot-held" });
  });

  it("refuses a same-kind observation whose slot another operation holds", () => {
    expect(observe(record(), observation({ generation: 2, operationId: op2 }))).toMatchObject({
      rule: "operation-slot-held",
    });
  });

  it("records an edit when the path is unchanged and a move when it changes", () => {
    const edit = observation({ generation: 2, digest: "sha256:b", type: "uploadFileVersion", operationId: op2 });
    expect(observe(record(), edit)).toEqual([V.ItemEdited.make({ observation: edit })]);
    const moved = observation({
      generation: 2,
      path: V.VaultRelPath.make("matters/renamed.txt"),
      type: "moveItem",
      operationId: op2,
    });
    expect(observe(record(), moved)).toEqual([V.ItemMoved.make({ observation: moved })]);
    const sameOperation = observation({ generation: 2, digest: "sha256:c" });
    expect(observe(record(), sameOperation)).toEqual([V.ItemEdited.make({ observation: sameOperation })]);
  });

  it("acknowledges a push only for a tracked item at the current generation", () => {
    const command = V.MarkItemPushed.make({ remoteId: remote, generation: 1, operationId: op1 });
    expect(decide.MarkItemPushed(null, command, ctx)).toMatchObject({ rule: "not-tracked" });
    expect(
      decide.MarkItemPushed(record(), V.MarkItemPushed.make({ remoteId: remote, generation: 2, operationId: op1 }), ctx)
    ).toMatchObject({ rule: "stale-generation" });
    expect(decide.MarkItemPushed(record(), command, ctx)).toEqual([
      V.ItemPushed.make({ remoteId: remote, generation: 1, operationId: op1 }),
    ]);
  });

  it("records a push failure only for a tracked item at the current generation", () => {
    const failed = V.MarkItemPushFailed.make({ terminal: false, generation: 1 });
    expect(decide.MarkItemPushFailed(null, failed, ctx)).toMatchObject({ rule: "not-tracked" });
    expect(
      decide.MarkItemPushFailed(record(), V.MarkItemPushFailed.make({ terminal: true, generation: 0 }), ctx)
    ).toEqual([]);
    expect(decide.MarkItemPushFailed(record(), failed, ctx)).toEqual([
      V.ItemPushFailed.make({ terminal: false, generation: 1 }),
    ]);
  });

  it("flags drift only on a tracked item", () => {
    expect(decide.FlagItemDrift(null, V.FlagItemDrift.make({}), ctx)).toMatchObject({ rule: "not-tracked" });
    expect(decide.FlagItemDrift(record(), V.FlagItemDrift.make({}), ctx)).toEqual([V.ItemDriftFlagged.make({})]);
  });

  it("returns an item to pending with the next generation and a derived or explicit operation type", () => {
    expect(decide.ReturnItemToPending(null, V.ReturnItemToPending.make({ operationId: op2 }), ctx)).toMatchObject({
      rule: "not-tracked",
    });
    const repush = (s: V.ItemRecord, command: V.ReturnItemToPending) => decide.ReturnItemToPending(s, command, ctx);
    const current = record({ slots: slots(["uploadFile", op1], ["moveItem", op3]) });
    expect(repush(current, V.ReturnItemToPending.make({ operationId: op2 }))).toEqual([
      V.ItemReturnedToPending.make({
        previousSlots: current.slots,
        observation: observation({ generation: 2, operationId: op2, type: "uploadFile" }),
      }),
    ]);
    expect(repush(record({ remoteId: remote }), V.ReturnItemToPending.make({ operationId: op2 }))).toMatchObject([
      { observation: { type: "uploadFileVersion" } },
    ]);
    const folder = record({ observation: observation({ kind: "folder", type: "ensureFolder" }) });
    expect(repush(folder, V.ReturnItemToPending.make({ operationId: op2 }))).toMatchObject([
      { observation: { type: "ensureFolder" } },
    ]);
    expect(repush(record(), V.ReturnItemToPending.make({ operationId: op2, type: "moveItem" }))).toMatchObject([
      { observation: { type: "moveItem" } },
    ]);
  });
});

describe("SyncItem aggregate evolve", () => {
  it("tracks a new item as pending with only its own slot", () => {
    const o = observation();
    const next = evolve.ItemTracked(null, V.ItemTracked.make({ observation: o }), envelope);
    expect(next).toMatchObject({ observation: o, remoteId: null, status: "pending" });
    expect(next === null ? [] : H.toEntries(next.slots)).toEqual([["uploadFile", op1]]);
  });

  it("keeps the remote id and slots across a same-kind edit or move", () => {
    const current = record({ remoteId: remote, status: "synced", slots: slots(["moveItem", op3]) });
    const edit = observation({ generation: 2, operationId: op2, type: "uploadFileVersion" });
    const edited = evolve.ItemEdited(current, V.ItemEdited.make({ observation: edit }), envelope);
    expect(edited).toMatchObject({ remoteId: remote, status: "pending" });
    expect(edited === null ? 0 : H.size(edited.slots)).toBe(2);
    const move = observation({ generation: 3, operationId: op2, type: "moveItem", path: V.VaultRelPath.make("b.txt") });
    const moved = evolve.ItemMoved(current, V.ItemMoved.make({ observation: move }), envelope);
    assertSome(
      O.flatMap(O.fromNullishOr(moved), (state) => H.get(state.slots, "moveItem")),
      op2
    );
  });

  it("drops the remote id and earlier slots when the kind is replaced", () => {
    const current = record({ remoteId: remote, slots: slots(["uploadFile", op1], ["moveItem", op3]) });
    const folder = observation({ kind: "folder", generation: 2, operationId: op2, type: "ensureFolder" });
    const next = evolve.ItemKindReplaced(
      current,
      V.ItemKindReplaced.make({ observation: folder, previousSlots: current.slots }),
      envelope
    );
    expect(next).toMatchObject({ remoteId: null, status: "pending" });
    expect(next === null ? [] : H.toEntries(next.slots)).toEqual([["ensureFolder", op2]]);
  });

  it("is total for result events that follow an absent state", () => {
    expect(
      evolve.ItemPushed(null, V.ItemPushed.make({ remoteId: remote, generation: 1, operationId: op1 }), envelope)
    ).toBeNull();
    expect(evolve.ItemPushFailed(null, V.ItemPushFailed.make({ terminal: true, generation: 1 }), envelope)).toBeNull();
    expect(evolve.ItemDriftFlagged(null, V.ItemDriftFlagged.make({}), envelope)).toBeNull();
  });

  it("marks a push synced, a terminal failure error, a retryable failure pending and drift drifted", () => {
    const current = record();
    const pushed = evolve.ItemPushed(
      current,
      V.ItemPushed.make({ remoteId: remote, generation: 1, operationId: op1 }),
      envelope
    );
    expect(pushed).toMatchObject({ remoteId: remote, status: "synced" });
    expect(pushed === null ? -1 : H.size(pushed.slots)).toBe(0);
    expect(
      evolve.ItemPushFailed(current, V.ItemPushFailed.make({ terminal: true, generation: 1 }), envelope)
    ).toMatchObject({ status: "error" });
    expect(
      evolve.ItemPushFailed(
        record({ status: "error" }),
        V.ItemPushFailed.make({ terminal: false, generation: 1 }),
        envelope
      )
    ).toMatchObject({ status: "pending" });
    expect(evolve.ItemDriftFlagged(current, V.ItemDriftFlagged.make({}), envelope)).toMatchObject({
      status: "drifted",
    });
  });

  it("returns to pending holding only the re-push slot", () => {
    const current = record({
      remoteId: remote,
      status: "error",
      slots: slots(["uploadFile", op1], ["moveItem", op3]),
    });
    const repush = observation({ generation: 2, operationId: op2, type: "uploadFileVersion" });
    const next = evolve.ItemReturnedToPending(
      current,
      V.ItemReturnedToPending.make({ observation: repush, previousSlots: current.slots }),
      envelope
    );
    expect(next).toMatchObject({ remoteId: remote, status: "pending", observation: repush });
    expect(next === null ? [] : H.toEntries(next.slots)).toEqual([["uploadFileVersion", op2]]);
  });
});
