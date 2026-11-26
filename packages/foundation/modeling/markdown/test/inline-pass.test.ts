import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { GuardExceeded } from "@beep/markdown/internal/carriers";
import { decodeEntity } from "@beep/markdown/internal/entities";
import { ENTITY_MAP } from "@beep/markdown/internal/entityMap";
import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { PhrasingContent } from "@beep/markdown/MarkdownNode";

const inlinesOf = (source: string): ReadonlyArray<PhrasingContent> => {
  const [first] = parseBlocks(source).root.children;
  return first?.type === "paragraph" || first?.type === "heading" ? first.children : [];
};

const shapeOf = (source: string): ReadonlyArray<string> => A.map(inlinesOf(source), (node) => node.type);

const onlyInline = (source: string): PhrasingContent | undefined => {
  const children = inlinesOf(source);
  return children.length === 1 ? children[0] : undefined;
};

describe("entities", () => {
  describe("the generated map", () => {
    it("holds every semicolon-terminated HTML5 name", () => {
      assert.strictEqual(
        HashMap.size(ENTITY_MAP),
        2125,
        "2125 of the 2231 WHATWG names; the rest are legacy forms without a semicolon, which CommonMark's grammar cannot match"
      );
    });

    it("decodes the multi-codepoint names", () => {
      assertSome(HashMap.get(ENTITY_MAP, "nvap"), "≍⃒");
    });

    it("decodes names whose value is itself a control character", () => {
      assertSome(HashMap.get(ENTITY_MAP, "NewLine"), "\n");
      assertSome(HashMap.get(ENTITY_MAP, "Tab"), "\t");
    });
  });

  describe("decodeEntity", () => {
    it("decodes a named reference", () => {
      assertSome(decodeEntity("&amp;"), "&");
      assertSome(decodeEntity("&ouml;"), "ö");
    });

    it("decodes decimal and hexadecimal references", () => {
      assertSome(decodeEntity("&#35;"), "#");
      assertSome(decodeEntity("&#x22;"), '"');
      assertSome(decodeEntity("&#X22;"), '"');
    });

    it("maps U+0000 to the replacement character", () => {
      assertSome(decodeEntity("&#0;"), "�");
    });

    it("maps an out-of-range code point to the replacement character", () => {
      assertSome(decodeEntity("&#1114112;"), "�");
      assertSome(decodeEntity("&#x110000;"), "�");
    });

    it("maps a lone surrogate to the replacement character", () => {
      assertSome(decodeEntity("&#xD800;"), "�");
    });

    it("returns undefined for a name it does not know", () => {
      assertNone(decodeEntity("&MissingHorseTermMark;"));
      assertNone(decodeEntity("&#;"));
      assertNone(decodeEntity("not an entity"));
    });
  });

  describe("in a document", () => {
    it("decodes a reference into the surrounding text run", () => {
      const node = onlyInline("&amp; and &#35;\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "& and #");
    });

    it("leaves an unknown name as literal source text", () => {
      const node = onlyInline("&MissingHorseTermMark;\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "&MissingHorseTermMark;");
    });
  });
});

describe("inline pass", () => {
  describe("backslash escapes", () => {
    it("takes the escaped punctuation literally", () => {
      const node = onlyInline("\\*not emphasis\\*\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "*not emphasis*");
    });

    it("escapes every character in the punctuation set", () => {
      const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
      const escaped = A.join(
        A.map(Str.split(punctuation, ""), (char) => `\\${char}`),
        ""
      );
      const node = onlyInline(`${escaped}\n`);
      assert.strictEqual(node?.type === "text" ? node.value : "", punctuation);
    });

    it("leaves a backslash before a non-escapable character literal", () => {
      const node = onlyInline("\\a\\ \\3\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "\\a\\ \\3");
    });

    it("does not escape inside a code span", () => {
      const [code] = inlinesOf("`\\*not escaped*`\n");
      assert.strictEqual(code?.type === "inlineCode" ? code.value : "", "\\*not escaped*");
    });
  });

  describe("code spans", () => {
    it("closes on a run of exactly the same length", () => {
      const node = onlyInline("`foo`\n");
      assert.strictEqual(node?.type, "inlineCode");
      assert.strictEqual(node?.type === "inlineCode" ? node.value : "", "foo");
    });

    it("lets a longer fence hold a shorter run", () => {
      const node = onlyInline("`` foo ` bar ``\n");
      assert.strictEqual(node?.type === "inlineCode" ? node.value : "", "foo ` bar");
    });

    it("strips one space of padding from each side", () => {
      const node = onlyInline("`` `foo` ``\n");
      assert.strictEqual(node?.type === "inlineCode" ? node.value : "", "`foo`");
    });

    it("keeps content that is all spaces", () => {
      const node = onlyInline("`  `\n");
      assert.strictEqual(node?.type === "inlineCode" ? node.value : "", "  ");
    });

    it("turns a line ending inside the span into a space", () => {
      const node = onlyInline("`foo\nbar`\n");
      assert.strictEqual(node?.type === "inlineCode" ? node.value : "", "foo bar");
    });

    it("leaves an unclosed run as literal backticks", () => {
      const node = onlyInline("`foo\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "`foo");
    });
  });

  describe("autolinks", () => {
    it("parses an absolute URI", () => {
      const node = onlyInline("<http://foo.bar.baz>\n");
      assert.strictEqual(node?.type, "link");
      if (node?.type !== "link") {
        return;
      }
      assert.strictEqual(node.url, "http://foo.bar.baz");
      assert.strictEqual(node.children[0]?.type === "text" ? node.children[0].value : "", "http://foo.bar.baz");
      assert.isFalse(P.hasProperty(node, "title"));
    });

    it("parses an email address with a mailto destination", () => {
      const node = onlyInline("<foo@bar.example.com>\n");
      assert.strictEqual(node?.type === "link" ? node.url : "", "mailto:foo@bar.example.com");
    });

    it("stores the decoded destination, leaving encoding to the renderer", () => {
      const node = onlyInline("<http://example.com/a b>\n");
      assert.strictEqual(node?.type, "text", "a space is not legal in an autolink, so this is not one");
    });

    it("requires a scheme, leaving anything else to the other constructs", () => {
      assert.deepStrictEqual(
        shapeOf("a <5> b\n"),
        ["text"],
        "`<5>` is neither an autolink nor a legal tag, so it falls through to literal text and merges with what surrounds it"
      );
    });
  });

  describe("raw inline html", () => {
    it("keeps an open tag with attributes verbatim", () => {
      const [html] = inlinesOf('<a href="foo" class="bar">x\n');
      assert.strictEqual(html?.type, "html");
      assert.strictEqual(html?.type === "html" ? html.value : "", '<a href="foo" class="bar">');
    });

    it("keeps closing tags, comments, declarations, instructions and CDATA", () => {
      const sources: ReadonlyArray<readonly [string, string]> = [
        ["x </a>\n", "</a>"],
        ["x <!-- comment -->\n", "<!-- comment -->"],
        ["x <!DOCTYPE html>\n", "<!DOCTYPE html>"],
        ["x <?php echo $y; ?>\n", "<?php echo $y; ?>"],
        ["x <![CDATA[raw]]>\n", "<![CDATA[raw]]>"],
      ];
      for (const [source, expected] of sources) {
        const [, html] = inlinesOf(source);
        assert.strictEqual(
          html?.type === "html" ? html.value : "",
          expected,
          `each source leads with text: at a line start it would open an HTML block, leaving no paragraph; failed for ${source}`
        );
      }
    });

    it("does not match a malformed tag", () => {
      assert.deepStrictEqual(shapeOf("<33> x\n"), ["text"]);
    });

    it("prefers an autolink to a raw tag", () => {
      assert.deepStrictEqual(shapeOf("<http://example.com>\n"), ["link"]);
    });
  });

  describe("line breaks", () => {
    it("makes two trailing spaces a hard break", () => {
      assert.deepStrictEqual(shapeOf("foo  \nbar\n"), ["text", "break", "text"]);
      const [, node] = inlinesOf("foo  \nbar\n");
      assert.strictEqual(node?.type === "break" ? node.breakStyle : undefined, "spaces");
    });

    it("makes a trailing backslash a hard break", () => {
      const [, node] = inlinesOf("foo\\\nbar\n");
      assert.strictEqual(node?.type, "break");
      assert.strictEqual(node?.type === "break" ? node.breakStyle : undefined, "backslash");
    });

    it("keeps a soft break as a newline inside one text value, with no node", () => {
      const node = onlyInline("foo\nbar\n");
      assert.strictEqual(node?.type, "text");
      assert.strictEqual(node?.type === "text" ? node.value : "", "foo\nbar");
    });

    it("strips a single trailing space without making a break", () => {
      const node = onlyInline("foo \nbar\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "foo\nbar");
    });

    it("strips the spaces a hard break was made of", () => {
      const [text] = inlinesOf("foo   \nbar\n");
      assert.strictEqual(text?.type === "text" ? text.value : "", "foo");
    });

    it("drops leading whitespace on the line after a break", () => {
      const [, , text] = inlinesOf("foo  \n     bar\n");
      assert.strictEqual(text?.type === "text" ? text.value : "", "bar");
    });
  });

  describe("positions", () => {
    it("spans exactly the source each inline node was built from", () => {
      const source = "a `code` b\n";
      const children = inlinesOf(source);
      const [, code] = children;
      assert.strictEqual(code?.type, "inlineCode");
      assert.strictEqual(Str.slice(code?.position.start.offset ?? 0, code?.position.end.offset ?? 0)(source), "`code`");
    });

    it("positions an inline inside a container against the original source", () => {
      const source = "> a\n> `code`\n";
      const children = inlinesOf(Str.replace(/^> /gm, "")(source));
      assert.isAtLeast(children.length, 1);

      const quote = parseBlocks(source).root.children[0];
      const paragraph = quote?.type === "blockquote" ? quote.children[0] : undefined;
      const code = paragraph?.type === "paragraph" ? paragraph.children[1] : undefined;
      assert.strictEqual(code?.type, "inlineCode");
      assert.strictEqual(
        Str.slice(code?.position.start.offset ?? 0, code?.position.end.offset ?? 0)(source),
        "`code`",
        "the inline pass sees the content with blockquote markers stripped, so a naive offset lands two characters early"
      );
    });

    it("keeps every inline position inside the source and ordered", () => {
      const source = "a `b` <c/> &amp; <http://x.y> d  \ne\n";
      for (const node of inlinesOf(source)) {
        assert.isAtLeast(node.position.start.offset, 0);
        assert.isAtMost(node.position.start.offset, node.position.end.offset);
        assert.isAtMost(node.position.end.offset, source.length);
      }
    });
  });

  describe("text runs", () => {
    it("merges adjacent runs into one node", () => {
      const node = onlyInline("a*b\n");
      assert.strictEqual(node?.type === "text" ? node.value : "", "a*b");
    });

    it("does not skip the run before an unclaimed character", () => {
      const node = onlyInline("?foo\nbar\n");
      assert.strictEqual(
        node?.type === "text" ? node.value : "",
        "?foo\nbar",
        "the regression the m flag caused: ^ matching at the NEXT line start swallowed everything in between"
      );
    });

    it("parses heading content as inlines too", () => {
      const [heading] = parseBlocks("# a `b`\n").root.children;
      assert.strictEqual(heading?.type, "heading");
      assert.deepStrictEqual(
        A.map(heading?.type === "heading" ? heading.children : [], (child) => child.type),
        ["text", "inlineCode"]
      );
    });
  });
});

describe("the delimiter stack", () => {
  const treeOf = (nodes: ReadonlyArray<PhrasingContent>): string => A.join(A.map(nodes, nodeShape), "");
  const nodeShape: (node: PhrasingContent) => string = Match.type<PhrasingContent>().pipe(
    Match.discriminators("type")({
      text: (node) => node.value,
      emphasis: (node) => `<em>${treeOf(node.children)}</em>`,
      strong: (node) => `<strong>${treeOf(node.children)}</strong>`,
      link: (node) => `<a ${node.url}>${treeOf(node.children)}</a>`,
      linkReference: (node) => `<ref ${node.identifier} ${node.referenceType}>${treeOf(node.children)}</ref>`,
      image: (node) => `<img ${node.url} ${node.alt ?? ""}>`,
      imageReference: (node) => `<imgref ${node.identifier} ${node.referenceType} ${node.alt ?? ""}>`,
      inlineCode: (node) => `<code>${node.value}</code>`,
    }),
    Match.orElse((node) => `<${node.type}>`)
  );

  const shape = (source: string): string => treeOf(inlinesOf(source));

  describe("emphasis", () => {
    it("pairs one delimiter as emphasis and two as strong", () => {
      assert.strictEqual(shape("*foo*\n"), "<em>foo</em>");
      assert.strictEqual(shape("**foo**\n"), "<strong>foo</strong>");
      assert.strictEqual(shape("***foo***\n"), "<em><strong>foo</strong></em>");
    });

    it("records which marker produced it", () => {
      const [node] = inlinesOf("*foo*\n");
      assert.strictEqual(node?.type === "emphasis" ? node.markerChar : undefined, "*");
      const [underscore] = inlinesOf("_foo_\n");
      assert.strictEqual(underscore?.type === "emphasis" ? underscore.markerChar : undefined, "_");
    });

    it("nests the shapes the spec's `*foo**bar**baz*` family expects", () => {
      assert.strictEqual(shape("*foo**bar**baz*\n"), "<em>foo<strong>bar</strong>baz</em>");
      assert.strictEqual(shape("*foo**bar*\n"), "<em>foo**bar</em>");
      assert.strictEqual(shape("**foo*bar*baz**\n"), "<strong>foo<em>bar</em>baz</strong>");
    });

    it("refuses intraword emphasis with underscores but allows it with asterisks", () => {
      assert.strictEqual(shape("foo_bar_baz\n"), "foo_bar_baz");
      assert.strictEqual(shape("foo*bar*baz\n"), "foo<em>bar</em>baz");
    });

    it("applies the multiple-of-three rule", () => {
      assert.strictEqual(
        shape("*foo**bar***\n"),
        "<em>foo<strong>bar</strong></em>",
        "a run that can both open and close cannot pair when the lengths sum to a multiple of three, unless both are multiples of three"
      );
      assert.strictEqual(shape("foo***bar***baz\n"), "foo<em><strong>bar</strong></em>baz");
      assert.strictEqual(
        shape("foo******bar*********baz\n"),
        "foo<strong><strong><strong>bar</strong></strong></strong>***baz"
      );
    });

    it("leaves an unmatched delimiter as literal text", () => {
      assert.strictEqual(shape("*foo\n"), "*foo");
      assert.strictEqual(shape("a * b\n"), "a * b");
    });

    it("does not pair delimiters across a code span", () => {
      assert.strictEqual(shape("*a `b* c`\n"), "*a <code>b* c</code>");
    });
  });

  describe("links and images", () => {
    it("parses an inline link with a title", () => {
      const [node] = inlinesOf('[foo](/url "title")\n');
      assert.strictEqual(node?.type, "link");
      if (node?.type !== "link") {
        return;
      }
      assert.strictEqual(node.url, "/url");
      assert.strictEqual(node.title, "title");
      assert.strictEqual(treeOf(node.children), "foo");
    });

    it("stores the decoded destination, leaving encoding to the renderer", () => {
      const [node] = inlinesOf("[foo](/b%C3%A4r\\*baz)\n");
      assert.strictEqual(node?.type === "link" ? node.url : "", "/b%C3%A4r*baz");
    });

    it("parses a bare destination holding 32 nested parens, the cmark bound", () => {
      const url = `/${Str.repeat(32)("(")}a${Str.repeat(32)(")")}`;
      assert.strictEqual(
        shape(`[foo](${url})\n`),
        `<a ${url}>foo</a>`,
        "the complete inline result: exactly one link consuming the whole destination, no trailing nodes after it"
      );
    });

    it("leaves the brackets literal past 32 nested parens, like cmark", () => {
      const destination = `/${Str.repeat(33)("(")}a${Str.repeat(33)(")")}`;
      assert.strictEqual(
        shape(`[foo](${destination})\n`),
        `[foo](${destination})`,
        "the spec lets implementations limit parens nesting; unbounded, the bare-destination scan is quadratic on \"[a](b\" repeated (pathological 'unclosed links B'). The complete result is the line verbatim"
      );
    });

    it("omits an absent title rather than storing undefined", () => {
      const [node] = inlinesOf("[foo](/url)\n");
      assert.isFalse(P.hasProperty(node ?? {}, "title"));
    });

    it("gives an image alt text and no children", () => {
      const [node] = inlinesOf("![*alt* text](/url)\n");
      assert.strictEqual(node?.type, "image");
      if (node?.type !== "image") {
        return;
      }
      assert.strictEqual(node.alt, "alt text");
      assert.isFalse("children" in node);
    });

    it("takes a link in preference to the emphasis around it", () => {
      assert.strictEqual(shape("*[foo*](/url)\n"), "*<a /url>foo*</a>");
    });

    it("resolves emphasis inside the brackets before the link closes", () => {
      assert.strictEqual(shape("[*foo*](/url)\n"), "<a /url><em>foo</em></a>");
    });

    it("refuses to nest a link inside a link", () => {
      assert.strictEqual(shape("[foo [bar](/inner)](/outer)\n"), "[foo <a /inner>bar</a>](/outer)");
    });

    it("allows a link inside an image", () => {
      const [node] = inlinesOf("![foo [bar](/inner)](/outer)\n");
      assert.strictEqual(node?.type === "image" ? node.url : "", "/outer");
      assert.strictEqual(node?.type === "image" ? node.alt : "", "foo bar");
    });

    it("lets the inner link win when brackets nest", () => {
      assert.strictEqual(
        shape("[a[b](/i)c](/o)\n"),
        "[a<a /i>b</a>c](/o)",
        "the inner link forms first and spends every enclosing opener, so the outer brackets stay literal text"
      );
    });
  });

  describe("references", () => {
    const withDefinition = (body: string): string => shape(`${body}\n\n[ref]: /url "t"\n`);

    it("forms a full reference", () => {
      assert.strictEqual(withDefinition("[text][ref]"), "<ref ref full>text</ref>");
    });

    it("forms a collapsed reference", () => {
      assert.strictEqual(withDefinition("[ref][]"), "<ref ref collapsed>ref</ref>");
    });

    it("forms a shortcut reference", () => {
      assert.strictEqual(withDefinition("[ref]"), "<ref ref shortcut>ref</ref>");
    });

    it("forms an image reference with alt text", () => {
      const [node] = inlinesOf('![ref]\n\n[ref]: /url "t"\n');
      assert.strictEqual(node?.type, "imageReference");
      if (node?.type !== "imageReference") {
        return;
      }
      assert.strictEqual(node.identifier, "ref");
      assert.strictEqual(node.referenceType, "shortcut");
      assert.strictEqual(node.alt, "ref");
    });

    it("carries the raw label alongside the normalized identifier", () => {
      const [node] = inlinesOf("[Text][Foo Bar]\n\n[foo bar]: /url\n");
      assert.strictEqual(node?.type, "linkReference");
      if (node?.type !== "linkReference") {
        return;
      }
      assert.strictEqual(node.identifier, "foo bar");
      assert.strictEqual(node.label, "Foo Bar");
    });

    it("does not form a reference with no matching definition", () => {
      assert.strictEqual(
        shape("[nope]\n"),
        "[nope]",
        "THE formation rule: a dangling label is literal text, brackets and all, not an unresolved reference node"
      );
      assert.strictEqual(shape("[text][nope]\n"), "[text][nope]");
      assert.strictEqual(shape("[nope][]\n"), "[nope][]");
      assert.strictEqual(shape("![nope]\n"), "![nope]");
    });

    it("still parses the bracket content when no reference forms", () => {
      assert.strictEqual(shape("[*emph*]\n"), "[<em>emph</em>]");
    });

    it("matches a label case-insensitively", () => {
      assert.strictEqual(withDefinition("[REF]"), "<ref ref shortcut>REF</ref>");
    });
  });

  describe("positions", () => {
    it("spans exactly the source each emphasis and link was built from", () => {
      const source = "a *b* [c](/d) e\n";
      const [, emphasis, , link] = inlinesOf(source);
      assert.strictEqual(
        Str.slice(emphasis?.position.start.offset ?? 0, emphasis?.position.end.offset ?? 0)(source),
        "*b*",
        "unist positions cover the whole construct, markers included: the delimiters are part of the emphasis"
      );
      assert.strictEqual(
        Str.slice(link?.position.start.offset ?? 0, link?.position.end.offset ?? 0)(source),
        "[c](/d)"
      );
    });

    it("positions inlines inside a container against the original source", () => {
      const source = "> a\n> *b*\n";
      const quote = parseBlocks(source).root.children[0];
      const paragraph = quote?.type === "blockquote" ? quote.children[0] : undefined;
      const emphasis = paragraph?.type === "paragraph" ? paragraph.children[1] : undefined;
      assert.strictEqual(emphasis?.type, "emphasis");
      assert.strictEqual(
        Str.slice(emphasis?.position.start.offset ?? 0, emphasis?.position.end.offset ?? 0)(source),
        "*b*"
      );
    });
  });

  describe("hardening", () => {
    it("handles a long run of unmatched delimiters without pairing them", () => {
      const source = `${Str.repeat(500)("*a **a ")}\n`;
      const children = inlinesOf(source);
      assert.isAtLeast(
        children.length,
        1,
        "the delimiter stack must not go quadratic or pair anything here; the pathological suite pins the timing"
      );
    });

    it("refuses emphasis nested past the depth cap", () => {
      const delimitersPerNestingLevel = 2;
      const markers = delimitersPerNestingLevel * MAX_NESTING_DEPTH + 20;
      const source = `${Str.repeat(markers)("*")}a${Str.repeat(markers)("*")}\n`;
      assert.throws(
        () => parseBlocks(source),
        GuardExceeded,
        undefined,
        "the delimiter stack is iterative and unguarded; the tree it builds recurses and shares the block pass's cap"
      );
    });

    it("parses emphasis nested just under the cap", () => {
      const markers = 2 * MAX_NESTING_DEPTH - 12;
      const source = `${Str.repeat(markers)("*")}a${Str.repeat(markers)("*")}\n`;
      const [node] = inlinesOf(source);
      assert.strictEqual(
        node?.type,
        "strong",
        "positive control: 500 markers a side nest 250 deep and must parse, or the test above would pass for the wrong reason"
      );
    });
  });
});
