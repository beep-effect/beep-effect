import { Md } from "@beep/md";
import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape";
import {
  Admonition,
  A as Anchor,
  BlockQuote,
  Code,
  Document,
  Em,
  FootnoteDefinition,
  FootnoteReference,
  Hr,
  Img,
  InlineMath,
  Li,
  Ol,
  P,
  Strong,
  Table,
  TableCell,
  TableRow,
  TaskItem,
  TaskList,
  Text,
  Ul,
} from "@beep/md/Md.model";
import { parseResult } from "@beep/md/Md.parse";
import {
  makeMarkdownAdapter,
  renderMarkdownBlock,
  renderUnsafe,
  renderWithUnsafe,
  UrlRenderOptions,
} from "@beep/md/Md.render";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import type { Block, Inline } from "@beep/md/Md.model";

const policyAdapter = makeMarkdownAdapter(UrlRenderOptions.make({ urlPolicy: BrowserSafeUrlPolicySpec }));

const encode = (document: Document): Document.Encoded => Result.getOrThrow(Document.encodeResult(document));

const reparsedWithDefaultMathOn = (markdown: string): Document.Encoded =>
  encode(Result.getOrThrow(parseResult(markdown)).document);

const text = (value: string): Text => Text.make({ value });

const p = (...children: ReadonlyArray<Inline>): P => P.make({ children });

const link = (children: ReadonlyArray<Inline>, title: O.Option<string> = O.none()): Anchor =>
  Anchor.make({ href: "https://example.com", title, children });

const expectBothAdaptersWriteAndReparse = (blocks: ReadonlyArray<Block>, markdown: string): void => {
  const document = Document.make({ children: blocks });
  expect(renderUnsafe(document)).toBe(markdown);
  expect(renderWithUnsafe(policyAdapter, document)).toBe(markdown);
  expect(reparsedWithDefaultMathOn(markdown)).toStrictEqual(encode(document));
};

describe("@beep/md/Md.render writer escapes what a parser would otherwise read back differently", () => {
  it("escapes an `&` only where it opens a character reference, unknown names too (Md has no entity table); in text only a named one takes `\\&` since the `#` escape already breaks a numeric one, while titles and destinations escape both", () => {
    expectBothAdaptersWriteAndReparse(
      [p(text("AT&T &amp; &#38; &#x26; &foo; & ;"))],
      "AT&T \\&amp; &\\#38; &\\#x26; \\&foo; & ;"
    );
    expectBothAdaptersWriteAndReparse([p(link([text("a")], O.some("&#38;")))], '[a](https://example.com "\\&#38;")');
  });

  it("preserves text newlines as references, including escaped HTML", () => {
    expectBothAdaptersWriteAndReparse([p(text("a\nb"))], "a&#10;b");
    const original = Result.getOrThrow(parseResult('before <span\nclass="x">after</span> end')).document;
    expect(reparsedWithDefaultMathOn(renderUnsafe(original))).toStrictEqual(encode(original));
  });

  it("escapes dollars before encoded newlines without a skipped math recognizer", () => {
    for (const value of ["$\nb$ c", "$\rb$ c", "$\r\nb$ c"]) {
      const document = Document.make({ children: [p(text(value))] });
      for (const markdown of [renderUnsafe(document), renderWithUnsafe(policyAdapter, document)]) {
        const result = Result.getOrThrow(parseResult(markdown, { math: true }));
        expect(encode(result.document)).toStrictEqual(encode(document));
        expect(result.losses).toStrictEqual([]);
      }
    }
  });

  it("keeps multiline table values as visible breaks through both adapters", () => {
    const table = Md.table([["Canonical Patch"], ['{\n  "count": 1\r\n}']], { headerRow: true });
    const document = Md.make([table]);
    const expected = '| Canonical Patch |\n| --- |\n| \\{<br/>  "count": 1<br/>\\} |';
    expect(renderMarkdownBlock(table)).toBe(expected);
    expect(renderWithUnsafe(policyAdapter, document)).toBe(expected);
  });

  it("keeps cell breaks nested in markup without rewriting references or titles", () => {
    const table = Md.table([[Md.strong("a\nb"), link([text("c\rd")], O.some("title\nline")), "literal &#10;"]], {
      headerRow: true,
    });
    const expected =
      '| **a<br/>b** | [c<br/>d](https://example.com "title&#10;line") | literal &\\#10; |\n| --- | --- | --- |';
    expect(renderMarkdownBlock(table)).toBe(expected);
    expect(renderWithUnsafe(policyAdapter, Md.make([table]))).toBe(expected);
  });

  it("closes inline math before a digit through both adapters", () => {
    expectBothAdaptersWriteAndReparse([p(InlineMath.make({ value: "x" }), text("123"))], "$x$&#49;23");
    expectBothAdaptersWriteAndReparse(
      [p(link([InlineMath.make({ value: "x" }), text("1")]))],
      "[$x$&#49;](https://example.com)"
    );
  });

  it("keeps a GFM email literal ([A-Za-z0-9.+_-] before `@`, a dotted alphanumeric, `-` or `_` domain ending in a letter) from becoming an autolink", () => {
    expectBothAdaptersWriteAndReparse([p(text("a@b.co"))], "a\\@b\\.co");
    expectBothAdaptersWriteAndReparse([p(text("a+b@c-d.e_f.co"))], "a\\+b\\@c\\-d\\.e\\_f\\.co");
    expectBothAdaptersWriteAndReparse([p(text("a@b.c."))], "a\\@b\\.c\\.");
    expectBothAdaptersWriteAndReparse([p(text("a@b@c.d"))], "a@b\\@c\\.d");
  });

  it("keeps scoped package names and non-email at signs literal, matching @beep/markdown's EmailCandidate rule that a domain dot is followed by an alphanumeric", () => {
    expectBothAdaptersWriteAndReparse([p(text("@beep/repo-cli"))], "@beep/repo\\-cli");
    expectBothAdaptersWriteAndReparse([p(text("@scope/pkg"))], "@scope/pkg");
    for (const value of ["@", "@example", "a@b", "a@b.c1", "a@b.c_", "a@b.c-", "a@b..co", "a@b.-co"]) {
      const document = Document.make({ children: [p(text(value))] });
      expect(renderUnsafe(document)).not.toContain("\\@");
      expect(reparsedWithDefaultMathOn(renderUnsafe(document))).toStrictEqual(encode(document));
    }
  });

  it("escapes a `$` only where it could open pandoc inline math: before a non-space character or at the end of a text node, whose neighbour is unknown", () => {
    expectBothAdaptersWriteAndReparse([p(text("cost $5, $ 6 and a$b$"))], "cost \\$5, $ 6 and a\\$b\\$");
    expectBothAdaptersWriteAndReparse(
      [p(text("pay $5 for "), InlineMath.make({ value: "x^2" }))],
      "pay \\$5 for $x^2$"
    );
  });

  it("escapes only a bare math `$`, since raw TeX already reads `\\$` as a literal dollar, so render(parse(render(x))) equals render(x)", () => {
    const math = (value: string): Document => Document.make({ children: [p(InlineMath.make({ value }))] });
    expectBothAdaptersWriteAndReparse([p(InlineMath.make({ value: "a\\$b" }))], "$a\\$b$");
    expectBothAdaptersWriteAndReparse([p(InlineMath.make({ value: "\\\\\\$" }))], "$\\\\\\$$");
    for (const value of ["a\\$b", "\\\\$", "$x", "x$", "a$b\\$c"]) {
      const once = renderUnsafe(math(value));
      expect(renderUnsafe(Result.getOrThrow(parseResult(once)).document)).toBe(once);
    }
  });

  it("keeps a bare URL in text from becoming a GFM autolink literal by escaping its scheme colon", () => {
    expectBothAdaptersWriteAndReparse([p(text("see https://example.com now"))], "see https\\://example\\.com now");
  });

  it("escapes a `!` that would turn a following link into an image", () => {
    expectBothAdaptersWriteAndReparse([p(text("Wow!"), link([text("a")]))], "Wow\\![a](https://example.com)");
  });

  it("writes block-edge whitespace as character references, since a paragraph, heading or cell drops edge whitespace and joinBlocks trims each block", () => {
    expectBothAdaptersWriteAndReparse([p(text(" \tindented "))], "&#32;&#9;indented&#32;");
    expectBothAdaptersWriteAndReparse([Md.h2(" spaced ")], "## &#32;spaced&#32;");
  });

  it("keeps line breaks in link and image titles as character references, so the link stays on one line and re-parses to the same title", () => {
    expectBothAdaptersWriteAndReparse(
      [p(link([text("a")], O.some("one\ntwo &amp;")))],
      '[a](https://example.com "one&#10;two \\&amp;")'
    );
    expectBothAdaptersWriteAndReparse(
      [p(Img.make({ src: "https://example.com/i.png", alt: "x &amp; y", title: O.some("t\nu") }))],
      '![x \\&amp; y](https://example.com/i.png "t&#10;u")'
    );
  });

  it("escapes a character reference in a link destination", () => {
    expectBothAdaptersWriteAndReparse(
      [p(Anchor.make({ href: "https://example.com/a&amp;b", title: O.none(), children: [text("a")] }))],
      "[a](https://example.com/a\\&amp;b)"
    );
  });

  it("writes an all-space code span without padding, since a parser strips one padding space per side only from content that is not all spaces", () => {
    expectBothAdaptersWriteAndReparse(
      [p(Code.make({ value: " " }), text(" and "), Code.make({ value: " a" }))],
      "` ` and `  a `"
    );
  });

  it("escapes a table-cell pipe once: the text escape already writes a text `|` as `\\|`, so only a pipe behind an even backslash run (code spans, destinations) takes the cell escape", () => {
    expectBothAdaptersWriteAndReparse(
      [
        Table.make({
          align: ["none"],
          headerRow: true,
          children: [
            TableRow.make({ children: [TableCell.make({ children: [text("a|b "), Code.make({ value: "c|d" })] })] }),
          ],
        }),
      ],
      "| a\\|b `c\\|d` |\n| --- |"
    );
  });

  it("keeps `*` delimiters on intraword emphasis that opens or closes on emphasis", () => {
    const em = Em.make({ children: [text("bar")] });
    expectBothAdaptersWriteAndReparse(
      [p(text("foo"), Strong.make({ children: [em, text("baz")] }), text("qux"))],
      "foo***bar*baz**qux"
    );
    expectBothAdaptersWriteAndReparse(
      [p(text("foo "), Strong.make({ children: [text("baz"), em] }), text("qux"))],
      "foo **baz*bar***qux"
    );
    expectBothAdaptersWriteAndReparse(
      [p(text("foo "), Strong.make({ children: [em] }), text(" qux"))],
      "foo __*bar*__ qux"
    );
    expect(
      renderMarkdownBlock(p(text("foo"), Em.make({ children: [em] }), text("qux"))),
      "intraword emphasis around emphasis has no Markdown spelling: `_` cannot flank there and `**` reads as strong, so the writer keeps `*`"
    ).toBe("foo**bar**qux");
  });

  it("delimits emphasis that opens or closes on emphasis with underscores, since `**foo**` reads as strong and `***foo***` as emphasis around strong", () => {
    const em = Em.make({ children: [text("foo")] });
    expectBothAdaptersWriteAndReparse([p(Em.make({ children: [em] }))], "_*foo*_");
    expectBothAdaptersWriteAndReparse([p(Strong.make({ children: [em] }))], "__*foo*__");
    expectBothAdaptersWriteAndReparse(
      [p(Em.make({ children: [Strong.make({ children: [text("foo")] })] }))],
      "***foo***"
    );
  });
});

describe("@beep/md/Md.render writer blocks", () => {
  const item = (...children: ReadonlyArray<Inline>): Li => Li.make({ children });

  it("alternates the markers (`+` bullets, `)` ordered) of adjacent lists of one family, which would otherwise merge into one list", () => {
    expectBothAdaptersWriteAndReparse(
      [
        Ul.make({ children: [item(text("a"))] }),
        Ul.make({ children: [item(text("b"))] }),
        Ul.make({ children: [item(text("c"))] }),
      ],
      "- a\n\n+ b\n\n- c"
    );
    expectBothAdaptersWriteAndReparse(
      [Ol.make({ start: 1, children: [item(text("a"))] }), Ol.make({ start: 3, children: [item(text("b"))] })],
      "1. a\n\n3) b"
    );
    expectBothAdaptersWriteAndReparse(
      [
        Ul.make({ children: [item(text("a"))] }),
        TaskList.make({ children: [TaskItem.make({ checked: false, children: [text("b")] })] }),
      ],
      "- a\n\n+ [ ] b"
    );
  });

  it("alternates adjacent list markers inside every container", () => {
    const lists: ReadonlyArray<Block> = [
      Ul.make({ children: [item(text("b"))] }),
      Ul.make({ children: [item(text("c"))] }),
    ];
    expectBothAdaptersWriteAndReparse(
      [Ul.make({ children: [Li.make({ children: [text("a"), ...lists] })] })],
      "- a\n  - b\n  + c"
    );
    expectBothAdaptersWriteAndReparse(
      [
        Ol.make({
          start: 1,
          children: [
            Li.make({
              children: [
                text("a"),
                Ol.make({ start: 1, children: [item(text("b"))] }),
                Ol.make({ start: 1, children: [item(text("c"))] }),
              ],
            }),
          ],
        }),
      ],
      "1. a\n   1. b\n   1) c"
    );
    expectBothAdaptersWriteAndReparse([BlockQuote.make({ children: lists })], "> - b\n> \n> + c");
    expectBothAdaptersWriteAndReparse(
      [Admonition.make({ kind: "tip", title: O.none(), children: lists })],
      "> [!TIP]\n>\n> - b\n> \n> + c"
    );
    expect(renderMarkdownBlock(FootnoteDefinition.make({ identifier: "n", children: lists }))).toBe(
      "[^n]: - b\n\n    + c"
    );
    expectBothAdaptersWriteAndReparse(
      [
        p(text("See"), FootnoteReference.make({ identifier: "n" })),
        FootnoteDefinition.make({ identifier: "n", children: lists }),
      ],
      "See[^n]\n\n[^n]: - b\n\n    + c"
    );
  });

  it("renders a list with any paragraph item loose (Md marks a loose item by paragraph children), with blank lines between items and between an item's blocks", () => {
    expectBothAdaptersWriteAndReparse(
      [
        Ul.make({
          children: [Li.make({ children: [p(text("a")), p(text("b"))] }), Li.make({ children: [p(text("c"))] })],
        }),
      ],
      "- a\n\n  b\n\n- c"
    );
  });

  it("indents a task item's blocks under its bullet", () => {
    expectBothAdaptersWriteAndReparse(
      [
        TaskList.make({
          children: [
            TaskItem.make({ checked: true, children: [p(text("a")), Ul.make({ children: [item(text("b"))] })] }),
          ],
        }),
      ],
      "- [x] a\n\n  - b"
    );
  });

  it("separates an admonition body from its marker line with a blank quoted line, since a table, an ordered list above 1 or a bare URL cannot interrupt a paragraph and would merge into the marker line, and inline math continuing it would sit in a run spanning the `> ` prefix, which the recognizer skips", () => {
    expectBothAdaptersWriteAndReparse(
      [
        Admonition.make({
          kind: "note",
          title: O.none(),
          children: [Ol.make({ start: 7, children: [item(text("seven"))] })],
        }),
      ],
      "> [!NOTE]\n>\n> 7. seven"
    );
  });

  it("writes thematic breaks as `***` rather than `---`, so a leading break is not a frontmatter fence, one under a paragraph is not a setext underline, and `- ***` stays a list item holding a break; it never uses a `*` bullet, since `* ***` reads as one thematic break", () => {
    expectBothAdaptersWriteAndReparse([Hr.make({}), p(text("x")), Hr.make({})], "***\n\nx\n\n***");
    expectBothAdaptersWriteAndReparse([Ul.make({ children: [Li.make({ children: [Hr.make({})] })] })], "- ***");
  });
});
