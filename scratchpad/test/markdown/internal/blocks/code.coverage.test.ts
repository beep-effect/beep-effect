import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeBlockNode } from "../../../../effected/markdown/internal/blockTypes.ts";
import type { BlockScanner, MaterializeContext } from "../../../../effected/markdown/internal/blockTypes.ts";
import { Position } from "../../../../effected/markdown/MarkdownNode.ts";

const scanner = (overrides: Partial<BlockScanner> = {}): BlockScanner => {
  let offset = 0;
  return {
    currentLine: "", lineStart: 0, lineNumber: 1, get offset() { return offset; },
    column: 0, nextNonspace: 0, nextNonspaceColumn: 0, indent: 0, indented: false,
    blank: false, tip: makeBlockNode("document", 0, 1), allClosed: true,
    advanceOffset: (count) => { offset += count; },
    advanceNextNonspace: () => { offset = overrides.nextNonspace ?? 0; },
    findNextNonspace: () => {}, closeUnmatchedBlocks: () => {},
    addChild: (type, start) => makeBlockNode(type, start, 1),
    setScanPosition: (start) => { offset = start; }, setLastLineLength: () => {},
    replaceBlock: (block, type) => makeBlockNode(type, block.startOffset, block.startLine),
    insertBefore: (block, type) => makeBlockNode(type, block.startOffset, block.startLine),
    finalizeBlock: (block) => { block.open = false; }, addLine: () => {}, ...overrides,
  };
};
const context: MaterializeContext = {
  position: () => Position.synthetic,
  inlineSlice: (block) => ({text: block.stringContent, startOffset: block.startOffset,
    endOffset: block.endOffset, segments: block.segments, children: []}),
  registerInline: () => {},
};
import { Markdown } from "../../../../effected/markdown/Markdown.ts";
import { codeConstruct } from "../../../../effected/markdown/internal/blocks/code.ts";
describe("code construct coverage", () => {
 it.effect("empty indented content finalizes without a surviving segment", () => Effect.sync(() => {
  const block = makeBlockNode("code", 12, 3); block.stringContent = " \n\t\n";
  assert.strictEqual(codeConstruct.canContain("paragraph"), false);
  codeConstruct.finalize?.(scanner(), block);
  assert.strictEqual(block.stringContent, ""); assert.strictEqual(block.endOffset, 12);
  const node = codeConstruct.materialize(block, [], context);
  if (node?.type !== "code") { assert.fail("expected code"); }
  assert.strictEqual(node.value, ""); assert.strictEqual(node.fenceChar, undefined);
 }));
 it.effect("fenced finalization accepts an info line without a terminator", () => Effect.sync(() => {
  const block = makeBlockNode("code", 0, 1); block.data.isFenced = true; block.stringContent = "ts";
  codeConstruct.finalize?.(scanner(), block);
  assert.strictEqual(block.stringContent, ""); assert.strictEqual(block.data.lang, "ts");
  const node = codeConstruct.materialize(block, [], context);
  if (node?.type !== "code") { assert.fail("expected code"); }
  assert.strictEqual(node.fenceChar, undefined); assert.strictEqual(node.fenceLength, undefined);
 }));
 it.effect("closing fences use the default length and update the source boundary", () => Effect.sync(() => {
  const block = makeBlockNode("code", 0, 1); block.data.isFenced = true; block.data.fenceChar = "`";
  let end = 0;
  assert.strictEqual(codeConstruct.continue(scanner({currentLine: "```", setLastLineLength: (length) => { end = length; }}), block), 2);
  assert.strictEqual(end, 3); assert.strictEqual(block.open, false);
  const open = makeBlockNode("code", 0, 1); open.data.isFenced = true;
  assert.strictEqual(codeConstruct.continue(scanner({currentLine: "text"}), open), 0);
  assert.strictEqual(open.open, true);
  open.data.fenceOffset = 2;
  const padded = scanner({currentLine: " x"});
  assert.strictEqual(codeConstruct.continue(padded, open), 0);
  assert.strictEqual(padded.offset, 1);
 }));
 it.effect("empty fences and a single blank code line carry distinct literal values", () => Effect.gen(function* () {
   const empty = yield* Markdown.parse("```\n```\n");
   const blank = yield* Markdown.parse("```\n\n```\n");
   const emptyCode = empty.children[0]; const blankCode = blank.children[0];
   if (emptyCode?.type !== "code" || blankCode?.type !== "code") { assert.fail("expected code blocks"); }
   assert.strictEqual(emptyCode.value, ""); assert.strictEqual(blankCode.value, "\n");
 }));
});
