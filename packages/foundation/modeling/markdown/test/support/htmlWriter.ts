// Test-only HTML writer. The product ships no HTML — this exists solely so
// the CommonMark spec corpus can be asserted by normalized-HTML equivalence,
// which is the same trick mdast-util-from-markdown uses to prove itself.
//
// Every rendering rule here is a direct port of commonmark.js@0.31.2
// `lib/render/html.js` and `lib/render/renderer.js`, including the escaping
// (`escapeXml` from `lib/common.js`) and the URL normalization (`normalizeURI`,
// which delegates to `mdurl@2.0.0`'s `encode`). Where this file departs from
// that source it says so and says why. Do not "clean up" a rule here without
// checking it against the upstream file — these rules decide all 652 corpus
// verdicts, and a tidier rule that disagrees with commonmark.js is a bug.
//
// commonmark.js is BSD-2-Clause, Copyright (c) 2014-2020 John MacFarlane.
// mdurl is MIT, Copyright (c) 2015 Vitaly Puzrin, Alex Kocharin.

import * as BStr from "@beep/utils/Str";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import { hasProperty } from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { flowNodes } from "./tree.ts";
import type {
  Blockquote,
  Code,
  Definition,
  FlowContent,
  FootnoteDefinition,
  FootnoteReference,
  Heading,
  ImageReference,
  LinkReference,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  Table,
  TableAlign,
  TableCell,
} from "@beep/markdown/MarkdownNode";
import type { DocumentChild } from "./tree.ts";

const reXmlSpecial = /[&<>"]/g;

const XML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
});

const replaceUnsafeChar = (s: string): string => XML_ESCAPES[s] ?? s;

/**
 * commonmark.js `lib/common.js` `escapeXml`: the four XML specials, nothing
 * else. Notably it does NOT escape `'`.
 */
export const escapeXml = (s: string): string => BStr.replaceAllWith(s, reXmlSpecial, replaceUnsafeChar);

// Ported from mdurl@2.0.0 encode (MIT).
// decision: html-writer-departures-from-commonmark-js
const ENCODE_DEFAULT_CHARS = ";/?:@&=+$,-_.!~*'()#";

const ASCII_ALPHANUMERIC = /^[0-9a-z]$/i;

const encodeAsciiUnit = (ch: string, code: number): string =>
  ASCII_ALPHANUMERIC.test(ch) || Str.includes(ch)(ENCODE_DEFAULT_CHARS)
    ? ch
    : `%${pipe(code.toString(16), Str.toUpperCase, Str.padStart(2, "0"))}`;

const ASCII_ENCODING: Readonly<Record<string, string>> = Object.freeze(
  R.fromEntries(
    A.makeBy(128, (code) => {
      const ch = String.fromCharCode(code);
      return [ch, encodeAsciiUnit(ch, code)] as const;
    })
  )
);

const URI_TOKEN = /%[0-9a-f]{2}|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]|[\s\S]/gi;
const PERCENT_ESCAPE = /^%[0-9a-f]{2}$/i;
const LONE_SURROGATE = /^[\ud800-\udfff]$/;
const encodedReplacementChar = "%EF%BF%BD";

const encodeUriToken = (token: string): string => {
  if (PERCENT_ESCAPE.test(token)) return token;
  if (LONE_SURROGATE.test(token)) return encodedReplacementChar;
  return ASCII_ENCODING[token] ?? encodeURIComponent(token);
};

/**
 * commonmark.js `normalizeURI` — `mdurl.encode` with its default character
 * set, falling back to the input if it throws.
 */
export const normalizeUri = (uri: string): string => {
  try {
    return BStr.replaceAllWith(uri, URI_TOKEN, encodeUriToken);
  } catch {
    return uri;
  }
};

const LABEL_WHITESPACE = /[ \t\r\n]+/g;

/**
 * commonmark.js `lib/inlines.js` `normalizeReference`, minus the bracket slice
 * (an mdast `identifier` carries no brackets).
 *
 * The `toLowerCase().toUpperCase()` pair is not redundant: it is commonmark's
 * Unicode case-folding trick, and it is why `ẞ` and `ß` match. Applying it to
 * both sides of the lookup means a tree whose identifiers were normalized
 * lowercase (mdast's convention) and one normalized uppercase both resolve.
 */
export const normalizeLabel = (label: string): string =>
  pipe(label, Str.trim, Str.replace(LABEL_WHITESPACE, " "), Str.toLowerCase, Str.toUpperCase);

// decision: html-writer-departures-from-commonmark-js
const collectFirstByLabel = <N extends Definition | FootnoteDefinition>(
  root: Root,
  isKind: (node: FlowContent) => node is N
): MutableHashMap.MutableHashMap<string, N> => {
  const definitions = MutableHashMap.empty<string, N>();
  for (const node of A.filter(flowNodes(root.children), isKind)) {
    const key = normalizeLabel(node.identifier);
    if (!MutableHashMap.has(definitions, key)) MutableHashMap.set(definitions, key, node);
  }
  return definitions;
};

const isDefinition = (node: FlowContent): node is Definition => node.type === "definition";

const isFootnoteDefinition = (node: FlowContent): node is FootnoteDefinition => node.type === "footnoteDefinition";

// Ported from cmark-gfm 0.29.0.gfm.13 extensions/tagfilter.c (BSD-2-Clause).
const TAGFILTER_TAG_NAMES = [
  "title",
  "textarea",
  "style",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "script",
  "plaintext",
] as const;

// decision: html-writer-departures-from-commonmark-js
const TAGFILTER_RE = new RegExp(`<(/?(?:${A.join(TAGFILTER_TAG_NAMES, "|")}))(?=[ \\t\\n\\v\\f\\r>]|/>)`, "gi");

/**
 * GFM's tagfilter extension: escapes the leading `<` of the nine disallowed
 * raw-HTML tag names (case-insensitively, opening or closing form), leaving
 * everything else — including the tag's own `>` — untouched. This is an
 * OUTPUT concern only: the parse tree keeps `Html` node values verbatim, and
 * this filter runs at render time when the `gfm` option is set.
 *
 * Ported from cmark-gfm's `extensions/tagfilter.c`.
 */
export const applyTagfilter = (value: string): string => Str.replace(TAGFILTER_RE, "&lt;$1")(value);

type Attr = readonly [name: string, value: string];

type WriterStep = (writer: HtmlWriter) => void;

const skip: WriterStep = () => {};

// decision: html-writer-departures-from-commonmark-js
const flowStep = Match.type<FlowContent>().pipe(
  Match.discriminatorsExhaustive("type")({
    paragraph:
      (node): WriterStep =>
      (writer) =>
        writer.paragraph(node, false),
    heading:
      (node): WriterStep =>
      (writer) =>
        writer.heading(node),
    thematicBreak: (): WriterStep => (writer) => writer.thematicBreak(),
    blockquote:
      (node): WriterStep =>
      (writer) =>
        writer.blockquote(node),
    list:
      (node): WriterStep =>
      (writer) =>
        writer.list(node),
    code:
      (node): WriterStep =>
      (writer) =>
        writer.codeBlock(node),
    html:
      (node): WriterStep =>
      (writer) =>
        writer.htmlBlock(node.value),
    table:
      (node): WriterStep =>
      (writer) =>
        writer.table(node),
    definition: () => skip,
    footnoteDefinition: () => skip,
    mdxFlowExpression: () => skip,
    mdxJsxFlowElement: () => skip,
  })
);

const phrasingStep = Match.type<PhrasingContent>().pipe(
  Match.discriminatorsExhaustive("type")({
    text:
      (node): WriterStep =>
      (writer) =>
        writer.out(node.value),
    break: (): WriterStep => (writer) => writer.lineBreak(),
    inlineCode:
      (node): WriterStep =>
      (writer) =>
        writer.inlineCode(node.value),
    html:
      (node): WriterStep =>
      (writer) =>
        writer.htmlInline(node.value),
    emphasis:
      (node): WriterStep =>
      (writer) =>
        writer.wrapped("em", node.children),
    strong:
      (node): WriterStep =>
      (writer) =>
        writer.wrapped("strong", node.children),
    delete:
      (node): WriterStep =>
      (writer) =>
        writer.wrapped("del", node.children),
    link:
      (node): WriterStep =>
      (writer) =>
        writer.link(node.url, node.title, node.children),
    image:
      (node): WriterStep =>
      (writer) =>
        writer.image(node.url, node.title, node.alt ?? ""),
    linkReference:
      (node): WriterStep =>
      (writer) =>
        writer.linkReference(node),
    imageReference:
      (node): WriterStep =>
      (writer) =>
        writer.imageReference(node),
    footnoteReference:
      (node): WriterStep =>
      (writer) =>
        writer.footnoteReference(node),
    mdxJsxTextElement: () => skip,
    mdxTextExpression: () => skip,
  })
);

const REFERENCE_SUFFIX: {
  readonly [K in LinkReference["referenceType"]]: (label: string) => string;
} = {
  shortcut: () => "",
  collapsed: () => "[]",
  full: (label) => `[${label}]`,
};

const isFlowContent = (child: DocumentChild): child is FlowContent =>
  child.type !== "frontmatter" && child.type !== "mdxjsEsm";

class HtmlWriter {
  private buffer = "";
  // decision: html-writer-departures-from-commonmark-js
  private lastOut = "\n";
  private disableTags = 0;
  private readonly definitions: MutableHashMap.MutableHashMap<string, Definition>;
  private readonly footnoteDefinitions: MutableHashMap.MutableHashMap<string, FootnoteDefinition>;
  private readonly gfm: boolean;
  private readonly footnoteIndex = MutableHashMap.empty<string, number>();
  private readonly footnoteRefCount = MutableHashMap.empty<string, number>();
  private readonly footnoteOrder: Array<FootnoteDefinition> = [];
  private nextFootnoteIndex = 1;

  constructor(root: Root, gfm: boolean) {
    this.definitions = collectFirstByLabel(root, isDefinition);
    this.footnoteDefinitions = collectFirstByLabel(root, isFootnoteDefinition);
    this.gfm = gfm;
  }

  private lit(s: string): void {
    this.buffer += s;
    this.lastOut = s;
  }

  out(s: string): void {
    this.lit(escapeXml(s));
  }

  private cr(): void {
    if (this.lastOut !== "\n") {
      this.lit("\n");
    }
  }

  private tag(name: string, attrs: ReadonlyArray<Attr> = [], selfclosing = false): void {
    if (this.disableTags > 0) {
      return;
    }
    this.buffer += `<${name}`;
    for (const [attrName, attrValue] of attrs) {
      this.buffer += ` ${attrName}="${attrValue}"`;
    }
    if (selfclosing) {
      this.buffer += " /";
    }
    this.buffer += ">";
    this.lastOut = ">";
  }

  private raw(value: string): string {
    return this.gfm ? applyTagfilter(value) : value;
  }

  render(root: Root): string {
    this.renderFlow(A.filter(root.children, isFlowContent));
    this.renderFootnoteSection();
    return this.buffer;
  }

  private renderFlow(nodes: ReadonlyArray<FlowContent>): void {
    for (const node of nodes) flowStep(node)(this);
  }

  private renderPhrasing(nodes: ReadonlyArray<PhrasingContent>): void {
    for (const node of nodes) phrasingStep(node)(this);
  }

  paragraph(node: Paragraph, tight: boolean): void {
    // decision: html-writer-departures-from-commonmark-js
    if (tight) {
      this.renderPhrasing(node.children);
      return;
    }
    this.cr();
    this.tag("p");
    this.renderPhrasing(node.children);
    this.tag("/p");
    this.cr();
  }

  heading(node: Heading): void {
    const tagname = `h${node.depth}`;
    this.cr();
    this.tag(tagname);
    this.renderPhrasing(node.children);
    this.tag(`/${tagname}`);
    this.cr();
  }

  thematicBreak(): void {
    this.cr();
    this.tag("hr", [], true);
    this.cr();
  }

  htmlBlock(value: string): void {
    this.cr();
    this.lit(this.raw(value));
    this.cr();
  }

  blockquote(node: Blockquote): void {
    this.cr();
    this.tag("blockquote");
    this.cr();
    this.renderFlow(node.children);
    this.cr();
    this.tag("/blockquote");
    this.cr();
  }

  list(node: List): void {
    const tagname = node.ordered === true ? "ol" : "ul";
    const attrs: ReadonlyArray<Attr> =
      node.start !== undefined && node.start !== 1 ? [["start", String(node.start)]] : [];
    const tight = node.spread !== true;

    this.cr();
    this.tag(tagname, attrs);
    this.cr();
    for (const item of node.children) {
      this.listItem(item, tight);
    }
    this.cr();
    this.tag(`/${tagname}`);
    this.cr();
  }

  private listItem(node: ListItem, tight: boolean): void {
    this.tag("li");
    if (node.checked !== undefined) {
      this.lit(
        node.checked ? '<input type="checkbox" checked="" disabled="" /> ' : '<input type="checkbox" disabled="" /> '
      );
    }
    for (const child of node.children) {
      if (child.type === "paragraph") {
        this.paragraph(child, tight);
      } else {
        this.renderFlow([child]);
      }
    }
    this.tag("/li");
    this.cr();
  }

  codeBlock(node: Code): void {
    const attrs: ReadonlyArray<Attr> =
      node.lang !== undefined && node.lang.length > 0 ? [["class", languageClass(escapeXml(node.lang))]] : [];
    this.cr();
    this.tag("pre");
    this.tag("code", attrs);
    this.out(node.value);
    this.tag("/code");
    this.tag("/pre");
    this.cr();
  }

  table(node: Table): void {
    this.cr();
    this.tag("table");
    const align: ReadonlyArray<TableAlign | null> = node.align ?? [];
    const [header, ...body] = node.children;
    if (header !== undefined) {
      this.cr();
      this.lit("<thead>");
      this.cr();
      this.tableRow(header, true, align);
      this.cr();
      this.lit("</thead>");
    }
    A.forEach(body, (row, rowIndex) => {
      this.cr();
      if (rowIndex === 0) {
        this.lit("<tbody>");
        this.cr();
      }
      this.tableRow(row, false, align);
    });
    if (A.isReadonlyArrayNonEmpty(body)) {
      this.cr();
      this.lit("</tbody>");
    }
    this.cr();
    this.tag("/table");
    this.cr();
  }

  private tableRow(row: Table["children"][number], isHeader: boolean, align: ReadonlyArray<TableAlign | null>): void {
    this.tag("tr");
    A.forEach(row.children, (cell, cellIndex) => {
      this.tableCell(cell, isHeader, align[cellIndex] ?? null);
    });
    this.cr();
    this.tag("/tr");
  }

  private tableCell(node: TableCell, isHeader: boolean, align: TableAlign | null): void {
    const attrs: ReadonlyArray<Attr> = align === null ? [] : [["align", align]];
    this.cr();
    this.tag(isHeader ? "th" : "td", attrs);
    this.renderPhrasing(node.children);
    this.tag(isHeader ? "/th" : "/td");
  }

  lineBreak(): void {
    this.tag("br", [], true);
    this.cr();
  }

  inlineCode(value: string): void {
    this.tag("code");
    this.out(value);
    this.tag("/code");
  }

  htmlInline(value: string): void {
    this.lit(this.raw(value));
  }

  wrapped(tagname: string, children: ReadonlyArray<PhrasingContent>): void {
    this.tag(tagname);
    this.renderPhrasing(children);
    this.tag(`/${tagname}`);
  }

  link(url: string, title: string | undefined, children: ReadonlyArray<PhrasingContent>): void {
    const attrs: ReadonlyArray<Attr> = [["href", escapeXml(normalizeUri(url))], ...titleAttr(title)];
    this.tag("a", attrs);
    this.renderPhrasing(children);
    this.tag("/a");
  }

  image(url: string, title: string | undefined, alt: string): void {
    // decision: html-writer-departures-from-commonmark-js
    if (this.disableTags === 0) {
      this.lit(`<img src="${escapeXml(normalizeUri(url))}" alt="`);
    }
    this.disableTags += 1;
    this.lit(escapeXml(alt));
    this.disableTags -= 1;
    if (this.disableTags === 0) {
      if (title !== undefined && title !== "") {
        this.lit(`" title="${escapeXml(title)}`);
      }
      this.lit('" />');
    }
  }

  linkReference(node: LinkReference): void {
    O.match(MutableHashMap.get(this.definitions, normalizeLabel(node.identifier)), {
      onNone: () => {
        this.out("[");
        this.renderPhrasing(node.children);
        this.out("]");
        this.out(REFERENCE_SUFFIX[node.referenceType](node.label ?? node.identifier));
      },
      onSome: (definition) => this.link(definition.url, definition.title, node.children),
    });
  }

  imageReference(node: ImageReference): void {
    O.match(MutableHashMap.get(this.definitions, normalizeLabel(node.identifier)), {
      onNone: () => {
        this.out(`![${node.alt ?? ""}]`);
        this.out(REFERENCE_SUFFIX[node.referenceType](node.label ?? node.identifier));
      },
      onSome: (definition) => this.image(definition.url, definition.title, node.alt ?? ""),
    });
  }

  // decision: html-writer-departures-from-commonmark-js
  footnoteReference(node: FootnoteReference): void {
    const key = normalizeLabel(node.identifier);
    O.match(MutableHashMap.get(this.footnoteDefinitions, key), {
      onNone: () => this.out(`[^${node.label ?? node.identifier}]`),
      onSome: (definition) => this.resolvedFootnoteReference(key, definition),
    });
  }

  private footnoteNumber(key: string, definition: FootnoteDefinition): number {
    return O.getOrElse(MutableHashMap.get(this.footnoteIndex, key), () => {
      const index = this.nextFootnoteIndex;
      this.nextFootnoteIndex += 1;
      MutableHashMap.set(this.footnoteIndex, key, index);
      this.footnoteOrder.push(definition);
      return index;
    });
  }

  private resolvedFootnoteReference(key: string, definition: FootnoteDefinition): void {
    const index = this.footnoteNumber(key, definition);
    const refIx = O.getOrElse(MutableHashMap.get(this.footnoteRefCount, key), () => 0) + 1;
    MutableHashMap.set(this.footnoteRefCount, key, refIx);

    const escId = escapeXml(normalizeUri(definition.identifier));
    this.lit(`<sup class="footnote-ref"><a href="#fn-${escId}" id="fnref-${escId}`);
    if (refIx > 1) {
      this.lit(`-${refIx}`);
    }
    this.lit(`" data-footnote-ref>${index}</a></sup>`);
  }

  private renderFootnoteSection(): void {
    if (this.footnoteOrder.length === 0) {
      return;
    }
    // decision: html-writer-departures-from-commonmark-js
    this.cr();
    this.lit('<section class="footnotes" data-footnotes>');
    this.cr();
    this.lit("<ol>");
    this.cr();
    for (const definition of this.footnoteOrder) {
      this.footnoteDefinitionItem(definition);
    }
    this.lit("</ol>");
    this.cr();
    this.lit("</section>");
    this.cr();
  }

  private footnoteDefinitionItem(node: FootnoteDefinition): void {
    const escId = escapeXml(normalizeUri(node.identifier));
    this.cr();
    this.tag("li", [["id", `fn-${escId}`]]);
    this.cr();

    const backrefHtml = this.buildFootnoteBackref(node, escId);
    const last = A.last(node.children);
    const backrefParagraph = O.filter(last, (child): child is Paragraph => child.type === "paragraph");
    const leading = O.isSome(backrefParagraph) ? A.dropRight(node.children, 1) : node.children;
    this.renderFlow(leading);
    O.match(backrefParagraph, {
      onNone: () => {
        this.lit(backrefHtml);
        this.cr();
      },
      onSome: (paragraph) => this.footnoteParagraph(paragraph, backrefHtml),
    });

    this.tag("/li");
    this.cr();
  }

  private footnoteParagraph(node: Paragraph, backrefHtml: string): void {
    this.cr();
    this.tag("p");
    this.renderPhrasing(node.children);
    this.lit(" ");
    this.lit(backrefHtml);
    this.tag("/p");
    this.cr();
  }

  /** Ported from cmark-gfm's `S_put_footnote_backref` (src/html.c). */
  private buildFootnoteBackref(node: FootnoteDefinition, escId: string): string {
    const key = normalizeLabel(node.identifier);
    const index = O.getOrUndefined(MutableHashMap.get(this.footnoteIndex, key));
    const useCount = O.getOrElse(MutableHashMap.get(this.footnoteRefCount, key), () => 0);

    const first = `<a href="#fnref-${escId}" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${index}" aria-label="Back to reference ${index}">↩</a>`;
    const repeat = (useIndex: number): string =>
      ` <a href="#fnref-${escId}-${useIndex}" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${index}-${useIndex}" aria-label="Back to reference ${index}-${useIndex}">↩<sup class="footnote-ref">${useIndex}</sup></a>`;
    return useCount < 2 ? first : first + A.join(A.map(A.range(2, useCount), repeat), "");
  }
}

const LANGUAGE_PREFIX = /^language-/;

const languageClass = (escapedLang: string): string =>
  LANGUAGE_PREFIX.test(escapedLang) ? escapedLang : `language-${escapedLang}`;

const titleAttr = (title: string | undefined): ReadonlyArray<Attr> =>
  title !== undefined && title !== "" ? [["title", escapeXml(title)]] : [];

/**
 * Renders a document to spec-conventional HTML, the form the CommonMark and
 * GFM conformance corpora expect. Compare results with {@link normalizeHtml},
 * never directly — the corpus's expected output differs from this writer's
 * in insignificant whitespace.
 *
 * Reference nodes are resolved here, against the {@link Definition} and
 * {@link FootnoteDefinition} nodes found anywhere in the tree, because the
 * parser emits them unresolved.
 *
 * `options.gfm` renders under the `gfm` dialect: it applies the tagfilter to
 * raw `Html` node values. It defaults to `false` (plain CommonMark rendering,
 * matching the `commonmark` dialect's conformance corpus) and is purely an
 * output-time decision — the parse tree is identical either way.
 */
export const renderHtml: {
  (root: Root, options?: { readonly gfm?: boolean }): string;
  (options?: { readonly gfm?: boolean }): (root: Root) => string;
} = dual(
  (args) => hasProperty(args[0], "type"),
  (root: Root, options?: { readonly gfm?: boolean }): string => new HtmlWriter(root, options?.gfm ?? false).render(root)
);
