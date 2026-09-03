import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import {
  GetVaultSyncStatusPayload,
  IntakeDroppedFilePayload,
  MarkVaultSyncConflictReviewedPayload,
  VaultSyncRpcs,
  VaultSyncStatus,
  VaultSyncWorkspacePayload,
} from "@beep/documents-use-cases/public";
import { fcRuns } from "@beep/test-utils";
import { SetWorkspaceVaultInput } from "@beep/workspace-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { DerivedThreadTitle } from "@/chat/DerivedThreadTitle";
import { DroppedDocumentInput, intakeDroppedFilePayload } from "@/intake/Intake.atoms";
import { ProfessionalDesktopMigrationOptions } from "@/runtime/Migrations";
import { SidecarTransport } from "@/transport/SidecarTransport";
import { InboundEvent, InboundFrame, SidecarClosedPayload } from "@/transport/TauriIpcSocket";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";

const decodeSidecarTransport = S.decodeUnknownEffect(SidecarTransport);
const encodeSidecarTransport = S.encodeUnknownEffect(SidecarTransport);
const encodeInboundFrame = S.encodeUnknownEffect(InboundFrame);
const decodeInboundEvent = S.decodeUnknownEffect(InboundEvent);
const encodeInboundEvent = S.encodeUnknownEffect(InboundEvent);
const encodeSidecarClosedPayload = S.encodeUnknownEffect(SidecarClosedPayload);
const decodeProfessionalDesktopMigrationOptions = S.decodeUnknownEffect(ProfessionalDesktopMigrationOptions);
const encodeProfessionalDesktopMigrationOptions = S.encodeUnknownEffect(ProfessionalDesktopMigrationOptions);
const decodeSetWorkspaceVaultInput = S.decodeUnknownEffect(SetWorkspaceVaultInput);
const encodeSetWorkspaceVaultInput = S.encodeUnknownEffect(SetWorkspaceVaultInput);
const decodeIntakeBatchId = S.decodeUnknownEffect(IntakeBatchId);
const encodeDroppedDocumentInput = S.encodeUnknownEffect(DroppedDocumentInput);
const encodeIntakeDroppedFilePayload = S.encodeUnknownEffect(IntakeDroppedFilePayload);
const encodeVaultSyncWorkspacePayload = S.encodeUnknownEffect(VaultSyncWorkspacePayload);
const decodeGetVaultSyncStatusPayload = S.decodeUnknownEffect(GetVaultSyncStatusPayload);
const encodeGetVaultSyncStatusPayload = S.encodeUnknownEffect(GetVaultSyncStatusPayload);
const decodeMarkVaultSyncConflictReviewedPayload = S.decodeUnknownEffect(MarkVaultSyncConflictReviewedPayload);
const encodeMarkVaultSyncConflictReviewedPayload = S.encodeUnknownEffect(MarkVaultSyncConflictReviewedPayload);
const decodeVaultSyncStatus = S.decodeUnknownEffect(VaultSyncStatus);
const encodeVaultSyncStatus = S.encodeUnknownEffect(VaultSyncStatus);
const decodeDerivedThreadTitle = S.decodeUnknownOption(DerivedThreadTitle);

const assertSchemaEncodeDecodeRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));
      return equivalent(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 50)
  );
};

describe("@beep/professional-desktop schema parity", () => {
  it.effect(
    "preserves transport boundary encoded shapes",
    Effect.fnUntraced(function* () {
      const sidecarTransportWire = { ipc: true };
      const sidecarTransport = yield* decodeSidecarTransport(sidecarTransportWire);
      expect(yield* encodeSidecarTransport(sidecarTransport)).toStrictEqual(sidecarTransportWire);

      const inboundFrameWire = '{"jsonrpc":"2.0"}\n';
      const inboundFrame = yield* InboundFrame.decodeUnknownEffect(inboundFrameWire);
      expect(yield* encodeInboundFrame(inboundFrame)).toStrictEqual(inboundFrameWire);

      const inboundEventWire = { _tag: "Rx", payload: inboundFrameWire };
      const inboundEvent = yield* decodeInboundEvent(inboundEventWire);
      expect(yield* encodeInboundEvent(inboundEvent)).toStrictEqual(inboundEventWire);

      const closedPayloadWire = {
        code: 0,
        kind: "terminated",
        message: null,
        signal: null,
      };
      const closedPayload = yield* SidecarClosedPayload.decodeUnknownEffect(closedPayloadWire);
      expect(yield* encodeSidecarClosedPayload(closedPayload)).toStrictEqual(closedPayloadWire);
    })
  );

  it.effect(
    "preserves migration option wire shape and schema-owned default",
    Effect.fnUntraced(function* () {
      const customWire = { migrationsSchema: "chat_runtime" };
      const custom = yield* decodeProfessionalDesktopMigrationOptions(customWire);
      expect(yield* encodeProfessionalDesktopMigrationOptions(custom)).toStrictEqual(customWire);

      const withDefault = ProfessionalDesktopMigrationOptions.make({});
      expect(withDefault.migrationsSchema).toBe("drizzle");
    })
  );

  it.effect(
    "preserves document intake onboarding and drop wire shapes",
    Effect.fnUntraced(function* () {
      const configure = yield* decodeSetWorkspaceVaultInput({
        vaultRootPath: "/tmp/beep-documents-vault",
        workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
      });
      expect(yield* encodeSetWorkspaceVaultInput(configure)).toStrictEqual({
        vaultRootPath: "/tmp/beep-documents-vault",
        workspaceId: 1,
      });

      const dropped = DroppedDocumentInput.make({
        content: new Uint8Array([1, 2, 3]),
        intakeBatchId: yield* decodeIntakeBatchId("batch-1"),
        originalFileName: "Complaint.pdf",
        workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
      });
      expect(yield* encodeDroppedDocumentInput(dropped)).toStrictEqual({
        content: "AQID",
        intakeBatchId: "batch-1",
        originalFileName: "Complaint.pdf",
        workspaceId: 1,
      });
    })
  );

  it.effect(
    "constructs dropped-file RPC payloads from raw Uint8Array inputs",
    Effect.fnUntraced(function* () {
      const payload = intakeDroppedFilePayload(
        DroppedDocumentInput.make({
          content: new Uint8Array([1, 2, 3]),
          intakeBatchId: yield* decodeIntakeBatchId("batch-raw"),
          originalFileName: "Raw.pdf",
          workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
        })
      );

      expect(payload.content).toEqual(new Uint8Array([1, 2, 3]));
      expect(yield* encodeIntakeDroppedFilePayload(payload)).toMatchObject({
        content: "AQID",
        originalFileName: "Raw.pdf",
      });
    })
  );

  it.effect(
    "preserves vault sync wire shapes",
    Effect.fnUntraced(function* () {
      const workspacePayload = VaultSyncWorkspacePayload.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID });
      expect(yield* encodeVaultSyncWorkspacePayload(workspacePayload)).toStrictEqual({
        workspaceId: 1,
      });

      const reviewedWire = { conflictId: 7, workspaceId: 1 };
      const reviewed = yield* decodeMarkVaultSyncConflictReviewedPayload(reviewedWire);
      expect(yield* encodeMarkVaultSyncConflictReviewedPayload(reviewed)).toStrictEqual(reviewedWire);

      const statusRequestWire = { forceProbe: true, workspaceId: 1 };
      const statusRequest = yield* decodeGetVaultSyncStatusPayload(statusRequestWire);
      expect(yield* encodeGetVaultSyncStatusPayload(statusRequest)).toStrictEqual(statusRequestWire);

      // An older app omits forceProbe entirely; the sidecar must decode it as
      // the cached-read default, not reject the request.
      const legacyStatusRequest = yield* decodeGetVaultSyncStatusPayload({ workspaceId: 1 });
      expect(legacyStatusRequest.forceProbe).toBe(false);

      const bootstrapStatusWire = {
        conflictItems: 0,
        connected: false,
        disconnectReason: "credentials-missing",
        currentItems: 0,
        cursorPosition: null,
        errorItems: 0,
        failedOperations: 0,
        openConflicts: 0,
        pendingItems: 0,
        probedAt: null,
        provider: "box",
        queuedOperations: 0,
      };
      const bootstrapStatus = yield* decodeVaultSyncStatus(bootstrapStatusWire);
      expect(O.isNone(bootstrapStatus.cursorPosition)).toBe(true);
      expect(yield* encodeVaultSyncStatus(bootstrapStatus)).toStrictEqual(bootstrapStatusWire);

      const activeStatusWire = {
        conflictItems: 1,
        connected: true,
        disconnectReason: null,
        currentItems: 3,
        cursorPosition: "now",
        errorItems: 0,
        failedOperations: 2,
        openConflicts: 1,
        pendingItems: 4,
        probedAt: "2026-08-26T12:00:00.000Z",
        provider: "box",
        queuedOperations: 5,
      };
      const activeStatus = yield* decodeVaultSyncStatus(activeStatusWire);
      expect(yield* encodeVaultSyncStatus(activeStatus)).toStrictEqual(activeStatusWire);

      // An older sidecar omits disconnectReason and probedAt entirely; the
      // status must still decode (missing key -> none) instead of going
      // unavailable.
      const { disconnectReason: _dropped, probedAt: _droppedProbedAt, ...legacyStatusWire } = bootstrapStatusWire;
      const legacyStatus = yield* decodeVaultSyncStatus(legacyStatusWire);
      expect(O.isNone(legacyStatus.disconnectReason)).toBe(true);
      expect(O.isNone(legacyStatus.probedAt)).toBe(true);
    })
  );

  it("registers the vault sync RPC group requests", () => {
    const names = ["GetVaultSyncStatus", "ListVaultSyncConflicts", "MarkVaultSyncConflictReviewed", "TriggerVaultSync"];

    expect(VaultSyncRpcs.requests.size).toBe(4);
    expect(A.every(names, (name) => VaultSyncRpcs.requests.has(name))).toBe(true);
  });

  it("normalizes derived titles through the schema", () => {
    const longTitle = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-title";

    expect(O.getOrUndefined(decodeDerivedThreadTitle("  Draft memo  "))).toBe("Draft memo");
    expect(O.getOrUndefined(decodeDerivedThreadTitle(longTitle))).toBe(
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-t"
    );
    expect(O.isNone(decodeDerivedThreadTitle("   "))).toBe(true);
  });

  it("round-trips schema-derived arbitraries through the absorbed invariants", () => {
    assertSchemaEncodeDecodeRoundTrip(SidecarTransport, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(InboundFrame, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(InboundEvent, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(SidecarClosedPayload, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(ProfessionalDesktopMigrationOptions, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(DerivedThreadTitle, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(VaultSyncWorkspacePayload, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(GetVaultSyncStatusPayload, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(MarkVaultSyncConflictReviewedPayload, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(VaultSyncStatus, { numRuns: 25 });
  });
});
