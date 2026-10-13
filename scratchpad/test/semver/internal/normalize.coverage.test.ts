import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { normalizeSets } from "../../../effected/semver/internal/normalize.ts";
import type { ComparatorOperator, ComparatorParts } from "../../../effected/semver/internal/order.ts";

const comparator = (operator: ComparatorOperator, major = 1, prerelease: ReadonlyArray<string | number> = [], build: ReadonlyArray<string> = []): ComparatorParts =>
  ({ operator, version: { major, minor: 0, patch: 0, prerelease, build } });

describe("comparator normalization coverage", () => {
  it.effect("sorts all operator weights, then version precedence, without merging OR branches", () => Effect.sync(() => {
    const lower = comparator(">=", 1);
    const higher = comparator(">=", 2);
    const greater = comparator(">");
    const equal = comparator("=");
    const less = comparator("<");
    const lessEqual = comparator("<=");
    assert.deepStrictEqual(normalizeSets([[lessEqual, less, equal, greater, higher, lower], [equal], []]),
      [[lower, higher, greater, equal, less, lessEqual], [equal], []]);
    assert.deepStrictEqual(normalizeSets([]), []);
  }));

  it.effect("deduplicates metadata-only differences, retains the first spelling, and distinguishes prereleases and operators", () => Effect.sync(() => {
    const stable = comparator("=", 1, [], ["first"]);
    const alpha = comparator("=", 1, ["alpha", 1], ["first"]);
    const beta = comparator("=", 1, ["beta"]);
    const greater = comparator(">", 1, ["alpha", 1]);
    const input = [stable, comparator("=", 1, [], ["second"]), beta, alpha,
      comparator("=", 1, ["alpha", 1], ["second"]), greater];
    assert.deepStrictEqual(normalizeSets([input, [stable]]), [[greater, alpha, beta, stable], [stable]]);
    assert.strictEqual(input.length, 6);
    assert.deepStrictEqual(stable.version.build, ["first"]);
  }));
});
