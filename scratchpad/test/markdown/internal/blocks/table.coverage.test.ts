import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Position, TableCell, TableRow } from "../../../../effected/markdown/MarkdownNode.ts";
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
import { tableCellConstruct, tableConstruct, tableHeaderStart, tableRowConstruct, tableRowStart } from "../../../../effected/markdown/internal/blocks/table.ts";

describe("table construct coverage", () => {
  it.effect("checks containment and closed row/cell continuation", () => Effect.sync(() => {
    const block = makeBlockNode("table", 0, 1);
    const scanner = scannerFor("body", block);
    assert.strictEqual(tableConstruct.canContain("tableRow"), true);
    assert.strictEqual(tableConstruct.canContain("paragraph"), false);
    assert.strictEqual(tableRowConstruct.canContain("tableCell"), true);
    assert.strictEqual(tableRowConstruct.canContain("paragraph"), false);
    assert.strictEqual(tableCellConstruct.canContain("paragraph"), false);
    assert.strictEqual(tableRowConstruct.continue(scanner, block), 1);
    assert.strictEqual(tableCellConstruct.continue(scanner, block), 1);
    assert.strictEqual(tableConstruct.materialize(block, [], context), undefined);
    const row = TableRow.make({ children: [TableCell.make({ children: [] })] });
    const node = tableConstruct.materialize(block, [row], context);
    assert.deepStrictEqual(node?.type === "table" ? node.align : undefined, []);
  }));
  it.effect("ends on indentation, invalid rows and missing or exhausted metadata", () => Effect.sync(() => {
    const block = makeBlockNode("table", 0, 1);
    assert.strictEqual(tableConstruct.continue(scannerFor("    x", block, 4), block), 1);
    assert.strictEqual(tableRowStart.trigger(scannerFor("x", block), block), 0);
    block.data.tableData = { columns: 2, rows: 0x80001, nonemptyCells: 0, align: [] };
    assert.strictEqual(tableRowStart.trigger(scannerFor("x", block), block), 0);
    block.data.tableData.rows = 1;
    assert.strictEqual(tableRowStart.trigger(scannerFor("\rbroken", block), block), 0);
    assert.strictEqual(tableRowStart.trigger(scannerFor("|", block), block), 0);
    assert.strictEqual(tableConstruct.continue(scannerFor("\rbroken", block), block), 1);
  }));
  it.effect("rejects malformed headers and maps content with missing provenance", () => Effect.sync(() => {
    const block = makeBlockNode("paragraph", 17, 1);
    block.stringContent = "a|b\n";
    assert.strictEqual(tableHeaderStart.trigger(scannerFor("-|x", block), block), 0);
    assert.strictEqual(tableHeaderStart.trigger(scannerFor("-|--", block), block), 2);
    const broken = makeBlockNode("paragraph", 0, 1);
    broken.stringContent = "\rbroken";
    assert.strictEqual(tableHeaderStart.trigger(scannerFor("-|-", broken), broken), 0);
    assert.strictEqual(broken.data.tableVisited, true);
  }));
  it.effect("retains discontinuous provenance around escaped pipes", () => Effect.sync(() => {
    const block = makeBlockNode("paragraph", 10, 1);
    block.stringContent = "\\|a\\|b|c\n";
    block.segments.push({ textOffset: 0, sourceOffset: 10, length: 1 }, { textOffset: 2, sourceOffset: 20, length: 7 });
    const scanner = scannerFor("-|-", block);
    assert.strictEqual(tableHeaderStart.trigger(scanner, block), 2);
    const row = scanner.tip.children[0];
    assert.strictEqual(row?.children[0]?.stringContent, "|a|b");
    assert.ok((row?.children[0]?.segments.length ?? 0) > 0);
  }));
  it.effect("uses final segment end for content outside recorded provenance", () => Effect.sync(() => {
    const block = makeBlockNode("paragraph", 10, 1);
    block.stringContent = "a|b\r\n";
    block.segments.push({ textOffset: 0, sourceOffset: 10, length: 1 });
    const scanner = scannerFor("-|-", block);
    assert.strictEqual(tableHeaderStart.trigger(scanner, block), 2);
    assert.strictEqual(scanner.tip.children[0]?.endOffset, 11);
    assert.strictEqual(scanner.tip.children[0]?.children[1]?.startOffset, 11);
  }));

  it.effect("reclaims preceding paragraph lines and pads short body rows", () => Effect.sync(() => {
    const root = parseBlocks("before\\|text\n| a | b |\n| - | - |\nshort\n", { dialect: "gfm" }).root;
    assert.deepStrictEqual(root.children.map((node) => node.type), ["paragraph", "table"]);
    const table = root.children[1];
    assert.strictEqual(table?.type === "table" ? table.children[1]?.children.length : undefined, 2);
    const paragraph = root.children[0];
    assert.strictEqual(paragraph?.type === "paragraph" && paragraph.children[0]?.type === "text" ? paragraph.children[0].value : undefined, "before|text");
  }));
  it.effect("maps a source gap to the next recorded segment", () => Effect.sync(() => {
    const block = makeBlockNode("paragraph", 10, 1);
    block.stringContent = "a|b\n";
    block.segments.push({ textOffset: 2, sourceOffset: 20, length: 2 });
    const scanner = scannerFor("-|-", block);
    assert.strictEqual(tableHeaderStart.trigger(scanner, block), 2);
    assert.strictEqual(scanner.tip.startOffset, 20);
    assert.strictEqual(scanner.tip.children[0]?.children[0]?.startOffset, 20);
  }));

});
