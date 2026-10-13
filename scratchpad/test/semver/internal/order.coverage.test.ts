import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { compareBuild, compareParts, comparePrereleaseIdentifier, VersionParts, ComparatorParts } from "../../../effected/semver/internal/order.ts";

const version = (major = 1, minor = 2, patch = 3, prerelease: ReadonlyArray<string | number> = [], build: ReadonlyArray<string> = []): VersionParts =>
  ({ major, minor, patch, prerelease, build });

describe("internal order branch coverage", () => {
  it.effect("identifier ordering is numeric, lexical, and numeric-before-text in both call forms", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [string | number, string | number, number]> = [
      [2, 10, -8], [10, 2, 8], [2, 2, 0], ["alpha", "beta", -1], ["beta", "alpha", 1],
      ["alpha", "alpha", 0], [1, "alpha", -1], ["alpha", 1, 1],
    ];
    for (const [a, b, expected] of cases) {
      assert.strictEqual(comparePrereleaseIdentifier(a, b), expected);
      assert.strictEqual(comparePrereleaseIdentifier(b)(a), expected);
    }
  }));

  it.effect("core components, release status, identifier precedence and prefix length determine version order", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [VersionParts, VersionParts, -1 | 0 | 1]> = [
      [version(0), version(), -1], [version(2), version(), 1],
      [version(1, 1), version(), -1], [version(1, 3), version(), 1],
      [version(1, 2, 2), version(), -1], [version(1, 2, 4), version(), 1],
      [version(), version(1, 2, 3, [], ["ignored"]), 0],
      [version(), version(1, 2, 3, ["alpha"]), 1], [version(1, 2, 3, ["alpha"]), version(), -1],
      [version(1, 2, 3, ["alpha", 1]), version(1, 2, 3, ["alpha", 2]), -1],
      [version(1, 2, 3, ["beta"]), version(1, 2, 3, ["alpha"]), 1],
      [version(1, 2, 3, ["alpha"]), version(1, 2, 3, ["alpha", 1]), -1],
      [version(1, 2, 3, ["alpha", 1]), version(1, 2, 3, ["alpha"]), 1],
      [version(1, 2, 3, ["alpha", 1], ["first"]), version(1, 2, 3, ["alpha", 1], ["second"]), 0],
    ];
    for (const [a, b, expected] of cases) {
      assert.strictEqual(compareParts(a, b), expected);
      assert.strictEqual(compareParts(b)(a), expected);
    }
  }));

  it.effect("build ordering handles absent metadata, lexical differences and equal prefixes", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [ReadonlyArray<string>, ReadonlyArray<string>, -1 | 0 | 1]> = [
      [[], [], 0], [[], ["a"], -1], [["a"], [], 1],
      [["10"], ["2"], -1], [["b"], ["a"], 1], [["a"], ["a"], 0],
      [["a"], ["a", "1"], -1], [["a", "1"], ["a"], 1],
      [["a", "1"], ["a", "2"], -1],
    ];
    for (const [a, b, expected] of cases) {
      assert.strictEqual(compareBuild(a, b), expected);
      assert.strictEqual(compareBuild(b)(a), expected);
    }
  }));
});


describe("structural order schemas", () => {
  it.effect("VersionParts and ComparatorParts preserve plain numeric intermediate records and codec fidelity", () => Effect.gen(function* () {
    const parts = version(-1, 1.5, Number.MAX_SAFE_INTEGER + 1, ["alpha", 0], ["001"]);
    assert.strictEqual(S.is(VersionParts)(parts), true);
    const decoded = yield* S.decodeEffect(VersionParts)(parts);
    assert.deepStrictEqual(decoded, parts);
    assert.deepStrictEqual(yield* S.encodeEffect(VersionParts)(decoded), parts);
    const comparator = { operator: ">=" as const, version: parts };
    assert.strictEqual(S.is(ComparatorParts)(comparator), true);
    const bound = yield* S.decodeEffect(ComparatorParts)(comparator);
    assert.deepStrictEqual(bound, comparator);
    assert.deepStrictEqual(yield* S.encodeEffect(ComparatorParts)(bound), comparator);
    assert.strictEqual(S.is(VersionParts)({ ...parts, minor: null }), false);
    assert.strictEqual(S.is(ComparatorParts)({ ...comparator, operator: "~" }), false);
  }));

  it.effect("both structural schemas and every field carry identity and descriptive metadata", () => Effect.sync(() => {
    assert.strictEqual(VersionParts.ast.annotations?.identifier, "@beep/scratchpad/effected/semver/internal/order/VersionParts");
    assert.strictEqual(ComparatorParts.ast.annotations?.identifier, "@beep/scratchpad/effected/semver/internal/order/ComparatorParts");
    assert.isString(VersionParts.ast.annotations?.description);
    assert.isString(ComparatorParts.ast.annotations?.description);
    for (const field of [VersionParts.fields.major, VersionParts.fields.minor, VersionParts.fields.patch, VersionParts.fields.prerelease, VersionParts.fields.build, ComparatorParts.fields.operator, ComparatorParts.fields.version]) {
      assert.isString(field.ast.context?.annotations?.description);
    }
  }));
});
