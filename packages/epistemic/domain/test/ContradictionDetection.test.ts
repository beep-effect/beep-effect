import { BeliefVersionRef } from "@beep/epistemic-domain/values/Contradiction";
import {
  ConflictClass,
  ContradictionDetectionSnapshot,
  canonicalDetectionJson,
  DetectionBelief,
  DetectionPolarity,
  detectionProposalId,
} from "@beep/epistemic-domain/values/ContradictionDetection";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const belief = {
  ref: { edgeVersionId: 1, logicalKey: Str.repeat(64)("a"), version: 1 },
  subject: "synthetic",
  predicate: "status",
  value: "A",
  polarity: "asserted",
  evidenceIds: [1],
  validFrom: 0,
  validTo: null,
};
const decode = S.decodeUnknownResult(DetectionBelief);
describe("Detection input bounds and content identities", () => {
  it.prop(
    "round-trips bounded values with either polarity",
    [Arbitrary.schema(S.String.check(S.isMaxLength(32))), Arbitrary.schema(DetectionPolarity)],
    ([value, polarity]) => {
      const original = Result.getOrThrow(decode({ ...belief, value, polarity }));
      const encoded = Result.getOrThrow(S.encodeResult(DetectionBelief)(original));
      const restored = Result.getOrThrow(S.decodeResult(DetectionBelief)(encoded));
      expect(S.toEquivalence(DetectionBelief)(original, restored)).toBe(true);
    }
  );
  it("retains only the supported class and polarity vocabulary", () => {
    expect(ConflictClass.literals).toEqual(["exact-negation", "value-conflict"]);
    expect(DetectionPolarity.literals).toEqual(["asserted", "negated"]);
  });
  it("rejects invalid evidence, intervals, polarity and proposal bounds", () => {
    for (const bad of [
      { ...belief, evidenceIds: [] },
      { ...belief, evidenceIds: [1, 1] },
      { ...belief, evidenceIds: A.range(1, 33) },
      { ...belief, validTo: 0 },
      { ...belief, validTo: -1 },
      { ...belief, polarity: "unknown" },
      { ...belief, subject: "" },
      { ...belief, value: Str.repeat(65536)("x") },
    ])
      decode(bad).pipe(Result.isFailure, assertTrue);
    decode(belief).pipe(Result.isSuccess, assertTrue);
  });
  it("rejects repeated immutable refs", () => {
    S.decodeUnknownResult(ContradictionDetectionSnapshot)({
      beliefs: [belief, belief],
      singleValuedPredicates: [],
    }).pipe(Result.isFailure, assertTrue);
  });
  it("canonicalizes JSON keys and hashes losing ref plus whole assertion", () => {
    expect(canonicalDetectionJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    const ref = Result.getOrThrow(S.decodeResult(BeliefVersionRef)(belief.ref));
    const fact = { subject: "synthetic", predicate: "status", value: "A", polarity: "asserted" };
    const id = Result.getOrThrow(detectionProposalId(ref, fact));
    expect(Result.getOrThrow(detectionProposalId(fact)(ref))).toBe(id);
    expect(Result.getOrThrow(detectionProposalId(ref, { ...fact, polarity: "negated" }))).not.toBe(id);
  });
});
