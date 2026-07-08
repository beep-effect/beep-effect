import { Md } from "@beep/md";
import { renderPlainTextBlocks } from "@beep/md/Md.behavior";
import {
  escapeHtmlUrlAttribute,
  escapeMarkdownDestination,
  escapeMarkdownText,
  isStringArray,
  joinBlocks,
  maxBackticks,
  prefixLines,
  renderFencedCode,
  renderInlineCode,
  sanitizeUrlDestination,
} from "@beep/md/Md.escape";
import { Block, CodeFenceLanguage, Document, Inline, Pre, Table, TableCell, TableRow, Text } from "@beep/md/Md.model";
import {
  DocumentToHtmlFragment,
  DocumentToMarkdown,
  DocumentToPlainText,
  HtmlFragmentAdapter,
  MarkdownAdapter,
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
import { HtmlFragment, Markdown } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { EffectRenderAdapter, PureRenderAdapter, RenderError } from "@beep/md/Md.render";

const InlineArbitrary = S.toArbitrary(Inline);
const BlockArbitrary = S.toArbitrary(Block);
const DocumentArbitrary = S.toArbitrary(Document);

const markdownHtmlDoc = (): Document => Md.make([Md.h1("Hello"), Md.p("World")]);
const encodeJsonResult = S.encodeUnknownResult(S.UnknownFromJsonString);
const decodeDocumentJsonResult = S.decodeUnknownResult(S.fromJsonString(Document));

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
      Md.taskList([Md.taskItem("Task List Item 1", { checked: true }), Md.taskItem("Task List Item 2")]),
      Md.pre(`console.log("beep")`, { language: "ts" }),
      Md.table(
        [
          ["Name", "Value"],
          ["Language", Md.code("ts")],
        ],
        { headerRow: true }
      ),
      Result.getOrThrow(Md.youtube("dQw4w9WgXcQ")),
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

https://www.youtube.com/watch?v=dQw4w9WgXcQ

> Hello World!`;

    expect(Result.getOrThrow(Md.render(markdown))).toBe(rendered);
    expect(Md.renderUnsafe(markdown)).toBe(rendered);
  });

  it.effect(
    "builds and validates schema-first AST nodes",
    Effect.fnUntraced(function* () {
      const text = Md.text("Hello");
      const pre = Md.pre("code");
      const doc = Md.make([Md.p([text]), pre]);

      expect(yield* S.decodeUnknownEffect(Inline)(text)).toEqual(text);
      // Pre.language is a codec field (OptionFromNullOr: Option<string> <-> string
      // | null), so Pre's encoded form differs from a constructed instance. Decode
      // through the encoded form rather than feeding a decoded instance back in.
      expect(yield* S.decodeUnknownEffect(Block)(yield* S.encodeEffect(Block)(pre))).toEqual(pre);
      expect(yield* S.decodeUnknownEffect(Document)(yield* S.encodeEffect(Document)(doc))).toEqual(doc);
      const tsPre = Pre.make({ value: "x", language: O.some("ts") });
      expect(yield* S.decodeUnknownEffect(Pre)(yield* S.encodeEffect(Pre)(tsPre))).toEqual(tsPre);
      expect(yield* S.decodeUnknownEffect(CodeFenceLanguage)("ts")).toBe("ts");
      expect(() => S.decodeUnknownSync(CodeFenceLanguage)("ts bad")).toThrow();
      // Pre.language now folds non-conforming legacy info strings to None at decode,
      // so a free-form "ts bad" token drops out instead of being preserved.
      expect(yield* S.decodeUnknownEffect(Pre)({ _tag: "pre", language: "ts bad", value: "x" })).toEqual(
        Pre.make({ value: "x", language: O.none() })
      );
      expect(yield* S.decodeUnknownEffect(Text)(Text.make({ value: "Hello" }))).toEqual(text);
    })
  );

  it("round-trips schema-derived Markdown AST nodes", () =>
    fc.assert(
      fc.property(InlineArbitrary, BlockArbitrary, DocumentArbitrary, (inline, block, document) => {
        const decodedInline = Result.getOrThrow(
          S.decodeUnknownResult(Inline)(Result.getOrThrow(S.encodeResult(Inline)(inline)))
        );
        const decodedBlock = Result.getOrThrow(
          S.decodeUnknownResult(Block)(Result.getOrThrow(S.encodeResult(Block)(block)))
        );
        const decodedDocument = Result.getOrThrow(
          S.decodeUnknownResult(Document)(Result.getOrThrow(S.encodeResult(Document)(document)))
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
      Result.getOrThrow(Md.youtube("dQw4w9WgXcQ")),
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

        expect(Result.getOrThrow(decodeDocumentJsonResult(json))).toEqual(document);
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
    expect(renderMarkdownInline(Md.a("https://example.com", Md.img("/img.png", "Alt")))).toBe(
      "[![Alt](/img.png)](https://example.com)"
    );
    expect(renderMarkdownInline(Md.a("https://example.com", Md.br))).toBe("[<br/>](https://example.com)");
    expect(renderMarkdownInline(Md.img("/a)b.png", "Alt #"))).toBe("![Alt \\#](/a\\)b.png)");
    expect(renderMarkdownInline(Md.img("data:image/png;base64,x", "Alt"))).toBe("![Alt](#)");
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
    expect(renderHtmlInline(Md.img("/logo.png", '"Logo"'))).toBe('<img src="/logo.png" alt="&quot;Logo&quot;" />');
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
    expect(renderMarkdownBlock(Md.taskList(["Todo", { text: "Done", checked: true }, { text: "Maybe" }]))).toBe(
      "- [ ] Todo\n- [x] Done\n- [ ] Maybe"
    );
    expect(renderMarkdownBlock(Md.taskList([{ children: [Md.p("Parent"), Md.ul(["Child"])], checked: true }]))).toBe(
      "- [x] Parent\n      - Child"
    );
    expect(renderMarkdownBlock(Md.ul(["one\n\ntwo"]))).toBe("- one\n  \n  two");
    expect(renderMarkdownBlock(Md.ul(["one\r\rtwo"]))).toBe("- one\n  \n  two");
    expect(renderMarkdownBlock(Md.ol(["one\ntwo"]))).toBe("1. one\n   two");
    expect(renderMarkdownBlock(Md.taskList(["one\ntwo"]))).toBe("- [ ] one\n      two");
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
    expect(renderHtmlBlock(Md.taskList([Md.taskItem("Done", { checked: true }), "Todo"]))).toBe(
      '<ul class="contains-task-list"><li><input type="checkbox" disabled checked /> Done</li><li><input type="checkbox" disabled /> Todo</li></ul>'
    );
    expect(renderHtmlBlock(Md.pre("<x>", { language: "ts" }))).toBe(
      '<pre><code class="language-ts">&lt;x&gt;</code></pre>'
    );
    expect(renderHtmlBlock(Md.pre("<x>", { language: "ts bad" }))).toBe("<pre><code>&lt;x&gt;</code></pre>");
    expect(renderHtmlBlock(Md.pre("<x>"))).toBe("<pre><code>&lt;x&gt;</code></pre>");
    expect(renderHtmlBlock(Md.hr)).toBe("<hr />");
  });

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

  it.effect(
    "constructs YouTube embeds without throwing at validation boundaries",
    Effect.fnUntraced(function* () {
      const decoded = Md.youtube("dQw4w9WgXcQ");

      expect(Result.isSuccess(decoded)).toBe(true);
      expect(Result.isFailure(Md.youtube("https://youtu.be/dQw4w9WgXcQ"))).toBe(true);
      expect((yield* Md.youtubeEffect("dQw4w9WgXcQ"))._tag).toBe("youtube");
      expect(Md.youtubeUnsafe("dQw4w9WgXcQ")._tag).toBe("youtube");
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

  it.effect(
    "exposes schema transformations for Markdown and HTML",
    Effect.fnUntraced(function* () {
      const doc = markdownHtmlDoc();

      expect(yield* S.decodeUnknownEffect(DocumentToMarkdown)(doc)).toBe(Markdown.make("# Hello\n\nWorld"));
      expect(yield* S.decodeUnknownEffect(DocumentToHtmlFragment)(doc)).toBe(
        HtmlFragment.make("<h1>Hello</h1>\n<p>World</p>")
      );
      expect(yield* S.decodeUnknownEffect(DocumentToPlainText)(doc)).toBe("Hello\nWorld");

      const markdownEncode = yield* Effect.exit(S.encodeEffect(DocumentToMarkdown)(Markdown.make("# Hello")));
      const htmlEncode = yield* Effect.exit(
        S.encodeEffect(DocumentToHtmlFragment)(HtmlFragment.make("<h1>Hello</h1>"))
      );
      const plainTextEncode = yield* Effect.exit(S.encodeEffect(DocumentToPlainText)("Hello"));

      expectExitCause(markdownEncode, "Encoding Markdown output back into a Markdown document AST is not supported.");
      expectExitCause(htmlEncode, "Encoding HTML fragment output back into a Markdown document AST is not supported.");
      expectExitCause(
        plainTextEncode,
        "Encoding plain text output back into a Markdown document AST is not supported."
      );

      const markdownDecode = yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          const originalMarkdownRender = MarkdownAdapter.render;
          Object.defineProperty(MarkdownAdapter, "render", {
            value: () => Result.getOrThrow(Result.fail(new globalThis.Error("schema boom"))),
            configurable: true,
          });

          return originalMarkdownRender;
        }),
        () => Effect.exit(S.decodeUnknownEffect(DocumentToMarkdown)(doc)),
        (originalMarkdownRender) =>
          Effect.sync(() => {
            Object.defineProperty(MarkdownAdapter, "render", {
              value: originalMarkdownRender,
              configurable: true,
            });
          })
      );

      expect(Exit.isSuccess(markdownDecode)).toBe(true);
      if (Exit.isSuccess(markdownDecode)) {
        expect(markdownDecode.value).toBe(Markdown.make("# Hello\n\nWorld"));
      }
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
    const stringArrayArbitrary = S.toArbitrary(StringArraySchema);
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
