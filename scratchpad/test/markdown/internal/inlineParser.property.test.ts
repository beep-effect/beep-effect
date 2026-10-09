import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { Markdown } from "../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../effected/markdown/MarkdownFormat.ts";
import { Mdast } from "../../../effected/markdown/Mdast.ts";
import { Paragraph, Position, Root } from "../../../effected/markdown/MarkdownNode.ts";
import { parseInlines } from "../../../effected/markdown/internal/inlineParser.ts";

const runs = { arbitrary: fcRuns(100) };
const fragment = S.Array(S.Literals(["plain", "*emphasis*", "**strong**", "_under_", "~~deleted~~", "`code`", "[label](/url)", "![alt](/image)", "<b>html</b>", "&amp;", "\\*literal\\*", "😀"]));
const position = (start: number, end: number) => Position.make({ start: { line: 1, column: start + 1, offset: start }, end: { line: 1, column: end + 1, offset: end } });
const parse = (text: string) => parseInlines({ text, startOffset: 0, segments: [{ textOffset: 0, sourceOffset: 0, length: text.length }] }, HashMap.empty(), position, "gfm");
const root = (text: string) => Root.make({ children: text === "" ? [] : [Paragraph.make({ children: parse(text) })] });
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value)) return R.fromEntries(A.map(A.filter(R.toEntries(value), ([key]) => key !== "position"), ([key, child]) => [key, semantic(child)]));
  return value;
};
const options = MarkdownFormattingOptions.make({ emphasisChar: "_" });

it.effect.prop("inline parse/stringify preserves semantic content and canonical serialization is idempotent", [Arbitrary.schema(fragment)], ([parts]) => Effect.gen(function* () {
  const source = parts.join(" ");
  const first = root(source);
  const serialized = yield* Markdown.stringify(first);
  const reparsed = yield* Markdown.parse(serialized);
  const reserialized = yield* Markdown.stringify(reparsed);
  assert.deepStrictEqual(semantic(Mdast.toMdast(reparsed)), semantic(Mdast.toMdast(first)));
  assert.strictEqual(reserialized, serialized);
}), runs);

it.effect.prop("marker formatting is idempotent and preserves parsed inline content", [Arbitrary.schema(fragment)], ([parts]) => Effect.gen(function* () {
  const source = parts.join(" ");
  const formatted = MarkdownFormat.formatToString(source, undefined, options);
  assert.strictEqual(MarkdownFormat.formatToString(formatted, undefined, options), formatted);
  const before = yield* Markdown.parse(source);
  const after = yield* Markdown.parse(formatted);
  assert.deepStrictEqual(semantic(Mdast.toMdast(after)), semantic(Mdast.toMdast(before)));
}), runs);
