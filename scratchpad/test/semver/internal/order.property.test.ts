import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ComparatorOperator, VersionParts, compareBuild, compareParts, comparePrereleaseIdentifier } from "../../../effected/semver/internal/order.ts";

const runs = { arbitrary: fcRuns(100) };
const Component = S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 }));
const Identifier = S.Union([Component, S.String]);
const Version = VersionParts.mapFields((fields) => ({ ...fields, major: Component, minor: Component, patch: Component, prerelease: S.Array(Identifier), build: S.Array(S.String) }));
const sign = (value: number): number => value < 0 ? -1 : value > 0 ? 1 : 0;

describe("order property floor", () => {
  it.effect.prop("ComparatorOperator decodes every encoded operator without failure and preserves it", [Arbitrary.schema(ComparatorOperator)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ComparatorOperator)(value);
    const decoded = yield* S.decodeEffect(ComparatorOperator)(encoded);
    assert.strictEqual(S.toEquivalence(ComparatorOperator)(decoded, value), true);
  }), runs);

  it.effect.prop("version precedence is reflexive, antisymmetric, transitive and ignores build metadata", [Arbitrary.schema(Version), Arbitrary.schema(Version), Arbitrary.schema(Version)], ([a, b, c]) => Effect.sync(() => {
    assert.strictEqual(compareParts(a, a), 0);
    assert.strictEqual(compareParts(a, b) + compareParts(b, a), 0);
    assert.strictEqual(compareParts({ ...a, build: c.build }, b), compareParts(a, b));
    assert.strictEqual(compareParts(b)(a), compareParts(a, b));
    if (compareParts(a, b) <= 0 && compareParts(b, c) <= 0) assert.strictEqual(compareParts(a, c) <= 0, true);
  }), runs);

  it.effect.prop("identifier and build comparisons are reflexive and antisymmetric in both call forms", [Arbitrary.schema(Identifier), Arbitrary.schema(Identifier), S.String.pipe(S.Array, Arbitrary.schema), S.String.pipe(S.Array, Arbitrary.schema)], ([a, b, first, second]) => Effect.sync(() => {
    assert.strictEqual(comparePrereleaseIdentifier(a, a), 0);
    assert.strictEqual(sign(comparePrereleaseIdentifier(a, b)) + sign(comparePrereleaseIdentifier(b, a)), 0);
    assert.strictEqual(comparePrereleaseIdentifier(b)(a), comparePrereleaseIdentifier(a, b));
    assert.strictEqual(compareBuild(first, first), 0);
    assert.strictEqual(compareBuild(first, second) + compareBuild(second, first), 0);
    assert.strictEqual(compareBuild(second)(first), compareBuild(first, second));
  }), runs);
});
