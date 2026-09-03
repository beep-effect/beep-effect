import { Md } from "@beep/md";
import {
  renderPlainTextBlock,
  renderPlainTextBlocks,
  renderPlainTextInline,
  segmentInlineRuns,
} from "@beep/md/Md.behavior";
import {
  AllowListUrlPolicySpec,
  BrowserSafeUrlPolicySpec,
  escapeHtmlUrlAttribute,
  escapeHtmlUrlAttributeWithPolicy,
  escapeMarkdownDestination,
  escapeMarkdownDestinationWithPolicy,
  escapeMarkdownText,
  isStringArray,
  joinBlocks,
  maxBackticks,
  prefixLines,
  renderFencedCode,
  renderInlineCode,
  StrictWebUrlPolicySpec,
  sanitizeUrlDestination,
  sanitizeUrlDestinationWithPolicy,
  UrlPolicySpec,
} from "@beep/md/Md.escape";
import { renderSafeHtml, safeHtmlValue } from "@beep/md/Md.html";
import {
  Block,
  BlockChildren,
  CodeFenceLanguage,
  Document,
  FootnoteIdentifier,
  Inline,
  InlineChildren,
  ListChildren,
  ListItemChild,
  ListItemChildren,
  Pre,
  Table,
  TableCell,
  TableRow,
  TaskItemChildren,
  Text,
} from "@beep/md/Md.model";
import {
  HtmlFragmentAdapter,
  MarkdownAdapter,
  makeHtmlFragmentAdapter,
  makeMarkdownAdapter,
  PlainTextAdapter,
  renderEffectWith,
  renderEffectWithUnsafe,
  renderHtmlBlock,
  renderHtmlBlocks,
  renderHtmlInline,
  renderHtmlUnsafe,
  renderMarkdownBlock,
  renderMarkdownBlocks,
  renderMarkdownInline,
  renderPlainText,
  renderPlainTextUnsafe,
  renderUnsafe,
  renderWith,
  renderWithUnsafe,
} from "@beep/md/Md.render";
import {
  DuplicateFootnoteDefinitionSafetyViolation,
  decodeSafeDocument,
  decodeSafeDocumentUnsafe,
  documentSafetyIssues,
  HtmlProjectionSafetyViolation,
  MAX_SAFE_DOCUMENT_NODES,
  refineSafeDocument,
  SafeDocument,
} from "@beep/md/Md.safe";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { micromark } from "micromark";
import type { EffectRenderAdapter, PureRenderAdapter, RenderError } from "@beep/md/Md.render";
import type { JsonObject } from "@beep/schema";

const InlineArbitrary = S.toArbitrary(Inline)(fc);
const BlockArbitrary = S.toArbitrary(Block)(fc);
const DocumentArbitrary = S.toArbitrary(Document)(fc);
const FootnoteIdentifierArbitrary = S.toArbitrary(FootnoteIdentifier)(fc);
const SafeDocumentArbitrary = S.toArbitrary(SafeDocument)(fc);

const markdownHtmlDoc = (): Document => Md.make([Md.h1("Hello"), Md.p("World")]);
const encodeJsonResult = UnknownFromJsonString.encodeUnknownResult;
const decodeDocumentJsonResult = S.decodeUnknownResult(S.fromJsonString(Document));

const isJsonObject = (value: S.Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeJsonBoundaryObject = (value: JsonObject): JsonObject =>
  Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJsonBoundaryValue(item)] as const));

const normalizeJsonBoundaryValue = (value: S.Json): S.Json => {
  if (typeof value === "number") {
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeJsonBoundaryValue);
  }
  if (isJsonObject(value)) {
    return normalizeJsonBoundaryObject(value);
  }
  return value;
};

const normalizeDocumentForJsonBoundary = (document: Document): Document =>
  O.match(document.frontmatter, {
    onNone: () => document,
    onSome: (frontmatter) =>
      Document.make({ children: document.children, frontmatter: O.some(normalizeJsonBoundaryObject(frontmatter)) }),
  });

const expectRenderFailure = <Output>(
  result: Result.Result<Output, RenderError>,
  assertion: (error: RenderError) => void
): void => {
  Result.match(result, {
    onFailure: assertion,
    onSuccess: () => expect.fail("Expected render adapter to fail"),
  });
};

const expectExitCause = <Output, Error>(exit: Exit.Exit<Output, Error>, expected: string): void => {
  const rendered = Exit.match(exit, {
    onFailure: Cause.pretty,
    onSuccess: () => expect.fail("Expected effect to fail"),
  });

  expect(rendered).toContain(expected);
};

describe("@beep/md", () => {
  it("renders the intended lowercase block-constructor document shape", () => {
    const markdown = Md.make([
      Md.h1`Heading 1`,
      Md.h2`Heading 2`,
      Md.p`Some text`,
      Md.ul(["List Item 1", "List Item 2"]),
      Md.ol(["Ordered List Item 1", "Ordered List Item 2"]),
      Md.taskListFromItems([Md.taskItem("Task List Item 1", { checked: true }), Md.taskItem("Task List Item 2")]),
      Md.pre(`console.log("beep")`, { language: "ts" }),
      Md.table(
        [
          ["Name", "Value"],
          ["Language", Md.code("ts")],
        ],
        { headerRow: true }
      ),
      Result.getOrThrow(Md.youtube("M7lc1UVf-VE")),
      Md.blockquote`Hello World!`,
    ]);

    const rendered = `# Heading 1

## Heading 2

Some text

- List Item 1
- List Item 2

1. Ordered List Item 1
2. Ordered List Item 2

- [x] Task List Item 1
- [ ] Task List Item 2

\`\`\`ts
console.log("beep")
\`\`\`

| Name | Value |
| --- | --- |
| Language | \`ts\` |

https://www.youtube.com/watch?v=M7lc1UVf-VE

> Hello World!`;

    expect(Result.getOrThrow(Md.render(markdown))).toBe(rendered);
    expect(Md.renderUnsafe(markdown)).toBe(rendered);
  });

  it("projects SafeDocument directly through the conformant safe-HTML pipeline", () => {
    const document = Result.getOrThrow(
      refineSafeDocument(
        Md.make([
          Md.p(["Hello ", Md.strong("world")]),
          Md.p(Md.a("https://example.com/docs", "Docs")),
          Md.taskListFromItems([Md.taskItem("Done", { checked: true }), Md.taskItem("Todo")]),
          Md.table(
            [
              ["Name", "Value"],
              ["Safety", Md.code("schema-first")],
            ],
            { headerRow: true }
          ),
          Result.getOrThrow(Md.youtube("M7lc1UVf-VE")),
        ])
      )
    );

    expect(safeHtmlValue(renderSafeHtml(document))).toBe(
      '<p>Hello <strong>world</strong></p><p><a href="https://example.com/docs">Docs</a></p>' +
        "<ul><li>☒ Done</li><li>☐ Todo</li></ul>" +
        "<table><thead><tr><th>Name</th><th>Value</th></tr></thead>" +
        "<tbody><tr><td>Safety</td><td><code>schema-first</code></td></tr></tbody></table>" +
        '<p><a href="https://www.youtube.com/watch?v=M7lc1UVf-VE">Watch on YouTube</a></p>'
    );
  });

  it("projects Markdown nodes through schema-owned HTML statics", () => {
    const inline = Inline.toHtml(Md.strong("world"));
    const block = Block.toHtml(Md.p("Hello"));
    const document = Document.toHtml(Md.make([Md.p("Hello")]));

    expect(inline._tag).toBe("strong");
    expect(Inline.toHtmlAll([Md.text("Hello"), Md.br])).toHaveLength(2);
    expect(block._tag).toBe("p");
    expect(Block.toHtmlAll([Md.h1("Title"), Md.p("Body")])).toHaveLength(2);
    expect(document._tag).toBe("#fragment");
  });

  it("normalizes nested Markdown links into conformant non-interactive descendants", () => {
    const document = Result.getOrThrow(
      refineSafeDocument(
        Md.make([Md.p(Md.a("https://example.com/outer", ["Outer ", Md.a("https://example.com/inner", "Inner")]))])
      )
    );

    expect(safeHtmlValue(renderSafeHtml(document))).toBe(
      '<p><a href="https://example.com/outer">Outer <span>Inner</span></a></p>'
    );
  });

  it("projects every remaining safe block and inline variant", () => {
    const document = Result.getOrThrow(
      refineSafeDocument(
        Md.make([
          Md.h2([Md.em("Emphasis"), Md.text(" "), Md.del("Deleted")]),
          Md.h3("Three"),
          Md.h4("Four"),
          Md.h5("Five"),
          Md.h6("Six"),
          Md.p([
            Md.img("/logo.png", { alt: "Logo", title: "Logo title" }),
            Md.br,
            Md.inlineMath("a+b"),
            Md.footnoteRef("note"),
          ]),
          Md.blockquote([Md.pre("<code>")]),
          Md.ul([Md.li([Md.text("Inline"), Md.p("Nested block")])]),
          Md.ol(["Ordered"], { start: 3 }),
          Md.table([["Body"]], { headerRow: false }),
          Md.mathBlock("x<y"),
          Md.footnoteDef("note", "Definition"),
          Md.admonition("note", "Body", { title: "Title" }),
          Md.embed("image", "https://example.com/image.png", {
            title: "Image",
            description: "Caption",
          }),
          Md.embed("link", "https://example.com"),
          Md.hr,
        ])
      )
    );
    const html = safeHtmlValue(renderSafeHtml(document));

    expect(html).toContain("<h2><em>Emphasis</em> <del>Deleted</del></h2>");
    expect(html).toContain("<h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>");
    expect(html).toContain('<img alt="Logo" src="/logo.png" title="Logo title"><br><code>a+b</code>');
    expect(html).toContain('<sup><a href="#fn-note">note</a></sup>');
    expect(html).toContain("<blockquote><pre><code>&lt;code&gt;</code></pre></blockquote>");
    expect(html).toContain('<ul><li>Inline<p>Nested block</p></li></ul><ol start="3"><li>Ordered</li></ol>');
    expect(html).toContain("<table><tbody><tr><td>Body</td></tr></tbody></table>");
    expect(html).toContain('<section id="fn-note"><sup>note</sup><p>Definition</p></section>');
    expect(html).toContain("<aside><p>Title</p><p>Body</p></aside>");
    expect(html).toContain("<figcaption>Caption</figcaption>");
    expect(html).toContain('<figure><a href="https://example.com">https://example.com</a></figure><hr>');
  });

  it("escapes raw nodes even when a forged SafeDocument reaches the defensive projection", () => {
    const forged = Md.make([
      Md.p([Md.rawMarkdown("*trusted*"), Md.rawHtml("<script>alert(1)</script>")]),
    ]) as unknown as SafeDocument;

    expect(safeHtmlValue(renderSafeHtml(forged))).toBe("<p>*trusted*&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("keeps active HTML constructs outside the SafeDocument to SafeHtml path", () => {
    const unsafe = Md.make([
      Md.p(Md.rawHtml('<img src=x onerror="alert(1)">')),
      Md.p(Md.a("javascript:alert(1)", "unsafe")),
    ]);

    expect(Result.isFailure(refineSafeDocument(unsafe))).toBe(true);
  });

  it("rejects values that cannot complete the total SafeDocument to SafeHtml projection", () => {
    const incompatible = [
      Md.make([Md.embed("link", " ")]),
      Md.make([Md.p("a\u0000b")]),
      Md.make([Md.p(Md.img("/logo.png", { alt: "\uD800" }))]),
    ];

    for (const document of incompatible) {
      expect(Result.isFailure(refineSafeDocument(document))).toBe(true);
    }
  });

  it("does not reject frontmatter that the safe HTML projection never reads", () => {
    const document = Md.make([Md.p("Visible")], {
      frontmatter: { note: "ignored\u0000metadata" },
    });
    const safe = refineSafeDocument(document);

    expect(Result.isSuccess(safe)).toBe(true);
    expect(() => renderSafeHtml(Result.getOrThrow(safe))).not.toThrow();
  });

  it("rejects duplicate footnote definitions recursively at their exact paths", () => {
    const document = Md.make([
      Md.footnoteDef("duplicate", "Top level"),
      Md.blockquote([Md.ul([Md.li(Md.footnoteDef("duplicate", "Nested list"))])]),
      Md.footnoteDef("container", [Md.footnoteDef("duplicate", "Nested definition")]),
      Md.admonition("note", [Md.footnoteDef("duplicate", "Nested admonition")]),
    ]);
    const issues = documentSafetyIssues(document);
    const duplicateIssues = issues.filter(S.is(DuplicateFootnoteDefinitionSafetyViolation));
    const projectionIssues = issues.filter(S.is(HtmlProjectionSafetyViolation));

    expect(duplicateIssues).toMatchObject([
      { identifier: "duplicate", path: ["children", 0, "identifier"] },
      {
        identifier: "duplicate",
        path: ["children", 1, "children", 0, "children", 0, "children", 0, "identifier"],
      },
      { identifier: "duplicate", path: ["children", 2, "children", 0, "identifier"] },
      { identifier: "duplicate", path: ["children", 3, "children", 0, "identifier"] },
    ]);
    expect(projectionIssues).toHaveLength(duplicateIssues.length);
    expect(projectionIssues.every((issue) => issue.rule === "duplicateId")).toBe(true);
    expect(Result.isFailure(refineSafeDocument(document))).toBe(true);

    const unique = refineSafeDocument(Md.make([Md.footnoteDef("first", "One"), Md.footnoteDef("second", "Two")]));
    expect(Result.isSuccess(unique)).toBe(true);
    expect(() => renderSafeHtml(Result.getOrThrow(unique))).not.toThrow();
  });

  it("rejects every schema-derived duplicate footnote identifier", () =>
    fc.assert(
      fc.property(FootnoteIdentifierArbitrary, (identifier) => {
        const document = Md.make([Md.footnoteDef(identifier, "One"), Md.footnoteDef(identifier, "Two")]);
        const duplicateIssues = documentSafetyIssues(document).filter(S.is(DuplicateFootnoteDefinitionSafetyViolation));

        expect(duplicateIssues).toHaveLength(2);
        expect(duplicateIssues.every((issue) => issue.identifier === identifier)).toBe(true);
        expect(Result.isFailure(refineSafeDocument(document))).toBe(true);
      }),
      fcRuns(100)
    ));

  it("rejects a heading outline that the safe HTML projection cannot render", () => {
    const document = Md.make([Md.h2(""), Md.h5("")]);
    const projectionIssues = documentSafetyIssues(document).filter(S.is(HtmlProjectionSafetyViolation));

    expect(projectionIssues).toMatchObject([
      {
        _tag: "HtmlProjection",
        path: ["children.1"],
        rule: "headingOutline",
      },
    ]);
    expect(Result.isFailure(refineSafeDocument(document))).toBe(true);
    expect(Result.isFailure(decodeSafeDocument(Result.getOrThrow(S.encodeUnknownResult(Document)(document))))).toBe(
      true
    );
  });

  it("renders every schema-derived SafeDocument without failing", () =>
    fc.assert(
      fc.property(SafeDocumentArbitrary, (document) => {
        expect(() => renderSafeHtml(document)).not.toThrow();
      }),
      fcRuns(100)
    ));

  it.effect(
    "builds and validates schema-first AST nodes",
    Effect.fnUntraced(function* () {
      const text = Md.text("Hello");
      const pre = Md.pre("code");
      const doc = Md.make([Md.p([text]), pre]);

      expect(yield* S.decodeEffect(Inline)(text)).toEqual(text);
      // Pre.language is a codec field (OptionFromNullOr: Option<string> <-> string
      // | null), so Pre's encoded form differs from a constructed instance. Decode
      // through the encoded form rather than feeding a decoded instance back in.
      expect(yield* S.decodeEffect(Block)(yield* S.encodeEffect(Block)(pre))).toEqual(pre);
      expect(yield* S.decodeEffect(Document)(yield* S.encodeEffect(Document)(doc))).toEqual(doc);
      const tsPre = Pre.make({ value: "x", language: O.some("ts") });
      expect(yield* S.decodeEffect(Pre)(yield* S.encodeEffect(Pre)(tsPre))).toEqual(tsPre);
      expect(yield* S.decodeEffect(CodeFenceLanguage)("ts")).toBe("ts");
      expect(() => S.decodeSync(CodeFenceLanguage)("ts bad")).toThrow();
      // Pre.language now folds non-conforming legacy info strings to None at decode,
      // so a free-form "ts bad" token drops out instead of being preserved.
      expect(yield* S.decodeEffect(Pre)({ _tag: "pre", language: "ts bad", value: "x" })).toEqual(
        Pre.make({ value: "x", language: O.none() })
      );
      expect(yield* S.decodeEffect(Text)(Text.make({ value: "Hello" }))).toEqual(text);
    })
  );

  it("round-trips schema-derived Markdown AST nodes", () =>
    fc.assert(
      fc.property(InlineArbitrary, BlockArbitrary, DocumentArbitrary, (inline, block, document) => {
        const decodedInline = Result.getOrThrow(
          S.decodeResult(Inline)(Result.getOrThrow(S.encodeResult(Inline)(inline)))
        );
        const decodedBlock = Result.getOrThrow(S.decodeResult(Block)(Result.getOrThrow(S.encodeResult(Block)(block))));
        const decodedDocument = Result.getOrThrow(
          S.decodeResult(Document)(Result.getOrThrow(S.encodeResult(Document)(document)))
        );

        expect(decodedInline).toEqual(inline);
        expect(decodedBlock).toEqual(block);
        expect(decodedDocument).toEqual(document);
        expect(renderMarkdownInline(decodedInline)).toEqual(expect.any(String));
        expect(renderMarkdownBlock(decodedBlock)).toEqual(expect.any(String));
        expect(Result.isSuccess(Md.render(decodedDocument))).toBe(true);
      }),
      fcRuns(50)
    ));

  it("bounds derived child-list arbitraries without constraining Markdown documents", () => {
    const childListArbitrary = fc.oneof(
      S.toArbitrary(InlineChildren)(fc),
      S.toArbitrary(BlockChildren)(fc),
      S.toArbitrary(ListItemChildren)(fc),
      S.toArbitrary(ListChildren)(fc),
      S.toArbitrary(TaskItemChildren)(fc)
    );

    fc.assert(
      fc.property(childListArbitrary, (children) => {
        expect(children.length).toBeLessThanOrEqual(2);
      }),
      fcRuns(100)
    );

    const text = Text.make({ value: "unbounded domain" });
    expect(Result.isSuccess(S.decodeResult(InlineChildren)([text, text, text]))).toBe(true);
  });

  it("encoded documents survive a JSON boundary (jsonb columns, rpc/ndjson wire)", () => {
    // Regression: a real Option in an encoded node must survive a JSON string
    // boundary. Persisting a Document into a jsonb column or sending it over the
    // rpc wire must decode back identically. Code blocks carry the only Option
    // field (Pre.language), so they are the canonical case.
    const doc = Md.make([
      Md.pre("const x = 1", { language: "ts" }),
      Md.pre("flowchart TD\nA-->B", { language: "mermaid" }),
      Md.table(
        [
          ["Name", "Value"],
          ["Language", Md.code("ts")],
        ],
        { headerRow: true }
      ),
      Result.getOrThrow(Md.youtube("M7lc1UVf-VE")),
      Md.pre("no language here"),
      Md.p([Md.text("hello")]),
    ]);
    const encoded = Result.getOrThrow(S.encodeResult(Document)(doc));
    const json = Result.getOrThrow(encodeJsonResult(encoded));

    expect(Result.getOrThrow(decodeDocumentJsonResult(json))).toEqual(doc);
  });

  it("every encoded document survives a JSON boundary", () =>
    fc.assert(
      fc.property(DocumentArbitrary, (document) => {
        const encoded = Result.getOrThrow(S.encodeResult(Document)(document));
        const json = Result.getOrThrow(encodeJsonResult(encoded));

        // JavaScript JSON stringification normalizes -0 to 0, so compare against
        // the exact document value representable after the JSON boundary.
        expect(Result.getOrThrow(decodeDocumentJsonResult(json))).toEqual(normalizeDocumentForJsonBoundary(document));
      }),
      fcRuns(50)
    ));

  it("renders inline Markdown and HTML variants with escaped text by default", () => {
    expect(renderMarkdownInline(Md.text("# title <tag>."))).toBe("\\# title \\<tag\\>\\.");
    expect(renderMarkdownInline(Md.text("~~gone~~"))).toBe("\\~\\~gone\\~\\~");
    expect(renderMarkdownInline(Md.rawMarkdown("**trusted**"))).toBe("**trusted**");
    expect(renderMarkdownInline(Md.rawHtml("<b>trusted</b>"))).toBe("\\<b\\>trusted\\</b\\>");
    expect(renderMarkdownInline(Md.strong("strong"))).toBe("**strong**");
    expect(renderMarkdownInline(Md.em("em"))).toBe("*em*");
    expect(renderMarkdownInline(Md.del("del"))).toBe("~~del~~");
    expect(renderMarkdownInline(Md.code("`tick`"))).toBe("`` `tick` ``");
    expect(renderMarkdownInline(Md.code(""))).toBe("<code></code>");
    expect(renderMarkdownInline(Md.code("<x>\n"))).toBe("<code>&lt;x&gt;\n</code>");
    expect(renderMarkdownInline(Md.a("https://example.com/a)b", "Example"))).toBe(
      "[Example](https://example.com/a\\)b)"
    );
    expect(renderMarkdownInline(Md.a("a b", "Example"))).toBe("[Example](a%20b)");
    expect(renderMarkdownInline(Md.a("a%20b", "Example"))).toBe("[Example](a%20b)");
    expect(renderMarkdownInline(Md.a("javascript:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("jav&#x61;script:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("javascript&#58;alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("javascript&colon;alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("java&Tab;script:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("java&NewLine;script:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("%6a%61%76%61%73%63%72%69%70%74:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)", "Example"))).toBe(
      "[Example](#)"
    );
    expect(renderMarkdownInline(Md.a("jav&#x61;%73cript:alert(1)", "Example"))).toBe("[Example](#)");
    expect(renderMarkdownInline(Md.a("%26%23x6a%3Bavascript:alert(1)", "Example"))).toBe("[Example](#)");
    expect(() => renderMarkdownInline(Md.a("jav&#99999999999;ascript:alert(1)", "Example"))).not.toThrow();
    expect(renderMarkdownInline(Md.a("https://example.com", Md.rawMarkdown("](javascript:alert(1))")))).toBe(
      String.raw`[\]\(javascript:alert\(1\)\)](https://example.com)`
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.strong(Md.rawMarkdown("]("))))).toBe(
      String.raw`[**\]\(**](https://example.com)`
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.rawHtml("<x>")))).toBe(
      String.raw`[\<x\>](https://example.com)`
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.em("E")))).toBe("[*E*](https://example.com)");
    expect(renderMarkdownInline(Md.a("https://example.com", Md.del("D")))).toBe("[~~D~~](https://example.com)");
    expect(renderMarkdownInline(Md.a("https://example.com", Md.code("C")))).toBe("[`C`](https://example.com)");
    expect(renderMarkdownInline(Md.a("https://example.com", Md.a("/child", "C")))).toBe(
      "[[C](/child)](https://example.com)"
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.img("/img.png", { alt: "Alt" })))).toBe(
      "[![Alt](/img.png)](https://example.com)"
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.br))).toBe("[<br/>](https://example.com)");
    expect(renderMarkdownInline(Md.img("/a)b.png", { alt: "Alt #" }))).toBe("![Alt \\#](/a\\)b.png)");
    expect(renderMarkdownInline(Md.img("data:image/png;base64,x", { alt: "Alt" }))).toBe("![Alt](#)");
    expect(renderMarkdownInline(Md.br)).toBe("<br/>");

    expect(renderHtmlInline(Md.text("<script>&'"))).toBe("&lt;script&gt;&amp;&#39;");
    expect(renderHtmlInline(Md.rawMarkdown("<not-html>"))).toBe("&lt;not-html&gt;");
    expect(renderHtmlInline(Md.rawHtml("<strong>trusted</strong>"))).toBe("&lt;strong&gt;trusted&lt;/strong&gt;");
    expect(renderHtmlInline(Md.strong("strong"))).toBe("<strong>strong</strong>");
    expect(renderHtmlInline(Md.em("em"))).toBe("<em>em</em>");
    expect(renderHtmlInline(Md.del("del"))).toBe("<del>del</del>");
    expect(renderHtmlInline(Md.code("<code>"))).toBe("<code>&lt;code&gt;</code>");
    expect(renderHtmlInline(Md.a('https://example.com?a="b"', "Example"))).toBe(
      '<a href="https://example.com?a=%22b%22">Example</a>'
    );
    expect(renderHtmlInline(Md.a("https://example.com?a=1&b=2", "Example"))).toBe(
      '<a href="https://example.com?a=1&amp;b=2">Example</a>'
    );
    expect(renderHtmlInline(Md.a("java\nscript:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("java&Tab;script:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("javascript&#58alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("jav&#x61script:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("java&#10script:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("java&#x0ascript:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("%6a%61%76%61%73%63%72%69%70%74:alert(1)", "Example"))).toBe(
      '<a href="#">Example</a>'
    );
    expect(renderHtmlInline(Md.a("%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)", "Example"))).toBe(
      '<a href="#">Example</a>'
    );
    expect(renderHtmlInline(Md.a("jav&#x61;%73cript:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("%26%23x6a%3Bavascript:alert(1)", "Example"))).toBe('<a href="#">Example</a>');
    expect(renderHtmlInline(Md.a("a%20b", "Example"))).toBe('<a href="a%20b">Example</a>');
    expect(renderHtmlInline(Md.img("/logo.png"))).toBe('<img src="/logo.png" alt="" />');
    expect(renderHtmlInline(Md.img("/logo.png", { alt: '"Logo"' }))).toBe(
      '<img src="/logo.png" alt="&quot;Logo&quot;" />'
    );
    expect(renderHtmlInline(Md.br)).toBe("<br />");
  });

  it("supports template interpolation for inline and block containers", () => {
    const paragraph = Md.p`Hello ${Md.strong("world")}!`;
    const paragraphArray = Md.p`Hello ${[Md.strong("world"), "!"]}`;
    const emptyLeadingTemplate = Md.p`${Md.code("x")}`;
    const quote = Md.blockquote([Md.h3("Inside"), "plain block"]);
    const stringArrayQuote = Md.blockquote(["a", "b"]);
    const singleBlockQuote = Md.blockquote(Md.p("Solo"));
    const templateQuote = Md.blockquote`Quoted ${Md.em("inline")}`;
    const templateBlockQuote = Md.blockquote`${Md.h3("Inside")}`;
    const templateInlineArrayQuote = Md.blockquote`Quoted ${[Md.em("inline"), "!"]}`;
    const templateStringArrayQuote = Md.blockquote`${["a", "b"]}`;
    const multilineTemplateBlockQuote = Md.blockquote`
${Md.h3("Inside")}
`;

    expect(Result.getOrThrow(Md.render(Md.make([paragraph, paragraphArray, emptyLeadingTemplate])))).toBe(
      "Hello **world**!\n\nHello **world**!\n\n`x`"
    );
    expect(renderMarkdownBlock(quote)).toBe("> ### Inside\n> \n> plain block");
    expect(renderMarkdownBlock(stringArrayQuote)).toBe("> a\n> \n> b");
    expect(renderMarkdownBlock(singleBlockQuote)).toBe("> Solo");
    expect(renderHtmlBlock(templateQuote)).toBe("<blockquote><p>Quoted <em>inline</em></p></blockquote>");
    expect(renderMarkdownBlock(templateBlockQuote)).toBe("> ### Inside");
    expect(renderHtmlBlock(templateInlineArrayQuote)).toBe("<blockquote><p>Quoted <em>inline</em>!</p></blockquote>");
    expect(renderMarkdownBlock(templateStringArrayQuote)).toBe("> ab");
    expect(renderHtmlBlock(multilineTemplateBlockQuote)).toBe("<blockquote><h3>Inside</h3></blockquote>");
  });

  it("renders every block variant to Markdown and HTML", () => {
    expect(renderMarkdownBlock(Md.h1("H1"))).toBe("# H1");
    expect(renderMarkdownBlock(Md.h2("H2"))).toBe("## H2");
    expect(renderMarkdownBlock(Md.h3("H3"))).toBe("### H3");
    expect(renderMarkdownBlock(Md.h4("H4"))).toBe("#### H4");
    expect(renderMarkdownBlock(Md.h5("H5"))).toBe("##### H5");
    expect(renderMarkdownBlock(Md.h6("H6"))).toBe("###### H6");
    expect(renderMarkdownBlock(Md.p("Body"))).toBe("Body");
    expect(renderMarkdownBlock(Md.ul([Md.li("Item")]))).toBe("- Item");
    expect(renderMarkdownBlock(Md.ul([Md.li("One"), ["Two", Md.code("2")]]))).toBe("- One\n- Two`2`");
    expect(renderMarkdownBlock(Md.ul([Md.li([Md.p("Parent"), Md.ul(["Child"])])]))).toBe("- Parent\n  - Child");
    expect(renderMarkdownBlock(Md.ol(["One", "Two"]))).toBe("1. One\n2. Two");
    expect(
      renderMarkdownBlock(
        Md.taskListFromItems([Md.taskItem("Todo"), Md.taskItem("Done", { checked: true }), Md.taskItem("Maybe")])
      )
    ).toBe("- [ ] Todo\n- [x] Done\n- [ ] Maybe");
    expect(
      renderMarkdownBlock(Md.taskListFromItems([Md.taskItem([Md.p("Parent"), Md.ul(["Child"])], { checked: true })]))
    ).toBe("- [x] Parent\n      - Child");
    expect(renderMarkdownBlock(Md.ul(["one\n\ntwo"]))).toBe("- one\n  \n  two");
    expect(renderMarkdownBlock(Md.ul(["one\r\rtwo"]))).toBe("- one\n  \n  two");
    expect(renderMarkdownBlock(Md.ol(["one\ntwo"]))).toBe("1. one\n   two");
    expect(renderMarkdownBlock(Md.taskListFromItems([Md.taskItem("one\ntwo")]))).toBe("- [ ] one\n      two");
    expect(renderMarkdownBlock(Md.blockquote`one\rtwo`)).toBe("> one\n> two");
    expect(renderMarkdownBlock(Md.pre("plain"))).toBe("```\nplain\n```");
    expect(renderMarkdownBlock(Md.pre("plain", { language: "ts bad" }))).toBe("```\nplain\n```");
    expect(renderFencedCode("plain", "ts bad")).toBe("```\nplain\n```");
    expect(renderMarkdownBlock(Md.hr)).toBe("---");

    expect(renderHtmlBlock(Md.h1("H1"))).toBe("<h1>H1</h1>");
    expect(renderHtmlBlock(Md.h2("H2"))).toBe("<h2>H2</h2>");
    expect(renderHtmlBlock(Md.h3("H3"))).toBe("<h3>H3</h3>");
    expect(renderHtmlBlock(Md.h4("H4"))).toBe("<h4>H4</h4>");
    expect(renderHtmlBlock(Md.h5("H5"))).toBe("<h5>H5</h5>");
    expect(renderHtmlBlock(Md.h6("H6"))).toBe("<h6>H6</h6>");
    expect(renderHtmlBlock(Md.p("Body"))).toBe("<p>Body</p>");
    expect(renderHtmlBlock(Md.ul([Md.li("Item")]))).toBe("<ul><li>Item</li></ul>");
    expect(renderHtmlBlock(Md.ul(["One", "Two"]))).toBe("<ul><li>One</li><li>Two</li></ul>");
    expect(renderHtmlBlock(Md.ul([Md.li([Md.p("Parent"), Md.ul(["Child"])])]))).toBe(
      "<ul><li><p>Parent</p><ul><li>Child</li></ul></li></ul>"
    );
    expect(renderHtmlBlock(Md.ol(["One", "Two"]))).toBe("<ol><li>One</li><li>Two</li></ol>");
    expect(renderHtmlBlock(Md.taskListFromItems([Md.taskItem("Done", { checked: true }), Md.taskItem("Todo")]))).toBe(
      '<ul class="contains-task-list"><li><input type="checkbox" disabled checked /> Done</li><li><input type="checkbox" disabled /> Todo</li></ul>'
    );
    expect(renderHtmlBlock(Md.pre("<x>", { language: "ts" }))).toBe(
      '<pre><code class="language-ts">&lt;x&gt;</code></pre>'
    );
    expect(renderHtmlBlock(Md.pre("<x>", { language: "ts bad" }))).toBe("<pre><code>&lt;x&gt;</code></pre>");
    expect(renderHtmlBlock(Md.pre("<x>"))).toBe("<pre><code>&lt;x&gt;</code></pre>");
    expect(renderHtmlBlock(Md.hr)).toBe("<hr />");
  });

  it("projects inline and block nodes to escaping-free plain text", () => {
    expect(Inline.toPlainText(Md.strong([Md.text("Strong"), Md.em("Em")]))).toBe("StrongEm");
    expect(Inline.toPlainTextAll([Md.text("One"), Md.code("Two")])).toBe("OneTwo");
    expect(ListItemChild.toPlainText(Md.text("Inline"))).toBe("Inline");
    expect(ListItemChild.toPlainText(Md.p("Block"))).toBe("Block");
    expect(renderPlainTextInline(Md.text("Text"))).toBe("Text");
    expect(renderPlainTextInline(Md.rawMarkdown("**Raw**"))).toBe("**Raw**");
    expect(renderPlainTextInline(Md.rawHtml("<b>Raw</b>"))).toBe("<b>Raw</b>");
    expect(renderPlainTextInline(Md.strong([Md.text("Strong"), Md.em("Em")]))).toBe("StrongEm");
    expect(renderPlainTextInline(Md.em("Em"))).toBe("Em");
    expect(renderPlainTextInline(Md.del("Del"))).toBe("Del");
    expect(renderPlainTextInline(Md.code("code"))).toBe("code");
    expect(renderPlainTextInline(Md.a("https://example.com", [Md.text("Example"), Md.code("1")]))).toBe("Example1");
    expect(renderPlainTextInline(Md.img("/img.png", { alt: "Alt" }))).toBe("Alt");
    expect(renderPlainTextInline(Md.br)).toBe("\n");
    expect(renderPlainTextInline(Md.inlineMath("a+b"))).toBe("a+b");
    expect(renderPlainTextInline(Md.footnoteRef("note"))).toBe("note");

    expect(
      segmentInlineRuns([Md.text("a"), Md.code("b"), Md.p("block"), Md.em("c")], {
        isInline: Inline.is,
        renderInlineRun: (run) => `inline:${run.length}`,
        renderBlock: (block) => `block:${block._tag}`,
      })
    ).toEqual(["inline:2", "block:p", "inline:1"]);
    expect(
      segmentInlineRuns({
        isInline: (value): value is string => typeof value === "string",
        renderInlineRun: (run) => run.join(""),
        renderBlock: (value: number) => `#${value}`,
      })([])
    ).toEqual([]);

    const table = Md.table(
      [
        ["Name", "Value"],
        ["Language", Md.code("ts")],
      ],
      { headerRow: true }
    );
    const blocks = [
      Md.h1("Heading"),
      Md.p([Md.text("Paragraph"), Md.br, Md.text("Text")]),
      Md.blockquote([Md.p("Quoted"), Md.ul(["Nested"])]),
      Md.pre("const x = 1"),
      Md.ul([Md.li([Md.text("Inline"), Md.p("Block")])]),
      Md.ol(["First", "Second"]),
      Md.taskListFromItems([Md.taskItem("Done", { checked: true }), Md.taskItem("Todo")]),
      table,
      Md.youtubeUnsafe("M7lc1UVf-VE"),
      Md.mathBlock("a=b"),
      Md.footnoteDef("note", [Md.p("Footnote")]),
      Md.admonition("tip", [Md.p("Admonition")]),
      Md.embed("video", "https://example.com/demo", { title: "Demo" }),
      Md.embed("video", "https://example.com/fallback"),
      Md.hr,
    ];

    expect(blocks.map(renderPlainTextBlock)).toEqual([
      "Heading",
      "Paragraph\nText",
      "Quoted\nNested",
      "const x = 1",
      "Inline\nBlock",
      "First\nSecond",
      "Done\nTodo",
      "Name\tValue\nLanguage\tts",
      "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      "a=b",
      "Footnote",
      "Admonition",
      "Demo",
      "https://example.com/fallback",
      "",
    ]);
  });

  it("renders core parity, rich extension, frontmatter, and URL policy additions", () => {
    expect(renderUnsafe(Md.make([], { frontmatter: { control: "\u0001" } }))).toBe(`---json
{"control":"\\u0001"}
---`);
    const richDocument = Md.make(
      [
        Md.h1("Rich"),
        Md.p(["Formula ", Md.inlineMath("a^2"), Md.footnoteRef("eq")]),
        Md.ol(["Three", "Four"], { start: 3 }),
        Md.table(
          [
            ["Left", "Center", "Right"],
            ["A", "B", "C"],
          ],
          { headerRow: true, align: ["left", "center", "right"] }
        ),
        Md.mathBlock("a=b"),
        Md.footnoteDef("eq", "Equation note"),
        Md.admonition("warning", "Body", { title: "Pay attention" }),
        Md.embed("video", "https://example.com/demo", { title: "Demo", description: "Demo video" }),
      ],
      { frontmatter: { z: false, title: "Doc", count: 2, nested: { b: "bee", a: [1, null] } } }
    );

    expect(renderUnsafe(richDocument)).toBe(`---json
{"count":2,"nested":{"a":[1,null],"b":"bee"},"title":"Doc","z":false}
---

# Rich

Formula $a^2$[^eq]

3. Three
4. Four

| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |

$$
a=b
$$

[^eq]: Equation note

> [!WARNING] Pay attention
> Body

[Demo](https://example.com/demo "Demo")

Demo video`);

    expect(renderHtmlInline(Md.a("https://example.com", "Example", { title: '"Title"' }))).toBe(
      '<a href="https://example.com" title="&quot;Title&quot;">Example</a>'
    );
    expect(renderMarkdownInline(Md.img("/logo.png", { alt: "Logo", title: '"Logo"' }))).toBe(
      '![Logo](/logo.png "\\"Logo\\"")'
    );
    expect(renderHtmlBlock(Md.ol(["Three"], { start: 3 }))).toBe('<ol start="3"><li>Three</li></ol>');
    expect(renderHtmlBlock(Md.mathBlock("<x>"))).toBe('<div class="math math-display">&lt;x&gt;</div>');
    expect(renderHtmlBlock(Md.admonition("note", "Body"))).toBe(
      '<aside class="admonition admonition-note"><p>Body</p></aside>'
    );
    expect(renderHtmlBlock(Md.embed("video", "https://example.com/demo", { title: "Demo" }))).toBe(
      '<figure data-embed-kind="video"><a href="https://example.com/demo">Demo</a></figure>'
    );

    expect(sanitizeUrlDestination("file:///tmp/a")).toBe("file:///tmp/a");
    expect(sanitizeUrlDestinationWithPolicy("file:///tmp/a", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("artifact:abc", BrowserSafeUrlPolicySpec)).toBe("artifact:abc");
    expect(sanitizeUrlDestinationWithPolicy("artifact:abc", StrictWebUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("//example.com", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("/\n/example.com", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("/\r/example.com", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("/\t/example.com", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("\\relative", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("&sol;&sol;example.com", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("&bsol;relative", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("file&#58;//tmp/a", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("%66%69%6c%65%3a///tmp/a", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(sanitizeUrlDestinationWithPolicy("fi\nle:///tmp/a", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(escapeMarkdownDestinationWithPolicy("file:///tmp/a", BrowserSafeUrlPolicySpec)).toBe("#");
    expect(escapeHtmlUrlAttributeWithPolicy("artifact:abc", StrictWebUrlPolicySpec)).toBe("#");
    expect(escapeHtmlUrlAttribute("file:///tmp/a")).toBe("#");

    const markdownAdapter = makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec });
    expect(Result.getOrThrow(renderWith(markdownAdapter, Md.make([Md.p(Md.a("file:///tmp/a", "File"))])))).toBe(
      "[File](#)"
    );
    const namedSlashMarkdown = Result.getOrThrow(
      renderWith(markdownAdapter, Md.make([Md.p(Md.a("&sol;&sol;evil.test", "External"))]))
    );
    expect(namedSlashMarkdown).toBe("[External](#)");
    expect(micromark(namedSlashMarkdown)).toBe('<p><a href="#">External</a></p>');
    const controlSeparatedSlashMarkdown = Result.getOrThrow(
      renderWith(markdownAdapter, Md.make([Md.p(Md.a("/\n/evil.test", "External"))]))
    );
    expect(controlSeparatedSlashMarkdown).toBe("[External](#)");
    expect(micromark(controlSeparatedSlashMarkdown)).toBe('<p><a href="#">External</a></p>');

    const htmlAdapter = makeHtmlFragmentAdapter({ urlPolicy: StrictWebUrlPolicySpec });
    expect(Result.getOrThrow(renderWith(htmlAdapter, Md.make([Md.p(Md.a("artifact:abc", "Artifact"))])))).toBe(
      '<p><a href="#">Artifact</a></p>'
    );
    const rawMarkdownDocument = Md.make([Md.p(Md.rawMarkdown("<trusted>"))]);
    expect(renderWithUnsafe(markdownAdapter, rawMarkdownDocument)).toBe("<trusted>");
    expect(renderWithUnsafe(htmlAdapter, rawMarkdownDocument)).toBe("<p>&lt;trusted&gt;</p>");

    const telOnly = AllowListUrlPolicySpec.make({
      schemes: ["tel:"],
      allowRelative: false,
      allowProtocolRelative: false,
      allowBackslashRelative: false,
    });
    const recursivelyNested = Md.make([
      Md.blockquote([
        Md.ul([Md.li([Md.p([Md.a("tel:+15551234567", "Call"), Md.text(" "), Md.a("https://example.com", "Web")])])]),
      ]),
    ]);
    expect(renderWithUnsafe(makeMarkdownAdapter({ urlPolicy: telOnly }), recursivelyNested)).toBe(
      "> - [Call](tel:+15551234567) [Web](#)"
    );
    expect(renderWithUnsafe(makeHtmlFragmentAdapter({ urlPolicy: telOnly }), recursivelyNested)).toBe(
      '<blockquote><ul><li><p><a href="tel:+15551234567">Call</a> <a href="#">Web</a></p></li></ul></blockquote>'
    );

    const normalizedPolicy = S.decodeSync(UrlPolicySpec)({
      _tag: "AllowList",
      schemes: [" HTTPS: "],
      allowRelative: false,
      allowProtocolRelative: false,
      allowBackslashRelative: false,
    });
    expect(normalizedPolicy._tag).toBe("AllowList");
    if (normalizedPolicy._tag === "AllowList") {
      expect(normalizedPolicy.schemes).toEqual(["https:"]);
    }

    const markedInspiredEvasions = [
      "java\u0000script:alert(1)",
      "jav&#x61;%73cript:alert(1)",
      "%26%23x6a%3Bavascript:alert(1)",
    ];
    for (const destination of markedInspiredEvasions) {
      expect(sanitizeUrlDestination(destination)).toBe("#");
      expect(sanitizeUrlDestinationWithPolicy(destination, BrowserSafeUrlPolicySpec)).toBe("#");
    }
  });

  it("applies a custom URL policy across every recursive render fold", () => {
    const document = Md.make([
      Md.p([
        Md.strong("Strong"),
        Md.em("Emphasis"),
        Md.del("Deleted"),
        Md.code("code"),
        Md.img("https://example.com/image.png", { alt: "Image", title: "Image title" }),
        Md.br,
        Md.inlineMath("a+b"),
        Md.footnoteRef("note"),
      ]),
      Md.pre("const value = 1", { language: "ts" }),
      Md.ol([Md.li([Md.p(Md.a("https://example.com/nested", "Nested"))])], { start: 2 }),
      Md.taskListFromItems([Md.taskItem("Done", { checked: true }), Md.taskItem("Todo")]),
      Md.table([["A"], [Md.a("https://example.com/cell", "B")]], { align: ["center"], headerRow: false }),
      Result.getOrThrow(Md.youtube("abcDEF123_-")),
      Md.mathBlock("<x>"),
      Md.footnoteDef("note", "Footnote"),
      Md.admonition("note", "Body", { title: "Title" }),
      Md.embed("video", "https://example.com/video", { description: "Caption" }),
      Md.hr,
    ]);
    const markdown = renderWithUnsafe(makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec }), document);
    const html = renderWithUnsafe(makeHtmlFragmentAdapter({ urlPolicy: BrowserSafeUrlPolicySpec }), document);

    expect(markdown).toContain('![Image](https://example.com/image.png "Image title")<br/>$a+b$[^note]');
    expect(markdown).toContain("[Nested](https://example.com/nested)");
    expect(markdown).toContain("[B](https://example.com/cell)");
    expect(html).toContain("<strong>Strong</strong><em>Emphasis</em><del>Deleted</del><code>code</code>");
    expect(html).toContain('<img src="https://example.com/image.png" alt="Image" title="Image title" /><br />');
    expect(html).toContain('<ol start="2"><li><p><a href="https://example.com/nested">Nested</a></p></li></ol>');
    expect(html).toContain('<td style="text-align:center"><a href="https://example.com/cell">B</a></td>');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/abcDEF123_-"');
    expect(html).toContain("<figcaption>Caption</figcaption>");
  });

  it("renders policy-denied top-level and nested YouTube blocks as inert text", () => {
    const youtube = Result.getOrThrow(Md.youtube("abcDEF123_-"));
    const document = Md.make([youtube, Md.blockquote([youtube]), Md.ul([Md.li([youtube])])]);
    const denyAll = AllowListUrlPolicySpec.make({
      schemes: [],
      allowRelative: false,
      allowProtocolRelative: false,
      allowBackslashRelative: false,
    });
    const httpOnly = AllowListUrlPolicySpec.make({
      schemes: ["http:"],
      allowRelative: false,
      allowProtocolRelative: false,
      allowBackslashRelative: false,
    });

    for (const urlPolicy of [denyAll, httpOnly]) {
      const markdown = renderWithUnsafe(makeMarkdownAdapter({ urlPolicy }), document);
      const html = renderWithUnsafe(makeHtmlFragmentAdapter({ urlPolicy }), document);

      expect(markdown).toBe("YouTube video\n\n> YouTube video\n\n- YouTube video");
      expect(markdown).not.toContain("#");
      expect(markdown).not.toContain("youtube.com");
      expect(html).toBe("YouTube video\n<blockquote>YouTube video</blockquote>\n<ul><li>YouTube video</li></ul>");
      expect(html).not.toContain("<iframe");
      expect(html).not.toContain('src="#"');
      expect(html).not.toContain("youtube-nocookie.com");
    }

    expect(renderWithUnsafe(makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec }), Md.make([youtube]))).toBe(
      "https://www.youtube.com/watch?v=abcDEF123_-"
    );
    expect(
      renderWithUnsafe(makeHtmlFragmentAdapter({ urlPolicy: BrowserSafeUrlPolicySpec }), Md.make([youtube]))
    ).toContain('src="https://www.youtube-nocookie.com/embed/abcDEF123_-"');
  });

  it("refines user-authored documents without changing their encoded wire", () => {
    const document = Md.make([Md.p([Md.a("https://example.com", "Safe"), Md.img("/logo.png", { alt: "Logo" })])]);
    const safe = Result.getOrThrow(refineSafeDocument(document));
    const encodedSafe = Result.getOrThrow(S.encodeResult(Document)(document));

    expect(documentSafetyIssues(document)).toEqual([]);
    expect(decodeSafeDocumentUnsafe(encodedSafe)).toEqual(safe);
    expect(Result.getOrThrow(S.encodeResult(SafeDocument)(safe))).toEqual(encodedSafe);

    const hostile = Md.make([
      Md.p([
        Md.rawMarkdown("**trusted**"),
        Md.rawHtml("<script>alert(1)</script>"),
        Md.a("http://example.com", "Insecure"),
        Md.img("//example.com/tracker.png", { alt: "Tracker" }),
      ]),
    ]);
    const encodedHostile = Result.getOrThrow(S.encodeResult(Document)(hostile));
    expect(Result.isFailure(decodeSafeDocument(encodedHostile))).toBe(true);
    expect(() => decodeSafeDocumentUnsafe(encodedHostile)).toThrow();
    expect(documentSafetyIssues(hostile)).toMatchObject([
      { _tag: "RawNode", path: ["children", 0, "children", 0], nodeTag: "rawMarkdown" },
      { _tag: "RawNode", path: ["children", 0, "children", 1], nodeTag: "rawHtml" },
      {
        _tag: "UnsafeUrl",
        path: ["children", 0, "children", 2, "href"],
        nodeTag: "a",
        destinationKind: "link",
      },
      {
        _tag: "UnsafeUrl",
        path: ["children", 0, "children", 3, "src"],
        nodeTag: "img",
        destinationKind: "image",
      },
    ]);
  });

  it("rejects documents above the global AST-node budget before HTML projection", () => {
    const atLimit = Md.make(A.makeBy(MAX_SAFE_DOCUMENT_NODES - 1, () => Md.hr));
    const overLimit = Md.make(A.makeBy(MAX_SAFE_DOCUMENT_NODES, () => Md.hr));

    expect(documentSafetyIssues(atLimit)).toStrictEqual([]);
    expect(documentSafetyIssues(overLimit)).toMatchObject([
      {
        _tag: "DocumentComplexity",
        maxNodes: MAX_SAFE_DOCUMENT_NODES,
        observedNodes: MAX_SAFE_DOCUMENT_NODES + 1,
      },
    ]);
    expect(Result.isFailure(refineSafeDocument(overLimit))).toBe(true);
  });

  it("ignores forged scalar children and stops reading once the global AST-node budget is exceeded", () => {
    const children = A.makeBy(MAX_SAFE_DOCUMENT_NODES + 1, () => Md.hr);
    Object.defineProperty(children, 0, {
      get: () => "not-a-node",
    });
    Object.defineProperty(children, MAX_SAFE_DOCUMENT_NODES, {
      get: () => {
        throw new Error("child beyond the document budget was read");
      },
    });
    const overwide: Document = { ...Md.make([]), children };

    expect(documentSafetyIssues(overwide)).toMatchObject([
      {
        _tag: "DocumentComplexity",
        maxNodes: MAX_SAFE_DOCUMENT_NODES,
        observedNodes: MAX_SAFE_DOCUMENT_NODES + 1,
      },
    ]);
  });

  it("keeps canonical URL-policy sanitization at a fixed point", () =>
    fc.assert(
      fc.property(fc.string(), (destination) => {
        const once = sanitizeUrlDestinationWithPolicy(destination, BrowserSafeUrlPolicySpec);
        const twice = sanitizeUrlDestinationWithPolicy(once, BrowserSafeUrlPolicySpec);

        expect(twice).toBe(once);
      }),
      fcRuns(100)
    ));

  it("renders later table rows when the first row has no cells", () => {
    const table = Table.make({
      headerRow: false,
      children: [
        TableRow.make({ children: [] }),
        TableRow.make({ children: [TableCell.make({ children: [Text.make({ value: "Later" })] })] }),
      ],
    });

    expect(renderMarkdownBlock(table)).toContain("| Later |");
    expect(renderMarkdownBlock(Md.table([["A"], ["B", "C"]], { headerRow: true }))).toBe(
      "| A |  |\n| --- | --- |\n| B | C |"
    );
    expect(renderMarkdownBlock(Md.table([["a\nb\rc"]], { headerRow: true }))).toBe("| a<br/>b<br/>c |\n| --- |");
  });

  it("falls back to a closed heading tag for forged heading levels", () => {
    const forgedHeading = {
      _tag: "heading",
      level: "1><script>alert(1)</script><h1",
      children: [Text.make({ value: "Safe" })],
    } as unknown as Block;

    expect(renderHtmlBlock(forgedHeading)).toBe("<h6>Safe</h6>");
  });

  it.effect(
    "constructs YouTube embeds without throwing at validation boundaries",
    Effect.fnUntraced(function* () {
      const decoded = Md.youtube("M7lc1UVf-VE");

      expect(Result.isSuccess(decoded)).toBe(true);
      expect(Result.isFailure(Md.youtube("https://youtu.be/M7lc1UVf-VE"))).toBe(true);
      expect((yield* Md.youtubeEffect("M7lc1UVf-VE"))._tag).toBe("youtube");
      expect(Md.youtubeUnsafe("M7lc1UVf-VE")._tag).toBe("youtube");
    })
  );

  it.effect(
    "exposes pure adapters for Markdown and HTML",
    Effect.fnUntraced(function* () {
      const doc = markdownHtmlDoc();

      expect(Result.getOrThrow(renderWith(MarkdownAdapter, doc))).toBe("# Hello\n\nWorld");
      expect(renderWithUnsafe(MarkdownAdapter, doc)).toBe("# Hello\n\nWorld");
      expect(renderUnsafe(doc)).toBe("# Hello\n\nWorld");
      expect(renderHtmlUnsafe(doc)).toBe("<h1>Hello</h1>\n<p>World</p>");
      expect(renderPlainTextUnsafe(doc)).toBe("Hello\nWorld");
      expect(Result.getOrThrow(renderPlainText(doc))).toBe("Hello\nWorld");
      expect(Result.getOrThrow(Md.renderWith(MarkdownAdapter, doc))).toBe("# Hello\n\nWorld");
      expect(Md.renderWithUnsafe(MarkdownAdapter, doc)).toBe("# Hello\n\nWorld");
      expect(Result.getOrThrow(Md.renderWith(HtmlFragmentAdapter, doc))).toBe("<h1>Hello</h1>\n<p>World</p>");
      expect(Result.getOrThrow(Md.renderWith(PlainTextAdapter, doc))).toBe("Hello\nWorld");
      expect(Result.getOrThrow(Md.renderHtml(doc))).toBe("<h1>Hello</h1>\n<p>World</p>");
      expect(Md.renderHtmlUnsafe(doc)).toBe("<h1>Hello</h1>\n<p>World</p>");
      expect(Result.getOrThrow(Md.renderPlainText(doc))).toBe("Hello\nWorld");
      expect(Md.renderPlainTextUnsafe(doc)).toBe("Hello\nWorld");

      const effectAdapter: EffectRenderAdapter<string> = {
        name: "effect",
        render: () => Effect.succeed("effect output"),
      };
      expect(yield* renderEffectWith(effectAdapter, doc)).toBe("effect output");
      expect(yield* Md.renderEffectWith(effectAdapter, doc)).toBe("effect output");
      expect(yield* renderEffectWithUnsafe(effectAdapter, doc)).toBe("effect output");
      expect(yield* Md.renderEffectWithUnsafe(effectAdapter, doc)).toBe("effect output");
    })
  );

  it.effect(
    "reports effect adapter failures",
    Effect.fnUntraced(function* () {
      const doc = markdownHtmlDoc();

      const throwingEffectAdapter: EffectRenderAdapter<string> = {
        name: "effect-throw",
        render: () => Result.getOrThrow(Result.fail("sync effect boom")),
      };
      const throwingEffect = yield* Effect.exit(renderEffectWith(throwingEffectAdapter, doc));

      expectExitCause(throwingEffect, "Render adapter effect-throw failed. sync effect boom");
      expect(() => renderEffectWithUnsafe(throwingEffectAdapter, doc)).toThrow("sync effect boom");
    })
  );

  it("reports pure adapter failures safely", () => {
    const doc = markdownHtmlDoc();

    const brokenAdapter: PureRenderAdapter<string> = {
      name: "broken",
      render: () => Result.getOrThrow(Result.fail("boom")),
    };
    const broken = renderWith(brokenAdapter, doc);

    expectRenderFailure(broken, (error) => {
      expect(error._tag).toBe("RenderError");
      expect(error.adapter).toBe("broken");
      expect(error.message).toContain("Render adapter broken failed.");
      expect(error.message).toContain("boom");
    });
    expect(() => renderWithUnsafe(brokenAdapter, doc)).toThrow("boom");

    const symbolFailure = renderWith(
      {
        name: "symbol",
        render: () => Result.getOrThrow(Result.fail(Symbol.for("boom"))),
      },
      doc
    );

    expectRenderFailure(symbolFailure, (error) => {
      expect(error.message).toContain("Symbol(boom)");
    });

    const hostileCause = {
      toString: () => {
        throw new globalThis.Error("hostile");
      },
    };
    const hostileFailure = renderWith(
      {
        name: "hostile",
        render: () => Result.getOrThrow(Result.fail(hostileCause)),
      },
      doc
    );

    expectRenderFailure(hostileFailure, (error) => {
      expect(error.message).toContain("Cannot render thrown value.");
    });

    const hostileError = new globalThis.Error("hidden");
    Object.defineProperty(hostileError, "message", {
      get: () => {
        throw new globalThis.Error("message getter");
      },
    });
    const hostileErrorFailure = renderWith(
      {
        name: "hostile-error",
        render: () => Result.getOrThrow(Result.fail(hostileError)),
      },
      doc
    );

    expectRenderFailure(hostileErrorFailure, (error) => {
      expect(error.message).toContain("Cannot render thrown value.");
    });

    const hostileNameAdapter: PureRenderAdapter<string> = {
      get name() {
        return Result.getOrThrow(Result.fail(new globalThis.Error("name getter")));
      },
      render: () => Result.getOrThrow(Result.fail("name-safe boom")),
    };
    const hostileNameFailure = renderWith(hostileNameAdapter, doc);

    expectRenderFailure(hostileNameFailure, (error) => {
      expect(error.adapter).toBe("unknown");
      expect(error.message).toContain("Render adapter unknown failed. name-safe boom");
    });

    const hostileNameObjectAdapter: PureRenderAdapter<string> = {
      name: "starts-safe",
      render: () => Result.getOrThrow(Result.fail("name-object-safe boom")),
    };
    Object.defineProperty(hostileNameObjectAdapter, "name", {
      value: {
        toString: () => {
          throw new globalThis.Error("name object");
        },
      },
      configurable: true,
    });
    const hostileNameObjectFailure = renderWith(hostileNameObjectAdapter, doc);

    expectRenderFailure(hostileNameObjectFailure, (error) => {
      expect(error.adapter).toBe("unknown");
      expect(error.message).toContain("Render adapter unknown failed. name-object-safe boom");
    });
  });

  it("provides focused rendering utilities", () => {
    expect(joinBlocks("\nOne\n")).toBe("One");
    expect(joinBlocks(["\nOne\n", "", "\nTwo\n"])).toBe("One\n\nTwo");
    expect(renderMarkdownBlocks([Md.h1("One"), Md.p("Two")])).toBe("# One\n\nTwo");
    expect(renderHtmlBlocks([Md.h1("One"), Md.p("Two")])).toBe("<h1>One</h1>\n<p>Two</p>");
    expect(Block.toPlainTextAll([Md.h1("One"), Md.p("Two")])).toBe("One\nTwo");
    expect(Document.toPlainText(Md.make([Md.h1("One"), Md.p("Two")]))).toBe("One\nTwo");
    expect(renderPlainTextBlocks([Md.h1("One"), Md.p("Two")])).toBe("One\nTwo");
    expect(prefixLines("alpha\nbeta", "> ")).toBe("> alpha\n> beta");
    expect(prefixLines("alpha\rbeta", "> ")).toBe("> alpha\n> beta");
    expect(escapeMarkdownText("a*b")).toBe("a\\*b");
    expect(escapeHtmlUrlAttribute("a&b")).toBe("a&amp;b");
    expect(escapeHtmlUrlAttribute("javascript&#58alert(1)")).toBe("#");
    expect(escapeHtmlUrlAttribute("%6a%61%76%61%73%63%72%69%70%74:alert(1)")).toBe("#");
    expect(escapeHtmlUrlAttribute("%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)")).toBe("#");
    expect(escapeHtmlUrlAttribute("%26%23x6a%3Bavascript:alert(1)")).toBe("#");
    expect(escapeMarkdownDestination("\\()")).toBe("%5C\\(\\)");
    expect(escapeMarkdownDestination("%6a%61%76%61%73%63%72%69%70%74:alert(1)")).toBe("#");
    expect(escapeMarkdownDestination("%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)")).toBe("#");
    expect(escapeMarkdownDestination("%26%23x6a%3Bavascript:alert(1)")).toBe("#");
    expect(escapeMarkdownDestination("java\tscript:alert(1)")).toBe("#");
    expect(escapeMarkdownDestination("\uD800")).toBe("%EF%BF%BD");
    expect(escapeMarkdownDestination("a\uD800b")).toBe("a%EF%BF%BDb");
    expect(maxBackticks("`one` and ```three```")).toBe(3);
    expect(renderInlineCode("plain")).toBe("`plain`");
    expect(renderInlineCode("`edge`")).toBe("`` `edge` ``");
    expect(renderInlineCode(" foo ")).toBe("`  foo  `");
    expect(renderInlineCode(" foo")).toBe("`  foo `");
    expect(renderInlineCode("foo ")).toBe("` foo  `");
    expect(renderInlineCode("")).toBe("<code></code>");
    expect(renderInlineCode("<x>\n")).toBe("<code>&lt;x&gt;\n</code>");
    expect(renderFencedCode("```", "ts")).toBe("````ts\n```\n````");
    expect(isStringArray(["a", "b"])).toBe(true);
    expect(isStringArray(["a", 1])).toBe(false);
  });

  // §5.3 crispen parity: the escape schemas now carry their guards via
  // SchemaUtils.withCodecStatics instead of free-floating `S.is(...)` walls.
  // These S.toArbitrary laws pin that the colocated `.is` static agrees with
  // the schema it derives from, so the absorption cannot silently drift.
  it("colocated escape-schema guards agree with their schemas", () => {
    // Mirrors the module-private StringArray schema in Md.escape.ts.
    const StringArraySchema = S.Array(S.String);
    const stringArrayArbitrary = S.toArbitrary(StringArraySchema)(fc);
    fc.assert(
      fc.property(stringArrayArbitrary, (values) => {
        expect(isStringArray(values)).toBe(true);
      })
    );

    // Any destination normalizing to an active unsafe protocol is neutralized
    // to "#" by the colocated UnsafeUrlProtocolDestination.is guard.
    const unsafeDestinationArbitrary = fc
      .tuple(fc.constantFrom("javascript:", "vbscript:", "data:"), fc.string())
      .map(([protocol, rest]) => `${protocol}${rest}`);
    fc.assert(
      fc.property(unsafeDestinationArbitrary, (destination) => {
        expect(sanitizeUrlDestination(destination)).toBe("#");
      })
    );
  });
});
