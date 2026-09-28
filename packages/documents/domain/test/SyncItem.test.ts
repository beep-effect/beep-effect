import * as SyncItem from "@beep/documents-domain/entities/SyncItem";
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

const decodeUnknownSyncItem = S.decodeUnknownEffect(SyncItem.SyncItem);
const decodeUnknownSyncItemState = S.decodeUnknownEffect(SyncItem.SyncItemState);
const encodeSyncItem = S.encodeEffect(SyncItem.SyncItem);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
};

const fileRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncItemId.entityType, 1),
  contentDigest: "abc123",
  contentSizeBytes: 2048,
  itemKind: "file",
  lastError: null,
  lastPushedDigest: "abc122",
  lastPushedGeneration: 3,
  localGeneration: 4,
  localRelPath: "matters/client-default/complaint.pdf",
  provider: "box",
  remoteId: "9001",
  remoteName: "complaint.pdf",
  remoteParentId: "9000",
  syncState: "pending",
  workspaceId: 2,
};

describe("SyncItem entity", () => {
  it("wires SyncItem to the documents identity", () => {
    expect(SyncItem.SyncItem.sql.tableName).toBe(DocumentsIdentity.SyncItemId.tableName);
    expect(Object.keys(SyncItem.SyncItem.insert.fields)).not.toContain("id");
    expect(Object.keys(SyncItem.SyncItem.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(SyncItem.SyncItem.update.fields)).toContain("id");
    expect(Object.keys(SyncItem.SyncItem.update.fields)).toContain("rowVersion");
    expect(Object.keys(SyncItem.SyncItem.jsonCreate.fields)).toHaveLength(14);
    expect(Object.keys(SyncItem.SyncItem.jsonUpdate.fields)).toHaveLength(14);
  });

  it.effect("decodes and encodes a full file row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncItem(fileRow);

      expect(decoded).toBeInstanceOf(SyncItem.SyncItem);
      assertSome<string>(decoded.contentDigest, "abc123");
      assertSome<number>(decoded.contentSizeBytes, 2048);
      assertSome<string>(decoded.remoteId, "9001");
      assertNone(decoded.lastError);
      expect(decoded.syncState).toBe("pending");
      expect(yield* encodeSyncItem(decoded)).toStrictEqual(fileRow);
    })
  );

  it.effect("decodes folder rows with null content and remote fields as none", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSyncItem({
        ...fileRow,
        contentDigest: null,
        contentSizeBytes: null,
        itemKind: "folder",
        lastPushedDigest: null,
        lastPushedGeneration: null,
        localRelPath: "matters/client-default",
        remoteId: null,
        remoteName: null,
        remoteParentId: null,
      });

      assertNone(decoded.contentDigest);
      assertNone(decoded.contentSizeBytes);
      assertNone(decoded.lastPushedDigest);
      assertNone(decoded.lastPushedGeneration);
      assertNone(decoded.remoteId);
      assertNone(decoded.remoteName);
      assertNone(decoded.remoteParentId);
    })
  );

  it.effect("exposes the SyncItemState literal family", () =>
    Effect.gen(function* () {
      pipe(SyncItem.SyncItemState.is.pending("pending"), assertTrue);
      pipe(SyncItem.SyncItemState.is.conflict("pending"), assertFalse);
      expect(SyncItem.SyncItemState.Enum.current).toBe("current");
      const stateExit = yield* Effect.exit(decodeUnknownSyncItemState("unknown"));
      const rowExit = yield* Effect.exit(decodeUnknownSyncItem({ ...fileRow, syncState: "unknown" }));
      pipe(stateExit, Exit.isFailure, assertTrue);
      pipe(rowExit, Exit.isFailure, assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived sync item values",
    [Arbitrary.schema(SyncItem.SyncItemState), Arbitrary.schema(SyncItem.SyncItem)],
    ([syncItemState, syncItem]) => {
      assertSchemaRoundTrip(SyncItem.SyncItemState, syncItemState);
      assertSchemaRoundTrip(SyncItem.SyncItem, syncItem);
    },
    { arbitrary: fcRuns(10) }
  );
});
