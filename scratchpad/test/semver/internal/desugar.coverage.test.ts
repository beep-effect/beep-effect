import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange, PartialParts } from "../../../effected/semver/internal/desugar.ts";
import { formatComparator } from "../../../effected/semver/internal/grammar.ts";
import type { ComparatorOperator, ComparatorParts } from "../../../effected/semver/internal/order.ts";

const partial = (major: number | null, minor: number | null = null, patch: number | null = null): PartialParts =>
  ({ major, minor, patch, prerelease: [], build: [] });
const print = (parts: ReadonlyArray<ComparatorParts>) => parts.map(formatComparator).join(" ");

describe("desugar coverage", () => {
  it.effect("expands every tilde and caret compatibility boundary", () => Effect.sync(() => {
    const tilde: ReadonlyArray<readonly [PartialParts, string]> = [
      [partial(null), ">=0.0.0"], [partial(1), ">=1.0.0 <2.0.0-0"],
      [partial(1, 2), ">=1.2.0 <1.3.0-0"], [partial(1, 2, 3), ">=1.2.3 <1.3.0-0"],
    ];
    const caret: ReadonlyArray<readonly [PartialParts, string]> = [
      [partial(null), ">=0.0.0"], [partial(1), ">=1.0.0 <2.0.0-0"],
      [partial(0), ">=0.0.0 <1.0.0-0"], [partial(0, 2, 3), ">=0.2.3 <0.3.0-0"],
      [partial(0, 0), ">=0.0.0 <0.1.0-0"], [partial(0, 0, 3), ">=0.0.3 <0.0.4-0"],
      [partial(0, 0, 0), ">=0.0.0 <0.0.1-0"],
    ];
    for (const [input, expected] of tilde) assert.strictEqual(print(desugarTilde(input)), expected);
    for (const [input, expected] of caret) assert.strictEqual(print(desugarCaret(input)), expected);
    const suffix = { ...partial(1, 2, 3), prerelease: ["rc", 1], build: ["build"] };
    assert.strictEqual(print(desugarTilde(suffix)), ">=1.2.3-rc.1 <1.3.0-0");
    assert.strictEqual(print(desugarCaret(suffix)), ">=1.2.3-rc.1 <2.0.0-0");
  }));

  it.effect("expands every operator across full, minor-wildcard and patch-wildcard versions", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [ComparatorOperator | null, string, string, string]> = [
      [null, "1.2.3", ">=1.0.0 <2.0.0-0", ">=1.2.0 <1.3.0-0"],
      ["=", "1.2.3", ">=1.0.0 <2.0.0-0", ">=1.2.0 <1.3.0-0"],
      [">", ">1.2.3", ">=2.0.0", ">=1.3.0"],
      [">=", ">=1.2.3", ">=1.0.0", ">=1.2.0"],
      ["<", "<1.2.3", "<1.0.0-0", "<1.2.0-0"],
      ["<=", "<=1.2.3", "<2.0.0-0", "<1.3.0-0"],
    ];
    for (const [operator, full, minor, patch] of cases) {
      assert.strictEqual(print(desugarXRange(operator, partial(1, 2, 3))), full);
      assert.strictEqual(print(desugarXRange(operator, partial(1))), minor);
      assert.strictEqual(print(desugarXRange(partial(1, 2))(operator)), patch);
      const wildcard = operator === "<" || operator === ">" ? "<0.0.0-0" : ">=0.0.0";
      assert.strictEqual(print(desugarXRange(operator, partial(null))), wildcard);
      assert.strictEqual(print(desugarXRange(partial(null))(operator)), wildcard);
    }
    assert.strictEqual(print(desugarXRange(null, { ...partial(1, 2, 3), prerelease: ["rc", 1], build: ["007"] })), "1.2.3-rc.1+007");
  }));

  it.effect("expands full and partial hyphen bounds, preserving prereleases and dropping builds", () => Effect.sync(() => {
    const bounds: ReadonlyArray<readonly [PartialParts, string]> = [
      [partial(2, 3, 4), ">=1.2.3 <=2.3.4"], [partial(2, 3), ">=1.2.3 <2.4.0-0"],
      [partial(2), ">=1.2.3 <3.0.0-0"], [partial(null), ">=1.2.3"],
    ];
    for (const [upper, expected] of bounds) {
      assert.strictEqual(print(desugarHyphen(partial(1, 2, 3), upper)), expected);
      assert.strictEqual(print(desugarHyphen(upper)(partial(1, 2, 3))), expected);
    }
    assert.strictEqual(print(desugarHyphen(partial(null), partial(null))), ">=0.0.0");
    assert.strictEqual(print(desugarHyphen(
      { ...partial(1, 2, 3), prerelease: ["a"], build: ["ignored"] },
      { ...partial(2, 3, 4), prerelease: ["b"], build: ["ignored"] },
    )), ">=1.2.3-a <=2.3.4-b");
  }));
});


describe("desugar round-3 regressions", () => {
  it.effect("caret floors discard numeric and prerelease suffixes after a wildcard", () => Effect.sync(() => {
    for (const [input, expected] of [
      [partial(1, null, 3), ">=1.0.0 <2.0.0-0"],
      [{ ...partial(1, null, 0), prerelease: ["alpha"] }, ">=1.0.0 <2.0.0-0"],
      [partial(0, null, 5), ">=0.0.0 <1.0.0-0"],
      [partial(1, null, 2), ">=1.0.0 <2.0.0-0"],
      [partial(0, null, 2), ">=0.0.0 <1.0.0-0"],
    ] satisfies ReadonlyArray<readonly [PartialParts, string]>) {
      assert.strictEqual(print(desugarCaret(input)), expected);
    }
  }));

  it.effect("hyphen floors stop at the first wildcard and omit a wildcard-major floor", () => Effect.sync(() => {
    const cases: ReadonlyArray<readonly [PartialParts, PartialParts, string]> = [
      [partial(1, null, 3), partial(2), ">=1.0.0 <3.0.0-0"],
      [partial(null, 1, 3), partial(2), "<3.0.0-0"],
      [partial(null, 2), partial(1, 0, 0), "<=1.0.0"],
      [partial(null, 2, 3), partial(2, 0, 0), "<=2.0.0"],
      [partial(null, 2, 3), partial(2, 1), "<2.2.0-0"],
      [partial(1, null, 2), partial(2, 0, 0), ">=1.0.0 <=2.0.0"],
      [{ ...partial(1, null, 0), prerelease: ["alpha"] }, partial(2), ">=1.0.0 <3.0.0-0"],
      [{ ...partial(1, 2), prerelease: ["alpha"] }, partial(2), ">=1.2.0 <3.0.0-0"],
      [partial(null, 2, 3), partial(null), ">=0.0.0"],
      [partial(1, null, 2), partial(null), ">=1.0.0"],
    ];
    for (const [lower, upper, expected] of cases) {
      assert.strictEqual(print(desugarHyphen(lower, upper)), expected);
      assert.strictEqual(print(desugarHyphen(upper)(lower)), expected);
    }
  }));

  it.effect("PartialParts is an annotated structural schema without early component validation", () => Effect.gen(function* () {
    const value = { major: null, minor: 1.5, patch: Number.MAX_SAFE_INTEGER + 1, prerelease: ["alpha", 0], build: ["001"] };
    assert.strictEqual(S.is(PartialParts)(value), true);
    const decoded = yield* S.decodeEffect(PartialParts)(value);
    assert.deepStrictEqual(decoded, value);
    assert.deepStrictEqual(yield* S.encodeEffect(PartialParts)(decoded), value);
    assert.strictEqual(S.is(PartialParts)({ ...value, major: "x" }), false);
    assert.strictEqual(PartialParts.ast.annotations?.identifier, "@beep/scratchpad/effected/semver/internal/desugar/PartialParts");
    assert.isString(PartialParts.ast.annotations?.description);
    for (const field of [PartialParts.fields.major, PartialParts.fields.minor, PartialParts.fields.patch, PartialParts.fields.prerelease, PartialParts.fields.build]) {
      assert.isString(field.ast.context?.annotations?.description);
    }
  }));
});
