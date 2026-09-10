import * as SyncItem from "@beep/documents-domain/entities/SyncItem";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownSyncItemSyncItemSync = S.decodeUnknownSync(SyncItem.SyncItem);
const decodeUnknownSyncItemSyncItemStateSync = S.decodeUnknownSync(SyncItem.SyncItemState);
const encodeSyncItemSyncItemSync = S.encodeSync(SyncItem.SyncItem);

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

  it("decodes and encodes a full file row", () => {
    const decoded = decodeUnknownSyncItemSyncItemSync(fileRow);

    expect(decoded).toBeInstanceOf(SyncItem.SyncItem);
    expect(decoded.contentDigest).toEqual(O.some("abc123"));
    expect(decoded.contentSizeBytes).toEqual(O.some(2048));
    expect(decoded.remoteId).toEqual(O.some("9001"));
    expect(decoded.lastError).toEqual(O.none());
    expect(decoded.syncState).toBe("pending");
    expect(encodeSyncItemSyncItemSync(decoded)).toStrictEqual(fileRow);
  });

  it("decodes folder rows with null content and remote fields as none", () => {
    const decoded = decodeUnknownSyncItemSyncItemSync({
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

    expect(decoded.contentDigest).toEqual(O.none());
    expect(decoded.contentSizeBytes).toEqual(O.none());
    expect(decoded.lastPushedDigest).toEqual(O.none());
    expect(decoded.lastPushedGeneration).toEqual(O.none());
    expect(decoded.remoteId).toEqual(O.none());
    expect(decoded.remoteName).toEqual(O.none());
    expect(decoded.remoteParentId).toEqual(O.none());
  });

  it("exposes the SyncItemState literal family", () => {
    expect(SyncItem.SyncItemState.is.pending("pending")).toBe(true);
    expect(SyncItem.SyncItemState.is.conflict("pending")).toBe(false);
    expect(SyncItem.SyncItemState.Enum.current).toBe("current");
    expect(() => decodeUnknownSyncItemSyncItemStateSync("unknown")).toThrow();
    expect(() => decodeUnknownSyncItemSyncItemSync({ ...fileRow, syncState: "unknown" })).toThrow();
  });

  it("round-trips schema-derived sync item values", () => {
    assertSchemaArbitraryRoundTrip(SyncItem.SyncItemState);
    assertSchemaArbitraryRoundTrip(SyncItem.SyncItem);
  });
});
