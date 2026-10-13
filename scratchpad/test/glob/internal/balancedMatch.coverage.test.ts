import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { balanced, range } from "../../../effected/glob/internal/balancedMatch.ts";

describe("balanced delimiter coverage", () => {
  it.effect("missing regexp delimiters and unmatched strings return no match", () => Effect.sync(() => {
    assert.strictEqual(balanced(/x/, /}/, "{a}"), false);
    assert.strictEqual(balanced(/{/, /x/, "{a}"), false);
    assert.strictEqual(balanced("{", "}", "{a"), false);
    assert.strictEqual(range("{", "}", "plain"), undefined);
  }));
  it.effect("nested, identical and unfinished outer delimiters preserve offsets", () => Effect.sync(() => {
    assert.deepStrictEqual(balanced("}", "pre{a{b}c}post")("{"), { start: 3, end: 9, pre: "pre", body: "a{b}c", post: "post" });
    assert.deepStrictEqual(range("|", "|", "a|b|c"), [1, 3]);
    assert.deepStrictEqual(range("}", "{{a}")("{"), [1, 3]);
    assert.deepStrictEqual(range("{", "}", "{{a}{b}"), [1, 3]);
  }));
});
