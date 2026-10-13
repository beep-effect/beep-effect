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
import { parseBlocks } from "../../../../effected/markdown/internal/blockParser.ts";
import { listConstruct, listItemConstruct, listItemStart } from "../../../../effected/markdown/internal/blocks/list.ts";

describe("list construct coverage", () => {
  it.effect("finalizes empty list metadata and materializes defaults", () => Effect.sync(() => {
    const block = makeBlockNode("list", 2, 1);
    const fresh = listConstruct.materialize(block, [], context);
    assert.strictEqual(fresh?.type === "list" ? fresh.spread : undefined, false);
    listConstruct.finalize?.(scannerFor("", block), block);
    assert.strictEqual(block.data.spread, false);
    const node = listConstruct.materialize(block, [], context);
    if (node?.type === "list") { assert.strictEqual(node.ordered, false); assert.strictEqual(node.spread, false); assert.strictEqual(node.start, undefined); }
    assert.strictEqual(node?.type, "list");
    block.data.listData = { type: "ordered", tight: true, padding: 2, markerOffset: 0 };
    const ordered = listConstruct.materialize(block, [], context);
    assert.strictEqual(ordered?.type === "list" ? ordered.start : 999, undefined);
    assert.strictEqual(listItemConstruct.continue(scannerFor("", block), block), 1);
    const item = makeBlockNode("listItem", 5, 1);
    listItemConstruct.finalize?.(scannerFor("", item), item);
    assert.strictEqual(item.endOffset, 5);
    assert.strictEqual(listItemConstruct.continue(scannerFor("text", item), item), 1);
  }));
  it.effect("refuses a deeply indented marker inside a list", () => Effect.sync(() => {
    const block = makeBlockNode("list", 0, 1);
    assert.strictEqual(listItemStart.trigger(scannerFor("    - text", block, 4), block), 0);
    assert.deepStrictEqual(block.children, []);
  }));
  it.effect("opens list metadata when an existing container has none", () => Effect.sync(() => {
    const block = makeBlockNode("list", 0, 1);
    const scanner = scannerFor("- item", block);
    assert.strictEqual(listItemStart.trigger(scanner, block), 1);
    assert.strictEqual(block.children[0]?.type, "list");
    assert.strictEqual(scanner.tip.type, "listItem");
    assert.strictEqual(scanner.tip.data.listData?.bulletChar, "-");
  }));

  it.effect("keeps markers, indentation and loose item boundaries", () => Effect.sync(() => {
    const sources = ["-\n", "-     code\n", "paragraph\n1. item\n", "paragraph\n-\n", "-nospace\n", "- a\n\n- b\n", "- a\n\n  b\n", "    - code\n", "- a\n  next\n"];
    const roots = sources.map((source) => parseBlocks(source).root);
    assert.strictEqual(roots[0]?.children[0]?.type, "list");
    assert.strictEqual(roots[1]?.children[0]?.type, "list");
    assert.strictEqual(roots[2]?.children[1]?.type, "list");
    assert.strictEqual(roots[3]?.children[0]?.type, "heading");
    assert.strictEqual(roots[4]?.children[0]?.type, "paragraph");
    const loose = roots[5]?.children[0];
    assert.strictEqual(loose?.type === "list" ? loose.spread : undefined, true);
    const spreadItem = roots[6]?.children[0];
    assert.strictEqual(spreadItem?.type === "list" ? spreadItem.children[0]?.spread : undefined, true);
    assert.strictEqual(roots[7]?.children[0]?.type, "code");
    assert.strictEqual(roots[8]?.children[0]?.type, "list");
    const paragraph = makeBlockNode("paragraph", 0, 1);
    assert.strictEqual(listItemStart.trigger(scannerFor("+", paragraph), paragraph), 0);
    const item = makeBlockNode("listItem", 0, 1);
    const node = listItemConstruct.materialize(item, [], context);
    assert.strictEqual(node?.type === "listItem" ? node.spread : undefined, false);
  }));

});
