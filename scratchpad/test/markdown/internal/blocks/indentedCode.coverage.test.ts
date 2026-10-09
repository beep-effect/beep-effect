import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeBlockNode } from "../../../../effected/markdown/internal/blockTypes.ts";
import type { BlockScanner } from "../../../../effected/markdown/internal/blockTypes.ts";

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
import { indentedCodeStart } from "../../../../effected/markdown/internal/blocks/indentedCode.ts";
describe("indented code start boundary coverage", () => {
 it.effect("unindented text, paragraph continuations and blank lines cannot open indented code", () => Effect.sync(() => {
  const samples = [scanner({currentLine: "text"}), scanner({currentLine: "    text", indent: 4, indented: true, tip: makeBlockNode("paragraph", 0, 1)}), scanner({currentLine: "    ", indent: 4, indented: true, blank: true})];
  for (const scan of samples) { assert.strictEqual(indentedCodeStart.trigger(scan, scan.tip), 0); assert.strictEqual(scan.offset, 0); }
 }));
});
