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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
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

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
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
    assertNone(item.parentRemoteId);

    const event = DmsRemoteEvent.make({
      eventId: "evt-1",
      eventType: "edited",
      payload: { eventType: "ITEM_MODIFY" },
    });
    assertNone(event.remoteId);
    assertNone(event.itemKind);

    assertNone(PollEventsInput.make({}).streamPosition);
    assertNone(EnsureFolderInput.make({ name: "matters" }).parentRemoteId);
  });

  it.effect(
    "exposes the DmsEventType literal family",
    Effect.fnUntraced(function* () {
      pipe(DmsEventType.is.created("created"), assertTrue);
      pipe(DmsEventType.is.deleted("created"), assertFalse);
      expect(DmsEventType.Enum.unknown).toBe("unknown");

      const exit = yield* Effect.exit(decodeUnknownDmsEventType("uploaded"));
      pipe(exit, Exit.isFailure, assertTrue);
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
      pipe(probe.connected, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived mirror models and inputs",
    [
      Arbitrary.schema(DmsRemoteItem),
      Arbitrary.schema(DmsRemoteEvent),
      Arbitrary.schema(DmsEventPage),
      Arbitrary.schema(EnsureFolderInput),
      Arbitrary.schema(UploadFileInput),
      Arbitrary.schema(UploadFileVersionInput),
      Arbitrary.schema(MoveItemInput),
      Arbitrary.schema(RenameItemInput),
      Arbitrary.schema(PollEventsInput),
    ],
    ([
      dmsRemoteItem,
      dmsRemoteEvent,
      dmsEventPage,
      ensureFolderInput,
      uploadFileInput,
      uploadFileVersionInput,
      moveItemInput,
      renameItemInput,
      pollEventsInput,
    ]) => {
      assertSchemaRoundTrip(DmsRemoteItem, dmsRemoteItem);
      assertSchemaRoundTrip(DmsRemoteEvent, dmsRemoteEvent);
      assertSchemaRoundTrip(DmsEventPage, dmsEventPage);
      assertSchemaRoundTrip(EnsureFolderInput, ensureFolderInput);
      assertSchemaRoundTrip(UploadFileInput, uploadFileInput);
      assertSchemaRoundTrip(UploadFileVersionInput, uploadFileVersionInput);
      assertSchemaRoundTrip(MoveItemInput, moveItemInput);
      assertSchemaRoundTrip(RenameItemInput, renameItemInput);
      assertSchemaRoundTrip(PollEventsInput, pollEventsInput);
    },
    { arbitrary: fcRuns(10) }
  );
});

describe("VaultSyncEngine port", () => {
  it.effect.prop(
    "round-trips the vault sync status read model",
    [Arbitrary.schema(VaultSyncStatus)],
    ([vaultSyncStatus]) =>
      Effect.gen(function* () {
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

        assertNone(decoded.cursorPosition);
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
        assertSchemaRoundTrip(VaultSyncStatus, vaultSyncStatus);
      }),
    { arbitrary: fcRuns(10) }
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

      pipe(VaultSyncError.is(VaultScanFailed.make({ reason: "vault root missing" })), assertTrue);
      pipe(VaultSyncError.is(VaultSyncActionError.new("client-safe failure")), assertFalse);
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

      pipe(status.connected, assertFalse);
    })
  );

  it.effect(
    "defaults forceProbe to the cached read path",
    Effect.fnUntraced(function* () {
      // Both construction and missing-key decoding must stay wire-compatible
      // with pre-forceProbe callers, which never bypass the probe cache.
      pipe(VaultSyncStatusInput.make({ workspaceId }).forceProbe, assertFalse);
      const decodedInput = yield* decodeVaultSyncStatusInput({ workspaceId: 1 });
      pipe(decodedInput.forceProbe, assertFalse);
      const decodedPayload = yield* decodeGetVaultSyncStatusPayload({ workspaceId: 1 });
      pipe(decodedPayload.forceProbe, assertFalse);
      pipe(GetVaultSyncStatusPayload.make({ forceProbe: true, workspaceId }).forceProbe, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived engine inputs",
    [
      Arbitrary.schema(SyncOnceInput),
      Arbitrary.schema(VaultSyncStatusInput),
      Arbitrary.schema(ListOpenConflictsInput),
      Arbitrary.schema(MarkConflictReviewedInput),
      Arbitrary.schema(GetVaultSyncStatusPayload),
    ],
    ([
      syncOnceInput,
      vaultSyncStatusInput,
      listOpenConflictsInput,
      markConflictReviewedInput,
      getVaultSyncStatusPayload,
    ]) => {
      assertSchemaRoundTrip(SyncOnceInput, syncOnceInput);
      assertSchemaRoundTrip(VaultSyncStatusInput, vaultSyncStatusInput);
      assertSchemaRoundTrip(ListOpenConflictsInput, listOpenConflictsInput);
      assertSchemaRoundTrip(MarkConflictReviewedInput, markConflictReviewedInput);
      assertSchemaRoundTrip(GetVaultSyncStatusPayload, getVaultSyncStatusPayload);
    },
    { arbitrary: fcRuns(10) }
  );
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

  it.prop(
    "round-trips schema-derived RPC payloads",
    [Arbitrary.schema(VaultSyncWorkspacePayload), Arbitrary.schema(MarkVaultSyncConflictReviewedPayload)],
    ([vaultSyncWorkspacePayload, markVaultSyncConflictReviewedPayload]) => {
      assertSchemaRoundTrip(VaultSyncWorkspacePayload, vaultSyncWorkspacePayload);
      assertSchemaRoundTrip(MarkVaultSyncConflictReviewedPayload, markVaultSyncConflictReviewedPayload);
    },
    { arbitrary: fcRuns(10) }
  );
});
