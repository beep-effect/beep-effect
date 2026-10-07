import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  Jsonc,
  JsoncEdit,
  JsoncFormattingOptions,
  JsoncModificationError,
  JsoncModifier,
  JsoncModifyOptions,
  JsoncStringifyError,
} from "@beep/scratchpad/effected/jsonc/index";

const apply = (text: string, edits: ReadonlyArray<JsoncEdit>): string => JsoncEdit.applyAll(text, edits);

describe("JsoncModifier", () => {
  describe("schemas", () => {
    it("JsoncModifyOptions accepts a literal formatting bag", () => {
      assert.isTrue(S.is(JsoncModifyOptions)({ formattingOptions: { insertSpaces: false } }));
      assert.isTrue(S.is(JsoncModifyOptions)({}));
      assert.isFalse(S.is(JsoncModifyOptions)({ formattingOptions: { tabSize: -1 } }));
    });

    it("JsoncModificationError renders its path, kind and depth", () => {
      const error = JsoncModificationError.make({ path: ["a", 0], expected: "array", depth: 2 });
      assert.strictEqual(error.message, "Modification failed at path [a, 0]: expected array at depth 2");
    });
  });

  describe("replace", () => {
    it.effect("updates object properties and array elements byte-minimally", () =>
      Effect.gen(function* () {
        assert.strictEqual(apply('{ "a": 1 }', yield* JsoncModifier.modify('{ "a": 1 }', ["a"], 2)), '{ "a": 2 }');
        const text = '{ "xs": [1, 2, 3] }';
        assert.strictEqual(apply(text, yield* JsoncModifier.modify(text, ["xs", 1], 99)), '{ "xs": [1, 99, 3] }');
        const commented = '{\n  "a": 1, // keep\n  "b": 2\n}';
        assert.strictEqual(apply(commented, yield* JsoncModifier.modify(commented, ["b"], 5)), '{\n  "a": 1, // keep\n  "b": 5\n}');
      })
    );

    it.effect("replaces the value of a quote-containing key", () =>
      Effect.gen(function* () {
        const text = '{ "a\\"b": 1 }';
        assert.deepStrictEqual(yield* Jsonc.parse(apply(text, yield* JsoncModifier.modify(text, ['a"b'], 42))), { 'a"b': 42 });
      })
    );
  });

  describe("insert", () => {
    it.effect("appends a property after the last one or into an empty object", () =>
      Effect.gen(function* () {
        assert.strictEqual(apply('{ "a": 1 }', yield* JsoncModifier.modify('{ "a": 1 }', ["b"], 2)), '{ "a": 1,\n  "b": 2 }');
        assert.strictEqual(apply("{}", yield* JsoncModifier.modify("{}", ["a"], 1)), '{\n  "a": 1\n}');
      })
    );

    it.effect("appends an element after the last one or into an empty array", () =>
      Effect.gen(function* () {
        assert.strictEqual(apply("[1]", yield* JsoncModifier.modify("[1]", [1], 2)), "[1,\n  2]");
        assert.strictEqual(apply("[]", yield* JsoncModifier.modify("[]", [0], 1)), "[\n  1\n]");
        assert.strictEqual(apply("[1]", yield* JsoncModifier.modify("[1]", [5], 2)), "[1,\n  2]");
      })
    );

    it.effect("indents nested insertions by their depth", () =>
      Effect.gen(function* () {
        const text = '{ "a": { "b": [] } }';
        assert.strictEqual(apply(text, yield* JsoncModifier.modify(text, ["a", "b", 0], true)), '{ "a": { "b": [\n      true\n    ] } }');
      })
    );
  });

  describe("delete via undefined", () => {
    it.effect("removes an object property with its comma, first or last", () =>
      Effect.gen(function* () {
        const text = '{ "a": 1, "b": 2 }';
        assert.strictEqual(apply(text, yield* JsoncModifier.modify(text, ["a"], undefined)), '{  "b": 2 }');
        assert.strictEqual(apply(text, yield* JsoncModifier.modify(text, ["b"], undefined)), '{ "a": 1 }');
        assert.strictEqual(apply('{ "a": 1 }', yield* JsoncModifier.modify('{ "a": 1 }', ["a"], undefined)), "{  }");
      })
    );

    it.effect("removes an array element with its comma", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* Jsonc.parse(apply("[1, 2, 3]", yield* JsoncModifier.modify("[1, 2, 3]", [1], undefined))), [1, 3]);
        assert.deepStrictEqual(yield* Jsonc.parse(apply("[1, 2, 3]", yield* JsoncModifier.modify("[1, 2, 3]", [2], undefined))), [1, 2]);
        assert.deepStrictEqual(yield* Jsonc.parse(apply("[ 1 /* c */, 2 ]", yield* JsoncModifier.modify("[ 1 /* c */, 2 ]", [0], undefined))), [2]);
      })
    );

    it.effect("deleting a missing key or index is a no-op", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* JsoncModifier.modify('{ "a": 1 }', ["missing"], undefined), []);
        assert.deepStrictEqual(yield* JsoncModifier.modify("[1]", [3], undefined), []);
      })
    );

    it.effect("deletes a key that contains a quote character without corrupting siblings", () =>
      Effect.gen(function* () {
        const text = '{ "a\\"b": 1, "c": 2 }';
        assert.deepStrictEqual(yield* Jsonc.parse(apply(text, yield* JsoncModifier.modify(text, ['a"b'], undefined))), { c: 2 });
      })
    );
  });

  describe("whole-document replace", () => {
    it.effect("replaces or clears the entire document at the empty path", () =>
      Effect.gen(function* () {
        const edits = yield* JsoncModifier.modify('{ "old": 1 }', [], { new: true });
        assert.strictEqual(apply('{ "old": 1 }', edits), '{\n  "new": true\n}');
        assert.strictEqual(apply('{ "old": 1 }', yield* JsoncModifier.modify('{ "old": 1 }', [], undefined)), "");
      })
    );
  });

  describe("structural comma handling (never string-searched)", () => {
    it.effect("deleting around comma-bearing comments keeps the document valid", () =>
      Effect.gen(function* () {
        const block = '{ "a": 1, /* x, y */ "b": 2 }';
        assert.deepStrictEqual(yield* Jsonc.parse(apply(block, yield* JsoncModifier.modify(block, ["b"], undefined))), { a: 1 });
        const line = '{\n  "a": 1, // keep, please\n  "b": 2\n}';
        const out = apply(line, yield* JsoncModifier.modify(line, ["b"], undefined));
        assert.deepStrictEqual(yield* Jsonc.parse(out), { a: 1 });
        assert.notInclude(out, "please");
      })
    );

    it.effect("deleting the first property of a nested object leaves earlier siblings intact", () =>
      Effect.gen(function* () {
        const text = '{ "z": [1, 2], "o": { "a": 1, "b": 2 } }';
        assert.deepStrictEqual(yield* Jsonc.parse(apply(text, yield* JsoncModifier.modify(text, ["o", "a"], undefined))), { z: [1, 2], o: { b: 2 } });
      })
    );
  });

  describe("generated content", () => {
    it.effect("JSON-escapes inserted keys containing special characters", () =>
      Effect.gen(function* () {
        const key = 'he"y\\there';
        assert.deepStrictEqual(yield* Jsonc.parse(apply("{}", yield* JsoncModifier.modify("{}", [key], 1))), { [key]: 1 });
      })
    );

    it.effect("honors insertSpaces, tabSize and eol from an instance or a plain literal", () =>
      Effect.gen(function* () {
        const viaInstance = yield* JsoncModifier.modify("{}", ["a"], { b: 1 }, { formattingOptions: JsoncFormattingOptions.make({ insertSpaces: false }) });
        const viaLiteral = yield* JsoncModifier.modify("{}", ["a"], { b: 1 }, { formattingOptions: { insertSpaces: false, tabSize: 2 } });
        assert.deepStrictEqual(viaLiteral, viaInstance);
        assertDefined(viaLiteral[0]);
        assert.strictEqual(viaLiteral[0].content, '\n\t"a": {\n\t\t"b": 1\n\t}\n');
        const crlf = yield* JsoncModifier.modify("{}", ["a"], 1, { formattingOptions: { eol: "\r\n" } });
        assertDefined(crlf[0]);
        assert.strictEqual(crlf[0].content, '\r\n  "a": 1\r\n');
        const wide = yield* JsoncModifier.modify("[]", [0], [1], { formattingOptions: { tabSize: 4 } });
        assertDefined(wide[0]);
        assert.strictEqual(wide[0].content, "\n    [\n        1\n    ]\n");
      })
    );
  });

  describe("errors", () => {
    it.effect("reports serialization failures when replacing or inserting values", () =>
      Effect.gen(function* () {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        for (const path of [[], ["a"], ["b"]]) {
          for (const text of ["{}", '{"a":0}']) {
            const bigint = yield* Effect.flip(JsoncModifier.modify(text, path, 1n));
            assertInstanceOf(bigint, JsoncStringifyError);
            assert.strictEqual(bigint.code, "BigIntValue");
            const cycle = yield* Effect.flip(JsoncModifier.modify(text, path, circular));
            assertInstanceOf(cycle, JsoncStringifyError);
            assert.strictEqual(cycle.code, "CircularReference");
          }
        }
      })
    );

    it.effect("fails with JsoncModificationError on a structural mismatch", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(JsoncModifier.modify('{ "a": 1 }', ["a", "b"], 2));
        assert.deepStrictEqual(error, JsoncModificationError.make({ path: ["a", "b"], expected: "object", depth: 2 }));
        assert.include(error.message, "expected object at depth 2");
        const array = yield* Effect.flip(JsoncModifier.modify('{ "a": {} }', ["a", 0], 2));
        assert.deepStrictEqual(array, JsoncModificationError.make({ path: ["a", 0], expected: "array", depth: 2 }));
      })
    );
  });

  describe("hostile input (hardening)", () => {
    it.effect("replaces a value past a deeply nested sibling without a stack-overflow defect", () =>
      Effect.gen(function* () {
        const deep = `${"[".repeat(20000)}1${"]".repeat(20000)}`;
        const text = `{ "d": ${deep}, "a": 1 }`;
        const edits = yield* JsoncModifier.modify(text, ["a"], 2);
        assert.isTrue(apply(text, edits).endsWith('"a": 2 }'));
      })
    );

    it.effect("modifying a value slot that holds a container closer does not swallow the closer", () =>
      Effect.gen(function* () {
        const text = '{"k":}';
        const out = apply(text, yield* JsoncModifier.modify(text, ["k"], 5));
        assert.strictEqual(out, '{"k":5}');
      })
    );
  });
});
