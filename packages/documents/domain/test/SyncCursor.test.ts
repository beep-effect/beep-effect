import * as SyncCursor from "@beep/documents-domain/entities/SyncCursor";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
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

const freshCursorRow = {
  ...baseEntityFixtureInput(DocumentsIdentity.SyncCursorId.entityType, 1),
  lastError: null,
  lastEventId: null,
  provider: "box",
  status: "active",
  streamPosition: "now",
  workspaceId: 2,
};

describe("SyncCursor entity", () => {
  it("wires SyncCursor to the documents identity", () => {
    expect(SyncCursor.SyncCursor.definition.entityId.tableName).toBe("documents_sync_cursor");
    expect(SyncCursor.SyncCursor.definition.entityId.entityType).toBe("DocumentsSyncCursor");
    expect(SyncCursor.SyncCursor.definition.persisted.streamPosition.columnName).toBe("stream_position");
    expect(SyncCursor.SyncCursor.definition.persisted.lastEventId.columnName).toBe("last_event_id");
    expect(SyncCursor.SyncCursor.definition.persisted.workspaceId.storageKind).toBe("entityId");
  });

  it("decodes and encodes a fresh cursor row", () => {
    const decoded = S.decodeUnknownSync(SyncCursor.SyncCursor)(freshCursorRow);

    expect(decoded).toBeInstanceOf(SyncCursor.SyncCursor);
    expect(decoded.lastEventId).toEqual(O.none());
    expect(decoded.lastError).toEqual(O.none());
    expect(decoded.status).toBe("active");
    expect(S.encodeSync(SyncCursor.SyncCursor)(decoded)).toStrictEqual(freshCursorRow);
  });

  it("decodes advanced cursors with recorded event and error state", () => {
    const decoded = S.decodeUnknownSync(SyncCursor.SyncCursor)({
      ...freshCursorRow,
      lastError: "box stream returned 429",
      lastEventId: "evt-9",
      status: "error",
      streamPosition: "1746000000000",
    });

    expect(decoded.lastEventId).toEqual(O.some("evt-9"));
    expect(decoded.lastError).toEqual(O.some("box stream returned 429"));
    expect(decoded.status).toBe("error");
  });

  it("exposes the SyncCursorStatus literal family", () => {
    expect(SyncCursor.SyncCursorStatus.is.active("active")).toBe(true);
    expect(SyncCursor.SyncCursorStatus.is.error("active")).toBe(false);
    expect(SyncCursor.SyncCursorStatus.Enum.error).toBe("error");
    expect(() => S.decodeUnknownSync(SyncCursor.SyncCursorStatus)("paused")).toThrow();
  });

  it("round-trips schema-derived sync cursor values", () => {
    assertSchemaArbitraryRoundTrip(SyncCursor.SyncCursorStatus);
    assertSchemaArbitraryRoundTrip(SyncCursor.SyncCursor);
  });
});
