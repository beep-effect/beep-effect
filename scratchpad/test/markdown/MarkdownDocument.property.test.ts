import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Subject from "../../effected/markdown/MarkdownDocument.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../effected/markdown/MarkdownFormat.ts";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
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
  if (P.isObject(value)) return R.map(R.filter(value, (_, key) => key !== "position"), semantic);
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
  return `${title}\n\n${sample.emphasis}emphasis${sample.emphasis}\n\n${sample.bullet} ${words}\n${sample.bullet} second\n\n[link](./path "title")\n\n${sample.fence.repeat(3)}js\ncode\n${sample.fence.repeat(3)}\n`;
};

describe("MarkdownDocument parser laws", () => {
  it.effect.prop("parse(stringify(parse(x))) retains semantic nodes and author marker choices", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
    const source = sampleSource(sample);
    const first = yield* Subject.MarkdownDocument.parse(source);
    const rendered = yield* Markdown.stringify(first.root);
    const second = yield* Subject.MarkdownDocument.parse(rendered);
    assert.deepStrictEqual(semantic(Mdast.toMdast(second.root)), semantic(Mdast.toMdast(first.root)));
    assert.deepStrictEqual(second.headings.map((entry) => [entry.text, entry.depth, entry.node.headingStyle]), first.headings.map((entry) => [entry.text, entry.depth, entry.node.headingStyle]));
    assert.strictEqual(second.find("list")?.bulletChar, sample.bullet);
    assert.strictEqual(second.find("emphasis")?.markerChar, sample.emphasis);
    assert.strictEqual(second.find("code")?.fenceChar, sample.fence);
    assert.strictEqual(yield* Markdown.stringify(second.root), rendered);
    assert.deepStrictEqual(Subject.MarkdownDocument.parseResult(source), yield* Effect.result(Subject.MarkdownDocument.parse(source)));
  }), runs);

  it.effect.prop("normalizing parsed documents is idempotent and retains their semantic tree", [Arbitrary.schema(Sample), Arbitrary.schema(MarkdownFormattingOptions)], ([sample, options]) => Effect.gen(function* () {
    const source = sampleSource(sample);
    const original = yield* Subject.MarkdownDocument.parse(source);
    const formatted = MarkdownFormat.formatToString(source, undefined, options);
    assert.strictEqual(MarkdownFormat.formatToString(formatted, undefined, options), formatted);
    const parsed = yield* Subject.MarkdownDocument.parse(formatted);
    assert.deepStrictEqual(semantic(Mdast.toMdast(parsed.root)), semantic(Mdast.toMdast(original.root)));
  }), runs);
});
