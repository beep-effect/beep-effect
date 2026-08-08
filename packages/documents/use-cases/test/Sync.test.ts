import { RemoteItemId } from "@beep/documents-domain/values/Sync";
import {
  DmsEventPage,
  DmsEventType,
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorProbe,
  DmsMirrorUnavailable,
  DmsRemoteEvent,
  DmsRemoteItem,
  EnsureFolderInput,
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  MoveItemInput,
  PollEventsInput,
  RenameItemInput,
  SyncOnceInput,
  UploadFileInput,
  UploadFileVersionInput,
  VaultScanFailed,
  VaultSyncEngine,
  VaultSyncError,
  VaultSyncStatus,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { SyncItemRepositoryUnavailable } from "@beep/documents-use-cases/entities/SyncItem/server";
import {
  GetVaultSyncStatusRpc,
  ListVaultSyncConflictsRpc,
  MarkVaultSyncConflictReviewedPayload,
  MarkVaultSyncConflictReviewedRpc,
  TriggerVaultSyncRpc,
  VaultSyncActionError,
  VaultSyncRpcs,
  VaultSyncWorkspacePayload,
} from "@beep/documents-use-cases/public";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { DmsMirrorShape, VaultSyncEngineShape } from "@beep/documents-use-cases/aggregates/Sync/server";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(10)
  );
};

const workspaceId = S.decodeSync(WorkspaceIdentity.WorkspaceId)(1);

const idleStatus = S.decodeSync(VaultSyncStatus)({
  conflictItems: 0,
  connected: false,
  currentItems: 0,
  cursorPosition: null,
  errorItems: 0,
  failedOperations: 0,
  openConflicts: 0,
  pendingItems: 0,
  provider: "box",
  queuedOperations: 0,
});

describe("DmsMirror port models", () => {
  it("defaults optional remote references to none at construction", () => {
    const item = DmsRemoteItem.make({
      itemKind: "folder",
      name: "matters",
      remoteId: S.decodeSync(RemoteItemId)("9000"),
    });
    expect(O.isNone(item.parentRemoteId)).toBe(true);

    const event = DmsRemoteEvent.make({
      eventId: "evt-1",
      eventType: "edited",
      payload: { eventType: "ITEM_MODIFY" },
    });
    expect(O.isNone(event.remoteId)).toBe(true);
    expect(O.isNone(event.itemKind)).toBe(true);

    expect(O.isNone(PollEventsInput.make({}).streamPosition)).toBe(true);
    expect(O.isNone(EnsureFolderInput.make({ name: "matters" }).parentRemoteId)).toBe(true);
  });

  it("exposes the DmsEventType literal family", () => {
    expect(DmsEventType.is.created("created")).toBe(true);
    expect(DmsEventType.is.deleted("created")).toBe(false);
    expect(DmsEventType.Enum.unknown).toBe("unknown");
    expect(() => S.decodeUnknownSync(DmsEventType)("uploaded")).toThrow();
  });

  it.effect(
    "resolves mirror and availability ports through their context tags",
    Effect.fnUntraced(function* () {
      const unavailable = () =>
        Effect.fail(DmsMirrorUnavailable.make({ provider: "box", reason: "stub mirror", retryable: false }));
      const mirror: DmsMirrorShape = {
        ensureFolder: unavailable,
        moveItem: unavailable,
        pollEvents: () => Effect.succeed(DmsEventPage.make({ entries: [], nextStreamPosition: "now" })),
        renameItem: unavailable,
        uploadFile: unavailable,
        uploadFileVersion: unavailable,
      };

      const page = yield* Effect.gen(function* () {
        const service = yield* DmsMirror;
        return yield* service.pollEvents(PollEventsInput.make({}));
      }).pipe(Effect.provideService(DmsMirror, mirror));
      expect(page.nextStreamPosition).toBe("now");

      const probe = yield* Effect.gen(function* () {
        const service = yield* DmsMirrorAvailability;
        return yield* service.probe;
      }).pipe(
        Effect.provideService(DmsMirrorAvailability, {
          probe: Effect.succeed(DmsMirrorProbe.make({ connected: true, provider: "box" })),
        })
      );
      expect(probe.connected).toBe(true);
    })
  );

  it("round-trips schema-derived mirror models and inputs", () => {
    assertSchemaArbitraryRoundTrip(DmsRemoteItem);
    assertSchemaArbitraryRoundTrip(DmsRemoteEvent);
    assertSchemaArbitraryRoundTrip(DmsEventPage);
    assertSchemaArbitraryRoundTrip(EnsureFolderInput);
    assertSchemaArbitraryRoundTrip(UploadFileInput);
    assertSchemaArbitraryRoundTrip(UploadFileVersionInput);
    assertSchemaArbitraryRoundTrip(MoveItemInput);
    assertSchemaArbitraryRoundTrip(RenameItemInput);
    assertSchemaArbitraryRoundTrip(PollEventsInput);
  });
});

describe("VaultSyncEngine port", () => {
  it("round-trips the vault sync status read model", () => {
    expect(O.isNone(idleStatus.cursorPosition)).toBe(true);
    expect(S.encodeSync(VaultSyncStatus)(idleStatus)).toStrictEqual({
      conflictItems: 0,
      connected: false,
      currentItems: 0,
      cursorPosition: null,
      errorItems: 0,
      failedOperations: 0,
      openConflicts: 0,
      pendingItems: 0,
      provider: "box",
      queuedOperations: 0,
    });
    assertSchemaArbitraryRoundTrip(VaultSyncStatus);
  });

  it("decodes and guards the vault sync error union", () => {
    const scanFailed = S.decodeSync(VaultSyncError)(VaultScanFailed.make({ reason: "vault root missing" }));
    expect(scanFailed._tag).toBe("VaultScanFailed");

    const mirrorDown = S.decodeSync(VaultSyncError)(
      DmsMirrorUnavailable.make({ provider: "box", reason: "remote rate limit exceeded", retryable: true })
    );
    expect(mirrorDown._tag).toBe("DmsMirrorUnavailable");

    const repositoryDown = S.decodeSync(VaultSyncError)(
      SyncItemRepositoryUnavailable.make({ reason: "database connection closed" })
    );
    expect(repositoryDown._tag).toBe("SyncItemRepositoryUnavailable");

    expect(VaultSyncError.is(VaultScanFailed.make({ reason: "vault root missing" }))).toBe(true);
    expect(VaultSyncError.is(VaultSyncActionError.new("client-safe failure"))).toBe(false);
  });

  it.effect(
    "resolves the engine port through its context tag",
    Effect.fnUntraced(function* () {
      const engine: VaultSyncEngineShape = {
        listOpenConflicts: () => Effect.succeed([]),
        markConflictReviewed: () => Effect.fail(VaultScanFailed.make({ reason: "stub engine" })),
        status: () => Effect.succeed(idleStatus),
        syncOnce: () => Effect.succeed(idleStatus),
      };

      const status = yield* Effect.gen(function* () {
        const service = yield* VaultSyncEngine;
        return yield* service.status(VaultSyncStatusInput.make({ workspaceId }));
      }).pipe(Effect.provideService(VaultSyncEngine, engine));

      expect(status.connected).toBe(false);
    })
  );

  it("round-trips schema-derived engine inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncOnceInput);
    assertSchemaArbitraryRoundTrip(VaultSyncStatusInput);
    assertSchemaArbitraryRoundTrip(ListOpenConflictsInput);
    assertSchemaArbitraryRoundTrip(MarkConflictReviewedInput);
  });
});

describe("VaultSyncRpcs group", () => {
  it("registers the four vault sync RPCs", () => {
    expect(VaultSyncRpcs.requests.get("TriggerVaultSync")).toBe(TriggerVaultSyncRpc);
    expect(VaultSyncRpcs.requests.get("GetVaultSyncStatus")).toBe(GetVaultSyncStatusRpc);
    expect(VaultSyncRpcs.requests.get("ListVaultSyncConflicts")).toBe(ListVaultSyncConflictsRpc);
    expect(VaultSyncRpcs.requests.get("MarkVaultSyncConflictReviewed")).toBe(MarkVaultSyncConflictReviewedRpc);
  });

  it.effect(
    "exposes a client-safe action error with fail helpers",
    Effect.fnUntraced(function* () {
      const error = yield* VaultSyncActionError.failEffect("Vault sync is unavailable.").pipe(Effect.flip);

      expect(error._tag).toBe("VaultSyncActionError");
      expect(error.message).toBe("Vault sync is unavailable.");
    })
  );

  it("round-trips schema-derived RPC payloads", () => {
    assertSchemaArbitraryRoundTrip(VaultSyncWorkspacePayload);
    assertSchemaArbitraryRoundTrip(MarkVaultSyncConflictReviewedPayload);
  });
});
