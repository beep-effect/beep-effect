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
import { blockquoteStart } from "../../../../effected/markdown/internal/blocks/blockquote.ts";
describe("blockquote marker boundary coverage", () => {
 it.effect("a bare marker opens a quote without consuming a nonexistent following space", () => Effect.sync(() => {
  let child = makeBlockNode("document", 0, 1);
  const scan = scanner({currentLine: ">", addChild: (type, offset) => { child = makeBlockNode(type, offset, 1); return child; }});
  assert.strictEqual(blockquoteStart.trigger(scan, scan.tip), 1);
  assert.strictEqual(scan.offset, 1); assert.strictEqual(child.type, "blockquote");
 }));
});
