import { inlineDialect } from "@beep/markdown/internal/inlineRegistry";
import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";

const cases = [
  { source: "`x`", type: "inlineCode" },
  { source: "<b>", type: "html" },
  { source: "*x*", type: "emphasis" },
  { source: "**x**", type: "strong" },
  { source: "~~x~~", type: "delete" },
  { source: '[x](/u "title")', type: "link" },
  { source: '![x](/u "title")', type: "image" },
  { source: "<https://example.com>", type: "link" },
];

describe("inline dispatch: trigger precedence and materialization over a per-character trigger table and once-compiled matcher", () => {
  it("keeps autolinks before raw HTML in each trigger bucket", () => {
    for (const dialect of ["commonmark", "gfm"] as const) {
      const registry = inlineDialect(dialect);
      assert.deepStrictEqual(
        A.map(
          O.getOrElse(R.get(registry.byTrigger, "<"), () => []),
          (construct) => construct.name
        ),
        ["autolink", "rawHtml"]
      );
      assertNone(R.get(registry.byTrigger, "a"));
    }
  });

  for (const { source, type } of cases) {
    it(`materializes ${type} from ${source}`, () => {
      const result = Markdown.parsePhrasingResult(source);
      assertSuccess(
        Result.map(result, () => undefined),
        undefined
      );
      if (Result.isSuccess(result)) {
        assert.strictEqual(result.success.length, 1);
        assert.strictEqual(result.success[0]?.type, type);
        assert.strictEqual(result.success[0]?.position.start.offset, 0);
        assert.strictEqual(result.success[0]?.position.end.offset, source.length);
      }
    });
  }

  it("retains both hard-break style fields", () => {
    for (const { source, style } of [
      { source: "a\\\nb", style: "backslash" },
      { source: "a  \nb", style: "spaces" },
    ]) {
      const result = Markdown.parsePhrasingResult(source);
      assertSuccess(
        Result.map(result, () => undefined),
        undefined
      );
      if (Result.isSuccess(result)) {
        assert.deepStrictEqual(
          A.map(result.success, (node) => node.type),
          ["text", "break", "text"]
        );
        const lineBreak = result.success[1];
        assert.strictEqual(lineBreak?.type === "break" ? lineBreak.breakStyle : undefined, style);
      }
    }
  });

  it("coalesces text fallback including dangling references", () => {
    const source = "plain ] [missing] !";
    const result = Markdown.parsePhrasingResult(source);
    assertSuccess(
      Result.map(result, () => undefined),
      undefined
    );
    if (Result.isSuccess(result)) {
      assert.strictEqual(result.success.length, 1);
      const [text] = result.success;
      assert.strictEqual(text?.type === "text" ? text.value : undefined, source);
    }
  });
});
