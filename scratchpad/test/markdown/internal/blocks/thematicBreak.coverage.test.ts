import { assert, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { thematicBreakConstruct } from "../../../../effected/markdown/internal/blocks/thematicBreak.ts";
import type { BlockScanner } from "../../../../effected/markdown/internal/blockTypes.ts";
import { makeBlockNode } from "../../../../effected/markdown/internal/blockTypes.ts";
import { Position } from "../../../../effected/markdown/MarkdownNode.ts";

it.effect("rejects children and materializes a synthetic break without inventing a marker", () => Effect.sync(() => {
  const block = makeBlockNode("thematicBreak", 0, 0, 1);
  const position = Position.make({ start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } });
  const node = thematicBreakConstruct.materialize(block, [], { position: () => position, registerInline: () => undefined, inlineSlice: () => ({ text: "", startOffset: 0, endOffset: 0, segments: [], children: [] }) });
  assertDefined(node);
  assert.strictEqual(thematicBreakConstruct.canContain("paragraph"), false);
  assert.strictEqual(node.type, "thematicBreak");
  assert.deepStrictEqual(node.position, position);
  assert.strictEqual("markerChar" in node, false);
}));

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

it.effect("ends on the next line rather than absorbing it", () => Effect.sync(() => {
  const block = makeBlockNode("thematicBreak", 0, 1);
  assert.strictEqual(thematicBreakConstruct.continue(scanner({ currentLine: "next" }), block), 1);
}));
