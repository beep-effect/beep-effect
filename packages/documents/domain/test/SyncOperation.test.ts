import * as SyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
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
    fcRuns(10)
  );
};

const uploadRow = {
  ...baseEntityFixtureInput(SyncOperation.SyncOperationId.entityType, 1),
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
    expect(SyncOperation.SyncOperation.definition.entityId.tableName).toBe("documents_sync_operation");
    expect(SyncOperation.SyncOperation.definition.entityId.entityType).toBe("DocumentsSyncOperation");
    expect(SyncOperation.SyncOperation.definition.persisted.idempotencyKey.columnName).toBe("idempotency_key");
    expect(SyncOperation.SyncOperation.definition.persisted.operationType.columnName).toBe("operation_type");
    expect(SyncOperation.SyncOperation.definition.persisted.syncItemId.storageKind).toBe("entityId");
  });

  it("decodes and encodes a full upload outbox row", () => {
    const decoded = S.decodeUnknownSync(SyncOperation.SyncOperation)(uploadRow);

    expect(decoded).toBeInstanceOf(SyncOperation.SyncOperation);
    expect(decoded.inputContentDigest).toEqual(O.some("abc123"));
    expect(decoded.targetParentRelPath).toEqual(O.some("matters/client-default"));
    expect(decoded.lastError).toEqual(O.none());
    expect(decoded.status).toBe("queued");
    expect(S.encodeSync(SyncOperation.SyncOperation)(decoded)).toStrictEqual(uploadRow);
  });

  it("decodes folder creation rows targeting the mirror root", () => {
    const decoded = S.decodeUnknownSync(SyncOperation.SyncOperation)({
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
    expect(() => S.decodeUnknownSync(SyncOperation.SyncOperationType)("deleteItem")).toThrow();
    expect(() => S.decodeUnknownSync(SyncOperation.SyncOperationStatus)("cancelled")).toThrow();
  });

  it("round-trips schema-derived sync operation values", () => {
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperationType);
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperationStatus);
    assertSchemaArbitraryRoundTrip(SyncOperation.SyncOperation);
  });
});
