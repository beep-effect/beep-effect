import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { MemoryReviewConflict, MemoryReviewRejected, buildMemoryReviewConflict } from "../../beep/MemoryReview.ts";

const encodeMemoryReviewConflict = S.encodeEffect(MemoryReviewConflict);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const rejectionReason = (effect: Effect.Effect<unknown, MemoryReviewRejected>): string =>
  Effect.runSync(Effect.match(effect, { onFailure: (error) => error.reason, onSuccess: () => "accepted" }));

const now = "2026-09-22T10:00:00+02:00";

const fact = { id: "fact-1", content: "Ada lives in Seattle", importance: 0.9, veracity: "likely" };

const wire = {
  reviewId: "review:fact-1:m-2",
  factId: "fact-1",
  candidate: fact,
  conflictWith: ["m-2"],
  veracity: "likely",
  impact: 0.9,
  status: "pending",
  sourceCommitId: null,
  sourceShortTermId: null,
  createdAt: "2026-09-22T08:00:00.000Z",
  updatedAt: "2026-09-22T08:00:00.000Z",
  expiresAt: "2026-09-25T08:00:00.000Z",
  permittedUses: ["answers_with_disclaimer"],
  referencedMemoryIds: ["fact-1", "m-2"],
};

describe("MemoryReviewConflict", () => {
  it("decodes a stored conflict with null-only and omittable optionals", () => {
    const conflict = decode(MemoryReviewConflict, wire);
    assert.strictEqual(conflict.status, "pending");
    assert.strictEqual(O.getOrNull(conflict.veracity), "likely");
    assert.strictEqual(O.isNone(conflict.sourceCommitId), true);
    assert.strictEqual(O.isNone(conflict.authority), true);
    assert.strictEqual(O.isNone(conflict.sourceItemRevision), true);
    assert.strictEqual(O.isNone(conflict.sourceContentHash), true);
    const withAuthority = decode(MemoryReviewConflict, {
      ...wire,
      authority: "canonical_memory",
      sourceItemRevision: 3,
      sourceContentHash: null,
    });
    assert.strictEqual(O.getOrNull(withAuthority.authority), "canonical_memory");
    assert.strictEqual(O.getOrNull(withAuthority.sourceItemRevision), 3);
    assert.strictEqual(O.isNone(withAuthority.sourceContentHash), true);
    const encoded = Effect.runSync(encodeMemoryReviewConflict(conflict));
    assert.strictEqual(encoded.authority, null);
    assert.strictEqual(encoded.sourceCommitId, null);
    assert.strictEqual(encoded.veracity, "likely");
  });

  it("rejects a non-pending status, a missing null-only key, and a foreign permitted use", () => {
    assert.strictEqual(decodeFails(MemoryReviewConflict, { ...wire, status: "resolved" }), true);
    const { sourceCommitId: _dropped, ...withoutSourceCommit } = wire;
    assert.strictEqual(decodeFails(MemoryReviewConflict, withoutSourceCommit), true);
    assert.strictEqual(decodeFails(MemoryReviewConflict, { ...wire, permittedUses: ["answers"] }), true);
  });

  it("derives arbitraries", () => {
    assert.isDefined(Arbitrary.schema(MemoryReviewConflict));
    assert.isDefined(Arbitrary.schema(MemoryReviewRejected));
  });
});

describe("buildMemoryReviewConflict", () => {
  it("builds a deterministic pending conflict from a fact", () => {
    const conflict = Effect.runSync(
      buildMemoryReviewConflict({ fact, conflictWith: [" m-9 ", "m-2", "m-2", ""], now }),
    );
    assert.strictEqual(conflict.reviewId, "review:fact-1:m-2,m-9");
    assert.strictEqual(conflict.factId, "fact-1");
    assert.deepStrictEqual(conflict.conflictWith, ["m-2", "m-9"]);
    assert.deepStrictEqual(conflict.referencedMemoryIds, ["fact-1", "m-2", "m-9"]);
    assert.strictEqual(conflict.impact, 0.9);
    assert.strictEqual(O.getOrNull(conflict.veracity), "likely");
    assert.strictEqual(O.isNone(conflict.authority), true);
    assert.strictEqual(O.isNone(conflict.sourceShortTermId), true);
    assert.strictEqual(DateTime.formatIso(conflict.createdAt), "2026-09-22T08:00:00.000Z");
    assert.strictEqual(DateTime.formatIso(conflict.expiresAt), "2026-09-25T08:00:00.000Z");
    assert.deepStrictEqual(conflict.permittedUses, ["answers_with_disclaimer"]);
    assert.deepStrictEqual(conflict.candidate, fact);
  });

  it("falls back to 0.5 impact and none veracity, honours ttl and explicit impact", () => {
    const bare = Effect.runSync(buildMemoryReviewConflict({ fact: { id: 7 }, conflictWith: [], now, ttlHours: 1 }));
    assert.strictEqual(bare.factId, "7");
    assert.strictEqual(bare.impact, 0.5);
    assert.strictEqual(O.isNone(bare.veracity), true);
    assert.strictEqual(bare.reviewId, "review:7:");
    assert.strictEqual(DateTime.formatIso(bare.expiresAt), "2026-09-22T09:00:00.000Z");
    const explicit = Effect.runSync(
      buildMemoryReviewConflict({
        fact: { id: true, veracity: { score: 1 } },
        conflictWith: ["m-1"],
        impact: 0.2,
        sourceShortTermId: "st-1",
        now: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
      }),
    );
    assert.strictEqual(explicit.factId, "True");
    assert.strictEqual(explicit.impact, 0.2);
    assert.strictEqual(O.getOrNull(explicit.veracity), '{"score":1}');
    assert.strictEqual(O.getOrNull(explicit.sourceShortTermId), "st-1");
    assert.strictEqual(DateTime.formatIso(explicit.createdAt), "2026-01-01T00:00:00.000Z");
  });

  it("carries the canonical source binding into the review id", () => {
    const conflict = Effect.runSync(
      buildMemoryReviewConflict({
        fact,
        conflictWith: ["m-2"],
        authority: "canonical_memory",
        sourceCommitId: "commit-1",
        sourceItemRevision: 4,
        sourceContentHash: "hash-1",
        now,
      }),
    );
    assert.strictEqual(conflict.reviewId, "review:fact-1:r4:m-2");
    assert.strictEqual(O.getOrNull(conflict.authority), "canonical_memory");
    assert.strictEqual(O.getOrNull(conflict.sourceCommitId), "commit-1");
    assert.strictEqual(O.getOrNull(conflict.sourceItemRevision), 4);
    assert.strictEqual(O.getOrNull(conflict.sourceContentHash), "hash-1");
  });

  it("rejects a naive timestamp", () => {
    assert.strictEqual(
      rejectionReason(buildMemoryReviewConflict({ fact, conflictWith: [], now: "2026-09-22T10:00:00" })),
      "review conflict timestamp must be timezone-aware",
    );
  });

  it("rejects a fact without an id", () => {
    assert.strictEqual(
      rejectionReason(buildMemoryReviewConflict({ fact: { content: "x" }, conflictWith: [], now })),
      "review conflict requires fact.id",
    );
    assert.strictEqual(
      rejectionReason(buildMemoryReviewConflict({ fact: { id: "  " }, conflictWith: [], now })),
      "review conflict requires fact.id",
    );
  });

  it("rejects a canonical review without an exact source binding", () => {
    const canonical = { fact, conflictWith: ["m-2"], authority: "canonical_memory", now };
    const reason = "canonical review requires an exact source commit, revision, and content hash";
    assert.strictEqual(rejectionReason(buildMemoryReviewConflict(canonical)), reason);
    assert.strictEqual(
      rejectionReason(
        buildMemoryReviewConflict({ ...canonical, sourceCommitId: "c", sourceItemRevision: 0, sourceContentHash: "h" }),
      ),
      reason,
    );
    assert.strictEqual(
      rejectionReason(
        buildMemoryReviewConflict({ ...canonical, sourceCommitId: "c", sourceItemRevision: 1, sourceContentHash: "" }),
      ),
      reason,
    );
  });
});
