import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown } from "@beep/markdown/Markdown";
import * as Subject from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
import { Mdast } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("MarkdownDocument schema property floor", () => {
  roundTrips("DocumentHeading", Subject.DocumentHeading);
  roundTrips("SectionQueryOptions", Subject.SectionQueryOptions);
  roundTrips("DocumentLink", Subject.DocumentLink);
  roundTrips("MarkdownDocument", Subject.MarkdownDocument);
});

// Mdast projection drops concrete marker extras; positions are source-relative
// and must be excluded when comparing parses of different serializations.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value))
    return R.map(
      R.filter(value, (_, key) => key !== "position"),
      semantic
    );
  return value;
};
const Sample = S.Struct({
  words: S.Array(S.Literals(["alpha", "beta", "gamma", "é", "中"])),
  bullet: S.Literals(["-", "*", "+"]),
  heading: S.Literals(["atx", "setext"]),
  emphasis: S.Literals(["*", "_"]),
  fence: S.Literals(["`", "~"]),
});
const sampleSource = (sample: typeof Sample.Type): string => {
  const words = `text ${A.join(sample.words, " ")}`;
  const title = sample.heading === "atx" ? `# ${words}` : `${words}\n======`;
  return `${title}\n\n${sample.emphasis}emphasis${sample.emphasis}\n\n${sample.bullet} ${words}\n${sample.bullet} second\n\n[link](./path "title")\n\n${Str.repeat(3)(sample.fence)}js\ncode\n${Str.repeat(3)(sample.fence)}\n`;
};

describe("MarkdownDocument parser laws", () => {
  it.effect.prop(
    "parse(stringify(parse(x))) retains semantic nodes and author marker choices",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const source = sampleSource(sample);
        const first = yield* Subject.MarkdownDocument.parse(source);
        const rendered = yield* Markdown.stringify(first.root);
        const second = yield* Subject.MarkdownDocument.parse(rendered);
        assert.deepStrictEqual(semantic(Mdast.toMdast(second.root)), semantic(Mdast.toMdast(first.root)));
        assert.deepStrictEqual(
          A.map(second.headings, (entry) => [entry.text, entry.depth, entry.node.headingStyle]),
          A.map(first.headings, (entry) => [entry.text, entry.depth, entry.node.headingStyle])
        );
        assert.strictEqual(second.find("list")?.bulletChar, sample.bullet);
        assert.strictEqual(second.find("emphasis")?.markerChar, sample.emphasis);
        assert.strictEqual(second.find("code")?.fenceChar, sample.fence);
        const stringify2 = yield* Markdown.stringify(second.root);
        assert.strictEqual(stringify2, rendered);
        const argument = Subject.MarkdownDocument.parseResult(source);
        const result1 = yield* Effect.result(Subject.MarkdownDocument.parse(source));
        assert.deepStrictEqual(argument, result1);
      }),
    runs
  );

  it.effect.prop(
    "normalizing parsed documents is idempotent and retains their semantic tree",
    [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownFormattingOptions)],
    ([sample, options]) =>
      Effect.gen(function* () {
        const source = sampleSource(sample);
        const original = yield* Subject.MarkdownDocument.parse(source);
        const formatted = MarkdownFormat.formatToString(source, undefined, options);
        assert.strictEqual(MarkdownFormat.formatToString(formatted, undefined, options), formatted);
        const parsed = yield* Subject.MarkdownDocument.parse(formatted);
        assert.deepStrictEqual(semantic(Mdast.toMdast(parsed.root)), semantic(Mdast.toMdast(original.root)));
      }),
    runs
  );
});
