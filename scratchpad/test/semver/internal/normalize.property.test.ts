import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { normalizeSets } from "../../../effected/semver/internal/normalize.ts";
import { ComparatorParts, VersionParts, compareParts } from "../../../effected/semver/internal/order.ts";

const runs = { arbitrary: fcRuns(100) };
const Component = S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 }));
const Version = VersionParts.mapFields((fields) => ({ ...fields, major: Component, minor: Component, patch: Component, prerelease: S.Array(S.Union([Component, S.Literals(["alpha", "beta", "rc"])])), build: S.Array(S.String) }));
const Comparator = ComparatorParts.mapFields((fields) => ({ ...fields, version: Version }));

describe("normalization properties", () => {
  it.effect.prop("normalization is idempotent and preserves each branch's semantic constraints", [Comparator.pipe(S.Array, S.Array, Arbitrary.schema)], ([sets]) => Effect.sync(() => {
    const normalized = normalizeSets(sets);
    assert.deepStrictEqual(normalizeSets(normalized), normalized);
    assert.strictEqual(normalized.length, sets.length);
    A.forEach(sets, (original, index) => {
      const result = A.getUnsafe(normalized, index);
      for (const constraint of original) {
        assert.strictEqual(A.some(result, (candidate) => candidate.operator === constraint.operator && compareParts(candidate.version, constraint.version) === 0), true);
      }
      for (const constraint of result) {
        assert.strictEqual(A.some(original, (candidate) => candidate === constraint), true);
        assert.strictEqual(A.filter(result, (candidate) => candidate.operator === constraint.operator && compareParts(candidate.version, constraint.version) === 0).length, 1);
      }
    });
  }), runs);

  it.effect.prop("metadata duplicates preserve the first occurrence and remain independent across OR branches", [Arbitrary.schema(Comparator), S.String.pipe(S.Array, Arbitrary.schema)], ([constraint, build]) => Effect.sync(() => {
    const duplicate = { ...constraint, version: { ...constraint.version, build } };
    assert.deepStrictEqual(normalizeSets([[constraint, duplicate], [duplicate, constraint]]), [[constraint], [duplicate]]);
  }), runs);
});
