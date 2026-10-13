import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Position } from "../../../../effected/markdown/MarkdownNode.ts";
import { makeBlockNode, type BlockNode, type BlockScanner, type MaterializeContext } from "../../../../effected/markdown/internal/blockTypes.ts";

const context: MaterializeContext = {
  position: (start, end) => Position.make({ start: { line: 1, column: start + 1, offset: start }, end: { line: 1, column: end + 1, offset: end } }),
  inlineSlice: (block) => ({ text: block.stringContent, startOffset: block.startOffset, endOffset: block.endOffset, segments: block.segments, children: [] }),
  registerInline: () => {},
};
const scannerFor = (currentLine: string, tip: BlockNode, indent = 0): BlockScanner => {
  let offset = 0;
  let column = 0;
  let currentTip = tip;
  return {
    currentLine, lineStart: 0, lineNumber: 2,
    get offset() { return offset; }, get column() { return column; },
    nextNonspace: indent, nextNonspaceColumn: indent, indent, indented: indent >= 4,
    blank: currentLine.trim().length === 0, get tip() { return currentTip; }, allClosed: true,
    advanceOffset: (count) => { offset += count; column += count; },
    advanceNextNonspace: () => { offset = indent; column = indent; },
    findNextNonspace: () => {}, closeUnmatchedBlocks: () => {},
    setScanPosition: (at, col) => { offset = at; column = col; }, setLastLineLength: () => {}, addLine: () => {},
    addChild: (type, at) => { const node = makeBlockNode(type, at, 2); node.parent = currentTip; currentTip.children.push(node); currentTip = node; return node; },
    replaceBlock: (block, type) => { const node = makeBlockNode(type, block.startOffset, block.startLine); node.stringContent = block.stringContent; node.segments.push(...block.segments); currentTip = node; return node; },
    insertBefore: (block, type) => { const node = makeBlockNode(type, block.startOffset, block.startLine); node.parent = block.parent; block.parent?.children.unshift(node); return node; },
    finalizeBlock: (block) => { block.open = false; currentTip = block.parent ?? tip; },
  };
};
import { definitionConstruct, extractDefinitions } from "../../../../effected/markdown/internal/blocks/linkReferenceDefinition.ts";

describe("definition construct coverage", () => {
  it.effect("leaves an orphan paragraph unchanged and appends before a detached child", () => Effect.sync(() => {
    const block = makeBlockNode("paragraph", 0, 1);
    block.stringContent = "[key]: /target";
    extractDefinitions(block);
    assert.strictEqual(block.stringContent, "[key]: /target");
    const parent = makeBlockNode("document", 0, 1);
    block.parent = parent;
    extractDefinitions(block);
    assert.strictEqual(parent.children[0]?.data.definition?.url, "/target");
    assert.strictEqual(block.stringContent, "");
    assert.strictEqual(block.startOffset, 0);
  }));
  it.effect("rejects missing definition data and materializes untitled definitions", () => Effect.sync(() => {
    const block = makeBlockNode("definition", 4, 1);
    assert.strictEqual(definitionConstruct.canContain("paragraph"), false);
    assert.strictEqual(definitionConstruct.continue(scannerFor("", block), block), 1);
    assert.strictEqual(definitionConstruct.materialize(block, [], context), undefined);
    block.data.definition = { key: "id", identifier: "id", label: "Id", url: "/target" };
    const node = definitionConstruct.materialize(block, [], context);
    assert.strictEqual(node?.type, "definition");
    if (node?.type === "definition") { assert.strictEqual(node.url, "/target"); assert.strictEqual(node.title, undefined); }
  }));
});
