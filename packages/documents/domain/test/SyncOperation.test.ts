import * as SyncOperation from "@beep/documents-domain/entities/SyncOperation";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownSyncOperationSyncOperationSync = S.decodeUnknownSync(SyncOperation.SyncOperation);
const decodeUnknownSyncOperationSyncOperationStatusSync = S.decodeUnknownSync(SyncOperation.SyncOperationStatus);
const decodeUnknownSyncOperationSyncOperationTypeSync = S.decodeUnknownSync(SyncOperation.SyncOperationType);
const encodeSyncOperationSyncOperationSync = S.encodeSync(SyncOperation.SyncOperation);

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

  it("decodes and encodes a full upload outbox row", () => {
    const decoded = decodeUnknownSyncOperationSyncOperationSync(uploadRow);

    expect(decoded).toBeInstanceOf(SyncOperation.SyncOperation);
    expect(decoded.inputContentDigest).toEqual(O.some("abc123"));
    expect(decoded.targetParentRelPath).toEqual(O.some("matters/client-default"));
    expect(decoded.lastError).toEqual(O.none());
    expect(decoded.status).toBe("queued");
    expect(encodeSyncOperationSyncOperationSync(decoded)).toStrictEqual(uploadRow);
  });

  it("decodes folder creation rows targeting the mirror root", () => {
    const decoded = decodeUnknownSyncOperationSyncOperationSync({
      ...uploadRow,
      inputContentDigest: null,
      lastError: "box responded 503",
      operationType: "createFolder",
      status: "failed",
      targetName: "matters",
      targetParentRelPath: null,
      targetRelPath: "matters",
    });

    expect(decoded.inputContentDigest).toEqual(O.none());
    expect(decoded.targetParentRelPath).toEqual(O.none());
    expect(decoded.lastError).toEqual(O.some("box responded 503"));
  });

  it("exposes the operation literal families", () => {
    expect(SyncOperation.SyncOperationType.is.uploadFile("uploadFile")).toBe(true);
    expect(SyncOperation.SyncOperationType.is.moveItem("uploadFile")).toBe(false);
    expect(SyncOperation.SyncOperationStatus.is.queued("queued")).toBe(true);
    expect(SyncOperation.SyncOperationStatus.Enum.leased).toBe("leased");
    expect(() => decodeUnknownSyncOperationSyncOperationTypeSync("deleteItem")).toThrow();
    expect(() => decodeUnknownSyncOperationSyncOperationStatusSync("cancelled")).toThrow();
  });

  it("round-trips schema-derived sync operation values", () => {
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperationType);
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperationStatus);
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperation);
  });
});
