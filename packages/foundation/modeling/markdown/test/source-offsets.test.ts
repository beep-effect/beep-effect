import { sourceOffsetAt } from "@beep/markdown/internal/segments";
import { Markdown } from "@beep/markdown/Markdown";
import { Point } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { Blockquote, Definition, FlowContent, Root } from "@beep/markdown/MarkdownNode";

const blockquoteAt = (children: ReadonlyArray<Root["children"][number]>, index: number): Blockquote => {
  const node = children[index];
  if (node?.type !== "blockquote") return assert.fail("expected a blockquote");
  return node;
};

const definitionAt = (children: ReadonlyArray<FlowContent>, index: number, message: string): Definition => {
  const node = children[index];
  if (node?.type !== "definition") return assert.fail(message);
  return node;
};

const assertScaledDefinitions = (children: ReadonlyArray<FlowContent>, lines: ReadonlyArray<string>): void => {
  let offset = 0;
  A.forEach(lines, (line, index) => {
    const definition = definitionAt(children, index, "expected a definition");
    assert.strictEqual(definition.identifier, `key${index}`);
    assert.strictEqual(definition.url, `/target${index}`);
    assert.deepStrictEqual(
      definition.position.start,
      Point.make({ offset: offset + 2, line: index + 1, column: 3 }),
      "each scaled definition span starts inside its `> ` prefix"
    );
    assert.deepStrictEqual(
      definition.position.end,
      Point.make({ offset: offset + line.length - 2, line: index + 1, column: line.length - 1 }),
      "each scaled definition span ends before its CRLF"
    );
    offset += line.length;
  });
};

const assertSetextTail = (
  children: ReadonlyArray<FlowContent>,
  size: number,
  tailOffset: number,
  sourceLength: number
): void => {
  const heading = children[size + 2];
  if (heading?.type !== "heading") assert.fail("expected the surviving setext heading");
  assert.deepStrictEqual(heading.position.start, Point.make({ offset: tailOffset + 2, line: size + 4, column: 3 }));
  assert.deepStrictEqual(heading.position.end, Point.make({ offset: sourceLength - 2, line: size + 5, column: 6 }));
  const emphasis = heading.children[1];
  if (emphasis?.type !== "emphasis") assert.fail("expected positioned emphasis");
  assert.strictEqual(emphasis.position.start.offset, tailOffset + 7);
  assert.strictEqual(emphasis.position.end.offset, tailOffset + 13);
  assert.strictEqual(emphasis.children[0]?.position.start.offset, tailOffset + 8);
  assert.strictEqual(emphasis.children[0]?.position.end.offset, tailOffset + 12);
};

describe("segmented source offsets", () => {
  it("preserves fallback, gaps, duplicate starts and exclusive ends in both call forms", () => {
    const segments = [
      { textOffset: 2, sourceOffset: 10, length: 3 },
      { textOffset: 8, sourceOffset: 30, length: 0 },
      { textOffset: 8, sourceOffset: 40, length: 2 },
      { textOffset: 10, sourceOffset: 60, length: 2 },
    ];
    const cases = [
      [-1, 7],
      [0, 7],
      [2, 10],
      [4, 12],
      [5, 13],
      [7, 13],
      [8, 40],
      [9, 41],
      [10, 60],
      [11, 61],
      [12, 62],
      [100, 62],
      [Number.NaN, 62],
      [Number.POSITIVE_INFINITY, 62],
      [Number.NEGATIVE_INFINITY, 7],
    ] as const;
    for (const [index, expected] of cases) {
      assert.strictEqual(sourceOffsetAt(segments, index, 7), expected);
      assert.strictEqual(sourceOffsetAt(index, 7)(segments), expected);
    }
    assert.strictEqual(sourceOffsetAt([], 0, 7), 7);
    assert.strictEqual(sourceOffsetAt([{ textOffset: 0, sourceOffset: 20, length: 0 }], 0, 7), 20);
  });

  it("bounds segment-start reads logarithmically across a long ordered index", () => {
    const size = 32_000;
    let reads = 0;
    const segments = A.makeBy(size, (index) => ({
      get textOffset() {
        reads += 1;
        return index * 4;
      },
      sourceOffset: index * 8,
      length: 3,
    }));
    for (let index = 0; index < size; index += 1) {
      assert.strictEqual(sourceOffsetAt(segments, index * 4, -1), index * 8);
    }
    assert.isAtMost(reads, size * 18);
  });

  it("positions every emphasis and text endpoint in a long multiline paragraph", () => {
    const size = 8_000;
    const source = Str.repeat(size)("a *b*\n");
    const root = Result.getOrThrow(Markdown.parseResult(source));
    assert.strictEqual(root.children.length, 1);
    const paragraph = root.children[0];
    if (paragraph?.type !== "paragraph") assert.fail("expected a paragraph");
    let count = 0;
    for (const child of paragraph.children) {
      if (child.type !== "emphasis") continue;
      assert.strictEqual(child.position.start.offset, count * 6 + 2);
      assert.strictEqual(child.position.end.offset, count * 6 + 5);
      assert.strictEqual(child.position.start.line, count + 1);
      assert.strictEqual(child.position.end.column, 6);
      const text = child.children[0];
      assert.strictEqual(text?.position.start.offset, count * 6 + 3);
      assert.strictEqual(text?.position.end.offset, count * 6 + 4);
      count += 1;
    }
    assert.strictEqual(count, size);
  });

  it("positions scaled definitions, a multiline title and the surviving setext heading across CRLF prefixes", () => {
    for (const size of [2_000, 8_000]) {
      const lines = A.makeBy(size, (index) => `> [key${index}]: /target${index}\r\n`);
      const duplicate = "> [KEY0]: /ignored\r\n";
      const multiline = '> [multi]: /target\r\n>   "title"\r\n';
      const tail = "> tail *text*\r\n> ===\r\n";
      const prefix = A.join(lines, "");
      const source = prefix + duplicate + multiline + tail;
      const root = Result.getOrThrow(Markdown.parseResult(source));
      const quote = blockquoteAt(root.children, 0);
      assert.strictEqual(quote.children.length, size + 3);
      assertScaledDefinitions(quote.children, lines);
      const repeated = definitionAt(quote.children, size, "expected the duplicate definition");
      assert.strictEqual(repeated.identifier, "key0");
      assert.strictEqual(repeated.url, "/ignored");
      assert.strictEqual(repeated.position.start.offset, prefix.length + 2);
      const titled = definitionAt(quote.children, size + 1, "expected the multiline definition");
      assert.strictEqual(titled.title, "title");
      assert.deepStrictEqual(
        titled.position.start,
        Point.make({ offset: prefix.length + duplicate.length + 2, line: size + 2, column: 3 })
      );
      assert.deepStrictEqual(
        titled.position.end,
        Point.make({ offset: prefix.length + duplicate.length + multiline.length - 2, line: size + 3, column: 12 })
      );
      assertSetextTail(quote.children, size, prefix.length + duplicate.length + multiline.length, source.length);
    }
  });
});
