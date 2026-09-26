import * as SyncConflict from "@beep/documents-domain/entities/SyncConflict";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownSyncConflict = S.decodeUnknownEffect(SyncConflict.SyncConflict);
const decodeUnknownSyncConflictKind = S.decodeUnknownEffect(SyncConflict.SyncConflictKind);
const decodeUnknownSyncConflictResolution = S.decodeUnknownEffect(SyncConflict.SyncConflictResolution);
const encodeSyncConflict = S.encodeEffect(SyncConflict.SyncConflict);

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
      expect(decoded.syncItemId).toEqual(O.some(1));
      expect(decoded.remoteId).toEqual(O.some("9001"));
      expect(decoded.remoteEventId).toEqual(O.some("evt-1"));
      expect(decoded.localRelPath).toEqual(O.some("matters/client-default/complaint.pdf"));
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

      expect(decoded.syncItemId).toEqual(O.none());
      expect(decoded.remoteId).toEqual(O.none());
      expect(decoded.remoteEventId).toEqual(O.none());
      expect(decoded.localRelPath).toEqual(O.none());
    })
  );

  it.effect("exposes the conflict literal families", () =>
    Effect.gen(function* () {
      expect(SyncConflict.SyncConflictKind.is.remoteEdit("remoteEdit")).toBe(true);
      expect(SyncConflict.SyncConflictKind.is.remoteDelete("remoteEdit")).toBe(false);
      expect(SyncConflict.SyncConflictResolution.is.open("open")).toBe(true);
      expect(SyncConflict.SyncConflictResolution.Enum.reviewed).toBe("reviewed");
      const kindExit = yield* Effect.exit(decodeUnknownSyncConflictKind("localEdit"));
      const resolutionExit = yield* Effect.exit(decodeUnknownSyncConflictResolution("dismissed"));
      expect(Exit.isFailure(kindExit)).toBe(true);
      expect(Exit.isFailure(resolutionExit)).toBe(true);
    })
  );

  it("round-trips schema-derived sync conflict values", () => {
    assertSchemaArbitraryRoundTrip(SyncConflict.SyncConflictKind);
    assertSchemaArbitraryRoundTrip(SyncConflict.SyncConflictResolution);
    assertSchemaArbitraryRoundTrip(SyncConflict.SyncConflict);
  });
});
