import * as SyncConflict from "@beep/documents-domain/entities/SyncConflict";
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

const decodeUnknownSyncConflict = S.decodeUnknownEffect(SyncConflict.SyncConflict);
const decodeUnknownSyncConflictKind = S.decodeUnknownEffect(SyncConflict.SyncConflictKind);
const decodeUnknownSyncConflictResolution = S.decodeUnknownEffect(SyncConflict.SyncConflictResolution);
const encodeSyncConflict = S.encodeEffect(SyncConflict.SyncConflict);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
};

const mappedDriftRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncConflictId.entityType, 1),
  conflictKind: "remoteEdit",
  localRelPath: "matters/client-default/complaint.pdf",
  provider: "box",
  remoteEventId: "evt-1",
  remoteId: "9001",
  remotePayload: { eventType: "ITEM_MODIFY", itemId: "9001" },
  resolutionStatus: "open",
  syncItemId: 1,
  workspaceId: 2,
};

describe("SyncConflict entity", () => {
  it("wires SyncConflict to the documents identity", () => {
    expect(SyncConflict.SyncConflict.sql.tableName).toBe(DocumentsIdentity.SyncConflictId.tableName);
    expect(Object.keys(SyncConflict.SyncConflict.insert.fields)).not.toContain("id");
    expect(Object.keys(SyncConflict.SyncConflict.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(SyncConflict.SyncConflict.update.fields)).toContain("id");
    expect(Object.keys(SyncConflict.SyncConflict.update.fields)).toContain("rowVersion");
    expect(Object.keys(SyncConflict.SyncConflict.jsonCreate.fields)).toEqual([
      "conflictKind",
      "localRelPath",
      "provider",
      "remoteEventId",
      "remoteId",
      "remotePayload",
      "resolutionStatus",
      "syncItemId",
      "workspaceId",
    ]);
  });

  it.effect("decodes and encodes a locally mapped drift row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncConflict(mappedDriftRow);

      expect(decoded).toBeInstanceOf(SyncConflict.SyncConflict);
      assertSome<number>(decoded.syncItemId, 1);
      assertSome<string>(decoded.remoteId, "9001");
      assertSome<string>(decoded.remoteEventId, "evt-1");
      assertSome<string>(decoded.localRelPath, "matters/client-default/complaint.pdf");
      expect(decoded.remotePayload).toEqual({ eventType: "ITEM_MODIFY", itemId: "9001" });
      expect(yield* encodeSyncConflict(decoded)).toStrictEqual(mappedDriftRow);
    })
  );

  it.effect("decodes drift for remote items unknown locally as none", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncConflict({
        ...mappedDriftRow,
        conflictKind: "remoteCreate",
        localRelPath: null,
        remoteEventId: null,
        remoteId: null,
        syncItemId: null,
      });

      assertNone(decoded.syncItemId);
      assertNone(decoded.remoteId);
      assertNone(decoded.remoteEventId);
      assertNone(decoded.localRelPath);
    })
  );

  it.effect("exposes the conflict literal families", () =>
    Effect.gen(function* () {
      pipe(SyncConflict.SyncConflictKind.is.remoteEdit("remoteEdit"), assertTrue);
      pipe(SyncConflict.SyncConflictKind.is.remoteDelete("remoteEdit"), assertFalse);
      pipe(SyncConflict.SyncConflictResolution.is.open("open"), assertTrue);
      expect(SyncConflict.SyncConflictResolution.Enum.reviewed).toBe("reviewed");
      const kindExit = yield* Effect.exit(decodeUnknownSyncConflictKind("localEdit"));
      const resolutionExit = yield* Effect.exit(decodeUnknownSyncConflictResolution("dismissed"));
      pipe(kindExit, Exit.isFailure, assertTrue);
      pipe(resolutionExit, Exit.isFailure, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived sync conflict values",
    [
      Arbitrary.schema(SyncConflict.SyncConflictKind),
      Arbitrary.schema(SyncConflict.SyncConflictResolution),
      Arbitrary.schema(SyncConflict.SyncConflict),
    ],
    ([syncConflictKind, syncConflictResolution, syncConflict]) => {
      assertSchemaRoundTrip(SyncConflict.SyncConflictKind, syncConflictKind);
      assertSchemaRoundTrip(SyncConflict.SyncConflictResolution, syncConflictResolution);
      assertSchemaRoundTrip(SyncConflict.SyncConflict, syncConflict);
    },
    { arbitrary: fcRuns(10) }
  );
});
