import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  Markdown,
  MarkdownDialect,
  MarkdownParseError,
  MarkdownParseOptions,
  MarkdownStringifyError,
} from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding an encoding succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("Markdown schema property floor", () => {
  roundTrips("MarkdownDialect", MarkdownDialect);
  roundTrips("MarkdownParseOptions", MarkdownParseOptions);
  roundTrips("MarkdownParseError", MarkdownParseError);
  roundTrips("MarkdownStringifyError", MarkdownStringifyError);
});

import { Paragraph, Root } from "@beep/markdown/MarkdownNode";
import * as Str from "effect/String";
import { renderHtml } from "./support/htmlWriter.ts";
import { normalizeHtml } from "./support/normalizeHtml.ts";

const Word = S.String.check(S.isPattern(/^[a-z]{1,12}$/));
const Sample = S.Struct({ title: Word, content: Word });
const render = (sample: typeof Sample.Type): string =>
  `Title ${sample.title}\n${Str.repeat(6 + sample.title.length)("=")}\n\n+ *${sample.content}*\n+ **${sample.title}**\n\n~~~ts\n${sample.content}\n~~~\n\n> [${sample.title}](/${sample.content})\n`;

// Source-backed generation represents the parser's domain: arbitrary synthesized
// Root nodes also admit source offsets and unresolved references that a string
// codec cannot preserve. The generation link only samples; encode/decode below
// use the actual exported codec and compare semantic structure independently.
for (const dialect of ["commonmark", "gfm"] as const) {
  const options = MarkdownParseOptions.make({ dialect });
  const codec = Markdown.fromString(options);
  // A `toCodecArbitrary` override on the codec no longer applies: the effect
  // Arbitrary compiler honors it only on declarations, and `Root` is a
  // branded `S.Opaque` struct now (D-22), so the samples are mapped directly.
  const generated = Arbitrary.map(Arbitrary.schema(Sample), (sample) =>
    Result.getOrThrow(Markdown.parseResult(render(sample), options))
  );
  it.effect.prop(
    `${dialect} fromString codec decodes its encoding without failure and preserves semantics`,
    [generated],
    ([root]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(codec)(root);
        const decoded = yield* S.decodeEffect(codec)(encoded);
        assert.deepStrictEqual(decoded, root);
        assert.strictEqual(
          normalizeHtml(renderHtml(decoded, { gfm: dialect === "gfm" })),
          normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" }))
        );
        const value2 = yield* S.encodeEffect(codec)(decoded);
        assert.strictEqual(value2, encoded);
      }),
    runs
  );
}
const defaultCodec = Markdown.MarkdownFromString;
const defaultGenerated = Arbitrary.map(Arbitrary.schema(Sample), (sample) =>
  Result.getOrThrow(Markdown.parseResult(render(sample)))
);
it.effect.prop(
  "MarkdownFromString decode(encode(x)) preserves structural content and decoding never fails",
  [defaultGenerated],
  ([root]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(defaultCodec)(root);
      const decoded = yield* S.decodeEffect(defaultCodec)(encoded);
      assert.deepStrictEqual(decoded, root);
      assert.strictEqual(
        normalizeHtml(renderHtml(decoded, { gfm: true })),
        normalizeHtml(renderHtml(root, { gfm: true }))
      );
      const value3 = yield* S.encodeEffect(defaultCodec)(decoded);
      assert.strictEqual(value3, encoded);
    }),
  runs
);

it.effect.prop(
  "parse/stringify is faithful and idempotent and retains setext, bullet, emphasis and fence spelling",
  [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownDialect)],
  ([sample, dialect]) =>
    Effect.gen(function* () {
      const options = MarkdownParseOptions.make({ dialect });
      const root = yield* Markdown.parse(render(sample), options);
      const formatted = yield* Markdown.stringify(root);
      const reparsed = yield* Markdown.parse(formatted, options);
      const stringify4 = yield* Markdown.stringify(reparsed);
      assert.strictEqual(stringify4, formatted);
      assert.strictEqual(
        normalizeHtml(renderHtml(reparsed, { gfm: dialect === "gfm" })),
        normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" }))
      );
      assert.include(formatted, `Title ${sample.title}\n===`);
      assert.include(formatted, `+ *${sample.content}*`);
      assert.include(formatted, `~~~ts\n${sample.content}\n~~~`);
    }),
  runs
);

it.effect.prop(
  "phrasing parse/stringify preserves inline semantics and stabilizes formatting",
  [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownDialect)],
  ([sample, dialect]) =>
    Effect.gen(function* () {
      const options = MarkdownParseOptions.make({ dialect });
      const source = `*${sample.title}* and **${sample.content}** with [link](/${sample.title})`;
      const children = yield* Markdown.parsePhrasing(source, options);
      const root = Root.make({ children: [Paragraph.make({ children })] });
      const formatted = yield* Markdown.stringify(root);
      const reparsed = Root.make({
        children: [Paragraph.make({ children: yield* Markdown.parsePhrasing(formatted, options) })],
      });
      const stringify5 = yield* Markdown.stringify(reparsed);
      assert.strictEqual(stringify5, formatted);
      assert.strictEqual(
        normalizeHtml(renderHtml(reparsed, { gfm: dialect === "gfm" })),
        normalizeHtml(renderHtml(root, { gfm: dialect === "gfm" }))
      );
    }),
  runs
);
