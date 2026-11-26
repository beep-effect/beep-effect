// decision: visitor-walks-parsed-tree

import { Markdown } from "@beep/markdown/Markdown";
import { Blockquote, Paragraph, Point, Position, Root, Text } from "@beep/markdown/MarkdownNode";
import { MarkdownVisitor, MarkdownVisitorEvent } from "@beep/markdown/MarkdownVisitor";
import { Mdast } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { MarkdownParseOptions } from "@beep/markdown/Markdown";

const parse = (text: string, options?: MarkdownParseOptions.Encoded) => {
  const result = Markdown.parseResult(text, options);
  assertSuccess(
    Result.map(result, () => undefined),
    undefined
  );
  return Result.getOrThrow(result);
};

const collect = Effect.fn("test.collect")(function* (root: Root) {
  return yield* MarkdownVisitor.visit(root).pipe(Stream.runCollect);
});

const deepForeignTree = (depth: number): unknown => {
  let node: unknown = { type: "paragraph", children: [{ type: "text", value: "x" }] };
  for (let i = 0; i < depth; i++) {
    node = { type: "blockquote", children: [node] };
  }
  return { type: "root", children: [node] };
};

const syntheticPosition = Position.make({
  start: Point.make({ line: 1, column: 1, offset: 0 }),
  end: Point.make({ line: 1, column: 1, offset: 0 }),
});

describe("MarkdownVisitor", () => {
  it.effect(
    "emits the exact enter/exit sequence for a small document",
    Effect.fnUntraced(function* () {
      const root = parse("hello *world*\n");
      const events = yield* collect(root);
      const shape = A.map(events, (event) =>
        event._tag === "Error"
          ? "Error"
          : `${event._tag}:${event.node.type}@${event.depth}[${A.join(A.map(event.path, String), ".")}]`
      );
      assert.deepStrictEqual(shape, [
        "Enter:root@0[]",
        "Enter:paragraph@1[0]",
        "Enter:text@2[0.0]",
        "Exit:text@2[0.0]",
        "Enter:emphasis@2[0.1]",
        "Enter:text@3[0.1.0]",
        "Exit:text@3[0.1.0]",
        "Exit:emphasis@2[0.1]",
        "Exit:paragraph@1[0]",
        "Exit:root@0[]",
      ]);
    })
  );

  it.effect(
    "walks an empty document as a bare root pair",
    Effect.fnUntraced(function* () {
      const events = yield* collect(parse(""));
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0]?._tag, "Enter");
      assert.strictEqual(events[1]?._tag, "Exit");
    })
  );

  it.effect(
    "covers gfm constructs and frontmatter in document order with balanced events",
    Effect.fnUntraced(function* () {
      const source = A.join(
        [
          "---",
          "title: x",
          "---",
          "# Head",
          "",
          "- [x] task ~~gone~~",
          "",
          "| a |",
          "| - |",
          "| b |",
          "",
          "Text[^f]",
          "",
          "[^f]: note",
          "",
        ],
        "\n"
      );
      const root = parse(source, { dialect: "gfm", frontmatter: true });
      const events = yield* collect(root);

      const stack: Array<string> = [];
      for (const event of events) {
        assert.notStrictEqual(event._tag, "Error", "a parsed tree walks with no Error events");
        if (event._tag === "Enter") {
          stack.push(event.node.type);
        } else if (event._tag === "Exit") {
          assert.strictEqual(event.node.type, stack.pop());
        }
      }
      assert.strictEqual(stack.length, 0, "balanced: every Enter has a matching LIFO Exit");

      const entered = A.map(
        A.filter(events, (event) => event._tag === "Enter"),
        (event) => event.node.type
      );
      assert.strictEqual(entered[0], "root");
      assert.strictEqual(entered[1], "frontmatter", "document order: frontmatter is the first child entered");
      for (const expected of ["heading", "listItem", "delete", "table", "tableRow", "tableCell", "footnoteReference"]) {
        assert.include(entered, expected, "every gfm node type appears");
      }
    })
  );

  it.effect(
    "reports path segments as child indexes from the root",
    Effect.fnUntraced(function* () {
      const root = parse("> - item\n");
      const events = yield* collect(root);
      const text = O.getOrUndefined(
        A.findFirst(events, (event) => MarkdownVisitorEvent.guards.Enter(event) && event.node.type === "text")
      );
      assert.isDefined(text);
      if (text !== undefined && text._tag === "Enter") {
        assert.deepStrictEqual(
          [...text.path],
          [0, 0, 0, 0, 0],
          "root > blockquote[0] > list[0] > listItem[0] > paragraph[0] > text[0]"
        );
        assert.strictEqual(text.depth, 5);
      }
    })
  );

  it.effect(
    "terminates early under Stream.take without walking the rest",
    Effect.fnUntraced(function* () {
      const root = parse("a\n\nb\n\nc\n");
      const events = yield* MarkdownVisitor.visit(root).pipe(Stream.take(3), Stream.runCollect);
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[0]?._tag, "Enter");
    })
  );

  it.effect(
    "bounds sibling reads for a fixed event prefix by stream chunking",
    Effect.fnUntraced(function* () {
      let previousReads: number | undefined;
      for (const size of [10_000, 50_000]) {
        let reads = 0;
        const paragraph = Paragraph.make({ children: [], position: syntheticPosition });
        const root = Root.make({ children: A.makeBy(size, () => paragraph), position: syntheticPosition });
        for (let index = 0; index < size; index++) {
          Object.defineProperty(root.children, index, {
            get() {
              reads++;
              return paragraph;
            },
          });
        }
        reads = 0;
        const events = yield* MarkdownVisitor.visit(root).pipe(Stream.take(2), Stream.runCollect);
        const consumed = reads;
        assert.deepStrictEqual(events, [
          { _tag: "Enter", node: root, path: [], depth: 0 },
          { _tag: "Enter", node: paragraph, path: [0], depth: 1 },
        ]);
        assert.isAbove(consumed, 0);
        assert.isAtMost(
          consumed,
          Stream.DefaultChunkSize,
          "fromIterable pulls a whole chunk even when take requests only two events"
        );
        if (previousReads !== undefined) {
          assert.strictEqual(consumed, previousReads);
        }
        previousReads = consumed;
      }
    })
  );

  it.effect(
    "events are structurally equal for the same walk",
    Effect.fnUntraced(function* () {
      const root = parse("hi\n");
      const [first] = yield* collect(root);
      const [again] = yield* collect(root);
      assert.isTrue(Equal.equals(first, again));
    })
  );

  it.effect(
    "walks a tree exactly at the depth cap without an Error event",
    Effect.fnUntraced(function* () {
      const blockquotesPuttingTextAtCap = 254;
      const result = Mdast.fromMdastResult(deepForeignTree(blockquotesPuttingTextAtCap));
      assertSuccess(
        Result.map(result, () => undefined),
        undefined
      );
      const events = yield* result.pipe(Result.getOrThrow, collect);
      assert.isFalse(
        A.some(events, (event) => event._tag === "Error"),
        "254 blockquotes put the text at depth 256, exactly the cap, which is legal"
      );
    })
  );

  it.effect(
    "surfaces a decoded foreign tree past the cap as an Error event ending the walk",
    Effect.fnUntraced(function* () {
      const result = Mdast.fromMdastResult(deepForeignTree(300));
      assertSuccess(
        Result.map(result, () => undefined),
        undefined
      );
      const tree = Result.getOrThrow(result);

      const events = yield* collect(tree);
      const last = events[events.length - 1];
      assert.isDefined(last);
      assert.strictEqual(last?._tag, "Error");
      if (last !== undefined && last._tag === "Error") {
        assert.strictEqual(last.diagnostic.code, "NestingDepthExceeded");
      }
      assert.strictEqual(
        A.filter(events, (event) => event._tag === "Error").length,
        1,
        "the Error event is terminal: exactly one, nothing after it"
      );

      const stringifyFailsTyped = Result.mapError(Markdown.stringifyResult(tree), () => undefined);
      assertFailure(stringifyFailsTyped, undefined);
    })
  );

  it("constructs events via the tagged-union cases and narrows them with its guards", () => {
    const node = Text.make({ value: "x", position: syntheticPosition });
    const event = MarkdownVisitorEvent.cases.Enter.make({ node, path: [0], depth: 1 });
    assert.strictEqual(event._tag, "Enter");
    assert.isTrue(MarkdownVisitorEvent.guards.Enter(event));
    assert.isFalse(MarkdownVisitorEvent.guards.Exit(event));
    assert.isTrue(S.is(MarkdownVisitorEvent)(event));
  });

  it.effect(
    "enter and exit fire for a leaf back to back",
    Effect.fnUntraced(function* () {
      const paragraph = Paragraph.make({
        children: [Text.make({ value: "x", position: syntheticPosition })],
        position: syntheticPosition,
      });
      const root = Root.make({ children: [paragraph], position: syntheticPosition });
      const events = yield* collect(root);
      const tags = A.map(events, (event) => event._tag);
      assert.deepStrictEqual(tags, ["Enter", "Enter", "Enter", "Exit", "Exit", "Exit"]);
    })
  );

  it.effect(
    "blockquote nesting inside the cap via make-constructed classes walks clean",
    Effect.fnUntraced(function* () {
      let node: Blockquote | Paragraph = Paragraph.make({
        children: [Text.make({ value: "x", position: syntheticPosition })],
        position: syntheticPosition,
      });
      for (let i = 0; i < 10; i++) {
        node = Blockquote.make({ children: [node], position: syntheticPosition });
      }
      const root = Root.make({ children: [node], position: syntheticPosition });
      const events = yield* collect(root);
      assert.strictEqual(events.length, 2 * (1 + 10 + 1 + 1));
      assert.isFalse(A.some(events, (event) => event._tag === "Error"));
    })
  );
});
