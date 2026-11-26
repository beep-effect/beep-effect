import { ListData, makeBlockNode } from "@beep/markdown/internal/blockTypes";
import { Position } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type { BlockNode, BlockScanner, MaterializeContext } from "@beep/markdown/internal/blockTypes";

const context: MaterializeContext = {
  position: dual(
    2,
    (start: number, end: number): Position =>
      Position.make({
        start: { line: 1, column: start + 1, offset: start },
        end: { line: 1, column: end + 1, offset: end },
      })
  ),
  inlineSlice: (block) => ({
    text: block.stringContent,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
    segments: block.segments,
    children: [],
  }),
  registerInline: dual(2, (_parent: InlineHost, _prepared: PreparedInline): void => {}),
};
const scannerFor = (currentLine: string, tip: BlockNode, indent = 0): BlockScanner => {
  let offset = 0;
  let column = 0;
  let currentTip = tip;
  return {
    currentLine,
    lineStart: 0,
    lineNumber: 2,
    get offset() {
      return offset;
    },
    get column() {
      return column;
    },
    nextNonspace: indent,
    nextNonspaceColumn: indent,
    indent,
    indented: indent >= 4,
    blank: Str.trim(currentLine).length === 0,
    get tip() {
      return currentTip;
    },
    allClosed: true,
    advanceOffset: dual(
      (args) => P.isNumber(args[0]),
      (count: number, _columns?: boolean): void => {
        offset += count;
        column += count;
      }
    ),
    advanceNextNonspace: () => {
      offset = indent;
      column = indent;
    },
    findNextNonspace: () => {},
    closeUnmatchedBlocks: () => {},
    setScanPosition: dual(2, (at: number, col: number): void => {
      offset = at;
      column = col;
    }),
    setLastLineLength: () => {},
    addLine: () => {},
    addChild: dual(2, (type: BlockType, at: number): BlockNode => {
      const node = makeBlockNode(type, at, 2);
      node.parent = currentTip;
      currentTip.children.push(node);
      currentTip = node;
      return node;
    }),
    replaceBlock: dual(2, (block: BlockNode, type: BlockType): BlockNode => {
      const node = makeBlockNode(type, block.startOffset, block.startLine);
      node.stringContent = block.stringContent;
      node.segments.push(...block.segments);
      currentTip = node;
      return node;
    }),
    insertBefore: dual(2, (block: BlockNode, type: BlockType): BlockNode => {
      const node = makeBlockNode(type, block.startOffset, block.startLine);
      node.parent = block.parent;
      block.parent?.children.unshift(node);
      return node;
    }),
    finalizeBlock: dual(2, (block: BlockNode, _lineNumber: number): void => {
      block.open = false;
      currentTip = block.parent ?? tip;
    }),
  };
};

import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { listConstruct, listItemConstruct, listItemStart } from "@beep/markdown/internal/blocks/list";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { BlockType, InlineHost, MaterializedBlock, PreparedInline } from "@beep/markdown/internal/blockTypes";
import type { List, ListItem, Root } from "@beep/markdown/MarkdownNode";

type AnyBlock = MaterializedBlock | Root["children"][number];

const asList = (node: AnyBlock | undefined): List =>
  node !== undefined && node.type === "list" ? node : assert.fail(`expected a list, got ${node?.type}`);

const asListItem = (node: AnyBlock | undefined): ListItem =>
  node !== undefined && node.type === "listItem" ? node : assert.fail(`expected a list item, got ${node?.type}`);

const childTypes = (source: string): ReadonlyArray<string> =>
  A.map(parseBlocks(source).root.children, (child) => child.type);

const firstChild = (source: string): AnyBlock | undefined => parseBlocks(source).root.children[0];

describe("list construct coverage", () => {
  it.effect("finalizes empty list metadata and materializes defaults", () =>
    Effect.sync(() => {
      const block = makeBlockNode("list", 2, 1);
      assert.strictEqual(asList(listConstruct.materialize(block, [], context)).spread, false);
      listConstruct.finalize?.(scannerFor("", block), block);
      assert.strictEqual(block.data.spread, false);
      const node = asList(listConstruct.materialize(block, [], context));
      assert.deepStrictEqual([node.ordered, node.spread, node.start], [false, false, undefined]);
      const data = new ListData("ordered", 0);
      data.padding = 2;
      block.data.listData = data;
      assert.strictEqual(asList(listConstruct.materialize(block, [], context)).start, undefined);
      assert.strictEqual(listItemConstruct.continue(scannerFor("", block), block), 1);
      const item = makeBlockNode("listItem", 5, 1);
      listItemConstruct.finalize?.(scannerFor("", item), item);
      assert.strictEqual(item.endOffset, 5);
      assert.strictEqual(listItemConstruct.continue(scannerFor("text", item), item), 1);
    })
  );
  it.effect("refuses a deeply indented marker inside a list", () =>
    Effect.sync(() => {
      const block = makeBlockNode("list", 0, 1);
      assert.strictEqual(listItemStart.trigger(scannerFor("    - text", block, 4), block), 0);
      assert.deepStrictEqual(block.children, []);
    })
  );
  it.effect("opens list metadata when an existing container has none", () =>
    Effect.sync(() => {
      const block = makeBlockNode("list", 0, 1);
      const scanner = scannerFor("- item", block);
      assert.strictEqual(listItemStart.trigger(scanner, block), 1);
      assert.strictEqual(block.children[0]?.type, "list");
      assert.strictEqual(scanner.tip.type, "listItem");
      assert.strictEqual(scanner.tip.data.listData?.bulletChar, "-");
    })
  );

  it.effect("keeps markers, indentation and loose item boundaries", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(childTypes("-\n"), ["list"]);
      assert.deepStrictEqual(childTypes("-     code\n"), ["list"]);
      assert.deepStrictEqual(childTypes("paragraph\n1. item\n"), ["paragraph", "list"]);
      assert.deepStrictEqual(childTypes("paragraph\n-\n"), ["heading"]);
      assert.deepStrictEqual(childTypes("-nospace\n"), ["paragraph"]);
      assert.deepStrictEqual(childTypes("    - code\n"), ["code"]);
      assert.deepStrictEqual(childTypes("- a\n  next\n"), ["list"]);
      assert.isTrue(asList(firstChild("- a\n\n- b\n")).spread);
      assert.isTrue(asListItem(asList(firstChild("- a\n\n  b\n")).children[0]).spread);
      const paragraph = makeBlockNode("paragraph", 0, 1);
      assert.strictEqual(listItemStart.trigger(scannerFor("+", paragraph), paragraph), 0);
      const item = makeBlockNode("listItem", 0, 1);
      assert.isFalse(asListItem(listItemConstruct.materialize(item, [], context)).spread);
    })
  );
});
