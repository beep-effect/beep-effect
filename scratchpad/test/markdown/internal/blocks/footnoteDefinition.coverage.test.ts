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
import { footnoteDefinitionConstruct, footnoteDefinitionStart } from "../../../../effected/markdown/internal/blocks/footnoteDefinition.ts";
describe("footnote definition construct coverage", () => {
 it.effect("missing metadata drops a block and Unicode whitespace labels do not open one", () => Effect.sync(() => {
  const block = makeBlockNode("footnoteDefinition", 0, 1);
  assert.strictEqual(footnoteDefinitionConstruct.materialize(block, [], context), undefined);
  const scan = scanner({currentLine: "[^\u00a0]: content"});
  assert.strictEqual(footnoteDefinitionStart.trigger(scan, scan.tip), 0);
 }));
 it.effect("four-column indentation prevents a footnote start", () => Effect.sync(() => {
  const scan = scanner({currentLine: "    [^a]: text", indent: 4, nextNonspace: 4, indented: true});
  assert.strictEqual(footnoteDefinitionStart.trigger(scan, scan.tip), 0); assert.strictEqual(scan.offset, 0);
 }));
 it.effect("empty, whitespace-bearing and displaced labels do not open a definition", () => Effect.sync(() => {
  for (const currentLine of ["[^]: text", "[^a b]: text", "text [^a]: text"]) {
   const scan = scanner({currentLine});
   assert.strictEqual(footnoteDefinitionStart.trigger(scan, scan.tip), 0); assert.strictEqual(scan.offset, 0);
  }
 }));
});
