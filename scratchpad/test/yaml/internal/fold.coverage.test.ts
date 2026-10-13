import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { foldScalarLine, foldRenderedScalar, hasInteriorTrailingWhitespace, hasNewlineSpacesTab, isControlChar, renderBlockFolded, renderBlockLiteral, renderSingleQuotedMultiline } from "../../../effected/yaml/internal/fold.ts";

describe("scalar folding boundaries", () => {
  it.effect("folds only safe interior spaces and handles disabled or exhausted budgets", () => Effect.sync(() => {
    assert.strictEqual(foldScalarLine("a b", "  ", 0, 0), "a b");
    assert.strictEqual(foldScalarLine(" a  b ", "  ", 1, 9), " a  b ");
    assert.strictEqual(foldScalarLine("a b c", "    ", 1, 9), "a\n    b\n    c");
    assert.strictEqual(foldScalarLine("", "", 5, 0), "");
    assert.strictEqual(foldScalarLine("longword", "  ", 1, 0), "longword");
    const rendered = foldRenderedScalar("word gamma gamma end", "  ", 20);
    assert.strictEqual(rendered, "word gamma gamma\n  end");
    assert.strictEqual(foldRenderedScalar(rendered, "  ", 20), rendered);
  }));
  it.effect("dispatches scalar styles and folds only exact-indent block content", () => Effect.sync(() => {
    assert.strictEqual(foldRenderedScalar("hello world", "  ", 0), "hello world");
    assert.strictEqual(foldRenderedScalar("", "  ", 8), "");
    assert.strictEqual(foldRenderedScalar("'hello world'", "  ", 8), "'hello world'");
    assert.strictEqual(foldRenderedScalar("|-\n  hello world", "  ", 8), "|-\n  hello world");
    assert.strictEqual(foldRenderedScalar('"hello world"', "  ", 8), '"hello\n  world"');
    assert.strictEqual(foldRenderedScalar("hello world", "  ", 8), "hello\n  world");
    assert.strictEqual(foldRenderedScalar(">-\n  hello world\n\n  \n x\n   more\n  \ttab", "  ", 8), ">-\n  hello\n  world\n\n  \n x\n   more\n  \ttab");
  }));
  it.effect("classifies control and mixed/trailing whitespace precisely", () => Effect.sync(() => {
    for (let code = -1; code <= 33; code++) {
      assert.strictEqual(isControlChar(code), code >= 0 && code < 32 && code !== 9 && code !== 10 && code !== 13);
    }
    for (const [value, expected] of [["", false], ["a\nb", false], ["a \n", false], ["a\t\nb", true], ["a \nb\n\n", true], ["\n", false]] as const) {
      assert.strictEqual(hasInteriorTrailingWhitespace(value), expected);
    }
    for (const [value, expected] of [["a\n \tb", true], ["\n  \t", true], ["a\n\tb", false], ["a\n  ", false], ["\n x", false], ["", false]] as const) {
      assert.strictEqual(hasNewlineSpacesTab(value), expected);
    }
    assert.strictEqual(renderSingleQuotedMultiline("a\rb", "  "), null);
    assert.strictEqual(renderSingleQuotedMultiline("a\u0000b", "  "), null);
    assert.strictEqual(renderSingleQuotedMultiline("", "  "), "''");
    assert.strictEqual(renderSingleQuotedMultiline("a'\nb\n", "  "), "'a''\n\n  b\n\n'");
  }));
  it.effect("renders chomp and explicit-indent boundaries", () => Effect.sync(() => {
    assert.strictEqual(renderBlockLiteral("\n", "  ", "keep", "block-map-value"), "|2+\n");
    assert.strictEqual(renderBlockLiteral("\n", "", "keep", "block-map-value"), "|+\n");
    assert.strictEqual(renderBlockLiteral("\n", "  ", "keep", "block-seq-item"), "|+\n");
    assert.strictEqual(renderBlockLiteral("\n\nx", "  "), "|2-\n\n\n  x");
    assert.strictEqual(renderBlockLiteral(" x", "  "), "|2-\n   x");
    assert.strictEqual(renderBlockLiteral("x", "  ", undefined, undefined, false, 3), "|-\n  x");
    assert.strictEqual(renderBlockFolded("\n\nx", "  "), ">2-\n\n\n  x");
    assert.strictEqual(renderBlockFolded("x", "  ", undefined, 3), ">-\n  x");
    assert.strictEqual(renderBlockFolded("a\n\n b", "  "), ">-\n  a\n\n   b");
    assert.strictEqual(renderBlockFolded("a\n\nb", "  "), ">-\n  a\n\n\n  b");
    assert.strictEqual(renderBlockFolded("", "  "), ">-\n");
  }));
});
