// Fenced code blocks with source spans (R6): the shared owner behind docgen's
// example extraction and the repo-cli Markdown laws. Every case pins the
// spans by slicing the source, so an offset drift shows as a wrong slice.

import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFence } from "@beep/markdown/MarkdownFence";
import { Code, Root } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import type { CodeFence } from "@beep/markdown/MarkdownFence";

const fences = (source: string): ReadonlyArray<CodeFence> =>
  MarkdownFence.fences(Result.getOrThrow(MarkdownDocument.parseResult(source)));

const only = (source: string): CodeFence => {
  const found = fences(source);
  assert.strictEqual(found.length, 1);
  return A.getUnsafe(found, 0);
};

const slice = (source: string, start: number, end: number): string => Str.slice(start, end)(source);

const tick3 = Str.repeat(3)("`");

describe("MarkdownFence.fences", () => {
  it.effect("spans the opening fence, the raw info string and the body of a closed fence", () =>
    Effect.sync(() => {
      const source = `before\n${tick3}ts  name='a' \nconst a = 1\n\nconst b = 2\n${tick3}  \nafter\n`;
      const fence = only(source);
      assert.strictEqual(fence.infoString, "ts  name='a' ");
      assert.strictEqual(slice(source, fence.infoStart, fence.infoEnd), fence.infoString);
      assert.strictEqual(fence.body, "const a = 1\n\nconst b = 2\n");
      assert.strictEqual(fence.value, fence.body);
      assert.strictEqual(slice(source, fence.bodyStart, fence.bodyEnd), fence.body);
      assert.strictEqual(
        slice(source, fence.fenceStart, fence.fenceEnd),
        `${tick3}ts  name='a' \n${fence.body}${tick3}`
      );
      assert.strictEqual(fence.line, 1);
      assert.strictEqual(fence.fenceChar, "`");
      assert.strictEqual(fence.fenceLength, 3);
      assertFalse(fence.unterminated);
    })
  );

  it.effect("closes a tilde fence with a longer run and keeps an empty body empty", () =>
    Effect.sync(() => {
      const source = "~~~~\n~~~~~~\n";
      const fence = only(source);
      assert.strictEqual(fence.fenceChar, "~");
      assert.strictEqual(fence.fenceLength, 4);
      assert.strictEqual(fence.infoString, "");
      assert.strictEqual(fence.body, "");
      assert.strictEqual(fence.bodyStart, fence.bodyEnd);
      assertFalse(fence.unterminated);
    })
  );

  it.effect("keeps CRLF terminators in the body and out of the info string", () =>
    Effect.sync(() => {
      const source = `${tick3}tsx\r\nconst view = <div />\r\n${tick3}\r\n`;
      const fence = only(source);
      assert.strictEqual(fence.infoString, "tsx");
      assert.strictEqual(fence.body, "const view = <div />\r\n");
      assert.strictEqual(fence.value, "const view = <div />\n");
    })
  );

  it.effect("reports a fence the document ends as unterminated, with the body running to the block end", () =>
    Effect.sync(() => {
      const source = `a\n\n${tick3}ts\nconst a = 1\n~~~\n`;
      const fence = only(source);
      assertTrue(fence.unterminated);
      assert.strictEqual(fence.body, "const a = 1\n~~~");
      assert.strictEqual(fence.bodyEnd, fence.fenceEnd);
    })
  );

  it.effect("reports an opening fence on the last line as unterminated with an empty body", () =>
    Effect.sync(() => {
      const fence = only(`${tick3}ts`);
      assertTrue(fence.unterminated);
      assert.strictEqual(fence.infoString, "ts");
      assert.strictEqual(fence.body, "");
    })
  );

  it.effect("ends a fence with its blockquote and keeps the container prefix in the raw body", () =>
    Effect.sync(() => {
      const source = `> ${tick3}ts\n> const a = 1\n\nafter\n`;
      const fence = only(source);
      assertTrue(fence.unterminated);
      assert.strictEqual(fence.body, "> const a = 1");
      assert.strictEqual(fence.value, "const a = 1\n");
    })
  );

  it.effect("lists nested and sibling fences in document order and skips indented code", () =>
    Effect.sync(() => {
      const source = `    indented\n\n- item\n\n  ${tick3}ts\n  const a = 1\n  ${tick3}\n\n${tick3}sh\nls\n${tick3}\n`;
      const found = fences(source);
      assert.deepStrictEqual(
        A.map(found, (fence) => [fence.infoString, fence.line, fence.body, fence.value]),
        [
          ["ts", 4, "  const a = 1\n", "const a = 1\n"],
          ["sh", 8, "ls\n", "ls\n"],
        ]
      );
    })
  );

  it.effect("does not open a fence on a backtick run inside prose or a code span", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(fences(`Write \`${tick3}ts\` to open one.\n`), []);
    })
  );

  it.effect("reads a constructed fence that records no marker length as a three-marker run", () =>
    Effect.sync(() => {
      const source = `${tick3}ts\na\n${tick3}\n`;
      const parsed = Result.getOrThrow(MarkdownDocument.parseResult(source));
      const code = A.getUnsafe(parsed.root.children, 0);
      assertTrue(S.is(Code)(code));
      const document = MarkdownDocument.make({
        source,
        root: Root.make({ ...parsed.root, children: [Code.make(Struct.omit(code, ["fenceLength"]))] }),
        diagnostics: [],
        definitions: parsed.definitions,
        definitionOrder: parsed.definitionOrder,
      });
      const fence = A.getUnsafe(MarkdownFence.fences(document), 0);
      assert.strictEqual(fence.fenceLength, 3);
      assert.strictEqual(fence.infoString, "ts");
      assert.strictEqual(fence.body, "a\n");
    })
  );
});

describe("Code.unterminated", () => {
  it.effect("is set only on an unterminated fenced block", () =>
    Effect.sync(() => {
      const codes = (source: string) =>
        Result.getOrThrow(MarkdownDocument.parseResult(source)).findAll((node): node is Code => node.type === "code");
      assert.deepStrictEqual(
        A.map(codes(`${tick3}\na\n${tick3}\n\n    b\n\n${tick3}\nc\n`), (node) => node.unterminated),
        [undefined, undefined, true]
      );
    })
  );

  it.effect("round-trips through the schema", () =>
    Effect.gen(function* () {
      const node = Code.make({ value: "a\n", fenceChar: "`", fenceLength: 3, unterminated: true });
      const decoded = yield* S.decodeEffect(Code)(yield* S.encodeEffect(Code)(node));
      assertTrue(decoded.unterminated === true);
    })
  );
});
