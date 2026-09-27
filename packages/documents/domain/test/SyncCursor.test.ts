import * as SyncCursor from "@beep/documents-domain/entities/SyncCursor";
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

const decodeUnknownSyncCursor = S.decodeUnknownEffect(SyncCursor.SyncCursor);
const decodeUnknownSyncCursorStatus = S.decodeUnknownEffect(SyncCursor.SyncCursorStatus);
const encodeSyncCursor = S.encodeEffect(SyncCursor.SyncCursor);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
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
      assertNone(decoded.lastEventId);
      assertNone(decoded.lastError);
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

      assertSome<string>(decoded.lastEventId, "evt-9");
      assertSome<string>(decoded.lastError, "box stream returned 429");
      expect(decoded.status).toBe("error");
    })
  );

  it.effect("exposes the SyncCursorStatus literal family", () =>
    Effect.gen(function* () {
      pipe(SyncCursor.SyncCursorStatus.is.active("active"), assertTrue);
      pipe(SyncCursor.SyncCursorStatus.is.error("active"), assertFalse);
      expect(SyncCursor.SyncCursorStatus.Enum.error).toBe("error");
      const statusExit = yield* Effect.exit(decodeUnknownSyncCursorStatus("paused"));
      pipe(statusExit, Exit.isFailure, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived sync cursor values",
    [Arbitrary.schema(SyncCursor.SyncCursorStatus), Arbitrary.schema(SyncCursor.SyncCursor)],
    ([syncCursorStatus, syncCursor]) => {
      assertSchemaRoundTrip(SyncCursor.SyncCursorStatus, syncCursorStatus);
      assertSchemaRoundTrip(SyncCursor.SyncCursor, syncCursor);
    },
    { arbitrary: fcRuns(10) }
  );
});
