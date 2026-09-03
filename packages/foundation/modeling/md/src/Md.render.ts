/**
 * Markdown AST render adapters.
 *
 * @packageDocumentation \@beep/md/Md.render
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity";
import { Defect, HtmlFragment } from "@beep/schema";
import { A, Html, R, thunkEmptyStr } from "@beep/utils";
import { replaceAllWith } from "@beep/utils/Str";
import { Effect, flow, identity, Match, Number as N, Order, Result, Tuple } from "effect";
import { cast, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { segmentInlineRuns } from "./Md.behavior.ts";
import {
  BrowserSafeUrlPolicySpec,
  CompatibilityUrlPolicySpec,
  escapeHtmlUrlAttribute,
  escapeHtmlUrlAttributeWithPolicy,
  escapeMarkdownDestinationWithPolicy,
  escapeMarkdownText,
  isUrlDestinationAllowedWithPolicy,
  joinBlocks,
  prefixLines,
  renderFencedCode,
  renderInlineCode,
  UrlPolicySpec,
} from "./Md.escape.ts";
import {
  Block as BlockSchema,
  HeadingValue,
  Inline as InlineSchema,
  TableAlignment,
  TableCell,
  TableRow,
} from "./Md.model.ts";
import type { Markdown } from "@beep/schema";
import type { Block, Document, Heading, Inline, Li, ListItemChild, Table, TaskItem } from "./Md.model.ts";

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
  Order.mapInput(Order.String, Tuple.get(0));

const jsonControlEscape: (value: string) => string = flow(
  Str.charCodeAt(0),
  O.map(
    flow(
      (code) => code.toString(16),
      Str.padStart(4, "0"),
      (hex) => `\\u${hex}`
    )
  ),
  O.getOrElse(thunkEmptyStr)
);

const escapeJsonCharacter = Match.type<string>().pipe(
  Match.withReturnType<string>(),
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
  `"${pipe(value, replaceAllWith(jsonStringEscapePattern, escapeJsonCharacter))}"`;

const isJsonArray = (value: S.Json): value is ReadonlyArray<S.Json> => A.isArray(value);

const isJsonRecord = (value: S.Json): value is JsonRecord => P.isObject(value) && !P.isNull(value) && !A.isArray(value);

const renderJsonRecord: (record: JsonRecord) => string = flow(
  R.toEntries,
  A.sort(byRecordEntryKeyAscending<S.Json>()),
  A.map(([key, item]) => `${renderJsonString(key)}:${renderJson(item)}`),
  A.join(","),
  (body) => `{${body}}`
);

const renderJson = (value: S.Json): string =>
  Match.value(value).pipe(
    Match.when(P.isNull, () => "null"),
    Match.when(P.isString, renderJsonString),
    Match.when(P.isNumber, (number) => `${number}`),
    Match.when(P.isBoolean, (boolean) => (boolean ? "true" : "false")),
    Match.when(isJsonArray, (array) => `[${pipe(array, A.map(renderJson), A.join(","))}]`),
    Match.when(isJsonRecord, renderJsonRecord),
    Match.exhaustive
  );

const renderJsonFrontmatter: (frontmatter: O.Option<JsonRecord>) => string = flow(
  O.filter((metadata) => A.isReadonlyArrayNonEmpty(R.toEntries(metadata))),
  O.map((metadata) => `---json\n${renderJson(metadata)}\n---`),
  O.getOrElse(thunkEmptyStr)
);

/**
 * Error raised when a render adapter fails while producing output.
 *
 * **Example** (Constructing a RenderError)
 *
 * ```ts import.meta.vitest name="Constructing a RenderError"
 * import { RenderError } from "@beep/md/Md.render"
 *
 * const error = RenderError.make({
 *   adapter: "markdown",
 *   message: "Render adapter markdown failed.",
 *   cause: "boom"
 * })
 * error._tag // => "RenderError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class RenderError extends S.TaggedError<RenderError>($I`RenderError`)(
  "RenderError",
  {
    adapter: S.String,
    message: S.String,
    cause: Defect({ includeStack: true }),
  },
  $I.annoteError<RenderError>("RenderError", {
    description: "Typed error raised when a Markdown render adapter fails.",
  })
) {}

/**
 * Pure render adapter contract for synchronous output formats.
 *
 * **Example** (Defining a pure adapter)
 *
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
 * **Details**
 *
 * Future PDF and DOCX adapters can use this shape when rendering needs fonts,
 * files, streams, or other services.
 *
 * **Example** (Defining an effectful adapter)
 *
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

const renderMarkdownTitle: (title: O.Option<string>) => string = flow(
  O.map((value) => ` "${escapeMarkdownTitle(value)}"`),
  O.getOrElse(thunkEmptyStr)
);

const renderMarkdownDestinationWithTitle = (
  destination: string,
  title: O.Option<string>,
  policy: UrlPolicySpec
): string => `${escapeMarkdownDestinationWithPolicy(destination, policy)}${renderMarkdownTitle(title)}`;

const tableAlignmentAt = (align: ReadonlyArray<TableAlignment>, index: number): TableAlignment =>
  pipe(A.get(align, index), O.getOrElse(TableAlignment.thunk.none));

const tableRowColumnCount = (row: TableRow): number => A.length(row.children);

const tableColumnCount: (rows: ReadonlyArray<TableRow>) => number = A.reduce(0, (max, row) =>
  N.max(max, tableRowColumnCount(row))
);

const markdownTableSeparatorCell = TableAlignment.$match({
  left: () => ":---",
  center: () => ":---:",
  right: () => "---:",
  none: () => "---",
});

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

const renderHtmlTableRows = (block: Table, renderRow: (tag: "td" | "th") => (row: TableRow) => string): string => {
  if (block.headerRow) {
    const header = pipe(block.children, A.head, O.map(renderRow("th")));
    const body = pipe(block.children, A.drop(1), A.map(renderRow("td")), joinEmpty);

    return `<table>${pipe(
      header,
      O.map((row) => `<thead>${row}</thead>`),
      O.getOrElse(thunkEmptyStr)
    )}<tbody>${body}</tbody></table>`;
  }

  return `<table><tbody>${pipe(block.children, A.map(renderRow("td")), joinEmpty)}</tbody></table>`;
};

const renderHtmlTable = (block: Table): string =>
  renderHtmlTableRows(block, (tag) => renderHtmlTableRow(tag, block.align));

const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
const youtubeEmbedUrl = (videoId: string): string => `https://www.youtube-nocookie.com/embed/${videoId}`;

// Built-in adapters keep `rawHtml` escaped by default; trusted passthrough is a custom-adapter concern.
const renderEscapedRawHtmlAsMarkdown = ({ value }: { readonly value: string }): string => escapeMarkdownText(value);
const renderEscapedRawHtmlAsHtml = ({ value }: { readonly value: string }): string => Html.escapeHtml(value);

const renderMarkdownHeading = (block: Heading): string =>
  `${pipe("#", Str.repeat(block.level))} ${renderMarkdownInlines(block.children)}`;

const isHeadingValue = S.is(HeadingValue);

const headingTag: (block: Heading) => string = Match.type<Heading>().pipe(
  Match.when(isHeadingValue, (heading) =>
    HeadingValue.match(heading, {
      1: () => "h1",
      2: () => "h2",
      3: () => "h3",
      4: () => "h4",
      5: () => "h5",
      6: () => "h6",
    })
  ),
  Match.orElse(() => "h6")
);

const renderHtmlHeading = (block: Heading): string => {
  const tag = headingTag(block);
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

const embedDescriptionMarkdown: (description: O.Option<string>) => string = flow(
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
  const destination = renderMarkdownDestinationWithTitle(block.src, block.title, CompatibilityUrlPolicySpec);
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

// The standalone and link-label Markdown inline matchers differ only in how
// nested inlines recurse and how a trusted `rawMarkdown` leaf is emitted, so a
// single factory parameterizes both.
const makeMarkdownInlineMatcher = (
  renderInlines: (children: ReadonlyArray<Inline>) => string,
  renderRawMarkdown: (node: { readonly value: string }) => string,
  urlPolicy: UrlPolicySpec
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
  CompatibilityUrlPolicySpec
);

const renderMarkdownInlineForLinkLabelMatcher = makeMarkdownInlineMatcher(
  renderMarkdownLinkLabelInlines,
  ({ value }) => escapeMarkdownText(value),
  CompatibilityUrlPolicySpec
);

function renderMarkdownInlineForLinkLabel(inline: Inline): string {
  return renderMarkdownInlineForLinkLabelMatcher(inline);
}

/**
 * Renders an inline node as Markdown.
 *
 * **Example** (Rendering strong as Markdown)
 *
 * ```ts import.meta.vitest name="Rendering strong as Markdown"
 * import { Md } from "@beep/md"
 * import { renderMarkdownInline } from "@beep/md/Md.render"
 *
 * renderMarkdownInline(Md.strong("beep")) // => "**beep**"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function renderMarkdownInline(inline: Inline): string {
  return renderMarkdownInlineMatcher(inline);
}

const renderHtmlOptionalAttribute: {
  (name: string, value: O.Option<string>): string;
  (value: O.Option<string>): (name: string) => string;
} = dual(2, (name: string, value: O.Option<string>): string =>
  O.map(value, (attributeValue) => ` ${name}="${Html.escapeHtml(attributeValue)}"`).pipe(O.getOrElse(thunkEmptyStr))
);

/**
 * Renders an inline node as an HTML fragment.
 *
 * **Example** (Rendering emphasis as HTML)
 *
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
 * **Example** (Rendering emphasis as HTML)
 *
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
 * **Example** (Rendering heading as Markdown)
 *
 * ```ts import.meta.vitest name="Rendering heading as Markdown"
 * import { Md } from "@beep/md"
 * import { renderMarkdownBlock } from "@beep/md/Md.render"
 *
 * renderMarkdownBlock(Md.h1("Hello")) // => "# Hello"
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
 * **Example** (Rendering paragraph as HTML)
 *
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
 * **Example** (Rendering multiple Markdown blocks)
 *
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
 * **Example** (Rendering multiple HTML blocks)
 *
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
 * **Details**
 *
 * Prefer {@link render} when callers should handle adapter failure explicitly.
 *
 * **Example** (Rendering Markdown unsafely)
 *
 * ```ts import.meta.vitest name="Rendering Markdown unsafely"
 * import { Md } from "@beep/md"
 * import { renderUnsafe } from "@beep/md/Md.render"
 *
 * renderUnsafe(Md.make([Md.h1("Hello")])) // => "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderUnsafe = (document: Document): Markdown => renderWithUnsafe(MarkdownAdapter, document);

/**
 * Renders a document through the HTML fragment adapter and returns the output directly.
 *
 * **Details**
 *
 * Prefer {@link renderHtml} when callers should handle adapter failure explicitly.
 *
 * **Example** (Rendering HTML unsafely)
 *
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
 * **Details**
 *
 * Prefer {@link renderPlainText} when callers should handle adapter failure explicitly.
 *
 * **Example** (Rendering plain text unsafely)
 *
 * ```ts import.meta.vitest name="Rendering plain text unsafely"
 * import { Md } from "@beep/md"
 * import { renderPlainTextUnsafe } from "@beep/md/Md.render"
 *
 * renderPlainTextUnsafe(Md.make([Md.h1("Hello")])) // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainTextUnsafe = (document: Document): string => renderWithUnsafe(PlainTextAdapter, document);

/**
 * Selects the output a {@link PureRenderAdapter} produces for a document.
 *
 * **Details**
 *
 * Spelled as a deferred conditional alias so the data-first and data-last
 * signatures of {@link renderWithUnsafe} share a single named return type.
 * Every concrete instantiation resolves back to `Output`.
 *
 * **Example** (Typing a parameter as render output)
 *
 * ```ts
 * import type { RenderOutputOf } from "@beep/md/Md.render"
 *
 * const acceptPlainText = (value: RenderOutputOf<string>) => value
 * console.log(acceptPlainText)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RenderOutputOf<Output> = Output extends unknown ? Output : never;

/**
 * Renders a document with a custom pure adapter and returns the output directly.
 *
 * **Details**
 *
 * Prefer {@link renderWith} when callers should handle adapter failure explicitly.
 *
 * **Example** (Rendering with custom adapter)
 *
 * ```ts import.meta.vitest name="Rendering with custom adapter"
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter, renderWithUnsafe } from "@beep/md/Md.render"
 *
 * const output = renderWithUnsafe(MarkdownAdapter, Md.make([Md.p("Hello")]))
 * output // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderWithUnsafe: {
  <Output>(document: Document): (adapter: PureRenderAdapter<Output>) => RenderOutputOf<Output>;
  <Output>(adapter: PureRenderAdapter<Output>, document: Document): RenderOutputOf<Output>;
} = dual(
  2,
  <Output>(adapter: PureRenderAdapter<Output>, document: Document): RenderOutputOf<Output> =>
    cast(adapter.render(document))
);

/**
 * Starts an effectful render adapter and returns its effect directly.
 *
 * **Details**
 *
 * Prefer {@link renderEffectWith} when adapter construction failures should be
 * reported as {@link RenderError}.
 *
 * **Example** (Starting effectful render unsafely)
 *
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
 * **Details**
 *
 * Adapter effects keep their original error and requirement channels. Only
 * failures thrown while starting the adapter are wrapped as {@link RenderError}.
 *
 * **Example** (Starting effectful render safely)
 *
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
 * **Example** (Creating URL render options)
 *
 * ```ts import.meta.vitest name="Creating URL render options"
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 * import { UrlRenderOptions } from "@beep/md/Md.render"
 *
 * const options = UrlRenderOptions.make({ urlPolicy: BrowserSafeUrlPolicySpec })
 * options.urlPolicy !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UrlRenderOptions extends S.Class<UrlRenderOptions>($I`UrlRenderOptions`)(
  {
    urlPolicy: S.optionalKey(UrlPolicySpec).annotateKey({
      description: "Canonical URL policy applied during recursive rendering.",
    }),
  },
  $I.annote("UrlRenderOptions", {
    description: "URL policy options accepted by built-in render adapter factories.",
  })
) {}

const renderPolicy = (options: UrlRenderOptions, fallback: UrlPolicySpec): UrlPolicySpec =>
  pipe(
    O.fromUndefinedOr(options.urlPolicy),
    O.getOrElse(() => fallback)
  );

const renderMarkdownInlinesWithPolicy = (
  policy: UrlPolicySpec,
  children: ReadonlyArray<Inline>,
  linkLabel = false
): string =>
  pipe(
    children,
    A.map((inline) => renderMarkdownInlineWithPolicy(policy, inline, linkLabel)),
    joinEmpty
  );

const renderMarkdownInlineWithPolicy = (policy: UrlPolicySpec, inline: Inline, linkLabel = false): string =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: ({ value }) => escapeMarkdownText(value),
      rawMarkdown: ({ value }) => (linkLabel ? escapeMarkdownText(value) : value),
      rawHtml: renderEscapedRawHtmlAsMarkdown,
      strong: ({ children }) => `**${renderMarkdownInlinesWithPolicy(policy, children, linkLabel)}**`,
      em: ({ children }) => `*${renderMarkdownInlinesWithPolicy(policy, children, linkLabel)}*`,
      del: ({ children }) => `~~${renderMarkdownInlinesWithPolicy(policy, children, linkLabel)}~~`,
      code: ({ value }) => renderInlineCode(value),
      a: ({ href, children, title }) =>
        `[${renderMarkdownInlinesWithPolicy(policy, children, true)}](${renderMarkdownDestinationWithTitle(href, title, policy)})`,
      img: ({ src, alt, title }) =>
        `![${escapeMarkdownText(alt)}](${renderMarkdownDestinationWithTitle(src, title, policy)})`,
      br: () => "<br/>",
      inlineMath: ({ value }) => `$${escapeInlineMath(value)}$`,
      footnoteReference: ({ identifier }) => `[^${identifier}]`,
    })
  );

const renderHtmlInlinesWithPolicy = (policy: UrlPolicySpec, children: ReadonlyArray<Inline>): string =>
  pipe(
    children,
    A.map((inline) => renderHtmlInlineWithPolicy(policy, inline)),
    joinEmpty
  );

const renderHtmlInlineWithPolicy = (policy: UrlPolicySpec, inline: Inline): string =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: ({ value }) => Html.escapeHtml(value),
      rawMarkdown: ({ value }) => Html.escapeHtml(value),
      rawHtml: renderEscapedRawHtmlAsHtml,
      strong: ({ children }) => `<strong>${renderHtmlInlinesWithPolicy(policy, children)}</strong>`,
      em: ({ children }) => `<em>${renderHtmlInlinesWithPolicy(policy, children)}</em>`,
      del: ({ children }) => `<del>${renderHtmlInlinesWithPolicy(policy, children)}</del>`,
      code: ({ value }) => `<code>${Html.escapeHtml(value)}</code>`,
      a: ({ href, children, title }) =>
        `<a href="${escapeHtmlUrlAttributeWithPolicy(href, policy)}"${renderHtmlOptionalAttribute("title", title)}>${renderHtmlInlinesWithPolicy(policy, children)}</a>`,
      img: ({ src, alt, title }) =>
        `<img src="${escapeHtmlUrlAttributeWithPolicy(src, policy)}" alt="${Html.escapeHtml(alt)}"${renderHtmlOptionalAttribute("title", title)} />`,
      br: () => "<br />",
      inlineMath: ({ value }) => `<span class="math math-inline">${Html.escapeHtml(value)}</span>`,
      footnoteReference: ({ identifier }) =>
        `<sup id="fnref-${Html.escapeHtml(identifier)}"><a href="#fn-${Html.escapeHtml(identifier)}">${Html.escapeHtml(identifier)}</a></sup>`,
    })
  );

const renderMarkdownListItemChildrenWithPolicy = (
  policy: UrlPolicySpec,
  children: ReadonlyArray<ListItemChild>
): string =>
  pipe(
    segmentInlineRuns<Inline, Block>(children, {
      isInline: InlineSchema.is,
      renderInlineRun: (inlines) => renderMarkdownInlinesWithPolicy(policy, inlines),
      renderBlock: (block: Block) => renderMarkdownBlockWithPolicy(policy, block),
    }),
    A.join("\n")
  );

const renderHtmlListItemChildrenWithPolicy = (policy: UrlPolicySpec, children: ReadonlyArray<ListItemChild>): string =>
  pipe(
    segmentInlineRuns<Inline, Block>(children, {
      isInline: InlineSchema.is,
      renderInlineRun: (inlines) => renderHtmlInlinesWithPolicy(policy, inlines),
      renderBlock: (block: Block) => renderHtmlBlockWithPolicy(policy, block),
    }),
    joinEmpty
  );

const renderMarkdownTableWithPolicy = (policy: UrlPolicySpec, block: Table): string => {
  const columns = tableColumnCount(block.children);
  if (columns === 0) {
    return "";
  }

  const renderCell = (cell: TableCell): string =>
    pipe(
      renderMarkdownInlinesWithPolicy(policy, cell.children),
      Str.replace(/\|/g, "\\|"),
      Str.replace(lineSeparatorGlobalPattern, "<br/>")
    );
  const renderRow = (row: TableRow): string =>
    pipe(row.children, A.map(renderCell), A.join(" | "), renderMarkdownTableFence);
  const paddedRows = A.map(block.children, padTableRow(columns));

  if (block.headerRow) {
    return pipe(paddedRows, A.map(renderRow), ([header, ...body]) =>
      A.join([header, renderMarkdownTableSeparator(columns, block.align), ...body], "\n")
    );
  }

  const emptyHeader = renderRow(
    TableRow.make({
      children: A.makeBy(columns, () => TableCell.make({ children: [] })),
    })
  );

  return pipe(paddedRows, A.map(renderRow), (rows) =>
    A.join([emptyHeader, renderMarkdownTableSeparator(columns, block.align), ...rows], "\n")
  );
};

const renderHtmlTableWithPolicy = (policy: UrlPolicySpec, block: Table): string => {
  const renderRow =
    (tag: "td" | "th") =>
    (row: TableRow): string =>
      `<tr>${pipe(
        row.children,
        A.map((cell, index) => {
          const align = tableAlignmentAt(block.align, index);
          const style = align === "none" ? "" : ` style="text-align:${align}"`;
          return `<${tag}${style}>${renderHtmlInlinesWithPolicy(policy, cell.children)}</${tag}>`;
        }),
        joinEmpty
      )}</tr>`;

  return renderHtmlTableRows(block, renderRow);
};

const renderMarkdownBlockWithPolicy = (policy: UrlPolicySpec, block: Block): string =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: ({ children, level }) =>
        `${pipe("#", Str.repeat(level))} ${renderMarkdownInlinesWithPolicy(policy, children)}`,
      p: ({ children }) => renderMarkdownInlinesWithPolicy(policy, children),
      blockquote: ({ children }) => prefixLines(renderMarkdownBlocksWithPolicy(policy, children), "> "),
      pre: ({ language, value }) => renderFencedCode(value, languageToMarkdown(language)),
      ul: ({ children }) =>
        pipe(
          children,
          A.map((item) =>
            renderMarkdownMarkedItem("- ", renderMarkdownListItemChildrenWithPolicy(policy, item.children))
          ),
          A.join("\n")
        ),
      ol: ({ children, start }) =>
        pipe(
          children,
          A.map((item, index) =>
            renderMarkdownMarkedItem(
              `${index + start}. `,
              renderMarkdownListItemChildrenWithPolicy(policy, item.children)
            )
          ),
          A.join("\n")
        ),
      taskList: ({ children }) =>
        pipe(
          children,
          A.map((item) =>
            renderMarkdownMarkedItem(
              `- [${item.checked ? "x" : " "}] `,
              renderMarkdownListItemChildrenWithPolicy(policy, item.children)
            )
          ),
          A.join("\n")
        ),
      table: (table) => renderMarkdownTableWithPolicy(policy, table),
      youtube: ({ videoId }) => {
        const destination = youtubeWatchUrl(videoId);
        return isUrlDestinationAllowedWithPolicy(destination, policy)
          ? escapeMarkdownDestinationWithPolicy(destination, policy)
          : escapeMarkdownText("YouTube video");
      },
      mathBlock: renderMarkdownMathBlock,
      footnoteDefinition: ({ children, identifier }) => {
        const body = renderMarkdownBlocksWithPolicy(policy, children);
        return Str.isEmpty(body) ? `[^${identifier}]:` : `[^${identifier}]: ${indentContinuationLines(body, "    ")}`;
      },
      admonition: ({ children, kind, title }) => {
        const renderedTitle = pipe(
          title,
          O.map((value) => ` ${escapeMarkdownText(value)}`),
          O.getOrElse(thunkEmptyStr)
        );
        const header = `> [!${Str.toUpperCase(kind)}]${renderedTitle}`;
        const body = renderMarkdownBlocksWithPolicy(policy, children);
        return Str.isEmpty(body) ? header : `${header}\n${prefixLines(body, "> ")}`;
      },
      embed: ({ description, kind, src, title }) => {
        const label = pipe(
          title,
          O.getOrElse(() => src)
        );
        const destination = renderMarkdownDestinationWithTitle(src, title, policy);
        const rendered =
          kind === "image"
            ? `![${escapeMarkdownText(label)}](${destination})`
            : `[${escapeMarkdownText(label)}](${destination})`;
        return `${rendered}${embedDescriptionMarkdown(description)}`;
      },
      hr: () => "---",
    })
  );

const renderMarkdownBlocksWithPolicy = (policy: UrlPolicySpec, blocks: ReadonlyArray<Block>): Markdown =>
  pipe(
    blocks,
    A.map((block) => renderMarkdownBlockWithPolicy(policy, block)),
    joinBlocks
  );

const renderHtmlBlockWithPolicy = (policy: UrlPolicySpec, block: Block): string =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: (heading) => {
        const { children } = heading;
        const tag = headingTag(heading);
        return `<${tag}>${renderHtmlInlinesWithPolicy(policy, children)}</${tag}>`;
      },
      p: ({ children }) => `<p>${renderHtmlInlinesWithPolicy(policy, children)}</p>`,
      blockquote: ({ children }) => `<blockquote>${renderHtmlBlocksWithPolicy(policy, children)}</blockquote>`,
      pre: ({ language, value }) => `<pre><code${languageToHtmlClass(language)}>${Html.escapeHtml(value)}</code></pre>`,
      ul: ({ children }) =>
        `<ul>${pipe(
          children,
          A.map((item) => `<li>${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`),
          joinEmpty
        )}</ul>`,
      ol: ({ children, start }) =>
        `<ol${start === 1 ? "" : ` start="${start}"`}>${pipe(
          children,
          A.map((item) => `<li>${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`),
          joinEmpty
        )}</ol>`,
      taskList: ({ children }) =>
        `<ul class="contains-task-list">${pipe(
          children,
          A.map((item) => {
            const checked = item.checked ? " checked" : "";
            return `<li><input type="checkbox" disabled${checked} /> ${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`;
          }),
          joinEmpty
        )}</ul>`,
      table: (table) => renderHtmlTableWithPolicy(policy, table),
      youtube: ({ videoId }) => {
        const destination = youtubeEmbedUrl(videoId);
        return isUrlDestinationAllowedWithPolicy(destination, policy)
          ? `<iframe src="${escapeHtmlUrlAttributeWithPolicy(destination, policy)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
          : Html.escapeHtml("YouTube video");
      },
      mathBlock: ({ value }) => `<div class="math math-display">${Html.escapeHtml(value)}</div>`,
      footnoteDefinition: ({ children, identifier }) =>
        `<section id="fn-${Html.escapeHtml(identifier)}" class="footnote-definition"><sup>${Html.escapeHtml(identifier)}</sup>${renderHtmlBlocksWithPolicy(policy, children)}</section>`,
      admonition: ({ children, kind, title }) => {
        const renderedTitle = pipe(
          title,
          O.map((value) => `<p class="admonition-title">${Html.escapeHtml(value)}</p>`),
          O.getOrElse(thunkEmptyStr)
        );
        return `<aside class="admonition admonition-${Html.escapeHtml(kind)}">${renderedTitle}${renderHtmlBlocksWithPolicy(policy, children)}</aside>`;
      },
      embed: ({ description, kind, src, title }) => {
        const caption = pipe(
          description,
          O.map((value) => `<figcaption>${Html.escapeHtml(value)}</figcaption>`),
          O.getOrElse(thunkEmptyStr)
        );
        const label = pipe(
          title,
          O.getOrElse(() => src)
        );
        return `<figure data-embed-kind="${Html.escapeHtml(kind)}"><a href="${escapeHtmlUrlAttributeWithPolicy(src, policy)}">${Html.escapeHtml(label)}</a>${caption}</figure>`;
      },
      hr: () => "<hr />",
    })
  );

const renderHtmlBlocksWithPolicy = (policy: UrlPolicySpec, blocks: ReadonlyArray<Block>): HtmlFragment =>
  pipe(
    blocks,
    A.map((block) => renderHtmlBlockWithPolicy(policy, block)),
    A.join("\n"),
    HtmlFragment.make
  );

const renderMarkdownDocumentWithPolicy = (policy: UrlPolicySpec, document: Document): Markdown =>
  joinBlocks([renderJsonFrontmatter(document.frontmatter), renderMarkdownBlocksWithPolicy(policy, document.children)]);

const renderHtmlDocumentWithPolicy = (policy: UrlPolicySpec, document: Document): HtmlFragment =>
  renderHtmlBlocksWithPolicy(policy, document.children);

/**
 * Creates a Markdown render adapter with an optional URL sink policy.
 *
 * **Example** (Markdown adapter with URL policy)
 *
 * ```ts import.meta.vitest name="Markdown adapter with URL policy"
 * import { Md } from "@beep/md"
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 * import { makeMarkdownAdapter, renderWithUnsafe } from "@beep/md/Md.render"
 *
 * const adapter = makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec })
 * renderWithUnsafe(adapter, Md.make([Md.p(Md.a("file:///tmp/a", "File"))])) // => "[File](#)"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeMarkdownAdapter = (options: UrlRenderOptions = {}): PureRenderAdapter<Markdown> => {
  const urlPolicy = renderPolicy(options, CompatibilityUrlPolicySpec);

  return {
    name: "markdown",
    render: (document) => renderMarkdownDocumentWithPolicy(urlPolicy, document),
  };
};

/**
 * Creates an HTML fragment render adapter with an optional URL sink policy.
 *
 * **Example** (HTML adapter with URL policy)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import { StrictWebUrlPolicySpec } from "@beep/md/Md.escape"
 * import { makeHtmlFragmentAdapter, renderWithUnsafe } from "@beep/md/Md.render"
 *
 * const adapter = makeHtmlFragmentAdapter({ urlPolicy: StrictWebUrlPolicySpec })
 * console.log(renderWithUnsafe(adapter, Md.make([Md.p(Md.a("artifact:abc", "Artifact"))])))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeHtmlFragmentAdapter = (options: UrlRenderOptions = {}): PureRenderAdapter<HtmlFragment> => {
  const urlPolicy = renderPolicy(options, BrowserSafeUrlPolicySpec);

  return {
    name: "html-fragment",
    render: (document) => renderHtmlDocumentWithPolicy(urlPolicy, document),
  };
};

/**
 * Built-in Markdown render adapter.
 *
 * **Example** (Using built-in Markdown adapter)
 *
 * ```ts import.meta.vitest name="Using built-in Markdown adapter"
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter } from "@beep/md/Md.render"
 *
 * MarkdownAdapter.render(Md.make([Md.h1("Hello")])) // => "# Hello"
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
 * **Details**
 *
 * Note: this adapter escapes `rawHtml` inline nodes by default. Treat trusted
 * HTML pass-through as an explicit custom-adapter boundary.
 *
 * **Example** (Using built-in HTML adapter)
 *
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
 * **Example** (Using built-in plain-text adapter)
 *
 * ```ts import.meta.vitest name="Using built-in plain-text adapter"
 * import { Md } from "@beep/md"
 * import { PlainTextAdapter } from "@beep/md/Md.render"
 *
 * PlainTextAdapter.render(Md.make([Md.h1("Hello")])) // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const PlainTextAdapter: PureRenderAdapter<string> = {
  name: "plain-text",
  render: (document) => BlockSchema.toPlainTextAll(document.children),
};

/**
 * Renders a document with a custom pure adapter.
 *
 * **Details**
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderWithUnsafe} only at boundaries that intentionally throw.
 *
 * **Example** (Rendering with Result capture)
 *
 * ```ts import.meta.vitest name="Rendering with Result capture"
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { MarkdownAdapter, renderWith } from "@beep/md/Md.render"
 *
 * const output = renderWith(MarkdownAdapter, Md.make([Md.p("Hello")]))
 * Result.getOrThrow(output) // => "Hello"
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
 * **Details**
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderUnsafe} only at boundaries that intentionally throw.
 *
 * **Example** (Rendering Markdown with Result)
 *
 * ```ts import.meta.vitest name="Rendering Markdown with Result"
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { render } from "@beep/md/Md.render"
 *
 * const output = render(Md.make([Md.h1("Hello")]))
 * Result.getOrThrow(output) // => "# Hello"
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
 * **Details**
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderHtmlUnsafe} only at boundaries that intentionally throw.
 *
 * **Example** (Rendering HTML with Result)
 *
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
 * **Details**
 *
 * Adapter failures are captured as {@link RenderError}. Use
 * {@link renderPlainTextUnsafe} only at boundaries that intentionally throw.
 *
 * **Example** (Rendering plain text with Result)
 *
 * ```ts import.meta.vitest name="Rendering plain text with Result"
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 * import { renderPlainText } from "@beep/md/Md.render"
 *
 * const output = renderPlainText(Md.make([Md.h1("Hello")]))
 * Result.getOrThrow(output) // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainText = (document: Document): Result.Result<string, RenderError> =>
  renderWith(PlainTextAdapter, document);
