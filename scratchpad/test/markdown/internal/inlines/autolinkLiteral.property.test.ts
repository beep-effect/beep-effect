import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown } from "../../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../../effected/markdown/MarkdownFormat.ts";
import { MarkdownDocument } from "../../../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../../../effected/markdown/MarkdownEdit.ts";

import { linkifyEmails } from "../../../../effected/markdown/internal/inlines/autolinkLiteral.ts";
import { appendChild, childrenOf, makeInlineNode } from "../../../../effected/markdown/internal/inlineNode.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ scheme: S.Literals(["http", "https", "ftp"]), label: S.Array(S.Literals(["a", "b", "9"])), ending: S.Literals(["", ".", ")", ";", "/q_(bar)"]) });
const sources = Arbitrary.schema(Sample).pipe(Arbitrary.map((sample) => `www.a${sample.label.join("")}.org${sample.ending} ${sample.scheme}://example.org/path${sample.ending} ada${sample.label.join("")}@example.org`));
// Positions and concrete marker spelling change when the canonical renderer emits new source.
const meaning = (root: unknown) => JSON.stringify(root, (key, value: unknown) =>
  ["position", "headingStyle", "markerChar", "fenceChar", "fenceLength", "bulletChar", "delimiter", "breakStyle"].includes(key) ? undefined : value);

describe("autolinkLiteral parser property floor", () => {
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

it.effect.prop("email postprocessing is idempotent and preserves text and source bounds across pieces", [S.Literals(["a", "b", "9", "_"]).pipe(S.Array, Arbitrary.schema)], ([chars]) => Effect.sync(() => {
  const address = `ada${chars.join("")}@example.org`;
  const source = `prefix ${address} suffix`;
  const root = makeInlineNode("emphasis", 0, source.length);
  // The address straddles pieces; source coordinates remain those of the full input.
  appendChild(root, makeInlineNode("text", 0, 9, source.slice(0, 9)));
  appendChild(root, makeInlineNode("text", 9, source.length, source.slice(9)));
  linkifyEmails(root);
  const snapshot = () => Array.from(childrenOf(root), (node) => ({
    type: node.type, value: node.value, start: node.start, end: node.end, url: node.data.url,
    children: Array.from(childrenOf(node), (child) => ({ type: child.type, value: child.value, start: child.start, end: child.end })),
  }));
  const once = snapshot();
  assert.deepStrictEqual(once.map((node) => node.type), ["text", "link", "text"]);
  assert.strictEqual(once[1]?.url, `mailto:${address}`);
  assert.strictEqual(once[1]?.start, 7);
  assert.strictEqual(once[1]?.end, 7 + address.length);
  assert.strictEqual(once.map((node) => node.type === "link" ? node.children.map((child) => child.value).join("") : node.value).join(""), source);
  linkifyEmails(root);
  assert.deepStrictEqual(snapshot(), once);
}), runs);
