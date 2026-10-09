import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Markdown, MarkdownParseOptions } from "../../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../../effected/markdown/MarkdownFormat.ts";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { Root } from "../../../../effected/markdown/MarkdownNode.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  letters: S.Array(S.Literals(["a", "b", "é", "中", " ", "&", "_"])).check(S.isMaxLength(24)),
  depth: S.Int.check(S.isBetween({minimum: 1, maximum: 6})),
  fence: S.Literals(["`", "~"]),
  length: S.Int.check(S.isBetween({minimum: 3, maximum: 8})),
});
// Source positions and inline marker choices may normalize for representability.
// Content, structure and the owned block fidelity fields must survive.
const withoutPositions = (value: unknown): unknown => {
  if (A.isArray(value)) { return A.map(value, withoutPositions); }
  if (P.isObject(value)) {
    return R.fromEntries(A.map(A.filter(R.toEntries(value), ([key]) => key !== "position" && key !== "markerChar"),
      ([key, field]): readonly [string, unknown] => [key, withoutPositions(field)]));
  }
  return value;
};
const options = MarkdownParseOptions.make({frontmatter: true});
const formatting = MarkdownFormattingOptions.make({frontmatter: true, headingStyle: "atx", fenceChar: "~"});
describe("atxHeading parser property floor", () => {
 const sourceOf = (sample: typeof Sample.Type): string => `${"#".repeat(sample.depth)} text ${sample.letters.join("")} end #\n`;
 it.effect.prop("parse/stringify/reparse preserves content and syntax fidelity", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
   const first = yield* Markdown.parse(sourceOf(sample), options);
   const emitted = yield* Markdown.stringify(first);
   const second = yield* Markdown.parse(emitted, options);
   assert.deepStrictEqual(withoutPositions(yield* S.encodeEffect(Root)(second)), withoutPositions(yield* S.encodeEffect(Root)(first)));
   assert.strictEqual(yield* Markdown.stringify(second), emitted);
 }), runs);
 it.effect.prop("marker normalization is idempotent", [Arbitrary.schema(Sample)], ([sample]) => Effect.sync(() => {
   const once = MarkdownFormat.formatToString(sourceOf(sample), undefined, formatting);
   assert.strictEqual(MarkdownFormat.formatToString(once, undefined, formatting), once);
 }), runs);
 it.effect.prop("README fidelity fields retain the author's block spelling", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
   const source = sourceOf(sample);
   const tree = yield* Markdown.parse(source, options);
   const emitted = yield* Markdown.stringify(tree);
   const again = yield* Markdown.parse(emitted, options);
   assert.deepStrictEqual(withoutPositions(yield* S.encodeEffect(Root)(again)), withoutPositions(yield* S.encodeEffect(Root)(tree)));
   assert.strictEqual(emitted.startsWith(`${"#".repeat(sample.depth)} `), true);
   const heading = again.children[0];
   if (heading?.type !== "heading") { assert.fail("expected heading"); }
   assert.strictEqual(heading.depth, sample.depth); assert.strictEqual(heading.headingStyle, "atx");
 }), runs);
 it.effect.prop("README surgical edits preserve every byte outside the target block", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
   const source = `${sourceOf(sample)}\n<!-- untouched -->\n\nTail  \t${sample.letters.join("")}\n`;
   const document = yield* MarkdownDocument.parse(source, options);
   const target = document.root.children[0];
   if (target === undefined) { assert.fail("expected a target block"); }
   const start = target.position.start.offset;
   const end = target.position.end.offset;
   const edited = yield* MarkdownFormat.modifyToString(document, target, "replacement");
   assert.strictEqual(edited, `${source.slice(0, start)}replacement${source.slice(end)}`);
   assert.strictEqual(source.slice(end).includes("<!-- untouched -->"), true);
   const reparsed = yield* Markdown.parse(edited, options);
   assert.strictEqual(reparsed.children[0]?.type, "paragraph");
 }), runs);
});
