import { assert, describe, it } from "@effect/vitest";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { navigate, NavigateResult } from "@beep/scratchpad/effected/jsonc/internal/navigate";

describe("internal/navigate", () => {
  it("is dual", () => {
    assert.deepStrictEqual(pipe('{ "a": 1 }', navigate(["a"])), navigate('{ "a": 1 }', ["a"]));
  });

  describe("Located", () => {
    it("locates an object property with its key span and surrounding commas", () => {
      const text = '{ "a": 1, "b": 2, "c": 3 }';
      assert.deepStrictEqual(
        navigate(text, ["b"]),
        NavigateResult.cases.Located.make({
          container: "object",
          keyStart: 10,
          valueStart: 15,
          valueEnd: 16,
          commaBefore: O.some(8),
          commaAfter: O.some(16),
        })
      );
      assert.deepStrictEqual(
        navigate(text, ["a"]),
        NavigateResult.cases.Located.make({
          container: "object",
          keyStart: 2,
          valueStart: 7,
          valueEnd: 8,
          commaBefore: O.none(),
          commaAfter: O.some(8),
        })
      );
      assert.deepStrictEqual(
        navigate(text, ["c"]),
        NavigateResult.cases.Located.make({
          container: "object",
          keyStart: 18,
          valueStart: 23,
          valueEnd: 24,
          commaBefore: O.some(16),
          commaAfter: O.none(),
        })
      );
    });

    it("locates an array element and bounds nested values tightly", () => {
      const text = "[1, {\"x\": [2]} , 3]";
      assert.deepStrictEqual(
        navigate(text, [1]),
        NavigateResult.cases.Located.make({
          container: "array",
          keyStart: 4,
          valueStart: 4,
          valueEnd: 14,
          commaBefore: O.some(2),
          commaAfter: O.some(15),
        })
      );
    });

    it("descends through objects and arrays", () => {
      const text = '[{ "x": [10, 20] }]';
      assert.deepStrictEqual(
        navigate(text, [0, "x", 1]),
        NavigateResult.cases.Located.make({
          container: "array",
          keyStart: 13,
          valueStart: 13,
          valueEnd: 15,
          commaBefore: O.some(11),
          commaAfter: O.none(),
        })
      );
    });

    it("keys containing quotes resolve structurally", () => {
      const result = navigate('{ "a\\"b": 1, "c": 2 }', ['a"b']);
      assert.isTrue(NavigateResult.guards.Located(result));
    });

    it("tolerates a key without a colon and a non-string key token while scanning", () => {
      assert.isTrue(NavigateResult.guards.Located(navigate('{ "a" 1, "b": 2 }', ["b"])));
      assert.isTrue(NavigateResult.guards.Located(navigate('{ 1: 2, "b": 3 }', ["b"])));
    });

    it("leaves an empty value slot that holds the closer as an empty span", () => {
      const result = navigate('{"k":}', ["k"]);
      assert.isTrue(NavigateResult.guards.Located(result) && result.valueStart === 5 && result.valueEnd === 5);
    });
  });

  describe("Insert", () => {
    it("inserts into an empty or populated object after the last value", () => {
      assert.deepStrictEqual(
        navigate("{}", ["a"]),
        NavigateResult.cases.Insert.make({ container: "object", at: 1, isFirst: true, depth: 1 })
      );
      assert.deepStrictEqual(
        navigate('{ "a": 1 }', ["b"]),
        NavigateResult.cases.Insert.make({ container: "object", at: 8, isFirst: false, depth: 1 })
      );
    });

    it("inserts into an empty or short array after the last element", () => {
      assert.deepStrictEqual(
        navigate("[]", [0]),
        NavigateResult.cases.Insert.make({ container: "array", at: 1, isFirst: true, depth: 1 })
      );
      assert.deepStrictEqual(
        navigate("[1, 2]", [5]),
        NavigateResult.cases.Insert.make({ container: "array", at: 5, isFirst: false, depth: 1 })
      );
    });

    it("reports the nesting depth of the insertion", () => {
      const result = navigate('{ "a": { "b": [] } }', ["a", "b", 0]);
      assert.isTrue(NavigateResult.guards.Insert(result) && result.depth === 3 && result.isFirst);
    });
  });

  describe("Mismatch", () => {
    it("reports the first segment that meets the wrong container kind", () => {
      assert.deepStrictEqual(navigate("[1]", ["a"]), NavigateResult.cases.Mismatch.make({ depth: 1, expected: "object" }));
      assert.deepStrictEqual(navigate("{}", [0]), NavigateResult.cases.Mismatch.make({ depth: 1, expected: "array" }));
      assert.deepStrictEqual(navigate('{ "a": 1 }', ["a", "b"]), NavigateResult.cases.Mismatch.make({ depth: 2, expected: "object" }));
      assert.deepStrictEqual(navigate('{ "a": {} }', ["a", 0]), NavigateResult.cases.Mismatch.make({ depth: 2, expected: "array" }));
    });

    it("reports an intermediate miss at the next segment", () => {
      assert.deepStrictEqual(navigate("{}", ["missing", "x"]), NavigateResult.cases.Mismatch.make({ depth: 2, expected: "object" }));
      assert.deepStrictEqual(navigate("[]", [0, 1]), NavigateResult.cases.Mismatch.make({ depth: 2, expected: "array" }));
      assert.deepStrictEqual(navigate("", ["a"]), NavigateResult.cases.Mismatch.make({ depth: 1, expected: "object" }));
      assert.deepStrictEqual(navigate("[1]", ["a", "b", "c"]), NavigateResult.cases.Mismatch.make({ depth: 1, expected: "object" }));
      assert.deepStrictEqual(navigate('{ "a": [] }', ["a", "b", "c"]), NavigateResult.cases.Mismatch.make({ depth: 2, expected: "object" }));
    });
  });
});
