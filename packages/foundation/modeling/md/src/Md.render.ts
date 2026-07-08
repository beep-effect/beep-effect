/**
 * Markdown AST render adapters.
 *
 * @packageDocumentation \@beep/md/Md.render
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity";
import { HtmlFragment, Markdown, TaggedErrorClass } from "@beep/schema";
import { A, Html, R, Str, thunkEmptyStr } from "@beep/utils";
import { Effect, flow, identity, Match, Number as N, Order, Result, SchemaGetter, SchemaIssue } from "effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { renderPlainTextBlocks, segmentInlineRuns } from "./Md.behavior.ts";
import {
  BrowserSafeUrlPolicy,
  CompatUrlPolicy,
  escapeHtmlUrlAttribute,
  escapeMarkdownDestinationWithPolicy,
  escapeMarkdownText,
  joinBlocks,
  prefixLines,
  renderFencedCode,
  renderInlineCode,
  sanitizeUrlDestinationWithPolicy,
} from "./Md.escape.ts";
import { Document as DocumentSchema, HeadingLevel, Inline as InlineSchema, TableCell, TableRow } from "./Md.model.ts";
import type { UrlPolicy } from "./Md.escape.ts";
import type {
  Block,
  Document,
  Heading,
  Inline,
  Li,
  ListItemChild,
  Table,
  TableAlignment,
  TaskItem,
} from "./Md.model.ts";

const $I = $MdId.create("Md.render");
const joinEmpty = A.join("");
const lineSeparatorPattern = /\r\n?|\n/;
const lineSeparatorGlobalPattern = /\r\n?|\n/g;
const markdownTitleEscapePattern = /["\\]/g;
const jsonStringEscapePattern = /["\\\u0000-\u001f]/g;
const mathFencePattern = /\$\$/g;
const mathDelimiterPattern = /\$/g;

type JsonRecord = Readonly<Record<string, S.Json>>;

const byRecordEntryKeyAscending = <Value>(): Order.Order<readonly [string, Value]> =>
  Order.mapInput(Order.String, ([key]) => key);

const jsonControlEscape = (value: string): string => {
  const hex = value.charCodeAt(0).toString(16).padStart(4, "0");
  return `\\u${hex}`;
};

const escapeJsonCharacter = (value: string): string =>
  Match.value(value).pipe(
    Match.when('"', () => '\\"'),
    Match.when("\\", () => "\\\\"),
    Match.when("\b", () => "\\b"),
    Match.when("\f", () => "\\f"),
    Match.when("\n", () => "\\n"),
    Match.when("\r", () => "\\r"),
    Match.when("\t", () => "\\t"),
    Match.orElse(jsonControlEscape)
  );

const renderJsonString = (value: string): string =>
  `"${pipe(value, Str.replaceAllWith(jsonStringEscapePattern, escapeJsonCharacter))}"`;

const isJsonArray = (value: S.Json): value is ReadonlyArray<S.Json> => A.isArray(value);

const isJsonRecord = (value: S.Json): value is JsonRecord => P.isObject(value) && !P.isNull(value) && !A.isArray(value);

const renderJson = (value: S.Json): string =>
  Match.value(value).pipe(
    Match.when(P.isNull, () => "null"),
    Match.when(P.isString, renderJsonString),
    Match.when(P.isNumber, (number) => `${number}`),
    Match.when(P.isBoolean, (boolean) => (boolean ? "true" : "false")),
    Match.when(isJsonArray, (array) => `[${pipe(array, A.map(renderJson), A.join(","))}]`),
    Match.when(isJsonRecord, (record) =>
      pipe(
        record,
        R.toEntries,
        A.sort(byRecordEntryKeyAscending()),
        A.map(([key, item]) => `${renderJsonString(key)}:${renderJson(item)}`),
        A.join(","),
        (body) => `{${body}}`
      )
    ),
    Match.exhaustive
  );

const renderJsonFrontmatter = (frontmatter: O.Option<JsonRecord>): string =>
  pipe(
    frontmatter,
    O.filter((metadata) => A.isReadonlyArrayNonEmpty(R.toEntries(metadata))),
    O.map((metadata) => `---json\n${renderJson(metadata)}\n---`),
    O.getOrElse(thunkEmptyStr)
  );

/**
 * Error raised when a render adapter fails while producing output.
 *
 * @example
 * ```ts
 * import { RenderError } from "@beep/md/Md.render"
 *
 * const error = RenderError.make({
 *   adapter: "markdown",
 *   message: "Render adapter markdown failed.",
 *   cause: "boom"
 * })
 * console.log(error._tag) // "RenderError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class RenderError extends TaggedErrorClass<RenderError>($I`RenderError`)(
  "RenderError",
  {
    adapter: S.String,
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("RenderError", {
    description: "Typed error raised when a Markdown render adapter fails.",
  })
) {}

/**
 * Pure render adapter contract for synchronous output formats.
 *
 * @example
 * ```ts
 * import type { PureRenderAdapter } from "@beep/md/Md.render"
 *
 * const adapter: PureRenderAdapter<string> = {
 *   name: "noop",
 *   render: (document) => document._tag
 * }
 * console.log(adapter)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PureRenderAdapter<Output> {
  readonly name: string;
  readonly render: (document: Document) => Output;
}

/**
 * Effectful render adapter contract for resourceful output formats.
 *
 * Future PDF and DOCX adapters can use this shape when rendering needs fonts,
 * files, streams, or other services.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import type { EffectRenderAdapter } from "@beep/md/Md.render"
 *
 * const adapter: EffectRenderAdapter<Uint8Array> = {
 *   name: "bytes",
 *   render: () => Effect.succeed(new Uint8Array())
 * }
 * console.log(adapter)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EffectRenderAdapter<Output, Error = never, Requirements = never> {
  readonly name: string;
  readonly render: (document: Document) => Effect.Effect<Output, Error, Requirements>;
}

const renderMarkdownInlines: (children: ReadonlyArray<Inline>) => string = flow(A.map(renderMarkdownInline), joinEmpty);

const renderMarkdownLinkLabelInlines: (children: ReadonlyArray<Inline>) => string = flow(
  A.map(renderMarkdownInlineForLinkLabel),
  joinEmpty
);

const renderHtmlInlines: (children: ReadonlyArray<Inline>) => string = flow(A.map(renderHtmlInline), joinEmpty);

const renderMarkdownListItemChildren: (children: ReadonlyArray<ListItemChild>) => string = flow(
  (items: ReadonlyArray<ListItemChild>) =>
    segmentInlineRuns(items, {
      isInline: InlineSchema.is,
      renderInlineRun: renderMarkdownInlines,
      renderBlock: renderMarkdownBlock,
    }),
  A.join("\n")
);

const renderMarkdownListItem = (item: Li): string => renderMarkdownListItemChildren(item.children);

const renderHtmlListItemChildren: (children: ReadonlyArray<ListItemChild>) => string = flow(
  (items: ReadonlyArray<ListItemChild>) =>
    segmentInlineRuns(items, {
      isInline: InlineSchema.is,
      renderInlineRun: renderHtmlInlines,
      renderBlock: renderHtmlBlock,
    }),
  joinEmpty
);

const renderHtmlListItem = (item: Li): string => `<li>${renderHtmlListItemChildren(item.children)}</li>`;

const renderHtmlTaskItem = (item: TaskItem): string => {
  const checked = item.checked ? " checked" : "";

  return `<li><input type="checkbox" disabled${checked} /> ${renderHtmlListItemChildren(item.children)}</li>`;
};

const renderMarkdownTableCell = (cell: TableCell): string =>
  pipe(
    renderMarkdownInlines(cell.children),
    Str.replace(/\|/g, "\\|"),
    Str.replace(lineSeparatorGlobalPattern, "<br/>")
  );

const renderMarkdownTableFence = (cells: string): string => `| ${cells} |`;

const escapeMarkdownTitle = flow(
  Str.replace(lineSeparatorGlobalPattern, " "),
  Str.replace(markdownTitleEscapePattern, "\\$&")
);

const renderMarkdownTitle = (title: O.Option<string>): string =>
  pipe(
    title,
    O.map((value) => ` "${escapeMarkdownTitle(value)}"`),
    O.getOrElse(thunkEmptyStr)
  );

const renderMarkdownDestinationWithTitle = (destination: string, title: O.Option<string>, policy: UrlPolicy): string =>
  `${escapeMarkdownDestinationWithPolicy(destination, policy)}${renderMarkdownTitle(title)}`;

const tableAlignmentAt = (align: ReadonlyArray<TableAlignment>, index: number): TableAlignment =>
  pipe(
    A.get(align, index),
    O.getOrElse(() => "none" as const)
  );

const tableRowColumnCount = (row: TableRow): number => A.length(row.children);

const tableColumnCount: (rows: ReadonlyArray<TableRow>) => number = A.reduce(0, (max, row) =>
  N.max(max, tableRowColumnCount(row))
);

const markdownTableSeparatorCell = (align: TableAlignment): string =>
  Match.value(align).pipe(
    Match.when("left", () => ":---"),
    Match.when("center", () => ":---:"),
    Match.when("right", () => "---:"),
    Match.orElse(() => "---")
  );

const renderMarkdownTableSeparator = (columns: number, align: ReadonlyArray<TableAlignment>): string =>
  pipe(
    A.makeBy(columns, (index) => markdownTableSeparatorCell(tableAlignmentAt(align, index))),
    A.join(" | "),
    renderMarkdownTableFence
  );

const emptyTableCell = (): TableCell => TableCell.make({ children: [] });

const padTableRow =
  (columns: number) =>
  (row: TableRow): TableRow => {
    const missing = columns - tableRowColumnCount(row);

    return missing > 0 ? TableRow.make({ children: [...row.children, ...A.makeBy(missing, emptyTableCell)] }) : row;
  };

const renderMarkdownTableRow = (row: TableRow): string =>
  pipe(row.children, A.map(renderMarkdownTableCell), A.join(" | "), renderMarkdownTableFence);

const renderMarkdownTable = (block: Table): string => {
  const columns = tableColumnCount(block.children);
  if (columns === 0) {
    return "";
  }

  const paddedRows = A.map(block.children, padTableRow(columns));

  if (block.headerRow) {
    return pipe(paddedRows, A.map(renderMarkdownTableRow), ([header, ...body]) =>
      A.join([header, renderMarkdownTableSeparator(columns, block.align), ...body], "\n")
    );
  }

  const emptyHeader = renderMarkdownTableRow(
    TableRow.make({
      children: A.makeBy(columns, () => TableCell.make({ children: [] })),
    })
  );

  return pipe(paddedRows, A.map(renderMarkdownTableRow), (rows) =>
    A.join([emptyHeader, renderMarkdownTableSeparator(columns, block.align), ...rows], "\n")
  );
};

const renderHtmlTableCell =
  (tag: "td" | "th", align: TableAlignment) =>
  (cell: TableCell): string => {
    const style = align === "none" ? "" : ` style="text-align:${align}"`;

    return `<${tag}${style}>${renderHtmlInlines(cell.children)}</${tag}>`;
  };

const renderHtmlTableRow =
  (tag: "td" | "th", align: ReadonlyArray<TableAlignment>) =>
  (row: TableRow): string =>
    `<tr>${pipe(
      row.children,
      A.map((cell, index) => renderHtmlTableCell(tag, tableAlignmentAt(align, index))(cell)),
      joinEmpty
    )}</tr>`;

const renderHtmlTable = (block: Table): string => {
  if (block.headerRow) {
    const header = pipe(block.children, A.head, O.map(renderHtmlTableRow("th", block.align)));
    const body = pipe(block.children, A.drop(1), A.map(renderHtmlTableRow("td", block.align)), joinEmpty);

    return `<table>${pipe(
      header,
      O.map((row) => `<thead>${row}</thead>`),
      O.getOrElse(thunkEmptyStr)
    )}<tbody>${body}</tbody></table>`;
  }

  return `<table><tbody>${pipe(block.children, A.map(renderHtmlTableRow("td", block.align)), joinEmpty)}</tbody></table>`;
};

const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
const youtubeEmbedUrl = (videoId: string): string => `https://www.youtube-nocookie.com/embed/${videoId}`;

// Built-in adapters keep `rawHtml` escaped by default; trusted passthrough is a custom-adapter concern.
const renderEscapedRawHtmlAsMarkdown = ({ value }: { readonly value: string }): string => escapeMarkdownText(value);
const renderEscapedRawHtmlAsHtml = ({ value }: { readonly value: string }): string => Html.escapeHtml(value);

const renderMarkdownHeading = (block: Heading): string =>
  `${pipe("#", Str.repeat(block.level))} ${renderMarkdownInlines(block.children)}`;

const renderHtmlHeading = (block: Heading): string => {
  const tag = S.is(HeadingLevel)(block.level) ? `h${block.level}` : "h6";
  return `<${tag}>${renderHtmlInlines(block.children)}</${tag}>`;
};

const escapeInlineMath = flow(Str.replace(lineSeparatorGlobalPattern, " "), Str.replace(mathDelimiterPattern, "\\$"));

const escapeBlockMath = Str.replace(mathFencePattern, "\\$\\$");

const renderMarkdownMathBlock = (block: { readonly value: string }): string =>
  `$$\n${escapeBlockMath(block.value)}\n$$`;

const renderMarkdownFootnoteDefinition = (block: {
  readonly identifier: string;
  readonly children: ReadonlyArray<Block>;
}): string => {
  const body = renderMarkdownBlocks(block.children);

  return Str.isEmpty(body)
    ? `[^${block.identifier}]:`
    : `[^${block.identifier}]: ${indentContinuationLines(body, "    ")}`;
};

const renderMarkdownAdmonition = (block: {
  readonly kind: string;
  readonly title: O.Option<string>;
  readonly children: ReadonlyArray<Block>;
}): string => {
  const title = pipe(
    block.title,
    O.map((value) => ` ${escapeMarkdownText(value)}`),
    O.getOrElse(thunkEmptyStr)
  );
  const header = `> [!${Str.toUpperCase(block.kind)}]${title}`;
  const body = renderMarkdownBlocks(block.children);

  return Str.isEmpty(body) ? header : `${header}\n${prefixLines(body, "> ")}`;
};

const embedTitle = (block: { readonly src: string; readonly title: O.Option<string> }): string =>
  pipe(
    block.title,
    O.getOrElse(() => block.src)
  );

const embedDescriptionMarkdown = (description: O.Option<string>): string =>
  pipe(
    description,
    O.map((value) => `\n\n${escapeMarkdownText(value)}`),
    O.getOrElse(thunkEmptyStr)
  );

const renderMarkdownEmbed = (block: {
  readonly kind: string;
  readonly src: string;
  readonly title: O.Option<string>;
  readonly description: O.Option<string>;
}): string => {
  const title = embedTitle(block);
  const destination = renderMarkdownDestinationWithTitle(block.src, block.title, CompatUrlPolicy);
  const rendered = Match.value(block.kind).pipe(
    Match.when("image", () => `![${escapeMarkdownText(title)}](${destination})`),
    Match.orElse(() => `[${escapeMarkdownText(title)}](${destination})`)
  );

  return `${rendered}${embedDescriptionMarkdown(block.description)}`;
};

const renderHtmlFootnoteDefinition = (block: {
  readonly identifier: string;
  readonly children: ReadonlyArray<Block>;
}): string =>
  `<section id="fn-${Html.escapeHtml(block.identifier)}" class="footnote-definition"><sup>${Html.escapeHtml(block.identifier)}</sup>${renderHtmlBlocks(block.children)}</section>`;

const renderHtmlAdmonition = (block: {
  readonly kind: string;
  readonly title: O.Option<string>;
  readonly children: ReadonlyArray<Block>;
}): string => {
  const title = pipe(
    block.title,
    O.map((value) => `<p class="admonition-title">${Html.escapeHtml(value)}</p>`),
    O.getOrElse(thunkEmptyStr)
  );

  return `<aside class="admonition admonition-${Html.escapeHtml(block.kind)}">${title}${renderHtmlBlocks(block.children)}</aside>`;
};

const renderHtmlEmbed = (block: {
  readonly kind: string;
  readonly src: string;
  readonly title: O.Option<string>;
  readonly description: O.Option<string>;
}): string => {
  const caption = pipe(
    block.description,
    O.map((value) => `<figcaption>${Html.escapeHtml(value)}</figcaption>`),
    O.getOrElse(thunkEmptyStr)
  );

  return `<figure data-embed-kind="${Html.escapeHtml(block.kind)}"><a href="${escapeHtmlUrlAttribute(block.src)}">${Html.escapeHtml(embedTitle(block))}</a>${caption}</figure>`;
};

const indentContinuationLines = (text: string, indent: string): string =>
  pipe(
    text,
    Str.split(lineSeparatorPattern),
    A.map((line, index) => (index === 0 ? line : `${indent}${line}`)),
    A.join("\n")
  );

const renderMarkdownMarkedItem: {
  (marker: string, content: string): string;
  (content: string): (marker: string) => string;
} = dual(
  2,
  (marker: string, content: string): string =>
    `${marker}${indentContinuationLines(content, pipe(" ", Str.repeat(Str.length(marker))))}`
);

// Pre.language already carries a validated CodeFenceLanguage (or None), so the
// language reads straight through without re-sanitizing here.
const languageToMarkdown: (language: O.Option<string>) => string = O.getOrElse(thunkEmptyStr);

const languageToHtmlClass = O.match({
  onNone: thunkEmptyStr,
  onSome: flow(Html.escapeHtml, (language) => ` class="language-${language}"`),
});

const causeMessage = (cause: unknown): string =>
  Result.getOrElse(
    Result.try(() =>
      Match.value(cause).pipe(
        Match.when(P.isError, (error) => error.message),
        Match.when(P.isSymbol, (symbol) => globalThis.String(symbol)),
        Match.orElse((value) => `${value}`)
      )
    ),
    () => "Cannot render thrown value."
  );

const toRenderError =
  (adapter: string) =>
  (cause: unknown): RenderError =>
    RenderError.make({
      adapter,
      message: `Render adapter ${adapter} failed. ${causeMessage(cause)}`,
      cause,
    });

const adapterName = (adapter: { readonly name: string }): string =>
  Result.getOrElse(
    Result.try(() => (P.isString(adapter.name) ? adapter.name : "unknown")),
    () => "unknown"
  );

const renderMarkdownDocumentUnsafe = (document: Document): Markdown =>
  joinBlocks([renderJsonFrontmatter(document.frontmatter), renderMarkdownBlocks(document.children)]);

const renderHtmlDocumentUnsafe = (document: Document): HtmlFragment => renderHtmlBlocks(document.children);

// The standalone and link-label Markdown inline matchers differ only in how
// nested inlines recurse and how a trusted `rawMarkdown` leaf is emitted, so a
// single factory parameterizes both.
const makeMarkdownInlineMatcher = (
  renderInlines: (children: ReadonlyArray<Inline>) => string,
  renderRawMarkdown: (node: { readonly value: string }) => string,
  urlPolicy: UrlPolicy
) =>
  Match.type<Inline>().pipe(
    Match.tagsExhaustive({
      text: ({ value }) => escapeMarkdownText(value),
      rawMarkdown: renderRawMarkdown,
      rawHtml: renderEscapedRawHtmlAsMarkdown,
      strong: ({ children }) => `**${renderInlines(children)}**`,
      em: ({ children }) => `*${renderInlines(children)}*`,
      del: ({ children }) => `~~${renderInlines(children)}~~`,
      code: ({ value }) => renderInlineCode(value),
      a: ({ href, children, title }) =>
        `[${renderMarkdownLinkLabelInlines(children)}](${renderMarkdownDestinationWithTitle(href, title, urlPolicy)})`,
      img: ({ src, alt, title }) =>
        `![${escapeMarkdownText(alt)}](${renderMarkdownDestinationWithTitle(src, title, urlPolicy)})`,
      br: () => "<br/>",
      inlineMath: ({ value }) => `$${escapeInlineMath(value)}$`,
      footnoteReference: ({ identifier }) => `[^${identifier}]`,
    })
  );

const renderMarkdownInlineMatcher = makeMarkdownInlineMatcher(
  renderMarkdownInlines,
  ({ value }) => value,
  CompatUrlPolicy
);

const renderMarkdownInlineForLinkLabelMatcher = makeMarkdownInlineMatcher(
  renderMarkdownLinkLabelInlines,
  ({ value }) => escapeMarkdownText(value),
  CompatUrlPolicy
);

function renderMarkdownInlineForLinkLabel(inline: Inline): string {
  return renderMarkdownInlineForLinkLabelMatcher(inline);
}

/**
 * Renders an inline node as Markdown.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderMarkdownInline } from "@beep/md/Md.render"
 *
 * console.log(renderMarkdownInline(Md.strong("beep"))) // "**beep**"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function renderMarkdownInline(inline: Inline): string {
  return renderMarkdownInlineMatcher(inline);
}

const renderHtmlOptionalAttribute = (name: string, value: O.Option<string>): string =>
  pipe(
    value,
    O.map((attributeValue) => ` ${name}="${Html.escapeHtml(attributeValue)}"`),
    O.getOrElse(thunkEmptyStr)
  );

/**
 * Renders an inline node as an HTML fragment.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderHtmlInline } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlInline(Md.em("beep"))) // "<em>beep</em>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const renderHtmlInlineMatcher = Match.type<Inline>().pipe(
  Match.tagsExhaustive({
    text: ({ value }) => Html.escapeHtml(value),
    rawMarkdown: ({ value }) => Html.escapeHtml(value),
    rawHtml: renderEscapedRawHtmlAsHtml,
    strong: ({ children }) => `<strong>${renderHtmlInlines(children)}</strong>`,
    em: ({ children }) => `<em>${renderHtmlInlines(children)}</em>`,
    del: ({ children }) => `<del>${renderHtmlInlines(children)}</del>`,
    code: ({ value }) => `<code>${Html.escapeHtml(value)}</code>`,
    a: ({ href, children, title }) =>
      `<a href="${escapeHtmlUrlAttribute(href)}"${renderHtmlOptionalAttribute("title", title)}>${renderHtmlInlines(children)}</a>`,
    img: ({ src, alt, title }) =>
      `<img src="${escapeHtmlUrlAttribute(src)}" alt="${Html.escapeHtml(alt)}"${renderHtmlOptionalAttribute("title", title)} />`,
    br: () => "<br />",
    inlineMath: ({ value }) => `<span class="math math-inline">${Html.escapeHtml(value)}</span>`,
    footnoteReference: ({ identifier }) =>
      `<sup id="fnref-${Html.escapeHtml(identifier)}"><a href="#fn-${Html.escapeHtml(identifier)}">${Html.escapeHtml(identifier)}</a></sup>`,
  })
);

/**
 * Renders an inline node as an HTML fragment.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderHtmlInline } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlInline(Md.em("beep"))) // "<em>beep</em>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function renderHtmlInline(inline: Inline): string {
  return renderHtmlInlineMatcher(inline);
}

/**
 * Renders a block node as Markdown.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderMarkdownBlock } from "@beep/md/Md.render"
 *
 * console.log(renderMarkdownBlock(Md.h1("Hello"))) // "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderMarkdownBlock: (block: Block) => string = Match.type<Block>().pipe(
  Match.tagsExhaustive({
    heading: renderMarkdownHeading,
    p: (block) => renderMarkdownInlines(block.children),
    blockquote: (block) => pipe(block.children, renderMarkdownBlocks, prefixLines("> ")),
    pre: (block) => renderFencedCode(block.value, languageToMarkdown(block.language)),
    ul: (block) =>
      pipe(
        block.children,
        A.map((item) => renderMarkdownMarkedItem("- ", renderMarkdownListItem(item))),
        A.join("\n")
      ),
    ol: (block) =>
      pipe(
        block.children,
        A.map((item, index) => {
          const marker = `${index + block.start}. `;

          return renderMarkdownMarkedItem(marker, renderMarkdownListItem(item));
        }),
        A.join("\n")
      ),
    taskList: (block) =>
      pipe(
        block.children,
        A.map((item) =>
          renderMarkdownMarkedItem(`- [${item.checked ? "x" : " "}] `, renderMarkdownListItemChildren(item.children))
        ),
        A.join("\n")
      ),
    table: renderMarkdownTable,
    youtube: (block) => youtubeWatchUrl(block.videoId),
    mathBlock: renderMarkdownMathBlock,
    footnoteDefinition: renderMarkdownFootnoteDefinition,
    admonition: renderMarkdownAdmonition,
    embed: renderMarkdownEmbed,
    hr: () => "---",
  })
);

/**
 * Renders a block node as an HTML fragment.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderHtmlBlock } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlBlock(Md.p("Hello"))) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHtmlBlock: (block: Block) => string = Match.type<Block>().pipe(
  Match.tagsExhaustive({
    heading: renderHtmlHeading,
    p: (block) => `<p>${renderHtmlInlines(block.children)}</p>`,
    blockquote: (block) => `<blockquote>${renderHtmlBlocks(block.children)}</blockquote>`,
    pre: (block) => `<pre><code${languageToHtmlClass(block.language)}>${Html.escapeHtml(block.value)}</code></pre>`,
    ul: (block) => `<ul>${pipe(block.children, A.map(renderHtmlListItem), joinEmpty)}</ul>`,
    ol: (block) =>
      `<ol${block.start === 1 ? "" : ` start="${block.start}"`}>${pipe(block.children, A.map(renderHtmlListItem), joinEmpty)}</ol>`,
    taskList: (block) =>
      `<ul class="contains-task-list">${pipe(block.children, A.map(renderHtmlTaskItem), joinEmpty)}</ul>`,
    table: renderHtmlTable,
    youtube: (block) =>
      `<iframe src="${escapeHtmlUrlAttribute(youtubeEmbedUrl(block.videoId))}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
    mathBlock: (block) => `<div class="math math-display">${Html.escapeHtml(block.value)}</div>`,
    footnoteDefinition: renderHtmlFootnoteDefinition,
    admonition: renderHtmlAdmonition,
    embed: renderHtmlEmbed,
    hr: () => "<hr />",
  })
);

/**
 * Renders block nodes as a Markdown document body.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderMarkdownBlocks } from "@beep/md/Md.render"
 *
 * console.log(renderMarkdownBlocks([Md.h1("Hello"), Md.p("World")]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderMarkdownBlocks: (blocks: ReadonlyArray<Block>) => Markdown = flow(
  A.map(renderMarkdownBlock),
  joinBlocks
);

/**
 * Renders block nodes as an HTML fragment body.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderHtmlBlocks } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlBlocks([Md.p("Hello")])) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHtmlBlocks: (blocks: ReadonlyArray<Block>) => HtmlFragment = flow(
  A.map(renderHtmlBlock),
  A.join("\n"),
  HtmlFragment.make
);

/**
 * Renders a document through the Markdown adapter and returns the output directly.
 *
 * Prefer {@link render} when callers should handle adapter failure explicitly.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderUnsafe } from "@beep/md/Md.render"
 *
 * console.log(renderUnsafe(Md.make([Md.h1("Hello")]))) // "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderUnsafe = (document: Document): Markdown => renderWithUnsafe(MarkdownAdapter, document);

/**
 * Renders a document through the HTML fragment adapter and returns the output directly.
 *
 * Prefer {@link renderHtml} when callers should handle adapter failure explicitly.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderHtmlUnsafe } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlUnsafe(Md.make([Md.p("Hello")]))) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHtmlUnsafe = (document: Document): HtmlFragment => renderWithUnsafe(HtmlFragmentAdapter, document);

/**
 * Renders a document through the plain text adapter and returns the output directly.
 *
 * Prefer {@link renderPlainText} when callers should handle adapter failure explicitly.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderPlainTextUnsafe } from "@beep/md/Md.render"
 *
 * console.log(renderPlainTextUnsafe(Md.make([Md.h1("Hello")]))) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainTextUnsafe = (document: Document): string => renderWithUnsafe(PlainTextAdapter, document);

/**
 * Renders a document with a custom pure adapter and returns the output directly.
 *
 * Prefer {@link renderWith} when callers should handle adapter failure explicitly.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter, renderWithUnsafe } from "@beep/md/Md.render"
 *
 * const output = renderWithUnsafe(MarkdownAdapter, Md.make([Md.p("Hello")]))
 * console.log(output) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderWithUnsafe: {
  <Output>(adapter: PureRenderAdapter<Output>, document: Document): Output;
  <Output>(document: Document): (adapter: PureRenderAdapter<Output>) => Output;
} = dual(2, <Output>(adapter: PureRenderAdapter<Output>, document: Document): Output => adapter.render(document));

/**
 * Starts an effectful render adapter and returns its effect directly.
 *
 * Prefer {@link renderEffectWith} when adapter construction failures should be
 * reported as {@link RenderError}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Md } from "@beep/md"
 * import { renderEffectWithUnsafe } from "@beep/md/Md.render"
 *
 * const adapter = {
 *   name: "bytes",
 *   render: () => Effect.succeed(new Uint8Array())
 * }
 * const program = renderEffectWithUnsafe(adapter, Md.make([]))
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderEffectWithUnsafe: {
  <Output, Error, Requirements>(
    adapter: EffectRenderAdapter<Output, Error, Requirements>,
    document: Document
  ): Effect.Effect<Output, Error, Requirements>;
  <Output, Error, Requirements>(
    document: Document
  ): (adapter: EffectRenderAdapter<Output, Error, Requirements>) => Effect.Effect<Output, Error, Requirements>;
} = dual(
  2,
  <Output, Error, Requirements>(
    adapter: EffectRenderAdapter<Output, Error, Requirements>,
    document: Document
  ): Effect.Effect<Output, Error, Requirements> => adapter.render(document)
);

/**
 * Starts an effectful render adapter with synchronous adapter failures captured.
 *
 * Adapter effects keep their original error and requirement channels. Only
 * failures thrown while starting the adapter are wrapped as {@link RenderError}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Md } from "@beep/md"
 * import { renderEffectWith } from "@beep/md/Md.render"
 *
 * const adapter = {
 *   name: "bytes",
 *   render: () => Effect.succeed(new Uint8Array())
 * }
 * const program = renderEffectWith(adapter, Md.make([]))
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderEffectWith: {
  <Output, Error, Requirements>(
    adapter: EffectRenderAdapter<Output, Error, Requirements>,
    document: Document
  ): Effect.Effect<Output, Error | RenderError, Requirements>;
  <Output, Error, Requirements>(
    document: Document
  ): (
    adapter: EffectRenderAdapter<Output, Error, Requirements>
  ) => Effect.Effect<Output, Error | RenderError, Requirements>;
} = dual(
  2,
  <Output, Error, Requirements>(
    adapter: EffectRenderAdapter<Output, Error, Requirements>,
    document: Document
  ): Effect.Effect<Output, Error | RenderError, Requirements> =>
    Effect.fromResult(
      Result.try({
        try: () => renderEffectWithUnsafe(adapter, document),
        catch: toRenderError(adapterName(adapter)),
      })
    ).pipe(Effect.flatMap(identity))
);

/**
 * URL policy options accepted by built-in render adapter factories.
 *
 * @category models
 * @since 0.0.0
 */
export interface UrlRenderOptions {
  /**
   * URL policy applied to URL-bearing AST fields before rendering.
   *
   * @since 0.0.0
   */
  readonly urlPolicy?: UrlPolicy;
}

const renderPolicy = (options: UrlRenderOptions, fallback: UrlPolicy): UrlPolicy =>
  pipe(
    O.fromUndefinedOr(options.urlPolicy),
    O.getOrElse(() => fallback)
  );

const makeSanitizeInlineUrlsMatcher = (policy: UrlPolicy): ((inline: Inline) => Inline) =>
  Match.type<Inline>().pipe(
    Match.tagsExhaustive({
      text: (node) => node,
      rawMarkdown: (node) => node,
      rawHtml: (node) => node,
      strong: (node) => ({ ...node, children: A.map(node.children, sanitizeInlineUrls(policy)) }),
      em: (node) => ({ ...node, children: A.map(node.children, sanitizeInlineUrls(policy)) }),
      del: (node) => ({ ...node, children: A.map(node.children, sanitizeInlineUrls(policy)) }),
      code: (node) => node,
      a: (node) => ({
        ...node,
        href: sanitizeUrlDestinationWithPolicy(node.href, policy),
        children: A.map(node.children, sanitizeInlineUrls(policy)),
      }),
      img: (node) => ({ ...node, src: sanitizeUrlDestinationWithPolicy(node.src, policy) }),
      br: (node) => node,
      inlineMath: (node) => node,
      footnoteReference: (node) => node,
    })
  );

const sanitizeInlineUrls =
  (policy: UrlPolicy): ((inline: Inline) => Inline) =>
  (inline) =>
    makeSanitizeInlineUrlsMatcher(policy)(inline);

const sanitizeListItemChildUrls =
  (policy: UrlPolicy): ((child: ListItemChild) => ListItemChild) =>
  (child) =>
    InlineSchema.is(child) ? sanitizeInlineUrls(policy)(child) : sanitizeBlockUrls(policy)(child);

const sanitizeListItemUrls =
  (policy: UrlPolicy): ((item: Li) => Li) =>
  (item) => ({ ...item, children: A.map(item.children, sanitizeListItemChildUrls(policy)) });

const sanitizeTaskItemUrls =
  (policy: UrlPolicy): ((item: TaskItem) => TaskItem) =>
  (item) => ({ ...item, children: A.map(item.children, sanitizeListItemChildUrls(policy)) });

const sanitizeTableUrls = (policy: UrlPolicy, table: Table): Table => ({
  ...table,
  children: A.map(table.children, (row) => ({
    ...row,
    children: A.map(row.children, (cell) => ({ ...cell, children: A.map(cell.children, sanitizeInlineUrls(policy)) })),
  })),
});

const makeSanitizeBlockUrlsMatcher = (policy: UrlPolicy): ((block: Block) => Block) =>
  Match.type<Block>().pipe(
    Match.tagsExhaustive({
      heading: (node) => ({ ...node, children: A.map(node.children, sanitizeInlineUrls(policy)) }),
      p: (node) => ({ ...node, children: A.map(node.children, sanitizeInlineUrls(policy)) }),
      blockquote: (node) => ({ ...node, children: A.map(node.children, sanitizeBlockUrls(policy)) }),
      pre: (node) => node,
      ul: (node) => ({ ...node, children: A.map(node.children, sanitizeListItemUrls(policy)) }),
      ol: (node) => ({ ...node, children: A.map(node.children, sanitizeListItemUrls(policy)) }),
      taskList: (node) => ({ ...node, children: A.map(node.children, sanitizeTaskItemUrls(policy)) }),
      table: (node) => sanitizeTableUrls(policy, node),
      youtube: (node) => node,
      mathBlock: (node) => node,
      footnoteDefinition: (node) => ({ ...node, children: A.map(node.children, sanitizeBlockUrls(policy)) }),
      admonition: (node) => ({ ...node, children: A.map(node.children, sanitizeBlockUrls(policy)) }),
      embed: (node) => ({ ...node, src: sanitizeUrlDestinationWithPolicy(node.src, policy) }),
      hr: (node) => node,
    })
  );

const sanitizeBlockUrls =
  (policy: UrlPolicy): ((block: Block) => Block) =>
  (block) =>
    makeSanitizeBlockUrlsMatcher(policy)(block);

const sanitizeDocumentUrls = (policy: UrlPolicy, document: Document): Document => ({
  ...document,
  children: A.map(document.children, sanitizeBlockUrls(policy)),
});

const renderMarkdownDocumentWithPolicy = (policy: UrlPolicy, document: Document): Markdown =>
  renderMarkdownDocumentUnsafe(sanitizeDocumentUrls(policy, document));

const renderHtmlDocumentWithPolicy = (policy: UrlPolicy, document: Document): HtmlFragment =>
  renderHtmlDocumentUnsafe(sanitizeDocumentUrls(policy, document));

/**
 * Creates a Markdown render adapter with an optional URL sink policy.
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeMarkdownAdapter = (options: UrlRenderOptions = {}): PureRenderAdapter<Markdown> => {
  const urlPolicy = renderPolicy(options, CompatUrlPolicy);

  return {
    name: "markdown",
    render: (document) => renderMarkdownDocumentWithPolicy(urlPolicy, document),
  };
};

/**
 * Creates an HTML fragment render adapter with an optional URL sink policy.
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeHtmlFragmentAdapter = (options: UrlRenderOptions = {}): PureRenderAdapter<HtmlFragment> => {
  const urlPolicy = renderPolicy(options, BrowserSafeUrlPolicy);

  return {
    name: "html-fragment",
    render: (document) => renderHtmlDocumentWithPolicy(urlPolicy, document),
  };
};

/**
 * Built-in Markdown render adapter.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter } from "@beep/md/Md.render"
 *
 * console.log(MarkdownAdapter.render(Md.make([Md.h1("Hello")]))) // "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const MarkdownAdapter: PureRenderAdapter<Markdown> = {
  ...makeMarkdownAdapter(),
};

/**
 * Built-in HTML fragment render adapter.
 *
 * Note: this adapter escapes `rawHtml` inline nodes by default. Treat trusted
 * HTML pass-through as an explicit custom-adapter boundary.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { HtmlFragmentAdapter } from "@beep/md/Md.render"
 *
 * console.log(HtmlFragmentAdapter.render(Md.make([Md.p("Hello")]))) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const HtmlFragmentAdapter: PureRenderAdapter<HtmlFragment> = {
  ...makeHtmlFragmentAdapter(),
};

/**
 * Built-in plain-text render adapter.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { PlainTextAdapter } from "@beep/md/Md.render"
 *
 * console.log(PlainTextAdapter.render(Md.make([Md.h1("Hello")]))) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const PlainTextAdapter: PureRenderAdapter<string> = {
  name: "plain-text",
  render: (document) => renderPlainTextBlocks(document.children),
};

/**
 * Renders a document with a custom pure adapter.
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderWithUnsafe} only at boundaries that intentionally throw.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter, renderWith } from "@beep/md/Md.render"
 *
 * const output = renderWith(MarkdownAdapter, Md.make([Md.p("Hello")]))
 * console.log(Result.getOrThrow(output)) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderWith: {
  <Output>(adapter: PureRenderAdapter<Output>, document: Document): Result.Result<Output, RenderError>;
  <Output>(document: Document): (adapter: PureRenderAdapter<Output>) => Result.Result<Output, RenderError>;
} = dual(
  2,
  <Output>(adapter: PureRenderAdapter<Output>, document: Document): Result.Result<Output, RenderError> =>
    Result.try({
      try: () => adapter.render(document),
      catch: toRenderError(adapterName(adapter)),
    })
);

/**
 * Renders a document through the Markdown adapter.
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderUnsafe} only at boundaries that intentionally throw.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { render } from "@beep/md/Md.render"
 *
 * const output = render(Md.make([Md.h1("Hello")]))
 * console.log(Result.getOrThrow(output)) // "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const render = (document: Document): Result.Result<Markdown, RenderError> =>
  renderWith(MarkdownAdapter, document);

/**
 * Renders a document through the HTML fragment adapter.
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderHtmlUnsafe} only at boundaries that intentionally throw.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { renderHtml } from "@beep/md/Md.render"
 *
 * const output = renderHtml(Md.make([Md.p("Hello")]))
 * console.log(Result.getOrThrow(output)) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHtml = (document: Document): Result.Result<HtmlFragment, RenderError> =>
  renderWith(HtmlFragmentAdapter, document);

/**
 * Renders a document through the plain text adapter.
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderPlainTextUnsafe} only at boundaries that intentionally throw.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { renderPlainText } from "@beep/md/Md.render"
 *
 * const output = renderPlainText(Md.make([Md.h1("Hello")]))
 * console.log(Result.getOrThrow(output)) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainText = (document: Document): Result.Result<string, RenderError> =>
  renderWith(PlainTextAdapter, document);

const encodeUnsupported =
  <Output>(name: string) =>
  (value: unknown): Effect.Effect<Output, SchemaIssue.Issue> =>
    Effect.fail(
      new SchemaIssue.InvalidValue(O.some(value), {
        message: `Encoding ${name} output back into a Markdown document AST is not supported.`,
      })
    );

/**
 * Schema transformation from a document AST to branded Markdown text.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Md } from "@beep/md"
 * import { DocumentToMarkdown } from "@beep/md/Md.render"
 *
 * const program = S.decodeUnknownEffect(DocumentToMarkdown)(Md.make([Md.h1("Hello")]))
 * console.log(Effect.runSync(program)) // "# Hello"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DocumentToMarkdown = DocumentSchema.pipe(
  S.decodeTo(Markdown, {
    decode: SchemaGetter.transform(renderMarkdownDocumentUnsafe),
    encode: SchemaGetter.transformOrFail(encodeUnsupported<Document>("Markdown")),
  }),
  $I.annoteSchema("DocumentToMarkdown", {
    description: "Schema transformation from a document AST to branded Markdown text.",
  })
);

/**
 * Type for {@link DocumentToMarkdown}.
 *
 * @example
 * ```ts
 * import type { DocumentToMarkdown } from "@beep/md/Md.render"
 *
 * const acceptMarkdown = (value: DocumentToMarkdown) => value
 * console.log(acceptMarkdown)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToMarkdown = typeof DocumentToMarkdown.Type;

/**
 * Schema transformation from a document AST to a branded HTML fragment.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Md } from "@beep/md"
 * import { DocumentToHtmlFragment } from "@beep/md/Md.render"
 *
 * const program = S.decodeUnknownEffect(DocumentToHtmlFragment)(Md.make([Md.p("Hello")]))
 * console.log(Effect.runSync(program)) // "<p>Hello</p>"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DocumentToHtmlFragment = DocumentSchema.pipe(
  S.decodeTo(HtmlFragment, {
    decode: SchemaGetter.transform(renderHtmlDocumentUnsafe),
    encode: SchemaGetter.transformOrFail(encodeUnsupported<Document>("HTML fragment")),
  }),
  $I.annoteSchema("DocumentToHtmlFragment", {
    description: "Schema transformation from a document AST to a branded HTML fragment.",
  })
);

/**
 * Schema transformation from a document AST to plain text.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Md } from "@beep/md"
 * import { DocumentToPlainText } from "@beep/md/Md.render"
 *
 * const program = S.decodeUnknownEffect(DocumentToPlainText)(Md.make([Md.h1("Hello")]))
 * console.log(Effect.runSync(program)) // "Hello"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DocumentToPlainText = DocumentSchema.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transform((document: Document) => renderPlainTextBlocks(document.children)),
    encode: SchemaGetter.transformOrFail(encodeUnsupported<Document>("plain text")),
  }),
  $I.annoteSchema("DocumentToPlainText", {
    description: "Schema transformation from a document AST to plain text.",
  })
);

/**
 * Type for {@link DocumentToPlainText}.
 *
 * @example
 * ```ts
 * import type { DocumentToPlainText } from "@beep/md/Md.render"
 *
 * const acceptPlainText = (value: DocumentToPlainText) => value
 * console.log(acceptPlainText)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToPlainText = typeof DocumentToPlainText.Type;

/**
 * Type for {@link DocumentToHtmlFragment}.
 *
 * @example
 * ```ts
 * import type { DocumentToHtmlFragment } from "@beep/md/Md.render"
 *
 * const acceptHtml = (value: DocumentToHtmlFragment) => value
 * console.log(acceptHtml)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentToHtmlFragment = typeof DocumentToHtmlFragment.Type;
