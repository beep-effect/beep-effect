import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { MarkdownParseOptions } from "@beep/markdown/Markdown";
import type { PhrasingContent } from "@beep/markdown/MarkdownNode";

const phrasing = (text: string, options?: MarkdownParseOptions.Encoded) => {
  const result = Markdown.parsePhrasingResult(text, options);
  assertSuccess(result, Result.getOrThrow(result));
  return Result.isSuccess(result) ? result.success : [];
};

const splicedFromFullParse = (text: string): ReadonlyArray<PhrasingContent> => {
  const parsed = Markdown.parseResult(text);
  assertSuccess(parsed, Result.getOrThrow(parsed));
  if (!Result.isSuccess(parsed)) {
    return [];
  }
  const [block] = parsed.success.children;
  assert.strictEqual(block?.type, "paragraph");
  return block?.type === "paragraph" ? block.children : [];
};

describe("Markdown.parsePhrasingResult", () => {
  it("parses a link-carrying prose fragment into phrasing content", () => {
    const nodes = phrasing("see [the docs](./docs.md)");
    assert.deepStrictEqual(
      A.map(nodes, (node) => node.type),
      ["text", "link"]
    );
    const link = nodes[1];
    assert.strictEqual(link?.type === "link" ? link.url : "", "./docs.md");
  });

  it("matches the paragraph splice of a full parse, positions included", () => {
    for (const fragment of [
      "plain",
      "x *y* `z`",
      "a [link](./x) and ![img](./y.png)",
      "code `span` **strong** ~~gone~~",
      "auto https://example.com literal",
    ]) {
      assert.deepStrictEqual(phrasing(fragment), splicedFromFullParse(fragment), fragment);
    }
  });

  it("reports positions relative to the input string", () => {
    const [emphasis] = phrasing("  *hi*  ");
    assert.strictEqual(emphasis?.type, "emphasis");
    assert.strictEqual(emphasis?.position.start.offset, 2);
    assert.strictEqual(emphasis?.position.end.offset, 6);
  });

  it("treats blank lines as inline content, never a block break", () => {
    const nodes = phrasing("a\n\nb");
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0]?.type === "text" ? nodes[0].value : "", "a\n\nb");
  });

  it("never opens block constructs", () => {
    const [heading] = phrasing("# not a heading");
    assert.strictEqual(heading?.type === "text" ? heading.value : "", "# not a heading");
  });

  it("normalizes CRLF terminators to \\n while keeping offsets true", () => {
    const [node] = phrasing("a\r\nb");
    assert.strictEqual(node?.type === "text" ? node.value : "", "a\nb");
    assert.strictEqual(node?.position.start.offset, 0);
    assert.strictEqual(node?.position.end.offset, 4);
  });

  it("leaves dangling references literal — no reference context exists", () => {
    assert.deepStrictEqual(
      A.map(phrasing("[foo] and ![bar] and [^baz]"), (node) => node.type),
      ["text"]
    );
  });

  it("honors the dialect option", () => {
    const gfm = phrasing("~~x~~");
    assert.strictEqual(gfm[0]?.type, "delete");
    const commonmark = phrasing("~~x~~", { dialect: "commonmark" });
    assert.strictEqual(commonmark[0]?.type, "text");
  });

  it("returns an empty array for empty and all-whitespace input", () => {
    assert.deepStrictEqual(phrasing(""), []);
    assert.deepStrictEqual(phrasing("   \n  "), []);
  });

  it("fails typed on a hardening-guard trip", () => {
    const markers = Str.repeat((MAX_NESTING_DEPTH + 10) * 2)("*");
    const result = Markdown.parsePhrasingResult(`${markers}a${markers}`);
    assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
    if (Result.isFailure(result)) {
      assert.strictEqual(result.failure._tag, "MarkdownParseError");
      assert.strictEqual(result.failure.diagnostic.code, "NestingDepthExceeded");
    }
  });

  it.effect("the Effect twin agrees with the Result primitive", () =>
    Effect.gen(function* () {
      const nodes = yield* Markdown.parsePhrasing("x *y*");
      assert.deepStrictEqual(nodes, phrasing("x *y*"));
    })
  );
});
