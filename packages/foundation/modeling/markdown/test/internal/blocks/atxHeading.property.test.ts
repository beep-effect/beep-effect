import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
import { Root } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  letters: S.Array(S.Literals(["a", "b", "é", "中", " ", "&", "_"])).check(S.isMaxLength(24)),
  depth: S.Int.check(S.isBetween({ minimum: 1, maximum: 6 })),
  fence: S.Literals(["`", "~"]),
  length: S.Int.check(S.isBetween({ minimum: 3, maximum: 8 })),
});
// Source positions and inline marker choices may normalize for representability.
// Content, structure and the owned block fidelity fields must survive.
const withoutPositions = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, withoutPositions);
  }
  if (P.isObject(value)) {
    return R.fromEntries(
      A.map(
        A.filter(R.toEntries(value), ([key]) => key !== "position" && key !== "markerChar"),
        ([key, field]): readonly [string, unknown] => [key, withoutPositions(field)]
      )
    );
  }
  return value;
};
const options = MarkdownParseOptions.make({ frontmatter: true });
const formatting = MarkdownFormattingOptions.make({ frontmatter: true, headingStyle: "atx", fenceChar: "~" });
describe("atxHeading parser property floor", () => {
  const sourceOf = (sample: typeof Sample.Type): string =>
    `${Str.repeat(sample.depth)("#")} text ${A.join(sample.letters, "")} end #\n`;
  it.effect.prop(
    "parse/stringify/reparse preserves content and syntax fidelity",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const first = yield* Markdown.parse(sourceOf(sample), options);
        const emitted = yield* Markdown.stringify(first);
        const second = yield* Markdown.parse(emitted, options);
        const value1 = yield* S.encodeEffect(Root)(second);
        const argument = withoutPositions(value1);
        const value2 = yield* S.encodeEffect(Root)(first);
        assert.deepStrictEqual(argument, withoutPositions(value2));
        const stringify2 = yield* Markdown.stringify(second);
        assert.strictEqual(stringify2, emitted);
      }),
    runs
  );
  it.effect.prop(
    "marker normalization is idempotent",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.sync(() => {
        const once = MarkdownFormat.formatToString(sourceOf(sample), undefined, formatting);
        assert.strictEqual(MarkdownFormat.formatToString(once, undefined, formatting), once);
      }),
    runs
  );
  it.effect.prop(
    "README fidelity fields retain the author's block spelling",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const source = sourceOf(sample);
        const tree = yield* Markdown.parse(source, options);
        const emitted = yield* Markdown.stringify(tree);
        const again = yield* Markdown.parse(emitted, options);
        const value3 = yield* S.encodeEffect(Root)(again);
        const argument1 = withoutPositions(value3);
        const value4 = yield* S.encodeEffect(Root)(tree);
        assert.deepStrictEqual(argument1, withoutPositions(value4));
        assert.strictEqual(Str.startsWith(`${Str.repeat(sample.depth)("#")} `)(emitted), true);
        const heading = again.children[0];
        if (heading?.type !== "heading") {
          assert.fail("expected heading");
        }
        assert.strictEqual(heading.depth, sample.depth);
        assert.strictEqual(heading.headingStyle, "atx");
      }),
    runs
  );
  it.effect.prop(
    "README surgical edits preserve every byte outside the target block",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const source = `${sourceOf(sample)}\n<!-- untouched -->\n\nTail  \t${A.join(sample.letters, "")}\n`;
        const document = yield* MarkdownDocument.parse(source, options);
        const target = document.root.children[0];
        if (target === undefined) {
          assert.fail("expected a target block");
        }
        const start = target.position.start.offset;
        const end = target.position.end.offset;
        const edited = yield* MarkdownFormat.modifyToString(document, target, "replacement");
        assert.strictEqual(edited, `${Str.slice(0, start)(source)}replacement${Str.slice(end)(source)}`);
        assert.strictEqual(Str.includes("<!-- untouched -->")(Str.slice(end)(source)), true);
        const reparsed = yield* Markdown.parse(edited, options);
        assert.strictEqual(reparsed.children[0]?.type, "paragraph");
      }),
    runs
  );
});
