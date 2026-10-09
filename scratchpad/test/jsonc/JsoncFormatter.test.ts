import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { JsoncEdit, JsoncFormatter, JsoncFormattingOptions, JsoncFormattingOptionsLike, JsoncRange } from "../../effected/jsonc/index.ts";

describe("JsoncFormatter", () => {
  describe("format / formatToString", () => {
    it("reflows a compact object with default options", () => {
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1,"b":2}'), '{\n  "a": 1,\n  "b": 2\n}');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":[1,{"b":2}]}'), '{\n  "a": [\n    1,\n    {\n      "b": 2\n    }\n  ]\n}');
    });

    it("computes the minimal edits as JsoncEdit instances", () => {
      const edits = JsoncFormatter.format('{"a":1}');
      assert.isTrue(edits.every(S.is(JsoncEdit)));
      assert.deepStrictEqual(
        edits.map((edit) => [edit.offset, edit.length, edit.content]),
        [[1, 0, "\n  "], [5, 0, " "], [6, 0, "\n"]]
      );
      assert.deepStrictEqual(JsoncFormatter.format('{\n  "a": 1\n}'), []);
      assert.deepStrictEqual(JsoncFormatter.format(""), []);
      assert.deepStrictEqual(JsoncFormatter.format("   "), []);
    });

    it("honors tabSize, tabs, eol and plain-literal options", () => {
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}', undefined, JsoncFormattingOptions.make({ insertSpaces: false })), '{\n\t"a": 1\n}');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}', undefined, { tabSize: 4 }), '{\n    "a": 1\n}');
      assert.strictEqual(JsoncFormatter.formatToString('[1]', undefined, { eol: "\r\n" }), "[\r\n  1\r\n]");
    });

    it("preserves comments and places them on their own line or inline as written", () => {
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1 // note\n}'), '{\n  "a": 1 // note\n}');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1 /* c */}'), '{\n  "a": 1 /* c */\n}');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1,\n// own line\n"b":2}'), '{\n  "a": 1,\n  // own line\n  "b": 2\n}');
      assert.strictEqual(JsoncFormatter.formatToString('/* lead */ 1'), "/* lead */ 1");
      assert.strictEqual(JsoncFormatter.formatToString('/* lead */\n1'), "/* lead */\n1");
      assert.strictEqual(JsoncFormatter.formatToString('// lead\n1'), "// lead\n1");
    });

    it("keeps blank lines between tokens with keepLines", () => {
      const text = '{\n\n  "a": 1,\n\n\n  "b": 2\n}';
      assert.strictEqual(JsoncFormatter.formatToString(text, undefined, { keepLines: true }), text);
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}', undefined, { keepLines: true }), '{\n  "a": 1\n}');
    });

    it("leaves gaps between scalar tokens alone", () => {
      assert.strictEqual(JsoncFormatter.formatToString("1  2"), "1  2");
    });

    it("a leading closer has nothing to close and leaves the depth alone", () => {
      assert.strictEqual(JsoncFormatter.formatToString("] [1]"), "] [\n  1\n]");
      assert.strictEqual(JsoncFormatter.formatToString('}{"a":1}'), '}{\n  "a": 1\n}');
    });

    // Port deviation (upstream-bug: upstream's String.prototype.repeat throws a RangeError on a surplus closer, a defect from a total function): the lab clamps the indent to none.
    it("a surplus closer formats with no indent instead of throwing", () => {
      assert.deepStrictEqual(JsoncFormatter.format("]]"), [JsoncEdit.make({ offset: 1, length: 0, content: "\n" })]);
      assert.strictEqual(JsoncFormatter.formatToString("]]"), "]\n]");
      assert.deepStrictEqual(
        JsoncFormatter.format('{"a":1}}').map((edit) => [edit.offset, edit.length, edit.content]),
        [[1, 0, "\n  "], [5, 0, " "], [6, 0, "\n"], [7, 0, "\n"]]
      );
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}}'), '{\n  "a": 1\n}\n}');
    });

    it("appends a final newline only when requested and missing", () => {
      const options = JsoncFormattingOptions.make({ insertFinalNewline: true });
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}', undefined, options), '{\n  "a": 1\n}\n');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}\n', undefined, options), '{\n  "a": 1\n}\n');
      assert.strictEqual(JsoncFormatter.formatToString('{"a":1}  \n', undefined, options), '{\n  "a": 1\n}  \n');
      assert.strictEqual(JsoncFormatter.formatToString("", undefined, options), "");
    });
  });

  describe("range restriction", () => {
    it("returns only edits inside the range", () => {
      const text = '{"a":1,"b":2}';
      const edits = JsoncFormatter.format(text, JsoncRange.make({ offset: 0, length: 4 }));
      assert.deepStrictEqual(edits.map((edit) => [edit.offset, edit.content]), [[1, "\n  "]]);
      assert.strictEqual(JsoncFormatter.formatToString(text, JsoncRange.make({ offset: 0, length: 4 })), '{\n  "a":1,"b":2}');
    });

    it("applies the final-newline edit only when the range covers the document end", () => {
      const text = '{"a":1}';
      const options = JsoncFormattingOptions.make({ insertFinalNewline: true });
      assert.isFalse(JsoncFormatter.format(text, JsoncRange.make({ offset: 0, length: 3 }), options).some((e) => e.offset >= text.length));
      assert.isTrue(JsoncFormatter.formatToString(text, JsoncRange.make({ offset: 0, length: text.length }), options).endsWith("\n"));
    });
  });

  describe("idempotence (property)", () => {
    const Sample = S.Struct({
      name: S.String,
      count: S.Int,
      nested: S.Struct({ flag: S.Boolean }),
      items: S.Array(S.Int),
    });
    const encodeSample = S.encodeEffect(S.fromJsonString(Sample));

    it.effect.prop("formatting a formatted document is a no-op", [Sample], ([value]) =>
      Effect.gen(function* () {
        const once = JsoncFormatter.formatToString(yield* encodeSample(value));
        assert.strictEqual(JsoncFormatter.formatToString(once), once);
        assert.deepStrictEqual(JsoncFormatter.format(once), []);
      })
    );
  });

  // Review round 2 pins. They sit at the end of the file so every test above
  // keeps the line number the README and the ledger cite.
  describe("tabSize", () => {
    const format = (text: string, tabSize: number, insertSpaces = true): string =>
      JsoncFormatter.formatToString(text, undefined, { tabSize, insertSpaces });
    const isOptionsLike = S.is(JsoncFormattingOptionsLike);

    // Upstream parity: `tabSize` is any number and the indent unit truncates it
    // toward zero.
    it("accepts a fractional width, truncated toward zero", () => {
      assert.strictEqual(format('{"a":[1]}', 1.5), '{\n "a": [\n  1\n ]\n}');
      assert.strictEqual(format('{"a":[1]}', 2.9), '{\n  "a": [\n    1\n  ]\n}');
      assert.strictEqual(format("[1,[2]] // c", 1.5), "[\n 1,\n [\n  2\n ]\n] // c");
      for (const tabSize of [0.5, -0.5, -0.999]) {
        assert.isTrue(isOptionsLike({ tabSize }));
        assert.strictEqual(format('{"a":[1]}', tabSize), '{\n"a": [\n1\n]\n}');
      }
    });

    it("ignores the width when indenting with tabs", () => {
      for (const tabSize of [-2, -1, 1.5]) {
        assert.strictEqual(format('{"a":[1]}', tabSize, false), '{\n\t"a": [\n\t\t1\n\t]\n}');
      }
    });

    // Port deviation (upstream-bug): upstream builds the indent unit with
    // `" ".repeat(tabSize)`, which throws a RangeError for a width of -1 or
    // below, a defect from a total function; the lab clamps the unit to no
    // indent.
    it("formats a width of -1 or below with no indent instead of throwing", () => {
      for (const tabSize of [-1, -1.5, -100]) {
        assert.strictEqual(format('{"a":[1]}', tabSize), '{\n"a": [\n1\n]\n}');
        assert.deepStrictEqual(
          JsoncFormatter.format('{"a":[1]}', undefined, JsoncFormattingOptions.make({ tabSize })).map((edit) => [edit.offset, edit.length, edit.content]),
          [[1, 0, "\n"], [5, 0, " "], [6, 0, "\n"], [7, 0, "\n"], [8, 0, "\n"]]
        );
      }
    });

    // Port deviation (law: the schemaNumber Effect rule): upstream types
    // `tabSize` as Schema.Number and reads its options without validating them,
    // so NaN formats with no indent; the lab's S.Finite rejects NaN and the
    // infinities when the options are constructed.
    it("rejects a non-finite width", () => {
      for (const tabSize of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert.isFalse(isOptionsLike({ tabSize }));
        assert.throws(() => JsoncFormattingOptions.make({ tabSize }));
        assert.throws(() => JsoncFormatter.format("{}", undefined, { tabSize }));
      }
    });
  });
});
