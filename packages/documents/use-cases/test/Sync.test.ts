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
  GetVaultSyncStatusPayload,
  GetVaultSyncStatusRpc,
  ListVaultSyncConflictsRpc,
  MarkVaultSyncConflictReviewedPayload,
  MarkVaultSyncConflictReviewedRpc,
  TriggerVaultSyncRpc,
  VaultSyncActionError,
  VaultSyncRpcs,
  VaultSyncWorkspacePayload,
} from "@beep/documents-use-cases/public";
import { NonNegativeInt } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { DmsMirrorShape, VaultSyncEngineShape } from "@beep/documents-use-cases/aggregates/Sync/server";

const decodeGetVaultSyncStatusPayload = S.decodeEffect(GetVaultSyncStatusPayload);
const decodeUnknownDmsEventType = S.decodeUnknownEffect(DmsEventType);
const decodeVaultSyncError = S.decodeEffect(VaultSyncError);
const decodeVaultSyncStatus = S.decodeEffect(VaultSyncStatus);
const decodeVaultSyncStatusInput = S.decodeEffect(VaultSyncStatusInput);
const encodeVaultSyncStatus = S.encodeEffect(VaultSyncStatus);

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.schema(schema),
        (value) => {
          const encoded = Result.getOrThrow(encode(value));
          const decoded = Result.getOrThrow(decode(encoded));

          return equivalent(decoded, value);
        },
        fcRuns(10)
      )
    )._tag
  ).toBe("Passed");
};

const zero = NonNegativeInt.make(0);
const workspaceId = WorkspaceIdentity.WorkspaceId.make(1);

const idleStatus = VaultSyncStatus.make({
  conflictItems: zero,
  connected: false,
  currentItems: zero,
  cursorPosition: O.none(),
  disconnectReason: O.some("credentials-missing"),
  errorItems: zero,
  failedOperations: zero,
  openConflicts: zero,
  pendingItems: zero,
  probedAt: O.none(),
  provider: "box",
  queuedOperations: zero,
});

describe("DmsMirror port models", () => {
  it("defaults optional remote references to none at construction", () => {
    const item = DmsRemoteItem.make({
      itemKind: "folder",
      name: "matters",
      remoteId: RemoteItemId.make("9000"),
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

  it.effect(
    "exposes the DmsEventType literal family",
    Effect.fnUntraced(function* () {
      expect(DmsEventType.is.created("created")).toBe(true);
      expect(DmsEventType.is.deleted("created")).toBe(false);
      expect(DmsEventType.Enum.unknown).toBe("unknown");

      const exit = yield* Effect.exit(decodeUnknownDmsEventType("uploaded"));
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

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

      const connectedProbe = Effect.succeed(DmsMirrorProbe.make({ connected: true, provider: "box" }));
      const probe = yield* Effect.gen(function* () {
        const service = yield* DmsMirrorAvailability;
        return yield* service.probe;
      }).pipe(
        Effect.provideService(DmsMirrorAvailability, {
          probe: connectedProbe,
          refresh: connectedProbe,
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
  it.effect(
    "round-trips the vault sync status read model",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeVaultSyncStatus({
        conflictItems: 0,
        connected: false,
        cursorPosition: null,
        currentItems: 0,
        disconnectReason: "credentials-missing",
        errorItems: 0,
        failedOperations: 0,
        openConflicts: 0,
        pendingItems: 0,
        probedAt: null,
        provider: "box",
        queuedOperations: 0,
      });

      expect(O.isNone(decoded.cursorPosition)).toBe(true);
      expect(yield* encodeVaultSyncStatus(decoded)).toStrictEqual({
        conflictItems: 0,
        connected: false,
        cursorPosition: null,
        currentItems: 0,
        disconnectReason: "credentials-missing",
        errorItems: 0,
        failedOperations: 0,
        openConflicts: 0,
        pendingItems: 0,
        probedAt: null,
        provider: "box",
        queuedOperations: 0,
      });
      assertSchemaArbitraryRoundTrip(VaultSyncStatus);
    })
  );

  it.effect(
    "decodes and guards the vault sync error union",
    Effect.fnUntraced(function* () {
      const scanFailed = yield* decodeVaultSyncError(VaultScanFailed.make({ reason: "vault root missing" }));
      expect(scanFailed._tag).toBe("VaultScanFailed");

      // Wire shape, not an instance: the optional-key disconnectReason encodes
      // as a bare literal (or an absent key), never as an Option object.
      const mirrorDown = yield* decodeVaultSyncError({
        _tag: "DmsMirrorUnavailable",
        disconnectReason: "transient",
        provider: "box",
        reason: "remote rate limit exceeded",
        retryable: true,
      });
      expect(mirrorDown._tag).toBe("DmsMirrorUnavailable");

      const repositoryDown = yield* decodeVaultSyncError(
        SyncItemRepositoryUnavailable.make({ reason: "database connection closed" })
      );
      expect(repositoryDown._tag).toBe("SyncItemRepositoryUnavailable");

      expect(VaultSyncError.is(VaultScanFailed.make({ reason: "vault root missing" }))).toBe(true);
      expect(VaultSyncError.is(VaultSyncActionError.new("client-safe failure"))).toBe(false);
    })
  );

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

  it.effect(
    "defaults forceProbe to the cached read path",
    Effect.fnUntraced(function* () {
      // Both construction and missing-key decoding must stay wire-compatible
      // with pre-forceProbe callers, which never bypass the probe cache.
      expect(VaultSyncStatusInput.make({ workspaceId }).forceProbe).toBe(false);
      const decodedInput = yield* decodeVaultSyncStatusInput({ workspaceId: 1 });
      expect(decodedInput.forceProbe).toBe(false);
      const decodedPayload = yield* decodeGetVaultSyncStatusPayload({ workspaceId: 1 });
      expect(decodedPayload.forceProbe).toBe(false);
      expect(GetVaultSyncStatusPayload.make({ forceProbe: true, workspaceId }).forceProbe).toBe(true);
    })
  );

  it("round-trips schema-derived engine inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncOnceInput);
    assertSchemaArbitraryRoundTrip(VaultSyncStatusInput);
    assertSchemaArbitraryRoundTrip(ListOpenConflictsInput);
    assertSchemaArbitraryRoundTrip(MarkConflictReviewedInput);
    assertSchemaArbitraryRoundTrip(GetVaultSyncStatusPayload);
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
