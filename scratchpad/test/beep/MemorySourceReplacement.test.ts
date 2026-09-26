import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AwareUtcTimestamp, ConversationSourceReplacementReceipt } from "../../beep/MemorySourceReplacement.ts";

const encodeAwareUtcTimestamp = S.encodeEffect(AwareUtcTimestamp);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const wire = {
  replacementId: "replacement-1",
  replacementDigest: "sha256:abc",
  uid: "user-1",
  conversationId: "conversation-1",
  operationId: "operation-1",
  controlState: { head_commit_id: "commit-1", writer_mode: "canonical" },
  retractedMemoryIds: ["m-1"],
  committedMemoryIds: ["m-2", "m-3"],
  reactivatedMemoryIds: [],
  tombstonedEvidenceIds: ["e-1"],
  committedAt: "2026-09-22T10:00:00+02:00",
};

describe("AwareUtcTimestamp", () => {
  it("coerces an aware instant to UTC and rejects a naive one", () => {
    const decoded = decode(AwareUtcTimestamp, "2026-09-22T10:00:00+02:00");
    assert.strictEqual(DateTime.formatIso(decoded), "2026-09-22T08:00:00.000Z");
    assert.strictEqual(
      DateTime.toEpochMillis(decode(AwareUtcTimestamp, "2026-09-22T08:00:00.250Z")),
      DateTime.toEpochMillis(decoded) + 250,
    );
    assert.strictEqual(decodeFails(AwareUtcTimestamp, "2026-09-22T10:00:00"), true);
    assert.strictEqual(decodeFails(AwareUtcTimestamp, "not a date"), true);
    assert.strictEqual(decoded.pipe(encodeAwareUtcTimestamp, Effect.runSync), "2026-09-22T08:00:00.000Z");
  });
});

describe("ConversationSourceReplacementReceipt", () => {
  it("decodes a full receipt with the commit instant in UTC", () => {
    const receipt = decode(ConversationSourceReplacementReceipt, wire);
    assert.strictEqual(receipt.replacementId, "replacement-1");
    assert.deepStrictEqual(receipt.committedMemoryIds, ["m-2", "m-3"]);
    assert.deepStrictEqual(receipt.controlState, { head_commit_id: "commit-1", writer_mode: "canonical" });
    assert.strictEqual(DateTime.formatIso(receipt.committedAt), "2026-09-22T08:00:00.000Z");
  });

  it("defaults the id lists to empty and committedAt to now on construction", () => {
    const before = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const receipt = ConversationSourceReplacementReceipt.make({
      replacementId: "replacement-2",
      replacementDigest: "digest",
      uid: "user-1",
      conversationId: "conversation-1",
      operationId: "operation-2",
      controlState: {},
    });
    assert.deepStrictEqual(receipt.retractedMemoryIds, []);
    assert.deepStrictEqual(receipt.committedMemoryIds, []);
    assert.deepStrictEqual(receipt.reactivatedMemoryIds, []);
    assert.deepStrictEqual(receipt.tombstonedEvidenceIds, []);
    assert.strictEqual(DateTime.toEpochMillis(receipt.committedAt) >= before, true);
  });

  it("rejects blank identifiers and naive timestamps", () => {
    for (const key of ["replacementId", "replacementDigest", "uid", "conversationId", "operationId"]) {
      assert.strictEqual(decodeFails(ConversationSourceReplacementReceipt, { ...wire, [key]: "" }), true);
      assert.strictEqual(decodeFails(ConversationSourceReplacementReceipt, { ...wire, [key]: "   " }), true);
    }
    assert.strictEqual(
      decodeFails(ConversationSourceReplacementReceipt, { ...wire, committedAt: "2026-09-22T10:00:00" }),
      true,
    );
    assert.strictEqual(decodeFails(ConversationSourceReplacementReceipt, { ...wire, controlState: null }), true);
  });

  it("derives arbitraries", () => {
    assert.isDefined(Arbitrary.schema(AwareUtcTimestamp));
    assert.isDefined(Arbitrary.schema(ConversationSourceReplacementReceipt));
  });
});
