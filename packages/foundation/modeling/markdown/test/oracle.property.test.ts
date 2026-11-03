import { identity } from "effect/Function";
// The differential oracle suite: our parser plus the test-only HTML writer,
// against commonmark.js 0.31.2 — the reference implementation this engine is
// a port of — over the full 652-example spec corpus and generated
// markdown-ish input.
//
// Both sides are normalized with the SAME normalizer, so this asserts
// semantic HTML equivalence rather than byte equality.
//
// Disagreement policy: the corpus wins. A generated input that disagrees is a
// bug in our engine or in the writer, to be investigated and fixed — never
// added to a skip list. There is no skip list in this file, by design.

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { loadSpecExamples } from "./support/corpus.ts";
import { renderHtml } from "./support/htmlWriter.ts";
import { normalizeHtml } from "./support/normalizeHtml.ts";
import { renderOracleHtml } from "./support/oracle.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const encodePrettyJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown, { space: 2 }));

/**
 * Render with our stack; `undefined` if the parse tripped a hardening guard.
 *
 * Pinned to `dialect: "commonmark"` explicitly: the oracle is commonmark.js,
 * which implements no GFM extension, so the comparison is only meaningful
 * against our commonmark dialect. The package's public default is `"gfm"` —
 * relying on the default here would diff a GFM parse against a CommonMark
 * oracle and fail on every extension construct the generator emits.
 */
const renderOurs = (markdown: string): string | undefined => {
  const result = Markdown.parseResult(markdown, { dialect: "commonmark" });
  return Result.isFailure(result) ? undefined : normalizeHtml(renderHtml(result.success));
};

/**
 * The one known ORACLE defect, corrected on the oracle's side.
 *
 * commonmark.js 0.31.2 emits a content-free `<p></p>` for a document whose
 * paragraph held only link reference definitions and was then interrupted by
 * a thematic break, as in `[a]: /a\n---\n`. The cause is visible in its
 * `lib/blocks.js`: the setext-heading block start strips the reference
 * definitions from the paragraph's `_string_content` itself (returning 0 when
 * nothing survives, so `---` falls through to a thematic break), but the
 * later `processInlines` walk only unlinks a reference-only paragraph when
 * ITS own stripping loop ran and set `hasReferenceDefs`. The flag does not
 * carry across the two sites, so an emptied paragraph node survives and
 * renders.
 *
 * This is not CommonMark: none of the spec's 652 examples expects `<p></p>`
 * in its output, and an empty paragraph has no source construct. Our tree for
 * that input is `definition` + `thematicBreak`, which renders to `<hr>` —
 * the correct result. So the divergence is corrected here rather than
 * skip-listed, and `oracle defect tripwire` below pins the exact behavior:
 * if a future commonmark.js fixes it, that test fails and this correction
 * gets deleted.
 *
 * Narrow by construction: our writer can never emit an empty paragraph (a
 * `Paragraph` node always has children), so this rule can only ever equalize
 * the oracle's spurious ones.
 */
const correctOracleDefect = (html: string): string => Str.replaceAll("<p></p>", "")(html);

/**
 * Markdown-ish source: fragments drawn from the whole CommonMark construct
 * vocabulary, joined into lines. Unstructured random unicode almost always
 * degenerates to a single paragraph and tests nothing; this arbitrary keeps
 * the generator inside the grammar where the two implementations can
 * actually disagree.
 */
const markdownish = Arbitrary.schema(
  S.Array(
    S.Union([
      S.Literals([
        "# heading",
        "## heading",
        "###### heading",
        "setext",
        "=======",
        "-------",
        "***",
        "- item",
        "- item",
        "1. item",
        "7) item",
        "> quote",
        ">> deep",
        "    indented code",
        "```js",
        "```",
        "~~~",
        "<div>",
        "</div>",
        "<!-- comment -->",
        '[ref]: /url "title"',
        "[a]: /a",
        "",
        "    ",
        "\ttab",
      ]),
      S.Literals([
        "*em* and **strong**",
        "_em_ and __strong__",
        "***both***",
        "a*b*c",
        "a_b_c",
        "`code span`",
        "``code ` span``",
        "[link](/url)",
        '[link](/url "title")',
        '![img](/src "alt")',
        "[ref][a]",
        "[a][]",
        "[a]",
        "<https://example.com>",
        "<user@example.com>",
        "<span>raw</span>",
        "line with two spaces  ",
        "backslash break\\",
        "&amp; &#35; &nbsp;",
        "\\*escaped\\*",
        "text with <angle> & ampersand",
        "unmatched [ bracket",
        "unmatched ] bracket",
        "*unclosed emphasis",
        "a > b < c",
      ]),
      S.String.check(S.isMaxLength(12)),
    ])
  ).check(S.isMaxLength(12))
).pipe(Arbitrary.map((lines) => `${A.join(lines, "\n")}\n`));

/**
 * Emphasis-dense inline text: delimiter runs of both characters and every
 * length, flanking punctuation, brackets and code-span backticks, joined
 * without separators so runs touch. One paragraph per document, so the whole
 * budget lands on the delimiter stack (`processEmphasis`) and the bracket
 * stack it interleaves with.
 *
 * No astral characters: flanking beside an astral punctuation or symbol code
 * point is a deliberate correction of commonmark.js, which classifies UTF-16
 * halves (`emphasis-astral.test.ts` pins it), so the oracle cannot judge it.
 */
const emphasisish = Arbitrary.schema(
  S.Array(
    S.Literals([
      "*",
      "**",
      "***",
      "_",
      "__",
      "___",
      "a",
      "foo",
      " ",
      "!",
      ".",
      "[",
      "]",
      "(",
      ")",
      "`",
      "\\",
      "*a*",
      "_a_",
      "**a**",
      "[x](/u)",
      "&amp;",
      "\n",
    ])
  ).check(S.isMaxLength(24))
).pipe(Arbitrary.map((fragments) => `${A.join(fragments, "")}\n`));

/**
 * Container-dense block structure: every line opens with a stack of block
 * quote, list and indentation prefixes over a small set of leaf lines, so
 * consecutive lines exercise container matching, lazy continuation, list
 * item indentation and fence/HTML-block closing (`incorporateLine`).
 */
const blockish = Arbitrary.schema(
  S.Array(
    S.Tuple([
      S.Literals([
        "",
        "> ",
        ">",
        "- ",
        "* ",
        "1. ",
        "2) ",
        "  ",
        "   ",
        "    ",
        "\t",
        "> - ",
        "- > ",
        "  - ",
        "    - ",
      ]),
      S.Literals(["a", "b c", "", "*x*", "```", "~~~", "# h", "---", "<div>", "</div>", "[a]: /b", "<!-- c -->"]),
    ])
  ).check(S.isMaxLength(16))
).pipe(
  Arbitrary.map(
    (lines) =>
      `${A.join(
        A.map(lines, ([prefix, leaf]) => prefix + leaf),
        "\n"
      )}\n`
  )
);

/** One generated document compared against the oracle; a guard trip is not a disagreement. */
const agreesWithOracle = (markdown: string): boolean => {
  const ours = renderOurs(markdown);
  if (ours !== undefined) {
    const oracle = correctOracleDefect(normalizeHtml(renderOracleHtml(markdown)));
    assert.strictEqual(
      ours,
      oracle,
      `disagreement on input:\n${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(markdown), identity)}`
    );
  }
  return true;
};

describe("differential oracle: commonmark.js 0.31.2", () => {
  it("agrees with the reference implementation on every spec corpus input", () => {
    const examples = loadSpecExamples();
    // Silently-empty-walk guard: a corpus that failed to load must fail
    // this test, not pass it vacuously.
    assert.strictEqual(examples.length, 652);
    const disagreements: Array<{ example: number; markdown: string; ours: string; oracle: string }> = [];
    for (const example of examples) {
      const ours = renderOurs(example.markdown);
      const oracle = correctOracleDefect(normalizeHtml(renderOracleHtml(example.markdown)));
      if (ours !== oracle) {
        disagreements.push({
          example: example.example,
          markdown: example.markdown,
          ours: ours ?? "<guard trip>",
          oracle,
        });
      }
    }
    assert.deepStrictEqual(
      A.map(disagreements, (d) => d.example),
      [],
      `differential disagreement on ${disagreements.length} corpus example(s): ${Result.getOrThrowWith(encodePrettyJson(disagreements.slice(0, 3)), identity)}`
    );
  });

  // `size` lifts the length scale to the 12-line cap so documents reach the
  // multi-line constructs (setext, fences, lists) the fragments are drawn for.
  it.prop(
    "agrees with the reference implementation on generated markdown",
    [markdownish],
    ([markdown]) => {
      const ours = renderOurs(markdown);
      if (ours === undefined) {
        // A hardening-guard trip is a legitimate outcome the oracle
        // does not model (commonmark.js has no depth cap); it is not
        // a disagreement.
        return true;
      }
      const oracle = correctOracleDefect(normalizeHtml(renderOracleHtml(markdown)));
      assert.strictEqual(
        ours,
        oracle,
        `disagreement on input:\n${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(markdown), identity)}`
      );
      return true;
    },
    { arbitrary: { runs: 250, size: 12 } }
  );

  // Fixed seeds and high run counts, so a refactor of the emphasis or block
  // pass is checked against the same large input set on every run.
  it.prop(
    "agrees with the reference implementation on emphasis-dense inline text",
    [emphasisish],
    ([markdown]) => agreesWithOracle(markdown),
    { arbitrary: { ...fcRuns(2000), seed: 0x656d70, size: 24 } }
  );

  it.prop(
    "agrees with the reference implementation on container-dense block structure",
    [blockish],
    ([markdown]) => agreesWithOracle(markdown),
    { arbitrary: { ...fcRuns(2000), seed: 0x626c6b, size: 16 } }
  );

  it("oracle defect tripwire: the empty-paragraph divergence still exists and is still ours-correct", () => {
    // Found by this suite's generator, minimized to this input. If a future
    // commonmark.js stops emitting the spurious paragraph, the first
    // assertion fails — delete `correctOracleDefect` and this test then.
    const source = "[a]: /a\n---\n";
    assert.include(normalizeHtml(renderOracleHtml(source)), "<p></p>");

    // Our side has no empty paragraph to correct: a definition and a
    // thematic break, rendering to the hr alone.
    const result = Markdown.parseResult(source);
    if (Result.isFailure(result)) {
      assert.fail("expected the document to parse");
    }
    assert.deepStrictEqual(
      A.map(result.success.children, (child) => child.type),
      ["definition", "thematicBreak"]
    );
    assert.strictEqual(renderOurs(source), "<hr>");

    // And with the defect corrected, the two agree.
    assert.strictEqual(renderOurs(source), correctOracleDefect(normalizeHtml(renderOracleHtml(source))));
  });
});
