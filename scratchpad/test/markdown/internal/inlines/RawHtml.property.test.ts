import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown, MarkdownParseOptions } from "../../../../effected/markdown/Markdown.ts";
import { Mdast } from "../../../../effected/markdown/Mdast.ts";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { MarkdownFormat } from "../../../../effected/markdown/MarkdownFormat.ts";

import { Heading, Text } from "../../../../effected/markdown/MarkdownNode.ts";

const runs = { arbitrary: fcRuns(100) };
const word = S.Literals(["a", "b", "é", "😀", "9"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((letters) => `x${letters.join("")}`));
const isArray = S.is(S.Array(S.Unknown));
const isRecord = S.is(S.Record(S.String, S.Unknown));
// Positions refer to different source spellings after canonical serialization.
// Compare all mdast semantic fields recursively, omitting only positions.
const semantic = (value: unknown): unknown => {
  if (isArray(value)) return value.map(semantic);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "position").map(([key, field]) => [key, semantic(field)]));
  return value;
};
const parse = (source: string, dialect: "commonmark" | "gfm") => Markdown.parse(source, MarkdownParseOptions.make({ dialect }));
const sources = (word: string): ReadonlyArray<string> => ["before <i title=\"{w}\">after</i>", "before <!--{w}--> after", "before <![CDATA[{w}]]> after", "before <?{w}?> after", "before <!--{w} after"].map((template) => template.replaceAll("{w}", word));
describe("rawHtml parser property floor", () => {
  it.effect.prop("surgical heading edits keep unrelated inline spelling and whitespace byte-identical", [word, Arbitrary.schema(S.Literals(["commonmark", "gfm"]))], ([word, dialect]) => Effect.gen(function* () {
    for (const fragment of sources(word)) {
      const suffix = `\n\n<!-- untouched -->\n\n${fragment}\n`;
      const doc = yield* MarkdownDocument.parse(`# Original${suffix}`, MarkdownParseOptions.make({ dialect }));
      const target = doc.root.children[0];
      if (target === undefined) assert.fail("expected heading");
      const changed = yield* MarkdownFormat.modifyToString(doc, target, Heading.make({ depth: 1, children: [Text.make({ value: "Changed" })] }));
      assert.strictEqual(changed, `# Changed${suffix}`);
    }
  }), runs);
  it.effect.prop("canonical formatting is idempotent", [word, Arbitrary.schema(S.Literals(["commonmark", "gfm"]))], ([word, dialect]) => Effect.gen(function* () {
    for (const source of sources(word)) {
      const formatted = yield* Markdown.stringify(yield* parse(source, dialect));
      assert.strictEqual(yield* Markdown.stringify(yield* parse(formatted, dialect)), formatted);
    }
  }), runs);
  it.effect.prop("parse(stringify(parse(x))) preserves every semantic mdast field", [word, Arbitrary.schema(S.Literals(["commonmark", "gfm"]))], ([word, dialect]) => Effect.gen(function* () {
    for (const source of sources(word)) {
      const parsed = yield* parse(source, dialect);
      const rendered = yield* Markdown.stringify(parsed);
      const reparsed = yield* parse(rendered, dialect);
      assert.deepStrictEqual(semantic(Mdast.toMdast(reparsed)), semantic(Mdast.toMdast(parsed)));
    }
  }), runs);
});
