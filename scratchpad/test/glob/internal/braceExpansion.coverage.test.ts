import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { expand } from "../../../effected/glob/internal/braceExpansion.ts";
import { GuardExceeded, MAX_NESTING_DEPTH } from "../../../effected/glob/internal/limits.ts";

describe("brace expansion coverage", () => {
  it.effect("preserves escaped punctuation, literal braces and shell parameter braces", () => Effect.sync(() => {
    assert.deepStrictEqual(expand("\\{a\\,b\\}\\.\\\\"), ["{a,b}.\\"]);
    assert.deepStrictEqual(expand("${a}"), ["${a}"]);
    assert.deepStrictEqual(expand("${a}{b,c}"), ["${a}b", "${a}c"]);
    assert.deepStrictEqual(expand("{{a\\,b}}tail"), ["{{a,b}}tail"]);
    assert.deepStrictEqual(expand("{,}"), []);
    assert.deepStrictEqual(expand("{{${a,b}}}tail"), ["{{${a,b}}}tail"]);
    assert.deepStrictEqual(expand("{{a,b}}tail"), ["{a}tail", "{b}tail"]);
    assert.deepStrictEqual(expand("{{a},b}}tail"), ["{a}}tail", "b}tail"]);
  }));
  it.effect("ascending and descending padded and mixed-case sequences follow Bash", () => Effect.sync(() => {
    assert.deepStrictEqual(expand("{-02..02..2}"), ["-02", "000", "002"]);
    assert.deepStrictEqual(expand("{02..-02..2}"), ["002", "000", "-02"]);
    assert.deepStrictEqual(expand("{9..010}"), ["009", "010"]);
    assert.deepStrictEqual(expand("{08..10}"), ["08", "09", "10"]);
    assert.deepStrictEqual(expand("{Z..a}"), ["Z", "[", "", "]", "^", "_", "`", "a"]);
    assert.deepStrictEqual(expand({ max: 2 })("{b..a}"), ["b", "a"]);
  }));
  it.effect("adjacent nested comma parts and recursive expansion trip the depth guard", () => Effect.sync(() => {
    const adjacent = `{${"{a,b}".repeat(MAX_NESTING_DEPTH + 1)},c}`;
    assert.throws(() => expand(adjacent), GuardExceeded);
    const nested = "{a,".repeat(MAX_NESTING_DEPTH + 1) + "b" + "}".repeat(MAX_NESTING_DEPTH + 1);
    assert.throws(() => expand(nested), GuardExceeded);
  }));
  it.effect("shell parameter suffix recursion accepts the depth limit and reports the first excess frame", () => Effect.sync(() => {
    const atLimit = "${a}".repeat(MAX_NESTING_DEPTH + 1);
    assert.deepStrictEqual(expand(atLimit), [atLimit]);
    assert.throws(
      () => expand(atLimit + "${a}"),
      GuardExceeded,
      `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH}, actual ${MAX_NESTING_DEPTH + 1}`
    );
  }));
});
