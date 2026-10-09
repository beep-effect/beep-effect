import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import { assertTrue } from "@effect/vitest/utils";
import { DelimiterRun, scanDelims } from "../../../../effected/markdown/internal/inlines/emphasis.ts";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown } from "../../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../../effected/markdown/MarkdownFormat.ts";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../../../effected/markdown/MarkdownEdit.ts";

import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { makeInlineNode } from "../../../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../../../effected/markdown/internal/inlineTypes.ts";

const scannerFor = (subject: string): InlineScanner => {
  const scanner: InlineScanner = {
    subject, pos: 0, refmap: HashMap.empty(), footnoteLabels: HashSet.empty(),
    delimiters: undefined, brackets: undefined,
    peek: () => O.getOrElse(Str.charCodeAt(subject, scanner.pos), () => -1),
    match: (pattern) => {
      const matched = pattern.exec(subject.slice(scanner.pos));
      if (matched === null || matched.index !== 0) return undefined;
      const value = matched[0];
      scanner.pos += value.length;
      return value;
    },
    matchAhead: () => undefined, hasAhead: () => false,
    closingBacktickRun: () => undefined, append: () => {},
    appendText: (value, from, to) => makeInlineNode("text", from, to, value),
    lastChild: () => undefined, unputText: () => false, trimTrailingSpaces: () => 0,
    removeDelimiter: () => {}, addBracket: () => {}, removeBracket: () => {},
    deactivateLinkOpeners: () => {}, processEmphasis: () => {},
  };
  return scanner;
};

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ marker: S.Literals(["*", "_", "**", "__", "***"]), content: S.Array(S.Literals(["a", "b", "é", "😀"])) });
const sources = Arbitrary.schema(Sample).pipe(Arbitrary.map((sample) => `prefix ${sample.marker}x${sample.content.join("")}y${sample.marker} suffix`));
// Positions and concrete marker spelling change when the canonical renderer emits new source.
const meaning = (root: unknown) => JSON.stringify(root, (key, value: unknown) =>
  ["position", "headingStyle", "markerChar", "fenceChar", "fenceLength", "bulletChar", "delimiter", "breakStyle"].includes(key) ? undefined : value);

describe("emphasis parser property floor", () => {
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

it.effect.prop("DelimiterRun decode(encode(x)) equals x and never fails", [Arbitrary.schema(DelimiterRun)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(DelimiterRun)(value);
  const decoded = yield* S.decodeEffect(DelimiterRun)(encoded);
  assertTrue(S.toEquivalence(DelimiterRun)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(DelimiterRun)(decoded), encoded);
}), runs);

it.effect.prop("delimiter measurement is idempotent, restores the cursor, and preserves run length", [Arbitrary.schema(S.Struct({
  count: S.Int.check(S.isBetween({ minimum: 1, maximum: 40 })),
  marker: S.Literals(["*", "_"]), before: S.Literals(["", " ", "!", "😀"]), after: S.Literals(["a", "é", "😀"]),
}))], ([sample]) => Effect.sync(() => {
  const subject = `${sample.before}${sample.marker.repeat(sample.count)}${sample.after}`;
  const scanner = scannerFor(subject);
  scanner.pos = sample.before.length;
  const once = scanDelims(scanner, sample.marker.charCodeAt(0));
  assert.deepStrictEqual(scanDelims(sample.marker.charCodeAt(0))(scanner), once);
  assert.strictEqual(scanner.pos, sample.before.length);
  assert.deepStrictEqual(once, O.some({ numdelims: sample.count, canOpen: true, canClose: (sample.before === "!" || sample.before === "😀") && sample.after === "😀" }));
}), runs);
