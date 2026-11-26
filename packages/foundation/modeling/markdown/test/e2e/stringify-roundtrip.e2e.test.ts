import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { stringifyTree } from "@beep/markdown/internal/stringify";
import { assert, describe, it } from "@effect/vitest";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { loadGfmExtensionsExamples, loadGfmSpecExtensionExamples, loadSpecExamples } from "../support/corpus.ts";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";
import type { SpecExample } from "../support/corpus.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

type Dialect = "commonmark" | "gfm";

const roundTrip = (markdown: string, dialect: Dialect): { before: string; after: string; emitted: string } => {
  const gfm = dialect === "gfm";
  const first = parseBlocks(markdown, { dialect: dialect }).root;
  const emitted = stringifyTree(first);
  const second = parseBlocks(emitted, { dialect: dialect }).root;
  return {
    before: normalizeHtml(renderHtml(first, { gfm })),
    after: normalizeHtml(renderHtml(second, { gfm })),
    emitted,
  };
};

const runCorpus = (
  name: string,
  examples: ReadonlyArray<SpecExample>,
  dialect: Dialect,
  expectedCount: number
): void => {
  describe(name, () => {
    it("carries the whole corpus", () => {
      assert.strictEqual(examples.length, expectedCount);
    });

    for (const example of examples) {
      it(`example ${example.example} (${example.section})`, () => {
        const { before, after, emitted } = roundTrip(example.markdown, dialect);
        assert.strictEqual(
          after,
          before,
          `stringify round-trip diverged; its output must not depend on constructs the reading dialect lacks, and no example is skipped: the extensions.txt <IGNORE> crash regression renders meaninglessly on both sides alike, so equivalence still holds.\nsource:  ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(example.markdown), identity)}\nemitted: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(emitted), identity)}`
        );
      });
    }
  });
};

describe("stringify re-parse equivalence: a render difference after parse, stringify, re-parse is a serialization bug", () => {
  runCorpus("CommonMark spec under commonmark", loadSpecExamples(), "commonmark", 652);
  runCorpus("CommonMark spec under gfm", loadSpecExamples(), "gfm", 652);
  runCorpus("GFM spec extensions", loadGfmSpecExtensionExamples(), "gfm", 22);
  runCorpus("cmark-gfm extensions.txt", loadGfmExtensionsExamples(), "gfm", 30);
});

describe("stringify cost", () => {
  it("serialization is string-building, not schema construction", () => {
    const input = Str.repeat(500)(
      "# heading\n\npara *em* **st** `code` [l](/u)\n\n- a\n- b\n\n> quote\n\n| a | b |\n| - | - |\n| 1 | 2 |\n"
    );
    const warm = parseBlocks(input, { dialect: "gfm" }).root;
    stringifyTree(warm);

    let minParseMs = Number.POSITIVE_INFINITY;
    let minStringifyMs = Number.POSITIVE_INFINITY;
    let emitted = "";
    for (let round = 0; round < 5; round++) {
      const parseStart = performance.now();
      const tree = parseBlocks(input, { dialect: "gfm" }).root;
      minParseMs = Math.min(minParseMs, performance.now() - parseStart);

      const stringifyStart = performance.now();
      emitted = stringifyTree(tree);
      minStringifyMs = Math.min(minStringifyMs, performance.now() - stringifyStart);
    }

    assert.isAbove(emitted.length, input.length / 2);
    assert.isBelow(
      minStringifyMs,
      minParseMs,
      `stringify ${minStringifyMs.toFixed(1)}ms should undercut parse ${minParseMs.toFixed(1)}ms: it builds strings, not Schema nodes, so the design doc's ~17µs/node Schema-construction flag must not bind. Both run in the same environment, so coverage instrumentation and hardware cancel, and interleaved per-side minimums are the estimators least inflated by GC pauses and contended CPU slices`
    );
  });
});

describe("decoded syntax round-trip regressions", () => {
  const examples = [
    ["link entities", '[x](a&amp;amp;b "t&amp;amp;")'],
    ["image entities", '![x](a&amp;amp;b "t&amp;amp;")'],
    ["definition entities", '[x][r]\n\n[r]: a&amp;amp;b "t&amp;amp;"'],
    ["pointy destination entities", '[x](<a&amp;amp;b c> "t&amp;amp;")'],
    ["link LF destination and blank-line title", '[x](a&#10;b "a&#10;&#10;b")'],
    ["link CR destination and blank-line title", '[x](a&#13;b "a&#13;&#13;b")'],
    ["image LF destination and blank-line title", '![x](a&#10;b "a&#10;&#10;b")'],
    ["image CR destination and blank-line title", '![x](a&#13;b "a&#13;&#13;b")'],
    ["definition LF destination and blank-line title", '[x][r]\n\n[r]: a&#10;b "a&#10;&#10;b"'],
    ["definition CR destination and blank-line title", '[x][r]\n\n[r]: a&#13;b "a&#13;&#13;b"'],
    ["decoded CR before a heading", "a&#13;# heading"],
    ["decoded CR before a list", "a&#13;- item"],
    ["decoded CR in image alt", "![a&#13;# heading](u)"],
    ["decoded spaces before a soft newline", "a&#32;&#32;&#32;\nb"],
    ["single tilde language", "~~~&#126;\nx\n~~~\n"],
    ["multiple tilde language", "~~~&#126;~x\nx\n~~~\n"],
    ["backtick language", "```&#96;\nx\n```\n"],
    ["entity-shaped language", "```a&amp;amp;\nx\n```\n"],
    ["language whitespace", "```a&#32;b\nx\n```\n"],
    ["info escapes and line endings", "```a&#92;b&#9;c m&#96;n&amp;amp;&#13;&#10;z\nx\n```\n"],
    ["direct image alt syntax", "![\\*x\\* \\_y\\_ \\`z\\` \\<b> &amp;amp;](u)"],
    ["full reference alt syntax", "![\\*x\\* \\_y\\_ \\`z\\` \\<b> &amp;amp;][r]\n\n[r]: u"],
    ["32 parenthesis destination", `[x](<${Str.repeat(32)("(")}x${Str.repeat(32)(")")}>)`],
    ["33 parenthesis destination", `[x](<${Str.repeat(33)("(")}x${Str.repeat(33)(")")}>)`],
  ] as const;
  for (const dialect of ["commonmark", "gfm"] as const) {
    for (const [name, source] of examples) {
      it(`${name} under ${dialect}`, () => {
        const { before, after } = roundTrip(source, dialect);
        assert.strictEqual(after, before);
      });
    }
  }
});
