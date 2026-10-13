import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Comparator } from "../../effected/semver/Comparator.ts";
import { Range, InvalidRangeError, UnsatisfiableConstraintError } from "../../effected/semver/Range.ts";
import { SemVer } from "../../effected/semver/SemVer.ts";

describe("Range coverage boundaries", () => {
  it.effect("reports position-free and singular errors, invalid decoding, empty extrema and inspection", () => Effect.gen(function* () {
    assert.strictEqual(InvalidRangeError.make({ input: "bad" }).message, 'Invalid range expression: "bad"');
    assertFailure(yield* Effect.result(S.decodeEffect(Range.FromString)("bad").pipe(Effect.mapError((error) => error._tag))), "SchemaError");
    const range = yield* Range.parse(">=1.0.0");
    assert.strictEqual(inspect(range), ">=1.0.0");
    assert.strictEqual(UnsatisfiableConstraintError.make({ constraints: [range] }).message, "No version satisfies all 1 constraint");
    assertNone(Range.minSatisfying([], range));
    const empty = Range.make({ sets: [] });
    assert.strictEqual(Range.simplify(empty), empty);
  }));

  it.effect("subset implication covers strict upper bounds and exact equality", () => Effect.gen(function* () {
    const cases = [
      [">1.0.0", ">1.0.0", true],
      [">=2.0.0", ">1.0.0", true],
      ["2.0.0", ">1.0.0", true],
      ["<2.0.0", ">1.0.0", false],
      ["<=2.0.0", ">1.0.0", false],
      [">=1.0.0", ">1.0.0", false],
      ["1.0.0", ">1.0.0", false],
      [">0.0.0", ">1.0.0", false],
      ["<1.0.0", "<1.0.0", true],
      ["<=1.0.0", "<=1.0.0", true],
      ["<1.0.0", "<=1.0.0", true],
      ["1.0.0", "<=1.0.0", true],
      [">1.0.0", "<=1.0.0", false],
      [">=1.0.0", "<=1.0.0", false],
      ["2.0.0", "<=1.0.0", false],
      ["<=1.0.0", "<2.0.0", true],
      ["1.0.0", "<2.0.0", true],
      [">1.0.0", "<2.0.0", false],
      [">=1.0.0", "<2.0.0", false],
      ["<=2.0.0", "<2.0.0", false],
      ["1.0.0", "1.0.0", true],
      ["2.0.0", "1.0.0", false],
      [">=1.0.0", "1.0.0", false],
    ] as const;
    for (const [sub, sup, expected] of cases) {
      assert.strictEqual(Range.isSubset(yield* Range.parse(sub), yield* Range.parse(sup)), expected, `${sub} subset ${sup}`);
    }
  }));

  it.effect("stable successor carries across patch and minor and fails at the domain ceiling", () => Effect.gen(function* () {
    const cap = Number.MAX_SAFE_INTEGER;
    const unrestricted = Range.make({ sets: [[]] });
    for (const [lower, witness] of [
      [SemVer.of(1, 0, cap), SemVer.of(1, 1, 0)],
      [SemVer.of(1, cap, cap), SemVer.of(2, 0, 0)],
    ] as const) {
      const range = Range.make({ sets: [[Comparator.make({ operator: ">", version: lower })]] });
      const intersection = yield* Range.intersect(range, unrestricted);
      assert.isTrue(intersection.test(witness));
      assert.isFalse(intersection.test(lower));
    }
    const impossible = Range.make({ sets: [[Comparator.make({ operator: ">", version: SemVer.of(cap, cap, cap) })]] });
    assertFailure(Range.intersectResult(impossible, unrestricted), UnsatisfiableConstraintError.make({ constraints: [impossible, unrestricted] }));
  }));

  it.effect("a stable lower bound cannot supply a prerelease witness on its own tuple", () => Effect.gen(function* () {
    const impossible = yield* Range.parse(">=1.0.0 <1.0.0-rc");
    assert.isTrue(Range.isSubset(impossible, yield* Range.parse("2.0.0")));
    assert.isFalse(impossible.test(SemVer.of(1, 0, 0, [0])));
    const range = yield* Range.parse(">=1.0.0 <2.0.0");
    assertSome(Range.minSatisfying([SemVer.of(1, 1, 0), SemVer.of(1, 0, 0)], range), SemVer.of(1, 0, 0));
  }));
});

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
