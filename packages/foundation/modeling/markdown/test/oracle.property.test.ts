import { identity } from "effect/Function";
// decision: commonmark-js-differential-oracle

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

const renderOurs = (markdown: string): string | undefined => {
  const result = Markdown.parseResult(markdown, { dialect: "commonmark" });
  return Result.isFailure(result) ? undefined : normalizeHtml(renderHtml(result.success));
};

// decision: oracle-empty-paragraph-corrected
const correctOracleDefect = (html: string): string => Str.replaceAll("<p></p>", "")(html);

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
    assert.strictEqual(examples.length, 652, "a corpus that failed to load must fail this test, not pass it vacuously");
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

  it.prop(
    "agrees with the reference implementation on generated markdown of up to 12 lines, multi-line constructs included",
    [markdownish],
    ([markdown]) => {
      const ours = renderOurs(markdown);
      if (ours === undefined) {
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
    const source = "[a]: /a\n---\n";
    assert.include(
      normalizeHtml(renderOracleHtml(source)),
      "<p></p>",
      "if commonmark.js stops emitting the spurious paragraph, delete correctOracleDefect and this tripwire"
    );

    const result = Markdown.parseResult(source);
    if (Result.isFailure(result)) {
      assert.fail("expected the document to parse");
    }
    assert.deepStrictEqual(
      A.map(result.success.children, (child) => child.type),
      ["definition", "thematicBreak"]
    );
    assert.strictEqual(renderOurs(source), "<hr>");

    assert.strictEqual(renderOurs(source), correctOracleDefect(normalizeHtml(renderOracleHtml(source))));
  });
});
