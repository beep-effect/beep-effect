import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { BraceExpressionError, parseClass } from "../../../effected/glob/internal/braceExpressions.ts";

describe("character class coverage", () => {
  it.effect("rejects a position outside a class", () => Effect.sync(() => {
    assert.throws(() => parseClass("plain", 0), BraceExpressionError);
  }));
  it.effect("parses escaped characters, equal ranges and trailing hyphens", () => Effect.sync(() => {
    assert.deepStrictEqual(parseClass("[\\\\]", 0), ["\\\\", false, 4, false]);
    assert.deepStrictEqual(parseClass("[\\]]", 0), ["\\]", false, 4, false]);
    assert.deepStrictEqual(parseClass("[a-a]", 0), ["a", false, 5, false]);
    assert.deepStrictEqual(parseClass("[a-]", 0), ["[a\\-]", false, 4, true]);
    assert.deepStrictEqual(parseClass("[a-[:alpha:]]", 0), ["$.", false, 13, true]);
  }));
  it.effect("combines positive and negative POSIX ranges with both negation modes", () => Effect.sync(() => {
    assert.deepStrictEqual(parseClass("[[:graph:]]", 0), ["[^\\p{Z}\\p{C}]", true, 11, true]);
    assert.deepStrictEqual(parseClass("[![:graph:]]", 0), ["[\\p{Z}\\p{C}]", true, 12, true]);
    assert.deepStrictEqual(parseClass("[a[:graph:]]", 0), ["([a]|[^\\p{Z}\\p{C}])", true, 12, true]);
    assert.deepStrictEqual(parseClass("[!a[:graph:]]", 0), ["([^a]|[\\p{Z}\\p{C}])", true, 13, true]);
    assert.deepStrictEqual(parseClass(1)("x[[:alpha:][:ascii:]]y"), ["[\\p{L}\\p{Nl}\\x00-\\x7f]", true, 20, true]);
  }));
});
