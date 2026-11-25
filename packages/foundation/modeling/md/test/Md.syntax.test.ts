import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import {
  MdxFlowExpression,
  MdxJsxFlowElement,
  MdxJsxTextElement,
  MdxjsEsm,
  MdxTextExpression,
} from "@beep/markdown/MarkdownMdx";
import { Paragraph, Position, Root, Text } from "@beep/markdown/MarkdownNode";
import * as MdRoot from "@beep/md";
import { scanInlineMathMetered } from "@beep/md/internal/syntax/recognizers";
import { Document } from "@beep/md/Md.model";
import { MdParseError, MdParseOptions, parse, parseResult, parseSafe, parseSafeResult } from "@beep/md/Md.parse";
import { documentSafetyIssues } from "@beep/md/Md.safe";
import {
  fromMarkdownDocument,
  locateViolations,
  lossSeverity,
  MdFrontmatterError,
  MdLoss,
  MdLossReason,
  MdSourceMap,
  MdSyntaxOptions,
  MdUnsafeDocumentError,
  positionAt,
  refineSafe,
} from "@beep/md/Md.syntax";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import {
  assertDefined,
  assertFailure,
  assertNone,
  assertSome,
  assertSuccess,
  deepStrictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MdFromSyntax, MdSyntaxOptions as MdSyntaxOptionsType } from "@beep/md/Md.syntax";

const bridge = (text: string, options?: MdParseOptions.Encoded): MdFromSyntax =>
  Result.getOrThrow(parseResult(text, options));

const encoded = (text: string, options?: MdParseOptions.Encoded): Document.Encoded =>
  Result.getOrThrow(Document.encodeResult(bridge(text, options).document));

const reasons = (result: MdFromSyntax): ReadonlyArray<string> => A.map(result.losses, (loss) => loss.reason);

const lossOf = (result: MdFromSyntax, reason: string): MdLoss =>
  O.getOrThrowWith(
    A.findFirst(result.losses, (candidate) => candidate.reason === reason),
    () => new Error(`missing ${reason} loss in ${A.join(reasons(result), ", ")}`)
  );

const handBuilt = (root: Root, options?: MdSyntaxOptionsType.Encoded): MdFromSyntax =>
  Result.getOrThrow(
    fromMarkdownDocument(
      MarkdownDocument.make({
        source: "",
        root,
        diagnostics: [],
        definitions: HashMap.empty(),
        definitionOrder: [],
      }),
      options
    )
  );

describe("@beep/md/Md.syntax options", () => {
  it("resolves every default from an empty object", () => {
    const options = MdSyntaxOptions.make({});
    expect(options).toMatchObject({
      html: "escapeAsText",
      htmlComments: "drop",
      breakTag: true,
      admonitions: true,
      math: true,
      youtube: false,
      absorbEmptyTableHeader: true,
      autolinkLiterals: "link",
      softBreak: "space",
      frontmatter: "decode",
      onFrontmatterFailure: "loss",
      sourceMap: true,
    });
    expect(MdParseOptions.make({}).dialect).toBe("gfm");
  });

  it.effect("decodes missing keys to the same defaults", () =>
    Effect.gen(function* () {
      const options = yield* S.decodeEffect(MdSyntaxOptions)({});
      expect(options.math).toBe(true);
    })
  );
});

describe("@beep/md/Md.syntax flow mapping", () => {
  it("maps root, paragraph, heading and thematic break", () => {
    expect(encoded("# Title\n\nBody\n\n---")).toEqual({
      _tag: "document",
      children: [
        { _tag: "heading", level: 1, children: [{ _tag: "text", value: "Title" }] },
        { _tag: "p", children: [{ _tag: "text", value: "Body" }] },
        { _tag: "hr" },
      ],
    });
  });

  it("maps a blockquote and keeps unknown alert kinds as blockquotes", () => {
    expect(encoded("> quoted\n\n> [!OTHER]\n> x")).toEqual({
      _tag: "document",
      children: [
        { _tag: "blockquote", children: [{ _tag: "p", children: [{ _tag: "text", value: "quoted" }] }] },
        { _tag: "blockquote", children: [{ _tag: "p", children: [{ _tag: "text", value: "[!OTHER] x" }] }] },
      ],
    });
  });

  it("recognizes admonitions with and without a title", () => {
    const result = bridge("> [!NOTE]\n> Body\n\n> [!warning] Heads up\n> more");
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children).toEqual([
      { _tag: "admonition", kind: "note", children: [{ _tag: "p", children: [{ _tag: "text", value: "Body" }] }] },
      {
        _tag: "admonition",
        kind: "warning",
        title: "Heads up",
        children: [{ _tag: "p", children: [{ _tag: "text", value: "more" }] }],
      },
    ]);
    expect(result.losses).toEqual([]);
  });

  it("does not recognize an escaped admonition marker or a disabled recognizer", () => {
    expect(encoded("> \\[!NOTE]\n> x").children[0]?._tag).toBe("blockquote");
    expect(encoded("> [!NOTE]\n> x", { admonitions: false }).children[0]?._tag).toBe("blockquote");
  });

  it("flattens an admonition title with inline markup", () => {
    const result = bridge("> [!TIP] A *styled* title\n> body");
    const loss = lossOf(result, "admonitionTitleFlattened");
    expect(loss.nodeKind).toBe("paragraph");
    assertSome(loss.mdPath, ["children", 0]);
    const admonition = Result.getOrThrow(Document.encodeResult(result.document)).children[0];
    expect(admonition).toMatchObject({ _tag: "admonition", title: "A styled title" });
  });

  it("drops an HTML comment from an admonition title by default", () => {
    const result = bridge("> [!NOTE] Title <!-- internal -->\n> body");
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children[0]).toMatchObject({
      _tag: "admonition",
      title: "Title",
    });
    expect(reasons(result)).toEqual(["htmlDropped"]);
    assertSome(lossOf(result, "htmlDropped").detail, "comment");
    expect(lossOf(result, "htmlDropped").nodeKind).toBe("html");
  });

  it("applies the html policy to raw HTML in an admonition title, whose plain-string title cannot carry raw HTML, so only escapeAsText keeps the markup and rawHtml drops it like drop", () => {
    const source = "> [!NOTE] Title <b>x</b>\n> body";
    const titleOf = (result: MdFromSyntax) => Result.getOrThrow(Document.encodeResult(result.document)).children[0];
    const details = (result: MdFromSyntax) =>
      A.map(result.losses, (loss) => [loss.reason, O.getOrElse(loss.detail, () => "")]);

    const dropped = bridge(source, { html: "drop" });
    expect(titleOf(dropped)).toMatchObject({ _tag: "admonition", title: "Title x" });
    expect(details(dropped)).toEqual([
      ["htmlDropped", "<b>"],
      ["htmlDropped", "</b>"],
    ]);

    const raw = bridge(source, { html: "rawHtml" });
    expect(titleOf(raw)).toMatchObject({ _tag: "admonition", title: "Title x" });
    expect(details(raw)).toEqual([
      ["htmlDropped", "<b>"],
      ["htmlDropped", "</b>"],
    ]);

    const escaped = bridge(source);
    expect(titleOf(escaped)).toMatchObject({ _tag: "admonition", title: "Title <b>x</b>" });
    expect(details(escaped)).toEqual([
      ["admonitionTitleFlattened", " Title <b>x</b>"],
      ["htmlEscapedAsText", "<b>"],
      ["htmlEscapedAsText", "</b>"],
    ]);
    assertSome(lossOf(escaped, "htmlEscapedAsText").mdPath, ["children", 0]);
  });

  it("keeps an admonition-title comment as text only when comments are HTML and HTML is escaped", () => {
    const source = "> [!NOTE] Title <!-- c -->\n> body";
    const kept = bridge(source, { htmlComments: "asHtml" });
    expect(Result.getOrThrow(Document.encodeResult(kept.document)).children[0]).toMatchObject({
      title: "Title <!-- c -->",
    });
    expect(reasons(kept)).toEqual(["admonitionTitleFlattened", "htmlEscapedAsText"]);

    const raw = bridge(source, { htmlComments: "asHtml", html: "rawHtml" });
    expect(Result.getOrThrow(Document.encodeResult(raw.document)).children[0]).toMatchObject({ title: "Title" });
    expect(reasons(raw)).toEqual(["htmlDropped"]);
  });

  it("drops raw HTML nested in inline markup of an admonition title", () => {
    const result = bridge("> [!TIP] A *styled <!-- c -->* title\n> body");
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children[0]).toMatchObject({
      title: "A styled  title",
    });
    expect(reasons(result)).toEqual(["admonitionTitleFlattened", "htmlDropped"]);
  });

  it("ends an admonition head line at a <br> tag the way a hard break does, since breakTag recognizes it before any HTML policy", () => {
    const source = "> [!NOTE] Title<br>more\n> body";
    const recognized = bridge(source);
    expect(Result.getOrThrow(Document.encodeResult(recognized.document)).children[0]).toMatchObject({
      title: "Title",
      children: [{ _tag: "p", children: [{ _tag: "text", value: "more body" }] }],
    });
    expect(reasons(recognized)).toEqual([]);

    const literal = bridge(source, { breakTag: false, html: "drop" });
    expect(Result.getOrThrow(Document.encodeResult(literal.document)).children[0]).toMatchObject({
      title: "Titlemore",
    });
    expect(reasons(literal)).toEqual(["htmlDropped"]);
  });

  it("maps fenced and indented code to pre without the newline CommonMark keeps after the last line, which Md.render writes back", () => {
    expect(encoded("```ts\nlet a = 1\n```\n\n    indented").children).toEqual([
      { _tag: "pre", language: "ts", value: "let a = 1" },
      { _tag: "pre", language: null, value: "indented" },
    ]);
  });

  it("drops invalid languages and info-string meta as losses", () => {
    const result = bridge("```c++!\nx\n```\n\n```ts title=a.ts\ny\n```");
    expect(reasons(result)).toEqual(["codeLanguageDropped", "codeMetaDropped"]);
    assertSome(lossOf(result, "codeLanguageDropped").detail, "c++!");
    assertSome(lossOf(result, "codeMetaDropped").detail, "title=a.ts");
    expect(lossSeverity(lossOf(result, "codeMetaDropped"))).toBe("lossy");
  });

  it("maps flow HTML under each policy", () => {
    const escaped = bridge("<div>hi</div>");
    expect(Result.getOrThrow(Document.encodeResult(escaped.document)).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "<div>hi</div>" }] },
    ]);
    expect(reasons(escaped)).toEqual(["htmlEscapedAsText"]);

    const raw = bridge("<div>hi</div>", { html: "rawHtml" });
    expect(Result.getOrThrow(Document.encodeResult(raw.document)).children).toEqual([
      { _tag: "p", children: [{ _tag: "rawHtml", value: "<div>hi</div>" }] },
    ]);
    expect(reasons(raw)).toEqual(["htmlInlinedBlock"]);

    const dropped = bridge("<div>hi</div>", { html: "drop" });
    expect(dropped.document.children).toEqual([]);
    expect(reasons(dropped)).toEqual(["htmlDropped"]);
    expect(lossSeverity(lossOf(dropped, "htmlDropped"))).toBe("unsupported");
    assertNone(lossOf(dropped, "htmlDropped").mdPath);
  });

  it("drops HTML comments by default and can treat them as HTML", () => {
    const dropped = bridge("<!-- note -->");
    expect(dropped.document.children).toEqual([]);
    assertSome(lossOf(dropped, "htmlDropped").detail, "comment");
    expect(reasons(bridge("<!-- note -->", { htmlComments: "asHtml" }))).toEqual(["htmlEscapedAsText"]);
  });

  it("treats HTML between two comments as HTML, not as one comment, since a comment body may not contain `-->` and a lazy match would stretch to the last one", () => {
    const block = bridge("<!-- a --><div>kept</div><!-- b -->");
    expect(reasons(block)).toEqual(["htmlEscapedAsText"]);
    expect(Result.getOrThrow(Document.encodeResult(block.document)).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "<!-- a --><div>kept</div><!-- b -->" }] },
    ]);
    expect(reasons(bridge("<!-- a --><div>kept</div><!-- b -->", { html: "rawHtml" }))).toEqual(["htmlInlinedBlock"]);
  });

  it("maps task, bullet and ordered lists", () => {
    expect(encoded("- [x] done\n- [ ] todo\n\n* a\n* b\n\n3. c\n4. d").children).toEqual([
      {
        _tag: "taskList",
        children: [
          { _tag: "taskItem", checked: true, children: [{ _tag: "text", value: "done" }] },
          { _tag: "taskItem", checked: false, children: [{ _tag: "text", value: "todo" }] },
        ],
      },
      {
        _tag: "ul",
        children: [
          { _tag: "li", children: [{ _tag: "text", value: "a" }] },
          { _tag: "li", children: [{ _tag: "text", value: "b" }] },
        ],
      },
      {
        _tag: "ol",
        start: 3,
        children: [
          { _tag: "li", children: [{ _tag: "text", value: "c" }] },
          { _tag: "li", children: [{ _tag: "text", value: "d" }] },
        ],
      },
    ]);
  });

  it("keeps paragraphs in loose list items", () => {
    expect(encoded("- a\n\n- b").children).toEqual([
      {
        _tag: "ul",
        children: [
          { _tag: "li", children: [{ _tag: "p", children: [{ _tag: "text", value: "a" }] }] },
          { _tag: "li", children: [{ _tag: "p", children: [{ _tag: "text", value: "b" }] }] },
        ],
      },
    ]);
  });

  it("drops checkboxes from mixed or ordered lists as losses", () => {
    const result = bridge("- [x] a\n- b\n\n1. [ ] c");
    expect(reasons(result)).toEqual(["taskCheckboxDropped", "taskCheckboxDropped"]);
    const [first, second] = result.losses;
    assertDefined(first);
    assertDefined(second);
    assertSome(first.mdPath, ["children", 0, "children", 0]);
    assertSome(second.detail, "unchecked");
  });

  it("maps tables with alignment and absorbs an empty header row", () => {
    expect(encoded("| a | b |\n|:-|-:|\n| 1 | 2 |").children).toEqual([
      {
        _tag: "table",
        align: ["left", "right"],
        headerRow: true,
        children: [
          {
            _tag: "tableRow",
            children: [
              { _tag: "tableCell", children: [{ _tag: "text", value: "a" }] },
              { _tag: "tableCell", children: [{ _tag: "text", value: "b" }] },
            ],
          },
          {
            _tag: "tableRow",
            children: [
              { _tag: "tableCell", children: [{ _tag: "text", value: "1" }] },
              { _tag: "tableCell", children: [{ _tag: "text", value: "2" }] },
            ],
          },
        ],
      },
    ]);
    const absorbed = encoded("|  |  |\n|--|--|\n| 1 | 2 |").children[0];
    expect(absorbed).toMatchObject({ _tag: "table", align: ["none", "none"], headerRow: false });
    const kept = encoded("|  |  |\n|--|--|\n| 1 | 2 |", { absorbEmptyTableHeader: false }).children[0];
    expect(kept).toMatchObject({ _tag: "table", headerRow: true });
  });

  it("removes referenced definitions silently and reports unreferenced ones", () => {
    const result = bridge("[x][ref]\n\n[ref]: /u\n[unused]: /z\n[ref]: /second");
    expect(reasons(result)).toEqual(["definitionUnreferenced", "definitionUnreferenced"]);
    deepStrictEqual(
      A.map(result.losses, (loss) => O.getOrElse(loss.detail, () => "")),
      ["unused", "ref"]
    );
    expect(lossSeverity(result.losses[0] ?? lossOf(result, "definitionUnreferenced"))).toBe("unsupported");
  });

  it("maps footnote definitions and drops later duplicates", () => {
    const result = bridge("Text[^n]\n\n[^n]: one\n\n[^n]: two");
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "text", value: "Text" },
          { _tag: "footnoteReference", identifier: "n" },
        ],
      },
      {
        _tag: "footnoteDefinition",
        identifier: "n",
        children: [{ _tag: "p", children: [{ _tag: "text", value: "one" }] }],
      },
    ]);
    expect(reasons(result)).toEqual(["footnoteDefinitionDuplicate"]);
  });

  it("rewrites footnote identifiers consistently for references and definitions", () => {
    const result = bridge("Text[^a!b] and[^_c]\n\n[^a!b]: one\n\n[^_c]: two");
    const document = Result.getOrThrow(Document.encodeResult(result.document));
    expect(document.children[0]).toEqual({
      _tag: "p",
      children: [
        { _tag: "text", value: "Text" },
        { _tag: "footnoteReference", identifier: "a-b" },
        { _tag: "text", value: " and" },
        { _tag: "footnoteReference", identifier: "c" },
      ],
    });
    expect(A.map(A.drop(document.children, 1), (block) => ("identifier" in block ? block.identifier : ""))).toEqual([
      "a-b",
      "c",
    ]);
    expect(A.filter(reasons(result), (reason) => reason === "footnoteIdentifierRewritten")).toHaveLength(4);
    assertSome(lossOf(result, "footnoteIdentifierRewritten").detail, "a!b -> a-b");
  });
});

describe("@beep/md/Md.syntax footnote identifiers", () => {
  it("generates identifiers for empty rewrites and suffixes collisions", () => {
    const result = bridge("Text[^!!] and[^a!b] and[^a-b]\n\n[^!!]: one\n\n[^a!b]: two\n\n[^a-b]: three");
    const document = Result.getOrThrow(Document.encodeResult(result.document));
    deepStrictEqual(
      A.flatMap(document.children, (block) => ("identifier" in block ? [block.identifier] : [])),
      ["fn-1", "a-b", "a-b-2"]
    );
  });
});

describe("@beep/md/Md.syntax phrasing mapping", () => {
  it("maps emphasis, strong, delete, inline code and hard breaks", () => {
    expect(encoded("*a* **b** ~~c~~ `d`\\\ne").children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "em", children: [{ _tag: "text", value: "a" }] },
          { _tag: "text", value: " " },
          { _tag: "strong", children: [{ _tag: "text", value: "b" }] },
          { _tag: "text", value: " " },
          { _tag: "del", children: [{ _tag: "text", value: "c" }] },
          { _tag: "text", value: " " },
          { _tag: "code", value: "d" },
          { _tag: "br" },
          { _tag: "text", value: "e" },
        ],
      },
    ]);
  });

  it("joins soft breaks with spaces by default and keeps newlines on request", () => {
    expect(encoded("a\nb").children).toEqual([{ _tag: "p", children: [{ _tag: "text", value: "a b" }] }]);
    expect(encoded("a\nb", { softBreak: "newline" }).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "a\nb" }] },
    ]);
  });

  it("distinguishes literal soft breaks from newline character references", () => {
    expect(encoded("a&#10;b\nc&#xA;d\ne&NewLine;f").children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "a\nb c\nd e\nf" }] },
    ]);
    expect(encoded("a&#10;b\nc", { softBreak: "newline" }).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "a\nb\nc" }] },
    ]);
  });

  it("merges escaped HTML with surrounding text while keeping HTML newlines", () => {
    const source = 'before <span\nclass="x">after</span> end';
    expect(encoded(source).children).toEqual([{ _tag: "p", children: [{ _tag: "text", value: source }] }]);
    const result = bridge(source);
    expect(result.losses).toHaveLength(2);
    for (const loss of result.losses) {
      assertSome(loss.mdPath, ["children", 0, "children", 0]);
    }
  });

  it("locates skipped math recognition on the merged text run", () => {
    const result = bridge("before <b>$x&amp;y$");
    expect(reasons(result)).toEqual(["htmlEscapedAsText", "recognizerSkipped"]);
    for (const loss of result.losses) {
      assertSome(loss.mdPath, ["children", 0, "children", 0]);
    }
  });

  it("keeps math recognition and source ranges at merged HTML boundaries", () => {
    const source = "$a$ before <b>after $b$ end";
    const result = bridge(source);
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "inlineMath", value: "a" },
          { _tag: "text", value: " before <b>after " },
          { _tag: "inlineMath", value: "b" },
          { _tag: "text", value: " end" },
        ],
      },
    ]);
    for (const [index, expected] of A.zip([0, 1, 2, 3], ["$a$", " before <b>after ", "$b$", " end"])) {
      const position = positionAt(result.sourceMap, result.document, ["children", 0, "children", index]);
      assertSome(
        O.map(position, (span) => Str.slice(span.start.offset, span.end.offset)(source)),
        expected
      );
    }
  });

  it("maps inline HTML under each policy and recognizes break tags", () => {
    const escaped = bridge("a <b>x</b> c<br/>d");
    expect(Result.getOrThrow(Document.encodeResult(escaped.document)).children).toEqual([
      {
        _tag: "p",
        children: [{ _tag: "text", value: "a <b>x</b> c" }, { _tag: "br" }, { _tag: "text", value: "d" }],
      },
    ]);
    expect(reasons(escaped)).toEqual(["htmlEscapedAsText", "htmlEscapedAsText"]);

    const raw = bridge("a <b>x</b>", { html: "rawHtml" });
    expect(raw.losses).toEqual([]);
    expect(Result.getOrThrow(Document.encodeResult(raw.document)).children[0]).toMatchObject({
      children: [{ _tag: "text" }, { _tag: "rawHtml", value: "<b>" }, { _tag: "text" }, { _tag: "rawHtml" }],
    });

    const dropped = bridge("a <b>x</b> <!-- c -->", { html: "drop", breakTag: false });
    expect(reasons(dropped)).toEqual(["htmlDropped", "htmlDropped", "htmlDropped"]);
    expect(reasons(bridge("a<br>b", { breakTag: false }))).toEqual(["htmlEscapedAsText"]);
  });

  it("maps inline links, autolinks and literal autolinks", () => {
    expect(encoded('[t](/u "T") <https://a.example>').children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "a", href: "/u", title: "T", children: [{ _tag: "text", value: "t" }] },
          { _tag: "text", value: " " },
          { _tag: "a", href: "https://a.example", children: [{ _tag: "text", value: "https://a.example" }] },
        ],
      },
    ]);
    expect(encoded("see www.example.com").children[0]).toMatchObject({
      children: [{ _tag: "text" }, { _tag: "a", href: "http://www.example.com" }],
    });
    const literal = bridge("see www.example.com <https://b.example>", { autolinkLiterals: "text" });
    expect(Result.getOrThrow(Document.encodeResult(literal.document)).children[0]).toMatchObject({
      children: [
        { _tag: "text", value: "see " },
        { _tag: "text", value: "www.example.com" },
        { _tag: "text" },
        { _tag: "a" },
      ],
    });
    expect(reasons(literal)).toEqual(["autolinkLiteralAsText"]);
  });

  it("resolves link and image references through the definitions", () => {
    expect(encoded('[t][r] ![alt][r]\n\n[r]: /img.png "T"').children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "a", href: "/img.png", title: "T", children: [{ _tag: "text", value: "t" }] },
          { _tag: "text", value: " " },
          { _tag: "img", src: "/img.png", alt: "alt", title: "T" },
        ],
      },
    ]);
  });

  it("maps images", () => {
    expect(encoded("![a](/p.png)").children).toEqual([
      { _tag: "p", children: [{ _tag: "img", src: "/p.png", alt: "a" }] },
    ]);
  });

  it("turns references without a definition into their source text", () => {
    const parsed = Result.getOrThrow(MarkdownDocument.parseResult("[t][r] ![i][r]\n\n[r]: /u"));
    const unresolved = MarkdownDocument.make({
      source: parsed.source,
      root: parsed.root,
      diagnostics: [],
      definitions: HashMap.empty(),
      definitionOrder: [],
    });
    const result = Result.getOrThrow(fromMarkdownDocument(unresolved));
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children[0]).toEqual({
      _tag: "p",
      children: [
        { _tag: "text", value: "[t][r]" },
        { _tag: "text", value: " " },
        { _tag: "text", value: "![i][r]" },
      ],
    });
    expect(reasons(result)).toEqual(["referenceUnresolved", "referenceUnresolved", "definitionUnreferenced"]);
  });
});

const isMathSpace = (char: string | undefined): boolean => char === " " || char === "\t" || char === "\n";
const isMathDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9";

type OraclePiece = { readonly _tag: string; readonly value: string };

const opensMathAt = (text: string, index: number): boolean =>
  text[index] === "$" && text[index + 1] !== "$" && !isMathSpace(text[index + 1]);

const closesMathAt = (text: string, probe: number): boolean =>
  text[probe] === "$" && !isMathSpace(text[probe - 1]) && !isMathDigit(text[probe + 1]);

const oracleCloser = (text: string, index: number): number => {
  if (!opensMathAt(text, index)) {
    return -1;
  }
  for (let probe = index + 2; probe < Str.length(text); probe++) {
    if (closesMathAt(text, probe)) {
      return probe;
    }
  }
  return -1;
};

const skipWidth = (text: string, index: number): number => (text[index] === "$" && text[index + 1] === "$" ? 2 : 1);

const pushMathSpan = (
  pieces: Array<OraclePiece>,
  text: string,
  textStart: number,
  open: number,
  close: number
): void => {
  if (open > textStart) {
    pieces.push({ _tag: "text", value: Str.slice(textStart, open)(text) });
  }
  pieces.push({ _tag: "inlineMath", value: Str.slice(open + 1, close)(text) });
};

const oracleInlineMath = (text: string): ReadonlyArray<OraclePiece> => {
  const pieces: Array<OraclePiece> = [];
  let textStart = 0;
  let index = 0;
  while (index < Str.length(text)) {
    const close = oracleCloser(text, index);
    if (close < 0) {
      index += skipWidth(text, index);
      continue;
    }
    pushMathSpan(pieces, text, textStart, index, close);
    textStart = close + 1;
    index = textStart;
  }
  if (Str.length(text) > textStart) {
    pieces.push({ _tag: "text", value: Str.slice(textStart)(text) });
  }
  return A.some(pieces, (piece) => piece._tag === "inlineMath") ? pieces : [{ _tag: "text", value: text }];
};

const everyStringUpTo = (alphabet: ReadonlyArray<string>, length: number): ReadonlyArray<string> =>
  length === 0
    ? [""]
    : [
        ...everyStringUpTo(alphabet, length - 1),
        ...A.flatMap(
          A.filter(everyStringUpTo(alphabet, length - 1), (prefix) => Str.length(prefix) === length - 1),
          (prefix) => A.map(alphabet, (char) => `${prefix}${char}`)
        ),
      ];

const meteredScanCharacterReads = (unit: string, count: number): number => {
  let steps = 0;
  scanInlineMathMetered(Str.repeat(count)(unit), () => {
    steps += 1;
  });
  return steps;
};

const forwardProbes = (text: string, index: number): number => {
  if (!opensMathAt(text, index)) {
    return 0;
  }
  let probes = 0;
  for (let probe = index + 2; probe < Str.length(text) && !closesMathAt(text, probe); probe++) {
    probes += 1;
  }
  return probes;
};

const quadraticScanSteps = (unit: string, count: number): number => {
  const text = Str.repeat(count)(unit);
  return A.reduce(A.range(0, Str.length(text) - 1), 0, (steps, index) => steps + 1 + forwardProbes(text, index));
};

const SCAN_SIZES = [1_000, 2_000, 4_000, 8_000];

const growsWithOneSlopeAcrossSizes = (counts: ReadonlyArray<number>): boolean => {
  const slopes = A.map(A.range(1, counts.length - 1), (at) => {
    const added = (counts[at] ?? 0) - (counts[at - 1] ?? 0);
    return added / ((SCAN_SIZES[at] ?? 0) - (SCAN_SIZES[at - 1] ?? 0));
  });
  return A.every(slopes, (slope) => slope === slopes[0]);
};

describe("@beep/md/Md.syntax inline math scan", () => {
  it("agrees with the direct quadratic pandoc tex_math_dollars scan it replaced, exhaustively on every short string", () => {
    for (const body of everyStringUpTo(["$", "a", "1", " "], 6)) {
      const text = `x${body}x`;
      const children = encoded(text, { math: true }).children;
      expect([text, children]).toEqual([text, [{ _tag: "p", children: oracleInlineMath(text) }]]);
    }
  });

  it("reads exactly 17 characters per unit over openers that never close", () => {
    const counts = A.map(SCAN_SIZES, (count) => meteredScanCharacterReads("$a ", count));
    expect(
      counts,
      "escape table 3n reads, closer table 4n + 1, scan loop 10n (6 per opener, 2 per other character)"
    ).toEqual(A.map(SCAN_SIZES, (count) => 17 * count + 1));
    expect(growsWithOneSlopeAcrossSizes(counts)).toBe(true);
  });

  it("reads exactly 17 characters per unit over many closed inline math spans", () => {
    const counts = A.map(SCAN_SIZES, (count) => meteredScanCharacterReads("$a$ ", count));
    expect(
      counts,
      "escape table 4n reads, closer table 7n + 1, scan loop 6n (4 per opener that jumps its span, 2 per space)"
    ).toEqual(A.map(SCAN_SIZES, (count) => 17 * count + 1));
    expect(growsWithOneSlopeAcrossSizes(counts)).toBe(true);
  });

  it("rejects the oracle's quadratic forward scan with the same growth check", () => {
    const counts = A.map(SCAN_SIZES, (count) => quadraticScanSteps("$a ", count));
    expect(counts, "3n positions plus 3(n - k) - 2 probes from the opener of unit k").toEqual(
      A.map(SCAN_SIZES, (count) => count + (3 * count * (count + 1)) / 2)
    );
    expect(growsWithOneSlopeAcrossSizes(counts)).toBe(false);
  });
});

describe("@beep/md/Md.syntax recognizers", () => {
  it("recognizes math by default and not when disabled", () => {
    const off = encoded("$$\nx^2\n$$\n\na $b$ c\n\n```math\ny\n```", { math: false });
    expect(A.map(off.children, (block) => block._tag)).toEqual(["p", "p", "pre"]);

    const on = encoded("$$\nx^2\n$$\n\na $b$ c $5 and $10\n\n```math\ny\n```");
    expect(on.children).toEqual([
      { _tag: "mathBlock", value: "x^2" },
      {
        _tag: "p",
        children: [
          { _tag: "text", value: "a " },
          { _tag: "inlineMath", value: "b" },
          { _tag: "text", value: " c $5 and $10" },
        ],
      },
      { _tag: "mathBlock", value: "y" },
    ]);
  });

  it("reads inline math from the raw slice, so a backslash-escaped dollar never delimits, a math piece keeps its raw TeX and a text piece drops its backslash escapes", () => {
    expect(encoded("a \\* $b$ \\$c$", { math: true }).children).toEqual([
      {
        _tag: "p",
        children: [
          { _tag: "text", value: "a * " },
          { _tag: "inlineMath", value: "b" },
          { _tag: "text", value: " $c$" },
        ],
      },
    ]);
    expect(bridge("costs \\$5 and \\$6", { math: true }).losses).toEqual([]);
  });

  it("recognizes math beside entities but skips math spanning entities or container prefixes", () => {
    const result = bridge("a &amp; $b$\n\n$a&amp;b$\n\n> $$\n> x\n> $$\n\n> a $b\n> c$", { math: true });
    expect(A.map(result.losses, (loss) => `${loss.reason}:${loss.nodeKind}`)).toEqual([
      "recognizerSkipped:text",
      "recognizerSkipped:paragraph",
      "recognizerSkipped:text",
    ]);
  });

  it("recognizes a lone YouTube link only when enabled", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(encoded(url, { youtube: true }).children).toEqual([{ _tag: "youtube", videoId: "dQw4w9WgXcQ" }]);
    expect(encoded(url).children[0]?._tag).toBe("p");
    expect(encoded("https://example.com/watch", { youtube: true }).children[0]?._tag).toBe("p");
    expect(encoded(`<${url}>`, { youtube: true }).children).toEqual([{ _tag: "youtube", videoId: "dQw4w9WgXcQ" }]);
  });

  it("keeps a YouTube link with its own text or title as a link, since a YouTube block carries only the video id and would lose them", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    for (const text of [`[My video](${url})`, `[${url}](${url} "Title")`]) {
      const result = bridge(text, { youtube: true });
      expect(Result.getOrThrow(Document.encodeResult(result.document)).children[0]?._tag).toBe("p");
      expect(result.losses).toEqual([]);
    }
  });
});

describe("@beep/md/Md.syntax frontmatter", () => {
  it("decodes YAML into JSON and reports the format change", () => {
    const result = bridge("---\ntitle: Notes\n---\nBody");
    assertSome(result.document.frontmatter, { title: "Notes" });
    expect(reasons(result)).toEqual(["frontmatterFormatChanged"]);
    assertSome(lossOf(result, "frontmatterFormatChanged").mdPath, ["frontmatter"]);
  });

  it("keeps JSON frontmatter without a format loss", () => {
    const result = bridge('---json\n{"title":"Notes"}\n---\nBody');
    assertSome(result.document.frontmatter, { title: "Notes" });
    expect(result.losses).toEqual([]);
  });

  it("coerces TOML date-times and reports each coercion", () => {
    const result = bridge("+++\nwhen = 1979-05-27T07:32:00Z\n+++\nBody");
    assertSome(result.document.frontmatter, { when: "1979-05-27T07:32:00Z" });
    expect(reasons(result)).toEqual(["frontmatterValueCoerced", "frontmatterFormatChanged"]);
    expect(O.getOrThrow(lossOf(result, "frontmatterValueCoerced").detail)).toMatch(/^\/when: /);
  });

  it("reports coercions with no landing path when projection empties the frontmatter", () => {
    const result = bridge("---\ninf: .inf\n---\nBody");
    assertNone(result.document.frontmatter);
    expect(reasons(result)).toEqual(["frontmatterValueCoerced"]);
    assertNone(lossOf(result, "frontmatterValueCoerced").mdPath);
  });

  it("projects TOML big integers, dates and times with JSON-pointer coercions", () => {
    const result = bridge(
      '+++\nbig = 9007199254740993\nsmall = 42\n"a/b~c" = 1979-05-27\narr = [1979-05-27T07:32:00Z]\nt = 07:32:00\n+++\nx'
    );
    assertSome(result.document.frontmatter, {
      big: "9007199254740993",
      small: 42,
      "a/b~c": "1979-05-27",
      arr: ["1979-05-27T07:32:00Z"],
      t: "07:32:00",
    });
    deepStrictEqual(
      A.map(result.losses, (loss) => O.getOrElse(loss.detail, () => "")),
      [
        "/big: bigint outside the safe integer range became its decimal string",
        "/a~1b~0c: TomlLocalDate became its string form",
        "/arr/0: TomlOffsetDateTime became its string form",
        "/t: TomlLocalTime became its string form",
        "toml -> json",
      ]
    );
  });

  it("drops non-finite YAML numbers and nulls them inside arrays", () => {
    const result = bridge("---\ninf: .inf\nlist: [.nan, 1]\n---\nx");
    assertSome(result.document.frontmatter, { list: [null, 1] });
    deepStrictEqual(
      A.map(result.losses, (loss) => O.getOrElse(loss.detail, () => "")),
      [
        "/inf: non-finite number Infinity was dropped",
        "/list/0: array element without a JSON form became null",
        "yaml -> json",
      ]
    );
  });

  it("treats empty frontmatter as absent", () => {
    assertNone(bridge("---\n---\nBody").document.frontmatter);
    expect(bridge("---\n{}\n---\nBody").losses).toEqual([]);
  });

  it("records invalid and non-object frontmatter as losses", () => {
    const invalid = bridge("---\n: [bad\n---\nBody");
    expect(reasons(invalid)).toEqual(["frontmatterInvalid"]);
    expect(lossSeverity(lossOf(invalid, "frontmatterInvalid"))).toBe("unsupported");
    expect(reasons(bridge("---\n- a\n---\nBody"))).toEqual(["frontmatterNotObject"]);
  });

  it("fails with MdFrontmatterError under the fail policy", () => {
    const invalid = parseResult("---\n: [bad\n---\nBody", { onFrontmatterFailure: "fail" });
    assertFailure(
      Result.mapError(invalid, (error) => error._tag),
      "MdFrontmatterError"
    );
    const notObject = parseResult("---\n- a\n---\nBody", { onFrontmatterFailure: "fail" });
    assertFailure(
      Result.mapError(notObject, (error) => (S.is(MdFrontmatterError)(error) ? error.reason : error._tag)),
      "notObject"
    );
  });

  it("drops frontmatter under the drop policy without parsing its fences as content", () => {
    const result = bridge("---\ntitle: x\n---\nBody", { frontmatter: "drop" });
    assertNone(result.document.frontmatter);
    expect(result.document.children).toHaveLength(1);
    expect(reasons(result)).toEqual(["frontmatterDropped"]);
  });
});

describe("@beep/md/Md.syntax MDX", () => {
  it("unwraps MDX elements and drops MDX expressions and ESM", () => {
    const root = Root.make({
      children: [
        MdxjsEsm.make({ value: "import X from 'x'" }),
        MdxJsxFlowElement.make({
          name: "Box",
          attributes: [],
          children: [
            Paragraph.make({
              children: [
                MdxJsxTextElement.make({ name: null, attributes: [], children: [Text.make({ value: "inner" })] }),
                MdxTextExpression.make({ value: "1 + 1" }),
              ],
            }),
          ],
        }),
        MdxFlowExpression.make({ value: "props.x" }),
      ],
    });
    const result = handBuilt(root);
    expect(Result.getOrThrow(Document.encodeResult(result.document)).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "inner" }] },
    ]);
    expect([...reasons(result)].sort()).toEqual(
      ["mdxDropped", "mdxDropped", "mdxDropped", "mdxElementUnwrapped", "mdxElementUnwrapped"].sort()
    );
    assertSome(
      O.flatMap(
        A.findFirst(result.losses, (loss) => O.contains(loss.detail, "Box")),
        (loss) => loss.mdPath
      ),
      ["children", 0]
    );
  });
});

const corpusSections = [
  "---\ntitle: x\n---",
  "# Title",
  "> [!NOTE] *t*\n> body",
  "- [x] a\n- b",
  "| | |\n|-|-|\n| 1 | 2 |",
  "a <b>x</b> <!-- c --> www.example.com $m$",
  "```ts meta\ncode\n```",
  "$$\nx\n$$",
  "[r][d] [^n]\n\n[d]: /u\n[^n]: note",
];

const corpus = A.join(corpusSections, "\n\n");

const parsedCorpus = Result.getOrThrow(MarkdownDocument.parseResult(corpus, { frontmatter: true }));

const isSortedByOffset = (losses: ReadonlyArray<MdLoss>): boolean =>
  A.every(
    losses,
    (loss, index) => index === 0 || (losses[index - 1]?.position.start.offset ?? 0) <= loss.position.start.offset
  );

const hasMathBlock = (document: Document): boolean => A.some(document.children, (block) => block._tag === "mathBlock");

describe("@beep/md/Md.syntax option space", () => {
  it.prop(
    "bridges the corpus under every option combination",
    [Arbitrary.schema(MdSyntaxOptions)],
    ([options]) => {
      const result = fromMarkdownDocument(parsedCorpus, options);
      if (Result.isFailure(result)) {
        expect(options.onFrontmatterFailure).toBe("fail");
        return true;
      }
      const entries = result.success.sourceMap.entries;
      expect(isSortedByOffset(result.success.losses)).toBe(true);
      expect(entries.length === 0 ? !options.sourceMap : entries[0]?.descendants === entries.length - 1).toBe(true);
      expect(options.math || !hasMathBlock(result.success.document)).toBe(true);
      return true;
    },
    { arbitrary: fcRuns(50) }
  );
});

describe("@beep/md/Md.syntax loss taxonomy", () => {
  it("derives a severity for every reason", () => {
    for (const reason of MdLossReason.literals) {
      const loss = MdLoss.make({
        reason,
        nodeKind: "text",
        position: Position.synthetic,
        mdPath: O.none(),
        detail: O.none(),
      });
      expect(["lossy", "unsupported"]).toContain(lossSeverity(loss));
    }
  });
});

describe("@beep/md/Md.syntax source map", () => {
  it("records one pre-order entry per Md node", () => {
    const result = bridge("# T\n\n- a\n- b *c*");
    expect(result.sourceMap.entries).toHaveLength(10);
    expect(result.sourceMap.entries[0]?.descendants).toBe(9);
    expect(A.map(result.sourceMap.entries, (entry) => entry.origin)).toContain("parsed");
  });

  it("locates nodes and trailing field segments", () => {
    const result = bridge("# T\n\n- a\n- b *c*");
    const em = positionAt(result.sourceMap, result.document, ["children", 1, "children", 1, "children", 1]);
    assertSome(
      O.map(em, (position) => [position.start.line, position.start.column]),
      [4, 5]
    );
    const viaField = positionAt(result.document, ["children", 0, "children", 0, "value"])(result.sourceMap);
    assertSome(
      O.map(viaField, (position) => position.start.offset),
      2
    );
    assertSome(
      O.map(positionAt(result.sourceMap, result.document, []), (position) => position.start.offset),
      0
    );
  });

  it("marks merged and recognized nodes", () => {
    const merged = handBuilt(
      Root.make({ children: [Paragraph.make({ children: [Text.make({ value: "a" }), Text.make({ value: "b" })] })] })
    );
    expect(Result.getOrThrow(Document.encodeResult(merged.document)).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "ab" }] },
    ]);
    expect(A.map(merged.sourceMap.entries, (entry) => entry.origin)).toEqual(["parsed", "parsed", "merged"]);
    const recognized = bridge("a $b$", { math: true });
    expect(A.map(recognized.sourceMap.entries, (entry) => entry.origin)).toContain("recognized");
  });

  it("returns None for paths outside the tree or after a transform", () => {
    const result = bridge("# T\n\nBody");
    assertNone(positionAt(result.sourceMap, result.document, ["children", 5]));
    const transformed = Document.make({ children: result.document.children.slice(1) });
    assertNone(positionAt(result.sourceMap, transformed, ["children", 0]));
    assertNone(positionAt(MdSourceMap.empty, result.document, []));
  });

  it("skips the map on request", () => {
    expect(bridge("Body", { sourceMap: false }).sourceMap.entries).toEqual([]);
  });
});

describe("@beep/md/Md.parse", () => {
  it.effect("parses as Result and as Effect", () =>
    Effect.gen(function* () {
      const viaEffect = yield* parse("Body");
      expect(viaEffect.document.children).toEqual(bridge("Body").document.children);
      const safe = yield* parseSafe("Body");
      expect(safe.children).toHaveLength(1);
      const parseCommonMark = parseResult({ dialect: "commonmark" });
      assertSuccess(parseCommonMark("~~x~~").pipe(Result.map((bridged) => bridged.losses.length)), 0);
    })
  );

  it("parses CommonMark without GFM extensions", () => {
    expect(encoded("~~x~~", { dialect: "commonmark" }).children).toEqual([
      { _tag: "p", children: [{ _tag: "text", value: "~~x~~" }] },
    ]);
  });

  it("fails with MdParseError on a fatal parser diagnostic", () => {
    const result = parseResult(`${Str.repeat(2000)(">")} deep`);
    assertFailure(
      Result.mapError(result, (error) => S.is(MdParseError)(error)),
      true
    );
  });

  it("refines safe documents and locates unsafe nodes", () => {
    const safe = parseSafeResult("Hello");
    assertSuccess(safe.pipe(Result.map((document) => document.children.length)), 1);
    const unsafe = parseSafeResult("x <b>y</b>", { html: "rawHtml" });
    assertFailure(
      Result.mapError(unsafe, (error) => error._tag),
      "MdUnsafeDocumentError"
    );
    const bridged = bridge("x <b>y</b>", { html: "rawHtml" });
    const refined = refineSafe(bridged);
    assertFailure(
      Result.mapError(refined, (error) => S.is(MdUnsafeDocumentError)(error)),
      true
    );
    const located = locateViolations(bridged, documentSafetyIssues(bridged.document));
    deepStrictEqual(
      A.map(located, (entry) =>
        O.getOrElse(
          O.map(entry.position, (position) => position.start.offset),
          () => -1
        )
      ),
      [2, 6]
    );
    expect(locateViolations(documentSafetyIssues(bridged.document))(bridged)).toHaveLength(2);
  });
});

describe("@beep/md export boundary", () => {
  it("keeps the bridge out of the package root and the Md namespace", () => {
    for (const name of ["parse", "parseResult", "parseSafe", "fromMarkdownDocument", "MdFromSyntax", "MdLoss"]) {
      expect(MdRoot).not.toHaveProperty(name);
      expect(MdRoot.Md).not.toHaveProperty(name);
    }
  });
});
