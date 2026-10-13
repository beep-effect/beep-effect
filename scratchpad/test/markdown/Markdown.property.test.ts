import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MarkdownDialect, MarkdownParseOptions, MarkdownParseError, MarkdownStringifyError, Markdown } from "../../effected/markdown/Markdown.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoding succeeds and preserves the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("Markdown schema property floor", () => {
  roundTrips("MarkdownDialect", MarkdownDialect);
  roundTrips("MarkdownParseOptions", MarkdownParseOptions);
  roundTrips("MarkdownParseError", MarkdownParseError);
  roundTrips("MarkdownStringifyError", MarkdownStringifyError);
});

import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaAST from "effect/SchemaAST";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { Paragraph, Root } from "../../effected/markdown/MarkdownNode.ts";
import { renderHtml } from "./e2e/support/htmlWriter.ts";
import { normalizeHtml } from "./e2e/support/normalizeHtml.ts";

const Word = S.String.check(S.isPattern(/^[a-z]{1,12}$/));
const Sample = S.Struct({ title: Word, content: Word });
const render = (sample: typeof Sample.Type): string =>
  `Title ${sample.title}\n${"=".repeat(6 + sample.title.length)}\n\n+ *${sample.content}*\n+ **${sample.title}**\n\n~~~ts\n${sample.content}\n~~~\n\n> [${sample.title}](/${sample.content})\n`;

// Source-backed generation represents the parser's domain: arbitrary synthesized
// Root nodes also admit source offsets and unresolved references that a string
// codec cannot preserve. The generation link only samples; encode/decode below
// use the actual exported codec and compare semantic structure independently.
for (const dialect of ["commonmark", "gfm"] as const) {
  const options = MarkdownParseOptions.make({ dialect });
  const codec = Markdown.fromString(options);
  const generated = codec.annotate({
    toCodecArbitrary: () => new SchemaAST.Link(Sample.ast, SchemaTransformation.makeTransformation({
      decode: SchemaGetter.transformEffect((sample: typeof Sample.Type) => Markdown.parse(render(sample), options).pipe(
        Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, sample))
      )),
      encode: SchemaGetter.forbiddenEncoding
    }))
  });
  it.effect.prop(`${dialect} fromString codec decodes its encoding without failure and preserves semantics`, [Arbitrary.schema(generated)], ([root]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(codec)(root);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assert.deepStrictEqual(decoded, root);
    assert.strictEqual(normalizeHtml(renderHtml(decoded, { gfm: dialect === "gfm" })), normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" })));
    assert.strictEqual(yield* S.encodeEffect(codec)(decoded), encoded);
  }), runs);
}
const defaultCodec = Markdown.MarkdownFromString;
const defaultGenerated = defaultCodec.annotate({
  toCodecArbitrary: () => new SchemaAST.Link(Sample.ast, SchemaTransformation.makeTransformation({
    decode: SchemaGetter.transformEffect((sample: typeof Sample.Type) => Markdown.parse(render(sample)).pipe(
      Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, sample))
    )),
    encode: SchemaGetter.forbiddenEncoding
  }))
});
it.effect.prop("MarkdownFromString decode(encode(x)) preserves structural content and decoding never fails", [Arbitrary.schema(defaultGenerated)], ([root]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(defaultCodec)(root);
  const decoded = yield* S.decodeEffect(defaultCodec)(encoded);
  assert.deepStrictEqual(decoded, root);
  assert.strictEqual(normalizeHtml(renderHtml(decoded, { gfm: true })), normalizeHtml(renderHtml(root, { gfm: true })));
  assert.strictEqual(yield* S.encodeEffect(defaultCodec)(decoded), encoded);
}), runs);

it.effect.prop("parse/stringify is faithful and idempotent and retains setext, bullet, emphasis and fence spelling", [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownDialect)], ([sample, dialect]) => Effect.gen(function* () {
  const options = MarkdownParseOptions.make({ dialect });
  const root = yield* Markdown.parse(render(sample), options);
  const formatted = yield* Markdown.stringify(root);
  const reparsed = yield* Markdown.parse(formatted, options);
  assert.strictEqual(yield* Markdown.stringify(reparsed), formatted);
  assert.strictEqual(normalizeHtml(renderHtml(reparsed, { gfm: dialect === "gfm" })), normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" })));
  assert.include(formatted, `Title ${sample.title}\n===`);
  assert.include(formatted, `+ *${sample.content}*`);
  assert.include(formatted, `~~~ts\n${sample.content}\n~~~`);
}), runs);

it.effect.prop("phrasing parse/stringify preserves inline semantics and stabilizes formatting", [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownDialect)], ([sample, dialect]) => Effect.gen(function* () {
  const options = MarkdownParseOptions.make({ dialect });
  const source = `*${sample.title}* and **${sample.content}** with [link](/${sample.title})`;
  const children = yield* Markdown.parsePhrasing(source, options);
  const root = Root.make({ children: [Paragraph.make({ children })] });
  const formatted = yield* Markdown.stringify(root);
  const reparsed = Root.make({ children: [Paragraph.make({ children: yield* Markdown.parsePhrasing(formatted, options) })] });
  assert.strictEqual(yield* Markdown.stringify(reparsed), formatted);
  assert.strictEqual(normalizeHtml(renderHtml(reparsed, { gfm: dialect === "gfm" })), normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" })));
}), runs);
