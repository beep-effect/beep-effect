import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { parse } from "yaml";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlDocument } from "../../effected/yaml/YamlDocument.ts";

describe("round-3 stringifier fidelity", () => {
  it.effect("keeps interior tabs inside width-folded block scalar content", () => Effect.gen(function* () {
    for (const value of ["one two \tthree four", "one two\t three four"]) {
      const text = yield* Yaml.stringify(value, { defaultScalarStyle: "block-folded", lineWidth: 12 });
      assert.strictEqual(parse(text), value);
      assert.strictEqual(yield* Yaml.parse(text), value);
    }
  }));

  it.effect("preserves child lines and closing-line commas in nested flow maps and sequences", () => Effect.gen(function* () {
    for (const input of [
      "{a: [1, # inner\n 2]}\n",
      "{a: [1, # inner\n\n # next\n 2]}\n",
      "[[1, # inner\n\n # next\n 2], 3]\n",
      "{a: {b: 1, # inner\n c: 2}, d: 3}\n",
      "[[1, # inner\n 2], 3]\n",
      "[{a: 1, # inner\n b: 2}, 3]\n",
      "{a: [1, # inner\n 2], # parent\n b: 3}\n",
      "[[1, # inner\n 2], # parent\n 3]\n",
      "{a: [{b: [1, # inner\n 2]}], d: 3}\n",
    ]) {
      const doc = yield* YamlDocument.parse(input);
      const text = yield* doc.stringify();
      assert.deepStrictEqual(parse(text), parse(input));
      assert.deepStrictEqual(yield* Yaml.parse(text), yield* Yaml.parse(input));
      assert.deepStrictEqual((yield* YamlDocument.parse(text)).toValue(), doc.toValue());
      assert.include(text, "# inner\n");
      assert.strictEqual(Str.split(text, "# inner").length, 2);
      if (Str.includes("# parent")(input)) {
        assert.strictEqual(Str.split(text, "# parent").length, 2);
        assert.include(text, "], # parent\n");
      }
    }
  }));

  it.effect("separates flow alias and metadata-only keys in inline and comment layouts", () => Effect.gen(function* () {
    for (const input of [
      "x: &a key\ny: {*a : val}\n",
      "x: &a key\ny: {*a : val, # tail\n other: 2}\n",
      "{!!str : val}\n",
      "{!!str : val, # tail\n other: 2}\n",
      "{&a : val}\n",
      "{&a : val, # tail\n other: 2}\n",
    ]) {
      const doc = yield* YamlDocument.parse(input);
      const text = yield* doc.stringify();
      assert.deepStrictEqual(parse(text), parse(input));
      assert.deepStrictEqual(yield* Yaml.parse(text), yield* Yaml.parse(input));
      assert.deepStrictEqual((yield* YamlDocument.parse(text)).toValue(), doc.toValue());
      if (Str.includes("*a")(input)) assert.include(text, "*a : val");
      if (Str.includes("!!str")(input)) assert.include(text, "!!str : val");
      if (Str.includes("{&a")(input)) assert.include(text, "&a : val");
    }
  }));

  it.effect("applies finalNewline to canonical empty framing while retaining marker separators", () => Effect.gen(function* () {
    for (const input of ["---\n", "---\n...\n"]) {
      const doc = yield* YamlDocument.parse(input);
      const withNewline = yield* doc.stringify({ forceDefaultStyles: true, finalNewline: true });
      const withoutNewline = yield* doc.stringify({ forceDefaultStyles: true, finalNewline: false });
      assert.strictEqual(withNewline, input);
      assert.strictEqual(withoutNewline, Str.slice(0, -1)(input));
      assert.strictEqual(yield* doc.stringify({ forceDefaultStyles: true }), input);
      assert.strictEqual(parse(withoutNewline), null);
      assert.strictEqual((yield* YamlDocument.parse(withoutNewline)).hasDocumentEnd, doc.hasDocumentEnd);
    }
  }));
});
