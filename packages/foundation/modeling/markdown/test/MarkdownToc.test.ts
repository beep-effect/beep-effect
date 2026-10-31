// The table-of-contents builder, pinned against `@effect/markdown-toc` 0.1.0
// (`bullets: "-"`): every expected rendering here is that package's output
// for the same source, except where a comment says otherwise. The docgen
// module page is the adopted site (R5b), so the first fixture has its shape:
// an intro section, the `<!-- toc -->` marker, category H1s, member H2s and
// duplicate `make` headings.

import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownToc, TocEntry, TocOptions } from "@beep/markdown/MarkdownToc";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const parse = (source: string): MarkdownDocument =>
  Result.getOrThrow(MarkdownDocument.parseResult(source, { frontmatter: true }));

const lines = (...xs: ReadonlyArray<string>): string => A.join(xs, "\n");

const modulePage = lines(
  "## Intro",
  "",
  "Added in v0.0.0",
  "",
  "<!-- toc -->",
  "",
  "# constructors",
  "",
  "## make",
  "",
  "**Signature**",
  "",
  "```ts",
  "## not a heading",
  "```",
  "",
  "# models",
  "",
  "## `Point` (class)",
  "",
  "### make",
  "",
  "#### Signature",
  "",
  "## [Guide](./guide.md) and more",
  "",
  "## Straße über Ærø",
  "",
  "## Use  <b>Effect.gen</b> now",
  "",
  "## 日本語、見出し！",
  "",
  "## make",
  "",
  "##### Deep",
  "",
  "###### Deeper",
  ""
);

const modulePageToc = lines(
  "- [constructors](#constructors)",
  "  - [make](#make)",
  "- [models](#models)",
  "  - [`Point` (class)](#point-class)",
  "    - [make](#make-1)",
  "      - [Signature](#signature)",
  "  - [Guide](#guide)",
  "  - [Straße über Ærø](#strasse-uber-aero)",
  "  - [Use Effect.gen now](#use--effectgen-now)",
  "  - [日本語、見出し！](#%E6%97%A5%E6%9C%AC%E8%AA%9E%E8%A6%8B%E5%87%BA%E3%81%97)",
  "  - [make](#make-2)",
  "        - [Deep](#deep)",
  "          - [Deeper](#deeper)"
);

describe("MarkdownToc", () => {
  describe("entries", () => {
    it("lists the headings after the marker with document-wide indices and duplicate ordinals", () => {
      const entries = MarkdownToc.entries(parse(modulePage));
      assert.deepStrictEqual(
        A.map(entries, (entry) => [entry.index, entry.depth, entry.occurrence, entry.slug]),
        [
          [1, 1, 0, "constructors"],
          [2, 2, 0, "make"],
          [3, 1, 0, "models"],
          [4, 2, 0, "point-class"],
          [5, 3, 1, "make-1"],
          [6, 4, 0, "signature"],
          [7, 2, 0, "guide"],
          [8, 2, 0, "strasse-uber-aero"],
          [9, 2, 0, "use--effectgen-now"],
          [10, 2, 0, "日本語見出し"],
          [11, 2, 2, "make-2"],
          [12, 5, 0, "deep"],
          [13, 6, 0, "deeper"],
        ]
      );
      assert.strictEqual(entries[6]?.text, "[Guide](./guide.md) and more");
      assert.strictEqual(entries[8]?.text, "Use  <b>Effect.gen</b> now");
      assert.isTrue(A.every(entries, S.is(TocEntry)));
    });

    it("lists every heading when there is no marker, nested ones included", () => {
      const entries = MarkdownToc.entries(
        parse(lines("# Title", "", "> ## Quoted", "", "- ### Listed", "", "Setext", "---", ""))
      );
      assert.deepStrictEqual(
        A.map(entries, (entry) => [entry.index, entry.depth, entry.slug]),
        [
          [0, 1, "title"],
          [1, 2, "quoted"],
          [2, 3, "listed"],
          [3, 2, "setext"],
        ]
      );
    });

    it("numbers duplicates by lower-cased text as written and counts only listed headings", () => {
      const entries = MarkdownToc.entries(
        parse(lines("# Make", "", "<!-- toc -->", "", "## make", "", "## MAKE", "", "## Make it", ""))
      );
      assert.deepStrictEqual(
        A.map(entries, (entry) => [entry.occurrence, entry.slug]),
        [
          [0, "make"],
          [1, "make-1"],
          [0, "make-it"],
        ]
      );
    });

    it("moves the boundary to the end of the paragraph, heading or code block holding the last marker", () => {
      const inParagraph = parse(
        lines("# Before", "", "intro <!-- toc --> text", "second line", "## Same block", "", "## After", "")
      );
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(inParagraph), (entry) => entry.slug),
        ["after"]
      );

      const inHeading = parse(lines("# Title <!-- toc -->", "## Next line", "", "## After", ""));
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(inHeading), (entry) => entry.slug),
        ["after"]
      );

      const inFence = parse(lines("# Before", "", "```", "<!-- toc -->", "```", "", "## After", ""));
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(inFence), (entry) => entry.slug),
        ["after"]
      );

      // The kit's own rule: remarkable's indented-code token swallows the blank lines after it, so
      // markdown-toc also drops the heading right after an indented marker. Positions here are CommonMark's.
      const inIndentedCode = parse(lines("# Before", "", "    <!-- toc -->", "", "## After", ""));
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(inIndentedCode), (entry) => entry.slug),
        ["after"]
      );

      const twoMarkers = parse(lines("<!-- toc -->", "", "# Between", "", "<!--\ttoc\t-->", "", "## After", ""));
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(twoMarkers), (entry) => entry.slug),
        ["after"]
      );
    });

    it("does not read a marker inside a frontmatter block or a plain text mention as the boundary", () => {
      const inFrontmatter = parse(lines("---", 'toc: "<!-- toc -->"', "---", "", "# First", "", "## Second", ""));
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(inFrontmatter), (entry) => entry.slug),
        ["first", "second"]
      );

      const mention = parse(
        lines("# First", "", "The marker is `toc` spelled <!-- not toc --> here.", "", "## Second", "")
      );
      assert.deepStrictEqual(
        A.map(MarkdownToc.entries(mention), (entry) => entry.slug),
        ["first", "second"]
      );
    });

    it("renders a multi-line setext heading on one TOC line", () => {
      const entries = MarkdownToc.entries(parse(lines("Goal *Title*", "second line", "===", "", "## Next", "")));
      assert.deepStrictEqual(
        A.map(entries, (entry) => entry.slug),
        ["goal-title-second-line", "next"]
      );
      assert.strictEqual(
        MarkdownToc.renderEntries(entries),
        lines("- [Goal *Title* second line](#goal-title-second-line)", "  - [Next](#next)")
      );
    });

    it("strips blockquote markers from a quoted multi-line heading", () => {
      const entries = MarkdownToc.entries(parse(lines("> Foo", "> bar", "> ===", "")));
      assert.deepStrictEqual(
        A.map(entries, (entry) => [entry.text, entry.slug]),
        [["Foo bar", "foo-bar"]]
      );
      assert.strictEqual(MarkdownToc.renderEntries(entries), "- [Foo bar](#foo-bar)");
    });

    it("counts a multi-line heading and its one-line twin as duplicates", () => {
      const entries = MarkdownToc.entries(parse(lines("Foo", "bar", "===", "", "## Foo bar", "")));
      assert.deepStrictEqual(
        A.map(entries, (entry) => [entry.occurrence, entry.slug]),
        [
          [0, "foo-bar"],
          [1, "foo-bar-1"],
        ]
      );
    });

    it("yields no entries for a document without headings", () => {
      assert.deepStrictEqual(MarkdownToc.entries(parse("just a paragraph\n")), []);
      assert.deepStrictEqual(MarkdownToc.entries(parse("")), []);
    });
  });

  describe("renderEntries", () => {
    it("renders the docgen module page byte-identically to markdown-toc", () => {
      assert.strictEqual(
        MarkdownToc.renderEntries(MarkdownToc.entries(parse(modulePage)), { bullet: "-" }),
        modulePageToc
      );
    });

    it("indents by depth below the shallowest entry, which is measured before maxDepth drops entries", () => {
      const entries = MarkdownToc.entries(parse(lines("## A", "", "### B", "", "#### C", "")));
      assert.strictEqual(MarkdownToc.renderEntries(entries), lines("- [A](#a)", "  - [B](#b)", "    - [C](#c)"));
      assert.strictEqual(MarkdownToc.renderEntries(entries, { maxDepth: 3 }), lines("- [A](#a)", "  - [B](#b)"));
      const deepOnly = MarkdownToc.entries(parse(lines("#### C", "", "## A", "")));
      assert.strictEqual(MarkdownToc.renderEntries(deepOnly, { maxDepth: 2 }), "- [A](#a)");
    });

    it("takes the bullet, indentation unit and linkify switch from the options", () => {
      const entries = MarkdownToc.entries(parse(lines("# A", "", "## B", "")));
      assert.strictEqual(MarkdownToc.renderEntries(entries, { bullet: "*" }), lines("* [A](#a)", "  * [B](#b)"));
      assert.strictEqual(
        MarkdownToc.renderEntries(entries, { bullet: "+", indent: "\t" }),
        lines("+ [A](#a)", "\t+ [B](#b)")
      );
      assert.strictEqual(MarkdownToc.renderEntries(entries, { linkify: false }), lines("- A", "  - B"));
      assert.strictEqual(
        MarkdownToc.renderEntries(entries, TocOptions.make({ bullet: "*", linkify: false })),
        lines("* A", "  * B")
      );
    });

    it("links the title of a leading link and keeps the written text without linkify", () => {
      const entries = MarkdownToc.entries(parse(lines("# [**bold**](x) rest", "", "# <http://a.b> auto", "")));
      assert.strictEqual(MarkdownToc.renderEntries(entries), lines("- [**bold**](#bold)", "- [auto](#-auto)"));
      assert.strictEqual(
        MarkdownToc.renderEntries(entries, { linkify: false }),
        lines("- [**bold**](x) rest", "- <http://a.b> auto")
      );
    });

    it("renders no entries as the empty string", () => {
      assert.strictEqual(MarkdownToc.renderEntries([]), "");
    });
  });

  describe("renderResult and render", () => {
    it("parse and render in one step, with frontmatter capture on", () => {
      assertSuccess(MarkdownToc.renderResult("# One\n\n## Two\n"), lines("- [One](#one)", "  - [Two](#two)"));
      assertSuccess(MarkdownToc.renderResult(modulePage, { bullet: "-" }), modulePageToc);
      assertSuccess(MarkdownToc.renderResult(lines("---", "title: x", "---", "", "# One", "")), "- [One](#one)");
    });

    it("surfaces the parse failure", () => {
      const tooDeep = `${Str.repeat(300)(">")} foo\n`;
      assertFailure(
        Result.mapError(MarkdownToc.renderResult(tooDeep), (error) => [error._tag, error.diagnostic.code]),
        ["MarkdownParseError", "NestingDepthExceeded"]
      );
    });

    it.effect("render is the Effect form of renderResult", () =>
      Effect.gen(function* () {
        assert.strictEqual(
          yield* MarkdownToc.render("# One\n\n## Two\n", { bullet: "*" }),
          lines("* [One](#one)", "  * [Two](#two)")
        );
        const failure = yield* Effect.flip(MarkdownToc.render(`${Str.repeat(300)(">")} foo\n`));
        assert.strictEqual(failure._tag, "MarkdownParseError");
      })
    );
  });

  describe("schemas", () => {
    it("TocOptions accepts every field omitted and rejects an explicit undefined", () => {
      assert.deepStrictEqual({ ...TocOptions.make({}) }, {});
      assert.deepStrictEqual(
        { ...TocOptions.make({ bullet: "+", indent: " ", maxDepth: 3, linkify: true }) },
        {
          bullet: "+",
          indent: " ",
          maxDepth: 3,
          linkify: true,
        }
      );
      assertFailure(
        Result.mapError(S.decodeUnknownResult(TocOptions)({ bullet: undefined }), (error) => error._tag),
        "SchemaError"
      );
      assertFailure(
        Result.mapError(S.decodeUnknownResult(TocOptions)({ bullet: "#" }), (error) => error._tag),
        "SchemaError"
      );
    });

    it("TocEntry rejects a slug with a space and a negative ordinal", () => {
      const entry = { text: "A b", slug: "a-b", depth: 2, index: 0, occurrence: 0 };
      assert.isTrue(S.is(TocEntry)(entry));
      assert.isFalse(S.is(TocEntry)({ ...entry, slug: "a b" }));
      assert.isFalse(S.is(TocEntry)({ ...entry, occurrence: -1 }));
      assert.isFalse(S.is(TocEntry)({ ...entry, depth: 7 }));
    });

    it("marker matches the comment with any spaces or tabs inside", () => {
      assert.isTrue(MarkdownToc.marker.test("<!--toc-->"));
      assert.isTrue(MarkdownToc.marker.test("<!-- \ttoc  -->"));
      assert.isFalse(MarkdownToc.marker.test("<!-- toc: no -->"));
    });
  });
});
