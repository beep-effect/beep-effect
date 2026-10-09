import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown } from "../../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../../effected/markdown/MarkdownFormat.ts";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../../../effected/markdown/MarkdownEdit.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ ticks: S.Literals(["`", "``", "```"]), content: S.Array(S.Literals(["a", "b", " ", "\n", "é"])) });
const sources = Arbitrary.schema(Sample).pipe(Arbitrary.map((sample) => `before ${sample.ticks} x${sample.content.join("x")}y ${sample.ticks} after`));
// Positions and concrete marker spelling change when the canonical renderer emits new source.
const meaning = (root: unknown) => JSON.stringify(root, (key, value: unknown) =>
  ["position", "headingStyle", "markerChar", "fenceChar", "fenceLength", "bulletChar", "delimiter", "breakStyle"].includes(key) ? undefined : value);

describe("codeSpan parser property floor", () => {
  it.effect.prop("parse(stringify(parse(x))) preserves inline meaning", [sources], ([source]) => Effect.gen(function* () {
    const parsed = yield* Markdown.parse(source);
    const canonical = yield* Markdown.stringify(parsed);
    const reparsed = yield* Markdown.parse(canonical);
    assert.deepStrictEqual(meaning(reparsed), meaning(parsed));
  }), runs);

  it.effect.prop("canonical inline formatting is idempotent", [sources], ([source]) => Effect.gen(function* () {
    const once = yield* Markdown.stringify(yield* Markdown.parse(source));
    const twice = yield* Markdown.stringify(yield* Markdown.parse(once));
    assert.strictEqual(twice, once);
  }), runs);

  it.effect.prop("marker normalization is idempotent and preserves inline meaning", [sources], ([source]) => Effect.gen(function* () {
    const options = MarkdownFormattingOptions.make({ emphasisChar: "_" });
    const once = MarkdownFormat.formatToString(source, undefined, options);
    assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
    assert.deepStrictEqual(meaning(yield* Markdown.parse(once)), meaning(yield* Markdown.parse(source)));
  }), runs);

  it.effect.prop("README surgical-edit guarantee preserves surrounding bytes", [sources, Arbitrary.schema(S.String)], ([inline, replacement]) => Effect.gen(function* () {
    const source = `<!-- keep  spacing -->\n\n# Target\n\n${inline}\n\n<!-- keep tail -->\n`;
    const doc = yield* MarkdownDocument.parse(source);
    const target = doc.find("text");
    if (target === undefined) return assert.fail("expected heading text");
    const edits = yield* MarkdownFormat.modify(doc, target, replacement);
    const edit = edits[0];
    if (edit === undefined) return assert.fail("expected replacement edit");
    const changed = MarkdownEdit.applyAll(source, edits);
    assert.strictEqual(changed.slice(0, edit.offset), source.slice(0, edit.offset));
    assert.strictEqual(changed.slice(edit.offset + edit.content.length), source.slice(edit.offset + edit.length));
    yield* Markdown.parse(changed);
  }), runs);
});
