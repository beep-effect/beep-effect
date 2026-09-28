import * as SyncOperation from "@beep/documents-domain/entities/SyncOperation";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

const decodeUnknownSyncOperation = S.decodeUnknownEffect(SyncOperation.SyncOperation);
const decodeUnknownSyncOperationStatus = S.decodeUnknownEffect(SyncOperation.SyncOperationStatus);
const decodeUnknownSyncOperationType = S.decodeUnknownEffect(SyncOperation.SyncOperationType);
const encodeSyncOperation = S.encodeEffect(SyncOperation.SyncOperation);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
};

const uploadRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncOperationId.entityType, 1),
  attemptCount: 0,
  idempotencyKey: "sync-item-1:uploadFile:1",
  inputContentDigest: "abc123",
  inputGeneration: 1,
  lastError: null,
  operationType: "uploadFile",
  provider: "box",
  status: "queued",
  syncItemId: 1,
  targetName: "complaint.pdf",
  targetParentRelPath: "matters/client-default",
  targetRelPath: "matters/client-default/complaint.pdf",
  workspaceId: 2,
};

describe("SyncOperation entity", () => {
  it("wires SyncOperation to the documents identity", () => {
    expect(SyncOperation.SyncOperation.sql.tableName).toBe(DocumentsIdentity.SyncOperationId.tableName);
    expect(Object.keys(SyncOperation.SyncOperation.insert.fields)).not.toContain("id");
    expect(Object.keys(SyncOperation.SyncOperation.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(SyncOperation.SyncOperation.update.fields)).toContain("id");
    expect(Object.keys(SyncOperation.SyncOperation.update.fields)).toContain("rowVersion");
    expect(Object.keys(SyncOperation.SyncOperation.jsonCreate.fields)).toHaveLength(13);
    expect(Object.keys(SyncOperation.SyncOperation.jsonUpdate.fields)).toHaveLength(13);
  });

  it.effect("decodes and encodes a full upload outbox row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncOperation(uploadRow);

      expect(decoded).toBeInstanceOf(SyncOperation.SyncOperation);
      assertSome<string>(decoded.inputContentDigest, "abc123");
      assertSome<string>(decoded.targetParentRelPath, "matters/client-default");
      assertNone(decoded.lastError);
      expect(decoded.status).toBe("queued");
      expect(yield* encodeSyncOperation(decoded)).toStrictEqual(uploadRow);
    })
  );

  it.effect("decodes folder creation rows targeting the mirror root", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncOperation({
        ...uploadRow,
        inputContentDigest: null,
        lastError: "box responded 503",
        operationType: "createFolder",
        status: "failed",
        targetName: "matters",
        targetParentRelPath: null,
        targetRelPath: "matters",
      });

      assertNone(decoded.inputContentDigest);
      assertNone(decoded.targetParentRelPath);
      assertSome<string>(decoded.lastError, "box responded 503");
    })
  );

  it.effect("exposes the operation literal families", () =>
    Effect.gen(function* () {
      pipe(SyncOperation.SyncOperationType.is.uploadFile("uploadFile"), assertTrue);
      pipe(SyncOperation.SyncOperationType.is.moveItem("uploadFile"), assertFalse);
      pipe(SyncOperation.SyncOperationStatus.is.queued("queued"), assertTrue);
      expect(SyncOperation.SyncOperationStatus.Enum.leased).toBe("leased");
      const typeExit = yield* Effect.exit(decodeUnknownSyncOperationType("deleteItem"));
      const statusExit = yield* Effect.exit(decodeUnknownSyncOperationStatus("cancelled"));
      pipe(typeExit, Exit.isFailure, assertTrue);
      pipe(statusExit, Exit.isFailure, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived sync operation values",
    [
      Arbitrary.schema(SyncOperation.SyncOperationType),
      Arbitrary.schema(SyncOperation.SyncOperationStatus),
      Arbitrary.schema(SyncOperation.SyncOperation),
    ],
    ([syncOperationType, syncOperationStatus, syncOperation]) => {
      assertSchemaRoundTrip(SyncOperation.SyncOperationType, syncOperationType);
      assertSchemaRoundTrip(SyncOperation.SyncOperationStatus, syncOperationStatus);
      assertSchemaRoundTrip(SyncOperation.SyncOperation, syncOperation);
    },
    { arbitrary: fcRuns(10) }
  );
});
