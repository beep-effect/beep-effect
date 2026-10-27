/**
 * Markdown AST render adapters.
 *
 * @packageDocumentation \@beep/md/Md.render
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity";
import { HtmlFragment, SchemaUtils } from "@beep/schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, Html, R, thunkEmptyStr } from "@beep/utils";
import { replaceAllWith } from "@beep/utils/Str";
import * as Effect from "effect/Effect";
import { cast, constant, dual, flow, identity, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
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
import type {
  Block,
  Document,
  Em,
  Heading,
  Inline,
  Li,
  ListItemChild,
  Ol,
  Strong,
  Table,
  TaskItem,
  TaskList,
  Ul,
} from "./Md.model.ts";

const $I = $MdId.create("Md.render");
const joinEmpty = A.join("");
const lineSeparatorPattern = /\r\n?|\n/;
const lineSeparatorGlobalPattern = /\r\n?|\n/g;
const markdownTitleEscapePattern = /["\\]/g;
const jsonStringEscapePattern = /["\\\u0000-\u001f]/g;
const mathFencePattern = /\$\$/g;
// A `$` that no backslash escapes yet: an inline-math value is raw TeX, where
// `\$` already is a literal dollar, so escaping only the bare ones keeps
// render(parse(render(x))) equal to render(x).
const unescapedDollarPattern = /(?<!\\)((?:\\\\)*)\$/g;
// An `&` that opens something shaped like a character reference (`&amp;`,
// `&#38;`, `&#x26;`), which a parser would decode. Md carries no entity
// table, so an unknown name such as `&foo;` is escaped too; a bare `&` is not.
const characterReferencePattern = /&(?=#[0-9]{1,7};|#[xX][0-9A-Fa-f]{1,6};|[A-Za-z][A-Za-z0-9]{0,31};)/g;
// A `$` that could open inline math under pandoc's rules: one followed by a
// non-space character, or one that ends the text node (its neighbour is
// unknown here). Newlines become entities or break tags in writer output,
// so a dollar before a newline must be escaped too.
const mathOpenerPattern = /\$(?=[^ \t]|$)/g;
// The scheme colon of an `http://` or `https://` URL in text, which GFM's
// autolink-literal extension would turn into a link; `http\://` stays text.
const autolinkSchemePattern = /(?<![A-Za-z0-9])(https?):(?=\/\/)/gi;
// GFM email literals use [A-Za-z0-9.+_-] before `@`, a dotted domain
// of alphanumerics, `-` and `_`, and an alphabetic final character.
// Match after escapeMarkdownLiteral: dots, hyphens and underscores already
// carry backslashes. A domain dot must be followed by an alphanumeric, as
// in markdown/internal/inlines/autolinkLiteral.ts (EmailCandidate).
const autolinkEmailAtPattern =
  /(?<=[A-Za-z0-9.+_-])@(?=(?:[A-Za-z0-9]|\\[-_])*(?:\\\.[A-Za-z0-9](?:[A-Za-z0-9]|\\[-_])*)+(?<=[A-Za-z])(?![A-Za-z0-9]|\\[-_]|\\\.[A-Za-z0-9]))/g;
const tableCellPipePattern = /(?<!\\)((?:\\\\)*)\|/g;
const leadingBlockWhitespacePattern = /^[ \t]+/g;
const trailingBlockWhitespacePattern = /[ \t]+$/g;
const titleLineSeparatorPattern = /[\r\n]/g;

// Escapes only what a parser would read back differently: `escapeMarkdownText`
// covers the block and inline markers, and an `&` that opens a character
// reference is escaped so it stays literal. For strings no math recognizer
// reads (titles, alt text, admonition titles).
const escapeMarkdownLiteral = flow(escapeMarkdownText, Str.replace(characterReferencePattern, "\\&"));

// Text in phrasing content, where the bridge's inline-math recognizer runs
// when math parsing is on and GFM links bare URLs: every `$` that could open
// math and every URL scheme colon is escaped too.
const escapeMarkdownPhrasingMarkers = flow(
  escapeMarkdownLiteral,
  Str.replace(mathOpenerPattern, "\\$"),
  Str.replace(autolinkSchemePattern, "$1\\:"),
  Str.replace(autolinkEmailAtPattern, "\\@")
);

const escapeMarkdownTablePhrasing = flow(
  escapeMarkdownPhrasingMarkers,
  Str.replace(lineSeparatorGlobalPattern, "<br/>")
);

const escapeMarkdownPhrasing = flow(
  escapeMarkdownPhrasingMarkers,
  Str.replaceAll("\n", "&#10;"),
  Str.replaceAll("\r", "&#13;")
);

const characterReferenceOf = (char: string): string => `&#${pipe(char, Str.charCodeAt(0), O.getOrElse(constant(0)))};`;

const characterReferencesOf: (run: string) => string = flow(Str.split(""), A.map(characterReferenceOf), joinEmpty);

// A paragraph, heading or cell drops whitespace at its edges, and `joinBlocks`
// trims each block, so edge spaces and tabs are written as character
// references, which a parser decodes back into the text.
const protectBlockEdgeWhitespace: (rendered: string) => string = flow(
  replaceAllWith(leadingBlockWhitespacePattern, characterReferencesOf),
  replaceAllWith(trailingBlockWhitespacePattern, characterReferencesOf)
);

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
export class RenderError extends S.TaggedError<RenderError, { readonly brand: unique symbol }>($I`RenderError`)(
  "RenderError",
  {
    adapter: S.String,
    message: S.String,
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
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
 * import * as Effect from "effect/Effect";
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

// A text node ending in `!` right before a link would turn the link into an
// image, so that one `!` is escaped.
const guardImageBang = (rendered: string, inline: Inline, next: O.Option<Inline>): string =>
  inline._tag === "text" && O.exists(next, (sibling) => sibling._tag === "a") && Str.endsWith("!")(rendered)
    ? `${Str.slice(0, -1)(rendered)}\\!`
    : rendered;

const wordCharacterPattern = /[\p{L}\p{N}\p{M}]/u;

const isWordCharacter = (char: string): boolean => wordCharacterPattern.test(char);

// `_` delimiters cannot open after, or close before, a letter or digit, so an
// emphasis that took them falls back to `*` when a neighbour touches it there.
const touchesWord = (rendered: ReadonlyArray<string>, index: number): boolean =>
  O.exists(A.get(rendered, index - 1), flow(Str.slice(-1), isWordCharacter)) ||
  O.exists(A.get(rendered, index + 1), flow(Str.slice(0, 1), isWordCharacter));

const starDelimiter = (inline: Em | Strong): string => (inline._tag === "em" ? "*" : "**");

const isEmphasis = (inline: Inline): inline is Em | Strong => inline._tag === "em" || inline._tag === "strong";

const fitEmphasisDelimiters = (
  inline: Inline,
  rendered: ReadonlyArray<string>,
  index: number,
  renderChildren: (children: ReadonlyArray<Inline>) => string
): string => {
  const own = A.get(rendered, index).pipe(O.getOrElse(thunkEmptyStr));
  return isEmphasis(inline) && Str.startsWith("_")(own) && touchesWord(rendered, index)
    ? `${starDelimiter(inline)}${renderChildren(inline.children)}${starDelimiter(inline)}`
    : own;
};

// Renders an inline sequence, then adjusts each node for its neighbours:
// emphasis delimiters that would not flank and a `!` that would form an image.
const renderInlineSequence = (
  children: ReadonlyArray<Inline>,
  renderInline: (inline: Inline) => string,
  renderChildren: (children: ReadonlyArray<Inline>) => string
): string => {
  const rendered = A.map(children, renderInline);
  return joinEmpty(
    A.map(children, (inline, index) => {
      const own = fitEmphasisDelimiters(inline, rendered, index, renderChildren);
      // A literal digit prevents pandoc's `$` closer from closing. A
      // reference keeps the digit's value while allowing the raw closer.
      const guarded = O.exists(A.get(children, index - 1), (previous) => previous._tag === "inlineMath")
        ? replaceAllWith(/^[0-9]/g, characterReferenceOf)(own)
        : own;
      return guardImageBang(guarded, inline, A.get(children, index + 1));
    })
  );
};

const renderMarkdownInlines = (children: ReadonlyArray<Inline>): string =>
  renderInlineSequence(children, renderMarkdownInline, renderMarkdownInlines);

const renderMarkdownLinkLabelInlines = (children: ReadonlyArray<Inline>): string =>
  renderInlineSequence(children, renderMarkdownInlineForLinkLabel, renderMarkdownLinkLabelInlines);

const renderHtmlInlines: (children: ReadonlyArray<Inline>) => string = flow(A.map(renderHtmlInline), joinEmpty);

const isInlineChild = S.is(InlineSchema);

const isBlockChild = S.is(BlockSchema);

// One segment per inline run and per block of a list item. A run of blocks
// is a sibling sequence, so adjacent lists in an item alternate markers too.
const renderListItemSegments = (
  children: ReadonlyArray<ListItemChild>,
  renderInlineRun: (run: ReadonlyArray<Inline>) => string,
  renderBlocks: (blocks: ReadonlyArray<Block>) => ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.match(children, {
    onEmpty: A.empty<string>,
    onNonEmpty: flow(
      A.groupWith((left, right) => isInlineChild(left) === isInlineChild(right)),
      A.flatMap((run) =>
        A.every(run, isInlineChild)
          ? [renderInlineRun(A.filter(run, isInlineChild))]
          : renderBlocks(A.filter(run, isBlockChild))
      )
    ),
  });

const renderMarkdownListItemSegments = (children: ReadonlyArray<ListItemChild>): ReadonlyArray<string> =>
  renderListItemSegments(children, flow(renderMarkdownInlines, protectBlockEdgeWhitespace), (blocks) =>
    renderSiblingBlocks(blocks, renderMarkdownBlock, (list, markers) =>
      renderMarkdownList(list, markers, renderMarkdownListItemSegments)
    )
  );

const renderHtmlListItemChildren: (children: ReadonlyArray<ListItemChild>) => string = flow(
  (items: ReadonlyArray<ListItemChild>) =>
    segmentInlineRuns(items, {
      isInline: S.is(InlineSchema),
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

// `escapeMarkdownText` already writes a text `|` as `\|`, so only a pipe
// behind an even run of backslashes (code spans, link destinations) still
// needs its cell escape.
const renderMarkdownTableCell = (cell: TableCell): string =>
  pipe(
    renderMarkdownInlinesWithPolicy(CompatibilityUrlPolicySpec, cell.children, false, escapeMarkdownTablePhrasing),
    Str.replace(tableCellPipePattern, "$1\\|"),
    Str.replace(lineSeparatorGlobalPattern, "<br/>"),
    protectBlockEdgeWhitespace
  );

const renderMarkdownTableFence = (cells: string): string => `| ${cells} |`;

// A title keeps its line breaks as character references, so the link stays
// on one line and re-parses to the same title.
const escapeMarkdownTitle = flow(
  Str.replace(markdownTitleEscapePattern, "\\$&"),
  Str.replace(characterReferencePattern, "\\&"),
  replaceAllWith(titleLineSeparatorPattern, characterReferenceOf)
);

const renderMarkdownTitle: (title: O.Option<string>) => string = flow(
  O.map((value) => ` "${escapeMarkdownTitle(value)}"`),
  O.getOrElse(thunkEmptyStr)
);

const renderMarkdownDestinationWithTitle = (
  destination: string,
  title: O.Option<string>,
  policy: UrlPolicySpec
): string =>
  `${pipe(escapeMarkdownDestinationWithPolicy(destination, policy), Str.replace(characterReferencePattern, "\\&"))}${renderMarkdownTitle(title)}`;

const tableAlignmentAt = (align: ReadonlyArray<TableAlignment>, index: number): TableAlignment =>
  pipe(A.get(align, index), O.getOrElse(constant(TableAlignment.Enum.none)));

const tableRowColumnCount = (row: TableRow): number => A.length(row.children);

const tableColumnCount: (rows: ReadonlyArray<TableRow>) => number = A.reduce(0, (max, row) =>
  N.max(max, tableRowColumnCount(row))
);

const markdownTableSeparatorCell = TableAlignment.match({
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
    return A.matchLeft(A.map(paddedRows, renderMarkdownTableRow), {
      onEmpty: thunkEmptyStr,
      onNonEmpty: (header, body) => A.join([header, renderMarkdownTableSeparator(columns, block.align), ...body], "\n"),
    });
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
const renderEscapedRawHtmlAsMarkdown = ({ value }: { readonly value: string }): string => escapeMarkdownPhrasing(value);
const renderEscapedRawHtmlAsHtml = ({ value }: { readonly value: string }): string => Html.escapeHtml(value);

const renderMarkdownHeading = (block: Heading): string =>
  `${pipe("#", Str.repeat(block.level))} ${protectBlockEdgeWhitespace(renderMarkdownInlines(block.children))}`;

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

const escapeInlineMath = flow(
  Str.replace(lineSeparatorGlobalPattern, " "),
  Str.replace(unescapedDollarPattern, "$1\\$")
);

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

// The body starts after a blank quoted line, so the marker line is a
// paragraph of its own: a table, an ordered list starting above 1 or a bare
// URL cannot interrupt a paragraph and would merge into the marker line, and
// inline math in a first paragraph that continued the marker line would sit
// in a text run spanning the `> ` prefix, which the recognizer skips.
const admonitionBodySeparator = ">\n";

const renderMarkdownAdmonition = (block: {
  readonly kind: string;
  readonly title: O.Option<string>;
  readonly children: ReadonlyArray<Block>;
}): string => {
  const title = pipe(
    block.title,
    O.map((value) => ` ${escapeMarkdownLiteral(value)}`),
    O.getOrElse(thunkEmptyStr)
  );
  const header = `> [!${Str.toUpperCase(block.kind)}]${title}`;
  const body = renderMarkdownBlocks(block.children);

  return Str.isEmpty(body) ? header : `${header}\n${admonitionBodySeparator}${prefixLines(body, "> ")}`;
};

const embedTitle = (block: { readonly src: string; readonly title: O.Option<string> }): string =>
  pipe(
    block.title,
    O.getOrElse(() => block.src)
  );

const embedDescriptionMarkdown: (description: O.Option<string>) => string = flow(
  O.map((value) => `\n\n${escapeMarkdownPhrasing(value)}`),
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
    Match.when("image", () => `![${escapeMarkdownLiteral(title)}](${destination})`),
    Match.orElse(() => `[${escapeMarkdownPhrasing(title)}](${destination})`)
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
    A.map((line, index) => (index === 0 || Str.isEmpty(line) ? line : `${indent}${line}`)),
    A.join("\n")
  );

// The list item markers a list renders with. Two adjacent lists of the same
// family would merge into one list, so the second takes the alternate
// markers (`+` for bullets, `)` for ordered items). `*` is never a bullet:
// `* ***` would read as a thematic break.
class ListMarkers {
  readonly bullet: string;
  readonly ordered: string;

  constructor(bullet: string, ordered: string) {
    this.bullet = bullet;
    this.ordered = ordered;
  }
}

const primaryListMarkers = new ListMarkers("-", ".");
const alternateListMarkers = new ListMarkers("+", ")");

const ListFamily = LiteralKit(["bullet", "ordered"]);

type ListFamily = typeof ListFamily.Type;

const listFamily: (block: Block) => O.Option<ListFamily> = Match.type<Block>().pipe(
  Match.tag("ul", "taskList", () => O.some(ListFamily.Enum.bullet)),
  Match.tag("ol", () => O.some(ListFamily.Enum.ordered)),
  Match.orElse(O.none<ListFamily>)
);

class ListRun {
  readonly family: O.Option<ListFamily>;
  readonly alternate: boolean;

  constructor(family: O.Option<ListFamily>, alternate: boolean) {
    this.family = family;
    this.alternate = alternate;
  }
}

const nextListRun = (previous: ListRun, block: Block): ListRun => {
  const family = listFamily(block);
  return new ListRun(family, O.isSome(family) && O.contains(previous.family, family.value) && !previous.alternate);
};

// The markers each block of a sibling sequence renders its list with.
const listMarkersOf = (blocks: ReadonlyArray<Block>): ReadonlyArray<ListMarkers> =>
  pipe(
    A.scan(blocks, new ListRun(O.none(), false), nextListRun),
    A.drop(1),
    A.map((run) => (run.alternate ? alternateListMarkers : primaryListMarkers))
  );

type MarkdownList = Ul | Ol | TaskList;

const isParagraph = (child: ListItemChild): boolean => child._tag === "p";

// Md marks a loose item by paragraph children (a tight item holds inline
// runs), so a list with any paragraph child renders loose: blank lines
// between items and between the blocks of an item.
const isLooseList = (list: MarkdownList): boolean =>
  A.some(list.children, (item: Li | TaskItem) => A.some(item.children, isParagraph));

const taskBox = (item: TaskItem): string => `[${item.checked ? "x" : " "}] `;

const listItemMarker = (list: MarkdownList, markers: ListMarkers, index: number): string =>
  list._tag === "ol" ? `${index + list.start}${markers.ordered} ` : `${markers.bullet} `;

const listItemPrefix = (item: Li | TaskItem): string => (item._tag === "taskItem" ? taskBox(item) : "");

const renderMarkdownList = (
  list: MarkdownList,
  markers: ListMarkers,
  segments: (children: ReadonlyArray<ListItemChild>) => ReadonlyArray<string>
): string => {
  const separator = isLooseList(list) ? "\n\n" : "\n";
  return pipe(
    list.children,
    A.map((item: Li | TaskItem, index) =>
      renderMarkdownMarkedItem(
        listItemMarker(list, markers, index),
        `${listItemPrefix(item)}${A.join(segments(item.children), separator)}`
      )
    ),
    A.join(separator)
  );
};

const isMarkdownList = (block: Block): block is MarkdownList =>
  block._tag === "ul" || block._tag === "ol" || block._tag === "taskList";

// Renders a sibling sequence, giving each list the markers that keep it apart
// from an adjacent list of the same family.
const renderSiblingBlocks = (
  blocks: ReadonlyArray<Block>,
  renderBlock: (block: Block) => string,
  renderList: (list: MarkdownList, markers: ListMarkers) => string
): ReadonlyArray<string> =>
  A.zipWith(blocks, listMarkersOf(blocks), (block, markers) =>
    isMarkdownList(block) ? renderList(block, markers) : renderBlock(block)
  );

const renderMarkdownSiblings = (
  blocks: ReadonlyArray<Block>,
  renderBlock: (block: Block) => string,
  renderList: (list: MarkdownList, markers: ListMarkers) => string
): Markdown => joinBlocks(renderSiblingBlocks(blocks, renderBlock, renderList));

// An emphasis that opens or closes on another emphasis takes `_` delimiters:
// `**foo**` would read `*` + `*foo*` + `*` as strong, and `***foo***` as
// emphasis around strong.
const opensOrClosesOnEm = (children: ReadonlyArray<Inline>): boolean =>
  O.exists(A.head(children), (child) => child._tag === "em") ||
  O.exists(A.last(children), (child) => child._tag === "em");

const emDelimiter = (children: ReadonlyArray<Inline>): string => (opensOrClosesOnEm(children) ? "_" : "*");

const strongDelimiter = (children: ReadonlyArray<Inline>): string => (opensOrClosesOnEm(children) ? "__" : "**");

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
  Match.typeTags<Inline>()({
    text: ({ value }) => escapeMarkdownPhrasing(value),
    rawMarkdown: renderRawMarkdown,
    rawHtml: renderEscapedRawHtmlAsMarkdown,
    strong: ({ children }) => `${strongDelimiter(children)}${renderInlines(children)}${strongDelimiter(children)}`,
    em: ({ children }) => `${emDelimiter(children)}${renderInlines(children)}${emDelimiter(children)}`,
    del: ({ children }) => `~~${renderInlines(children)}~~`,
    code: ({ value }) => renderInlineCode(value),
    a: ({ href, children, title }) =>
      `[${renderMarkdownLinkLabelInlines(children)}](${renderMarkdownDestinationWithTitle(href, title, urlPolicy)})`,
    img: ({ src, alt, title }) =>
      `![${escapeMarkdownLiteral(alt)}](${renderMarkdownDestinationWithTitle(src, title, urlPolicy)})`,
    br: () => "<br/>",
    inlineMath: ({ value }) => `$${escapeInlineMath(value)}$`,
    footnoteReference: ({ identifier }) => `[^${identifier}]`,
  });

const renderMarkdownInlineMatcher = makeMarkdownInlineMatcher(
  renderMarkdownInlines,
  ({ value }) => value,
  CompatibilityUrlPolicySpec
);

const renderMarkdownInlineForLinkLabelMatcher = makeMarkdownInlineMatcher(
  renderMarkdownLinkLabelInlines,
  ({ value }) => escapeMarkdownPhrasing(value),
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
 * import { renderHtmlInline } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlInline(Md.em("beep"))) // "<em>beep</em>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const renderHtmlInlineMatcher = Match.typeTags<Inline>()({
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
});

/**
 * Renders an inline node as an HTML fragment.
 *
 * **Example** (Rendering emphasis as HTML)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
 * import { renderMarkdownBlock } from "@beep/md/Md.render"
 *
 * renderMarkdownBlock(Md.h1("Hello")) // => "# Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderMarkdownBlock: (block: Block) => string = Match.typeTags<Block>()({
  heading: renderMarkdownHeading,
  p: (block) => protectBlockEdgeWhitespace(renderMarkdownInlines(block.children)),
  blockquote: (block) => pipe(block.children, renderMarkdownBlocks, prefixLines("> ")),
  pre: (block) => renderFencedCode(block.value, languageToMarkdown(block.language)),
  ul: (block) => renderMarkdownList(block, primaryListMarkers, renderMarkdownListItemSegments),
  ol: (block) => renderMarkdownList(block, primaryListMarkers, renderMarkdownListItemSegments),
  taskList: (block) => renderMarkdownList(block, primaryListMarkers, renderMarkdownListItemSegments),
  table: renderMarkdownTable,
  youtube: (block) => youtubeWatchUrl(block.videoId),
  mathBlock: renderMarkdownMathBlock,
  footnoteDefinition: renderMarkdownFootnoteDefinition,
  admonition: renderMarkdownAdmonition,
  embed: renderMarkdownEmbed,
  // `***` rather than `---`: a leading `---` reads as a frontmatter fence, a
  // `---` under a paragraph line as a setext underline, and `- ---` as one
  // thematic break instead of a list item holding one.
  hr: () => "***",
});

/**
 * Renders a block node as an HTML fragment.
 *
 * **Example** (Rendering paragraph as HTML)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
 * import { renderHtmlBlock } from "@beep/md/Md.render"
 *
 * console.log(renderHtmlBlock(Md.p("Hello"))) // "<p>Hello</p>"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHtmlBlock: (block: Block) => string = Match.typeTags<Block>()({
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
});

/**
 * Renders block nodes as a Markdown document body.
 *
 * **Example** (Rendering multiple Markdown blocks)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
 * import { renderMarkdownBlocks } from "@beep/md/Md.render"
 *
 * console.log(renderMarkdownBlocks([Md.h1("Hello"), Md.p("World")]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderMarkdownBlocks = (blocks: ReadonlyArray<Block>): Markdown =>
  renderMarkdownSiblings(blocks, renderMarkdownBlock, (list, markers) =>
    renderMarkdownList(list, markers, renderMarkdownListItemSegments)
  );

/**
 * Renders block nodes as an HTML fragment body.
 *
 * **Example** (Rendering multiple HTML blocks)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import * as Effect from "effect/Effect";
 * import { Md } from "@beep/md/Md"
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
 * import * as Effect from "effect/Effect";
 * import { Md } from "@beep/md/Md"
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
export class UrlRenderOptions extends S.Opaque<UrlRenderOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    urlPolicy: S.optionalKey(UrlPolicySpec).annotateKey({
      description: "Canonical URL policy applied during recursive rendering.",
    }),
  }).pipe(
    $I.annoteSchema("UrlRenderOptions", {
      description: "URL policy options accepted by built-in render adapter factories.",
    })
  )
) {}

const renderPolicy = (options: UrlRenderOptions, fallback: UrlPolicySpec): UrlPolicySpec =>
  pipe(
    O.fromUndefinedOr(options.urlPolicy),
    O.getOrElse(() => fallback)
  );

const renderMarkdownInlinesWithPolicy = (
  policy: UrlPolicySpec,
  children: ReadonlyArray<Inline>,
  linkLabel = false,
  escapePhrasing = escapeMarkdownPhrasing
): string =>
  renderInlineSequence(
    children,
    (inline) => renderMarkdownInlineWithPolicy(policy, inline, linkLabel, escapePhrasing),
    (inlines) => renderMarkdownInlinesWithPolicy(policy, inlines, linkLabel, escapePhrasing)
  );

const renderMarkdownInlineWithPolicy = (
  policy: UrlPolicySpec,
  inline: Inline,
  linkLabel = false,
  escapePhrasing = escapeMarkdownPhrasing
): string =>
  Match.value(inline).pipe(
    Match.tag("text", ({ value }) => escapePhrasing(value)),
    Match.tag("rawMarkdown", ({ value }) => (linkLabel ? escapePhrasing(value) : value)),
    Match.tag("rawHtml", ({ value }) => escapePhrasing(value)),
    Match.tag("strong", ({ children }) => {
      const delimiter = strongDelimiter(children);
      return `${delimiter}${renderMarkdownInlinesWithPolicy(policy, children, linkLabel, escapePhrasing)}${delimiter}`;
    }),
    Match.tag("em", ({ children }) => {
      const delimiter = emDelimiter(children);
      return `${delimiter}${renderMarkdownInlinesWithPolicy(policy, children, linkLabel, escapePhrasing)}${delimiter}`;
    }),
    Match.tag(
      "del",
      ({ children }) => `~~${renderMarkdownInlinesWithPolicy(policy, children, linkLabel, escapePhrasing)}~~`
    ),
    Match.tag("code", ({ value }) => renderInlineCode(value)),
    Match.tag(
      "a",
      ({ href, children, title }) =>
        `[${renderMarkdownInlinesWithPolicy(policy, children, true, escapePhrasing)}](${renderMarkdownDestinationWithTitle(href, title, policy)})`
    ),
    Match.tag(
      "img",
      ({ src, alt, title }) =>
        `![${escapeMarkdownLiteral(alt)}](${renderMarkdownDestinationWithTitle(src, title, policy)})`
    ),
    Match.tag("br", () => "<br/>"),
    Match.tag("inlineMath", ({ value }) => `$${escapeInlineMath(value)}$`),
    Match.tag("footnoteReference", ({ identifier }) => `[^${identifier}]`),
    Match.exhaustive
  );

const renderHtmlInlinesWithPolicy = (policy: UrlPolicySpec, children: ReadonlyArray<Inline>): string =>
  pipe(
    children,
    A.map((inline) => renderHtmlInlineWithPolicy(policy, inline)),
    joinEmpty
  );

const renderHtmlInlineWithPolicy = (policy: UrlPolicySpec, inline: Inline): string =>
  Match.value(inline).pipe(
    Match.tag("text", ({ value }) => Html.escapeHtml(value)),
    Match.tag("rawMarkdown", ({ value }) => Html.escapeHtml(value)),
    Match.tag("rawHtml", renderEscapedRawHtmlAsHtml),
    Match.tag("strong", ({ children }) => `<strong>${renderHtmlInlinesWithPolicy(policy, children)}</strong>`),
    Match.tag("em", ({ children }) => `<em>${renderHtmlInlinesWithPolicy(policy, children)}</em>`),
    Match.tag("del", ({ children }) => `<del>${renderHtmlInlinesWithPolicy(policy, children)}</del>`),
    Match.tag("code", ({ value }) => `<code>${Html.escapeHtml(value)}</code>`),
    Match.tag(
      "a",
      ({ href, children, title }) =>
        `<a href="${escapeHtmlUrlAttributeWithPolicy(href, policy)}"${renderHtmlOptionalAttribute("title", title)}>${renderHtmlInlinesWithPolicy(policy, children)}</a>`
    ),
    Match.tag(
      "img",
      ({ src, alt, title }) =>
        `<img src="${escapeHtmlUrlAttributeWithPolicy(src, policy)}" alt="${Html.escapeHtml(alt)}"${renderHtmlOptionalAttribute("title", title)} />`
    ),
    Match.tag("br", () => "<br />"),
    Match.tag("inlineMath", ({ value }) => `<span class="math math-inline">${Html.escapeHtml(value)}</span>`),
    Match.tag(
      "footnoteReference",
      ({ identifier }) =>
        `<sup id="fnref-${Html.escapeHtml(identifier)}"><a href="#fn-${Html.escapeHtml(identifier)}">${Html.escapeHtml(identifier)}</a></sup>`
    ),
    Match.exhaustive
  );

const renderMarkdownListItemSegmentsWithPolicy =
  (policy: UrlPolicySpec) =>
  (children: ReadonlyArray<ListItemChild>): ReadonlyArray<string> =>
    renderListItemSegments(
      children,
      (inlines) => protectBlockEdgeWhitespace(renderMarkdownInlinesWithPolicy(policy, inlines)),
      (blocks) =>
        renderSiblingBlocks(
          blocks,
          (block) => renderMarkdownBlockWithPolicy(policy, block),
          (list, markers) => renderMarkdownList(list, markers, renderMarkdownListItemSegmentsWithPolicy(policy))
        )
    );

const renderHtmlListItemChildrenWithPolicy = (policy: UrlPolicySpec, children: ReadonlyArray<ListItemChild>): string =>
  pipe(
    segmentInlineRuns<Inline, Block>(children, {
      isInline: S.is(InlineSchema),
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
      renderMarkdownInlinesWithPolicy(policy, cell.children, false, escapeMarkdownTablePhrasing),
      Str.replace(tableCellPipePattern, "$1\\|"),
      Str.replace(lineSeparatorGlobalPattern, "<br/>"),
      protectBlockEdgeWhitespace
    );
  const renderRow = (row: TableRow): string =>
    pipe(row.children, A.map(renderCell), A.join(" | "), renderMarkdownTableFence);
  const paddedRows = A.map(block.children, padTableRow(columns));

  if (block.headerRow) {
    return A.matchLeft(A.map(paddedRows, renderRow), {
      onEmpty: thunkEmptyStr,
      onNonEmpty: (header, body) => A.join([header, renderMarkdownTableSeparator(columns, block.align), ...body], "\n"),
    });
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
    Match.tag(
      "heading",
      ({ children, level }) =>
        `${pipe("#", Str.repeat(level))} ${protectBlockEdgeWhitespace(renderMarkdownInlinesWithPolicy(policy, children))}`
    ),
    Match.tag("p", ({ children }) => protectBlockEdgeWhitespace(renderMarkdownInlinesWithPolicy(policy, children))),
    Match.tag("blockquote", ({ children }) => prefixLines(renderMarkdownBlocksWithPolicy(policy, children), "> ")),
    Match.tag("pre", ({ language, value }) => renderFencedCode(value, languageToMarkdown(language))),
    Match.tag("ul", "ol", "taskList", (list) =>
      renderMarkdownList(list, primaryListMarkers, renderMarkdownListItemSegmentsWithPolicy(policy))
    ),
    Match.tag("table", (table) => renderMarkdownTableWithPolicy(policy, table)),
    Match.tag("youtube", ({ videoId }) => {
      const destination = youtubeWatchUrl(videoId);
      return isUrlDestinationAllowedWithPolicy(destination, policy)
        ? escapeMarkdownDestinationWithPolicy(destination, policy)
        : escapeMarkdownText("YouTube video");
    }),
    Match.tag("mathBlock", renderMarkdownMathBlock),
    Match.tag("footnoteDefinition", ({ children, identifier }) => {
      const body = renderMarkdownBlocksWithPolicy(policy, children);
      return Str.isEmpty(body) ? `[^${identifier}]:` : `[^${identifier}]: ${indentContinuationLines(body, "    ")}`;
    }),
    Match.tag("admonition", ({ children, kind, title }) => {
      const renderedTitle = pipe(
        title,
        O.map((value) => ` ${escapeMarkdownLiteral(value)}`),
        O.getOrElse(thunkEmptyStr)
      );
      const header = `> [!${Str.toUpperCase(kind)}]${renderedTitle}`;
      const body = renderMarkdownBlocksWithPolicy(policy, children);
      return Str.isEmpty(body) ? header : `${header}\n${admonitionBodySeparator}${prefixLines(body, "> ")}`;
    }),
    Match.tag("embed", ({ description, kind, src, title }) => {
      const label = pipe(
        title,
        O.getOrElse(() => src)
      );
      const destination = renderMarkdownDestinationWithTitle(src, title, policy);
      const rendered =
        kind === "image"
          ? `![${escapeMarkdownLiteral(label)}](${destination})`
          : `[${escapeMarkdownPhrasing(label)}](${destination})`;
      return `${rendered}${embedDescriptionMarkdown(description)}`;
    }),
    Match.tag("hr", () => "***"),
    Match.exhaustive
  );

const renderMarkdownBlocksWithPolicy = (policy: UrlPolicySpec, blocks: ReadonlyArray<Block>): Markdown =>
  renderMarkdownSiblings(
    blocks,
    (block) => renderMarkdownBlockWithPolicy(policy, block),
    (list, markers) => renderMarkdownList(list, markers, renderMarkdownListItemSegmentsWithPolicy(policy))
  );

const renderHtmlBlockWithPolicy = (policy: UrlPolicySpec, block: Block): string =>
  Match.value(block).pipe(
    Match.tag("heading", (heading) => {
      const { children } = heading;
      const tag = headingTag(heading);
      return `<${tag}>${renderHtmlInlinesWithPolicy(policy, children)}</${tag}>`;
    }),
    Match.tag("p", ({ children }) => `<p>${renderHtmlInlinesWithPolicy(policy, children)}</p>`),
    Match.tag(
      "blockquote",
      ({ children }) => `<blockquote>${renderHtmlBlocksWithPolicy(policy, children)}</blockquote>`
    ),
    Match.tag(
      "pre",
      ({ language, value }) => `<pre><code${languageToHtmlClass(language)}>${Html.escapeHtml(value)}</code></pre>`
    ),
    Match.tag(
      "ul",
      ({ children }) =>
        `<ul>${pipe(
          children,
          A.map((item) => `<li>${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`),
          joinEmpty
        )}</ul>`
    ),
    Match.tag(
      "ol",
      ({ children, start }) =>
        `<ol${start === 1 ? "" : ` start="${start}"`}>${pipe(
          children,
          A.map((item) => `<li>${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`),
          joinEmpty
        )}</ol>`
    ),
    Match.tag(
      "taskList",
      ({ children }) =>
        `<ul class="contains-task-list">${pipe(
          children,
          A.map((item) => {
            const checked = item.checked ? " checked" : "";
            return `<li><input type="checkbox" disabled${checked} /> ${renderHtmlListItemChildrenWithPolicy(policy, item.children)}</li>`;
          }),
          joinEmpty
        )}</ul>`
    ),
    Match.tag("table", (table) => renderHtmlTableWithPolicy(policy, table)),
    Match.tag("youtube", ({ videoId }) => {
      const destination = youtubeEmbedUrl(videoId);
      return isUrlDestinationAllowedWithPolicy(destination, policy)
        ? `<iframe src="${escapeHtmlUrlAttributeWithPolicy(destination, policy)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        : Html.escapeHtml("YouTube video");
    }),
    Match.tag("mathBlock", ({ value }) => `<div class="math math-display">${Html.escapeHtml(value)}</div>`),
    Match.tag(
      "footnoteDefinition",
      ({ children, identifier }) =>
        `<section id="fn-${Html.escapeHtml(identifier)}" class="footnote-definition"><sup>${Html.escapeHtml(identifier)}</sup>${renderHtmlBlocksWithPolicy(policy, children)}</section>`
    ),
    Match.tag("admonition", ({ children, kind, title }) => {
      const renderedTitle = pipe(
        title,
        O.map((value) => `<p class="admonition-title">${Html.escapeHtml(value)}</p>`),
        O.getOrElse(thunkEmptyStr)
      );
      return `<aside class="admonition admonition-${Html.escapeHtml(kind)}">${renderedTitle}${renderHtmlBlocksWithPolicy(policy, children)}</aside>`;
    }),
    Match.tag("embed", ({ description, kind, src, title }) => {
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
    }),
    Match.tag("hr", () => "<hr />"),
    Match.exhaustive
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
 * import { Md } from "@beep/md/Md"
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 * import { makeMarkdownAdapter, renderWithUnsafe, UrlRenderOptions } from "@beep/md/Md.render"
 *
 * const adapter = makeMarkdownAdapter(UrlRenderOptions.make({ urlPolicy: BrowserSafeUrlPolicySpec }))
 * renderWithUnsafe(adapter, Md.make([Md.p(Md.a("file:///tmp/a", "File"))])) // => "[File](#)"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeMarkdownAdapter = (
  options: UrlRenderOptions = UrlRenderOptions.make({})
): PureRenderAdapter<Markdown> => {
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
 * import { Md } from "@beep/md/Md"
 * import { StrictWebUrlPolicySpec } from "@beep/md/Md.escape"
 * import { makeHtmlFragmentAdapter, renderWithUnsafe, UrlRenderOptions } from "@beep/md/Md.render"
 *
 * const adapter = makeHtmlFragmentAdapter(UrlRenderOptions.make({ urlPolicy: StrictWebUrlPolicySpec }))
 * console.log(renderWithUnsafe(adapter, Md.make([Md.p(Md.a("artifact:abc", "Artifact"))])))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeHtmlFragmentAdapter = (
  options: UrlRenderOptions = UrlRenderOptions.make({})
): PureRenderAdapter<HtmlFragment> => {
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import { Md } from "@beep/md/Md"
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
 * import * as Result from "effect/Result";
 * import { Md } from "@beep/md/Md"
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
 * import * as Result from "effect/Result";
 * import { Md } from "@beep/md/Md"
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
 * import * as Result from "effect/Result";
 * import { Md } from "@beep/md/Md"
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
 * import * as Result from "effect/Result";
 * import { Md } from "@beep/md/Md"
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
