import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import * as HashMap from "effect/HashMap";
import { prepareInline, trimWithSegments } from "../../../effected/markdown/internal/rawInline.ts";
import type { BlockNode } from "../../../effected/markdown/internal/blockTypes.ts";
import { Definition, Point, Position } from "../../../effected/markdown/MarkdownNode.ts";
import { stringifyTree } from "../../../effected/markdown/internal/stringify.ts";
import { Paragraph, Root } from "../../../effected/markdown/MarkdownNode.ts";
const prose = Arbitrary.schema(S.String).pipe(Arbitrary.map((value) => `word${Array.from(value, (char) => char.codePointAt(0)?.toString(16)).join("")}`));
const position = (start: number, end: number) => Position.make({ start: Point.make({ line: 1, column: start + 1, offset: start }), end: Point.make({ line: 1, column: end + 1, offset: end }) });
const block = (text: string): BlockNode => ({ type: "paragraph", parent: undefined, children: [], open: false, stringContent: text, segments: [{ textOffset: 0, sourceOffset: 0, length: text.length }], startOffset: 0, endOffset: text.length, startLine: 1, endLine: 1, depth: 1, data: {} });
describe("raw inline properties", () => {
  it.effect.prop("trimming is idempotent and preserves surviving source positions", [prose], ([value]) => Effect.sync(() => {
    const text = `  ${value}  `;
    const trimmed = trimWithSegments(text, [{ textOffset: 0, sourceOffset: 10, length: text.length }], /\s/);
    assert.deepStrictEqual(trimWithSegments(trimmed.text, trimmed.segments, /\s/), trimmed);
    assert.deepStrictEqual(trimmed, { text: value, segments: [{ textOffset: 0, sourceOffset: 12, length: value.length }] });
  }), runs);
  it.effect.prop("prepared inline text survives stringify/reparse and canonical formatting stabilizes", [prose], ([value]) => Effect.sync(() => {
    const first = prepareInline(block(`  ${value}  `), position, HashMap.empty<string, Definition>());
    const emit = (children: Paragraph["children"]) => stringifyTree(Root.make({ children: [Paragraph.make({ children })] }));
    const emitted = emit(first.children);
    const second = prepareInline(position, HashMap.empty<string, Definition>())(block(emitted));
    assert.strictEqual(second.text, first.text);
    assert.deepStrictEqual(second.children.map((node) => node.type === "text" ? node.value : node.type), first.children.map((node) => node.type === "text" ? node.value : node.type));
    assert.strictEqual(emit(second.children), emitted);
  }), runs);
});
