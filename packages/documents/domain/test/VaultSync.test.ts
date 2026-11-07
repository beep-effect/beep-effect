import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeEvidence = S.decodeEffect(V.RemoteEvidence);
const encodeQueued = S.encodeEffect(V.OperationQueued);
const destination = V.DestinationId.make("vault-unit");
const id = V.OperationId.make("documents_sync_operation_a1");
const itemId = V.ItemId.make("documents_sync_item_a1");
const input = V.OperationInput.make({
  destinationId: destination,
  itemId,
  type: "uploadFile",
  path: V.VaultRelPath.make("file.txt"),
  digest: "sha256:a",
  generation: 1,
  parentRequired: false,
  idempotencyKey: id,
});
const ctx = { id, commandId: "cmd", stream: `SyncOperation/${id}`, version: 1, now: DateTime.makeUnsafe(1000) };
const envelope = { id, stream: ctx.stream, seq: 1, at: ctx.now, commandId: "cmd", correlationId: "cmd" };
const queued = V.SyncOperation.definition.evolve.OperationQueued(null, V.OperationQueued.make({ input }), envelope);
const leased = V.SyncOperation.definition.evolve.OperationLeased(
  queued,
  V.OperationLeased.make({ holder: "worker", expiresAt: 2000, attempt: 1 }),
  envelope
);

describe("vault sync pure transitions", () => {
  it("queued events evolve to a stable input and zero attempts", () => {
    expect(queued).toMatchObject({ input, attempts: 0, leaseEpoch: 0, status: "queued" });
  });
  it("squash records a fact without rewriting the genesis key", () => {
    const command = V.SquashOperation.make({ input: { ...input, generation: 2 } });
    const events = V.SyncOperation.definition.decide.SquashOperation(queued, command, ctx);
    expect(events).toEqual([V.OperationSquashed.make({ input: command.input })]);
  });
  it("cannot retarget a leased or foreign operation", () => {
    const events = V.SyncOperation.definition.decide.QueueOperation(leased, V.QueueOperation.make({ input }), ctx);
    expect(events).toMatchObject({ _tag: "SyncRuleViolation", rule: "not-retargetable" });
  });
  it("expiry before the deadline and a stale retry timer are no-ops", () => {
    expect(V.SyncOperation.definition.decide.ExpireLease(leased, V.ExpireLease.make({ attempt: 1 }), ctx)).toEqual([]);
    expect(
      V.SyncOperation.definition.decide.RetryOperation(leased, V.RetryOperation.make({ attempt: 1 }), ctx)
    ).toEqual([]);
  });
  it("a retry budget reset preserves the monotonically increasing lease token", () => {
    const failed = V.SyncOperation.definition.evolve.OperationFailed(
      leased,
      V.OperationFailed.make({ reason: "vendor" }),
      envelope
    );
    const revived = V.SyncOperation.definition.evolve.OperationRevived(failed, V.OperationRevived.make({}), envelope);
    expect(revived).toMatchObject({ status: "queued", attempts: 0, leaseEpoch: 1 });
    const events = V.SyncOperation.definition.decide.LeaseOperation(
      revived,
      V.LeaseOperation.make({ holder: "next", leaseMillis: 5000, parentRemoteId: null, itemRemoteId: null }),
      ctx
    );
    expect(events).toEqual([V.OperationLeased.make({ holder: "next", expiresAt: 6000, attempt: 2 })]);
  });
  it("a completed deadline cannot be bypassed by a delayed expiry worker", () => {
    const events = V.SyncOperation.definition.decide.CompleteOperation(
      leased,
      V.CompleteOperation.make({ holder: "worker", attempt: 1 }),
      { ...ctx, now: DateTime.makeUnsafe(2000) }
    );
    expect(events).toMatchObject({ rule: "stale-lease" });
  });
  it("squash ignores stale input and a new stream cannot reuse another idempotency key", () => {
    const current = queued === null ? queued : { ...queued, input: { ...input, generation: 2 } };
    expect(V.SyncOperation.definition.decide.SquashOperation(current, V.SquashOperation.make({ input }), ctx)).toEqual(
      []
    );
    expect(
      V.SyncOperation.definition.decide.QueueOperation(null, V.QueueOperation.make({ input }), {
        ...ctx,
        id: V.OperationId.make("documents_sync_operation_a2"),
      })
    ).toMatchObject({ rule: "operation-key" });
  });
  it("evolve is total for events following an absent state", () => {
    expect(
      V.SyncOperation.definition.evolve.OperationSucceeded(null, V.OperationSucceeded.make({ attempt: 1 }), envelope)
    ).toBe(null);
  });
  it("name reservations reject an unqualified or unnormalized key", () => {
    const result = V.DestinationNameReservation.definition.decide.ClaimDestinationName(
      null,
      V.ClaimDestinationName.make({
        claim: { destinationId: destination, orgId: 1, workspaceId: 1, name: " Vault ", previousName: null },
      }),
      { ...ctx, id: V.ReservationKey.make("vault") }
    );
    expect(result).toMatchObject({ rule: "wrong-key" });
  });
  it("push acknowledgements preserve other operation slots and ignore stale failures", () => {
    const observation = V.ItemObservation.make({
      destinationId: destination,
      workspaceId: 1,
      path: input.path,
      kind: "file",
      digest: "sha:b",
      generation: 2,
      operationId: id,
      type: "uploadFile",
      parentRequired: false,
    });
    const move = V.OperationId.make("documents_sync_operation_amove");
    const state = V.ItemRecord.make({
      observation,
      remoteId: null,
      status: "pending",
      slots: H.fromIterable<V.OperationType, V.OperationId>([
        ["uploadFile", id],
        ["moveItem", move],
      ]),
    });
    const event = V.ItemPushed.make({ remoteId: V.RemoteItemId.make("box1"), generation: 2, operationId: id });
    const next = V.SyncItem.definition.evolve.ItemPushed(state, event, { ...envelope, id: itemId });
    expect(next !== null && H.size(next.slots)).toBe(1);
    expect(
      V.SyncItem.definition.decide.MarkItemPushFailed(
        state,
        V.MarkItemPushFailed.make({ terminal: true, generation: 1 }),
        { ...ctx, id: itemId }
      )
    ).toEqual([]);
  });
  it("path release is scoped to its current owner", () => {
    const state: V.DestinationState = {
      _tag: "Registered",
      orgId: 1,
      workspaceId: 1,
      name: "vault",
      provider: "box",
      rootId: null,
      cursor: null,
      cursorError: null,
      paused: false,
      paths: H.make([input.path, itemId]),
    };
    const events = V.SyncDestination.definition.decide.ReleaseItemPath(
      state,
      V.ReleaseItemPath.make({ path: input.path, itemId: V.ItemId.make("documents_sync_item_a2") }),
      { ...ctx, id: destination }
    );
    expect(events).toEqual([]);
  });
  it("name reservations reject another destination and ignore a repeated claim", () => {
    const key = { ...ctx, id: V.ReservationKey.make("1:vault") };
    const claim = V.NameClaim.make({
      destinationId: destination,
      orgId: 1,
      workspaceId: 1,
      name: "vault",
      previousName: null,
    });
    const claimFor = (name: string, destinationId: V.DestinationId) =>
      V.ClaimDestinationName.make({ claim: { ...claim, name, destinationId } });
    const decide = V.DestinationNameReservation.definition.decide.ClaimDestinationName;
    expect(decide(claim, claimFor("vault", V.DestinationId.make("vault-other")), key)).toMatchObject({
      rule: "name-held",
    });
    expect(decide(claim, claimFor("vault", destination), key)).toEqual([]);
    expect(decide(claim, claimFor("Vault", destination), key)).toMatchObject([{ _tag: "DestinationNameClaimed" }]);
  });
  it("rename checks registration, scope, and the previous name in order", () => {
    const registered: V.DestinationState = {
      _tag: "Registered",
      orgId: 1,
      workspaceId: 1,
      name: "vault",
      provider: "box",
      rootId: null,
      cursor: null,
      cursorError: null,
      paused: false,
      paths: H.empty(),
    };
    const rename = (orgId: number, name: string, previousName: string) =>
      V.RenameDestination.make({ orgId, workspaceId: 1, name, previousName });
    const decide = (state: V.DestinationState, command: V.RenameDestination) =>
      V.SyncDestination.definition.decide.RenameDestination(state, command, { ...ctx, id: destination });
    expect(decide({ _tag: "Unregistered" }, rename(1, "renamed", "vault"))).toMatchObject({ rule: "not-registered" });
    expect(decide(registered, rename(2, "renamed", "vault"))).toMatchObject({ rule: "destination-scope" });
    expect(decide(registered, rename(1, "vault", "stale"))).toEqual([]);
    expect(decide(registered, rename(1, "renamed", "stale"))).toMatchObject({ rule: "stale-name" });
    expect(decide(registered, rename(1, "renamed", "vault"))).toMatchObject([{ _tag: "DestinationRenamed" }]);
  });
  it.effect("remote evidence is capped by UTF-8 bytes, not character count (I20)", () =>
    Effect.gen(function* () {
      const accepted = yield* decodeEvidence(Str.repeat(8192)("a"));
      expect(accepted.length).toBe(8192);
      const rejected = yield* decodeEvidence(Str.repeat(2049)("😀")).pipe(Effect.flip);
      expect(rejected._tag).toBe("SchemaError");
    })
  );
  it("public ids and one-way operation types retain the legacy contract (I3,I11)", () => {
    expect(S.is(V.OperationId)("documents_sync_operation_a17")).toBe(true);
    expect(S.is(V.OperationType)("deleteItem")).toBe(false);
    expect(S.is(V.OperationInput)({ ...input, content: new Uint8Array([1]) })).toBe(true);
    // Extra input is stripped at the codec: upload bytes are never encoded into events.
  });
  it.effect("event encoding contains only declared input fields and carries version one", () =>
    Effect.gen(function* () {
      const withBytes = { ...input, content: new Uint8Array([1, 2]) };
      const event = V.OperationQueued.make({ input: withBytes });
      const encoded = yield* encodeQueued(event);
      expect(encoded).toEqual({ _tag: "OperationQueued", input });
      expect(V.OperationQueued.schemaVersion).toBe(1);
    })
  );
});
