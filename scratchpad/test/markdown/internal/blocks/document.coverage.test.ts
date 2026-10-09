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
import { documentConstruct } from "../../../../effected/markdown/internal/blocks/document.ts";
describe("document construct coverage", () => {
 it.effect("root continues and excludes bare list items", () => Effect.sync(() => {
  const block = makeBlockNode("document", 0, 1);
  assert.strictEqual(documentConstruct.continue(scanner(), block), 0);
  assert.strictEqual(documentConstruct.canContain("listItem"), false);
  assert.strictEqual(documentConstruct.canContain("blockquote"), true);
  const node = documentConstruct.materialize(block, [], context);
  assert.strictEqual(node?.type, "root");
 }));
});
