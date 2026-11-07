import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { CuidState } from "@beep/schema/Cuid";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeEvidence = S.decodeEffect(V.RemoteEvidence);
const decodeDestinationId = S.decodeUnknownEffect(V.DestinationId);
const decodeReservationKey = S.decodeUnknownEffect(V.ReservationKey);
const CuidLayer = CuidState.Default.pipe(
  Layer.provideMerge(Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto))
);
const encodeQueued = S.encodeEffect(V.OperationQueued);
const destination = V.DestinationId.make("documents_sync_destination_avaultunit");
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
  it("cursor advances retain the classified page event identity", () => {
    const registered = V.SyncDestination.definition.evolve.DestinationRegistered(
      V.SyncDestination.definition.initial,
      V.DestinationRegistered.make({ orgId: 1, workspaceId: 1, name: "synthetic" }),
      { ...envelope, id: destination }
    );
    const events = V.SyncDestination.definition.decide.RecordDestinationPoll(
      registered,
      V.RecordDestinationPoll.make({ position: "p2", error: null, lastEventId: "event-2" }),
      { ...ctx, id: destination }
    );
    expect(events).toEqual([V.CursorAdvanced.make({ position: "p2", lastEventId: "event-2" })]);
  });
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
      V.OperationFailed.make({ reason: "uploadFile" }),
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
      { ...ctx, id: V.reservationKey({ orgId: 1, name: "other" }) }
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
    const key = { ...ctx, id: V.reservationKey({ orgId: 1, name: "vault" }) };
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
    expect(
      decide(claim, claimFor("vault", V.DestinationId.make("documents_sync_destination_avaultother")), key)
    ).toMatchObject({
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
  it.prop(
    "reservation keys for generated org ids and names decode as opaque keys (F2)",
    [S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 })), S.NonEmptyString],
    ([orgId, name]) => S.is(V.ReservationKey)(V.reservationKey({ orgId, name })),
    { arbitrary: { runs: 100, seed: "vault-sync-reservation-keys" } }
  );
  it.prop(
    "generated destination ids keep the opaque prefix (F3)",
    [V.DestinationId],
    ([id]) => Str.startsWith("documents_sync_destination_")(id),
    { arbitrary: { runs: 100, seed: "vault-sync-destination-ids" } }
  );
  it.effect("reservation keys hash the normalized name and never carry it (F2)", () =>
    Effect.gen(function* () {
      const key = V.reservationKey({ orgId: 7, name: " Client Matter " });
      expect(key).toBe(V.reservationKey({ orgId: 7, name: "client matter" }));
      expect(key).not.toBe(V.reservationKey({ orgId: 8, name: "client matter" }));
      expect(key).toMatch(/^7:[0-9a-f]{64}$/);
      expect(Str.toLowerCase(key)).not.toContain("client");
      const rejected = yield* decodeReservationKey("7:client matter").pipe(Effect.flip);
      expect(rejected._tag).toBe("SchemaError");
      const claim = V.NameClaim.make({
        destinationId: destination,
        orgId: 7,
        workspaceId: 1,
        name: "Client Matter",
        previousName: null,
      });
      const decide = V.DestinationNameReservation.definition.decide.ClaimDestinationName;
      const violation = decide(
        V.NameClaim.make({ ...claim, destinationId: V.DestinationId.make("documents_sync_destination_other1") }),
        V.ClaimDestinationName.make({ claim }),
        { ...ctx, id: key }
      );
      expect(violation).toMatchObject({ rule: "name-held", evidence: key });
    })
  );
});
layer(CuidLayer, { timeout: "10 seconds" })("vault sync destination ids", (it) => {
  it.effect("destination ids are opaque minted tokens and decode strictly (F3)", () =>
    Effect.gen(function* () {
      const minted = yield* V.mintDestinationId;
      expect(S.is(V.DestinationId)(minted)).toBe(true);
      expect(Str.startsWith("documents_sync_destination_")(minted)).toBe(true);
      const decoded = yield* decodeDestinationId(minted);
      expect(decoded).toBe(minted);
      const rejected = yield* decodeDestinationId("vault").pipe(Effect.flip);
      expect(rejected._tag).toBe("SchemaError");
      expect(S.is(V.DestinationId)("documents_sync_destination_Vault Name")).toBe(false);
    })
  );
});

describe("review corrections (I14)", () => {
  const record = V.ConflictRecord.make({
    publicId: V.ConflictId.make("documents_sync_conflict_a9"),
    destinationId: destination,
    workspaceId: 1,
    remoteEventId: "event9",
    itemId,
    evidence: "remote",
    kind: "remoteRename",
    reviewed: false,
  });
  const item = V.ItemRecord.make({
    observation: V.ItemObservation.make({
      destinationId: destination,
      workspaceId: 1,
      path: V.VaultRelPath.make("folder/file.txt"),
      kind: "file",
      digest: "d1",
      generation: 3,
      operationId: id,
      type: "uploadFile",
      parentRequired: true,
    }),
    remoteId: V.RemoteItemId.make("remote-9"),
    status: "drifted",
    slots: H.empty(),
  });
  it("re-asserts the local name for a reviewed remote rename with a stable operation id", () => {
    const first = O.getOrNull(V.reviewCorrection({ record, item }));
    expect(first?.input).toMatchObject({ type: "renameItem", generation: 4, path: "folder/file.txt", itemId });
    expect(first?.input.idempotencyKey).toBe(first?.operationId);
    expect(O.getOrNull(V.reviewCorrection({ record, item }))?.operationId).toBe(first?.operationId);
  });
  it("queues nothing for other kinds, untracked conflicts or items without a remote id", () => {
    assertNone(V.reviewCorrection({ record: { ...record, kind: "remoteEdit" }, item }));
    const { kind: _kind, ...legacy } = record;
    assertNone(V.reviewCorrection({ record: V.ConflictRecord.make(legacy), item }));
    assertNone(V.reviewCorrection({ record: { ...record, itemId: null }, item }));
    assertNone(V.reviewCorrection({ record, item: { ...item, remoteId: null } }));
  });
});
