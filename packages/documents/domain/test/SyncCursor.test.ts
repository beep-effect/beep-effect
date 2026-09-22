import * as SyncCursor from "@beep/documents-domain/entities/SyncCursor";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownSyncCursor = S.decodeUnknownEffect(SyncCursor.SyncCursor);
const decodeUnknownSyncCursorStatus = S.decodeUnknownEffect(SyncCursor.SyncCursorStatus);
const encodeSyncCursor = S.encodeEffect(SyncCursor.SyncCursor);

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

const freshCursorRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncCursorId.entityType, 1),
  lastError: null,
  lastEventId: null,
  provider: "box",
  status: "active",
  streamPosition: "now",
  workspaceId: 2,
};

describe("SyncCursor entity", () => {
  it("wires SyncCursor to the documents identity", () => {
    expect(SyncCursor.SyncCursor.sql.tableName).toBe(DocumentsIdentity.SyncCursorId.tableName);
    expect(Object.keys(SyncCursor.SyncCursor.insert.fields)).not.toContain("id");
    expect(Object.keys(SyncCursor.SyncCursor.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(SyncCursor.SyncCursor.update.fields)).toContain("id");
    expect(Object.keys(SyncCursor.SyncCursor.update.fields)).toContain("rowVersion");
    expect(Object.keys(SyncCursor.SyncCursor.jsonCreate.fields)).toEqual([
      "lastError",
      "lastEventId",
      "provider",
      "status",
      "streamPosition",
      "workspaceId",
    ]);
  });

  it.effect("decodes and encodes a fresh cursor row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncCursor(freshCursorRow);

      expect(decoded).toBeInstanceOf(SyncCursor.SyncCursor);
      expect(decoded.lastEventId).toEqual(O.none());
      expect(decoded.lastError).toEqual(O.none());
      expect(decoded.status).toBe("active");
      expect(yield* encodeSyncCursor(decoded)).toStrictEqual(freshCursorRow);
    })
  );

  it.effect("decodes advanced cursors with recorded event and error state", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncCursor({
        ...freshCursorRow,
        lastError: "box stream returned 429",
        lastEventId: "evt-9",
        status: "error",
        streamPosition: "1746000000000",
      });

      expect(decoded.lastEventId).toEqual(O.some("evt-9"));
      expect(decoded.lastError).toEqual(O.some("box stream returned 429"));
      expect(decoded.status).toBe("error");
    })
  );

  it.effect("exposes the SyncCursorStatus literal family", () =>
    Effect.gen(function* () {
      expect(SyncCursor.SyncCursorStatus.is.active("active")).toBe(true);
      expect(SyncCursor.SyncCursorStatus.is.error("active")).toBe(false);
      expect(SyncCursor.SyncCursorStatus.Enum.error).toBe("error");
      const statusExit = yield* Effect.exit(decodeUnknownSyncCursorStatus("paused"));
      expect(Exit.isFailure(statusExit)).toBe(true);
    })
  );

  it("round-trips schema-derived sync cursor values", () => {
    assertSchemaArbitraryRoundTrip(SyncCursor.SyncCursorStatus);
    assertSchemaArbitraryRoundTrip(SyncCursor.SyncCursor);
  });
});
