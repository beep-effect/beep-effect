import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange, type PartialParts } from "../../../effected/semver/internal/desugar.ts";
import { formatComparator } from "../../../effected/semver/internal/grammar.ts";
import type { ComparatorOperator, ComparatorParts } from "../../../effected/semver/internal/order.ts";

const partial = (major: number | null, minor: number | null = null, patch: number | null = null): PartialParts =>
  ({ major, minor, patch, prerelease: [], build: [] });
const print = (parts: ReadonlyArray<ComparatorParts>) => parts.map(formatComparator).join(" ");

describe("desugar coverage", () => {
  it.effect("expands every tilde and caret compatibility boundary", () => Effect.sync(() => {
    const tilde: ReadonlyArray<readonly [PartialParts, string]> = [
      [partial(null), ">=0.0.0 <1.0.0-0"], [partial(1), ">=1.0.0 <2.0.0-0"],
      [partial(1, 2), ">=1.2.0 <1.3.0-0"], [partial(1, 2, 3), ">=1.2.3 <1.3.0-0"],
    ];
    const caret: ReadonlyArray<readonly [PartialParts, string]> = [
      [partial(null), ">=0.0.0 <1.0.0-0"], [partial(1), ">=1.0.0 <2.0.0-0"],
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
      ["<", "<1.2.3", "<1.0.0", "<1.2.0"],
      ["<=", "<=1.2.3", "<2.0.0-0", "<1.3.0-0"],
    ];
    for (const [operator, full, minor, patch] of cases) {
      assert.strictEqual(print(desugarXRange(operator, partial(1, 2, 3))), full);
      assert.strictEqual(print(desugarXRange(operator, partial(1))), minor);
      assert.strictEqual(print(desugarXRange(partial(1, 2))(operator)), patch);
      assert.strictEqual(print(desugarXRange(operator, partial(null))), ">=0.0.0");
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
