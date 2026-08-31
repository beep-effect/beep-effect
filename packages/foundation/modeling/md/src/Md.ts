/**
 * Public Markdown AST builder DSL.
 *
 * @packageDocumentation \@beep/md/Md
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, Match } from "effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { renderSafeHtml, safeHtmlValue } from "./Md.html.ts";
import {
  Admonition,
  A as ANode,
  BlockQuote,
  Block as BlockSchema,
  Br,
  Code,
  CodeFenceLanguage,
  Del,
  Document,
  Em,
  Embed,
  FootnoteDefinition,
  FootnoteIdentifier,
  FootnoteReference,
  Heading,
  Hr,
  Img,
  InlineMath,
  Li,
  MathBlock,
  Ol,
  OrderedListStart,
  P as PNode,
  Pre,
  RawHtml,
  RawMarkdown,
  Strong,
  Table,
  TableCell,
  TableRow,
  TaskItem,
  TaskList,
  Text,
  Ul,
  YouTube,
} from "./Md.model.ts";
import {
  HtmlFragmentAdapter,
  MarkdownAdapter,
  makeHtmlFragmentAdapter,
  makeMarkdownAdapter,
  PlainTextAdapter,
  render,
  renderEffectWith,
  renderEffectWithUnsafe,
  renderHtml,
  renderHtmlUnsafe,
  renderPlainText,
  renderPlainTextUnsafe,
  renderUnsafe,
  renderWith,
  renderWithUnsafe,
} from "./Md.render.ts";
import {
  decodeSafeDocument,
  decodeSafeDocumentEffect,
  decodeSafeDocumentUnsafe,
  documentSafetyIssues,
  refineSafeDocument,
} from "./Md.safe.ts";
import type { JsonObject } from "@beep/schema";
import type { Result } from "effect";
import type {
  AdmonitionKind,
  Block,
  EmbedKind,
  Inline,
  ListItemChild,
  TableAlignment,
  TaskListItemSpec,
} from "./Md.model.ts";

/**
 * Inline constructor input accepted by text-oriented builders.
 *
 * **Example** (Accept InlineInput type)
 *
 * ```ts
 * import type { InlineInput } from "@beep/md/Md"
 *
 * const accept = (input: InlineInput) => input
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InlineInput = string | Inline;

/**
 * Inline child content accepted by inline and text block builders.
 *
 * **Example** (Inline content array)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { InlineContent } from "@beep/md/Md"
 *
 * const content: InlineContent = [Md.strong("Hello"), " world"]
 * console.log(content)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InlineContent = InlineInput | ReadonlyArray<InlineInput>;

/**
 * Overloaded builder shape for inline-content constructors.
 *
 * **Example** (Accept Strong builder)
 *
 * ```ts
 * import type { InlineContentBuilder } from "@beep/md/Md"
 * import type { Strong } from "@beep/md/Md.model"
 *
 * const accept = (builder: InlineContentBuilder<Strong>) => builder
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InlineContentBuilder<Node> = {
  (strings: TemplateStringsArray, ...values: ReadonlyArray<InlineContent>): Node;
  (children: InlineContent): Node;
};

/**
 * Block constructor input accepted by block containers.
 *
 * **Example** (Accept BlockInput type)
 *
 * ```ts
 * import type { BlockInput } from "@beep/md/Md"
 *
 * const accept = (input: BlockInput) => input
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockInput = string | Block;

/**
 * Block child content accepted by block container call forms.
 *
 * **Example** (Block content array)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { BlockContent } from "@beep/md/Md"
 *
 * const content: BlockContent = [Md.h2("Nested"), "plain"]
 * console.log(content)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockContent = BlockInput | ReadonlyArray<BlockInput>;

/**
 * Tagged-template interpolation accepted by block containers.
 *
 * **Details**
 *
 * Arrays in templates are inline content arrays; use the call form for block
 * arrays.
 *
 * **Example** (Template value as heading)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { BlockTemplateValue } from "@beep/md/Md"
 *
 * const value: BlockTemplateValue = Md.h2("Nested")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockTemplateValue = InlineContent | Block;

/**
 * Overloaded builder shape for block-content constructors.
 *
 * **Example** (Accept BlockQuote builder)
 *
 * ```ts
 * import type { BlockContentBuilder } from "@beep/md/Md"
 * import type { BlockQuote } from "@beep/md/Md.model"
 *
 * const accept = (builder: BlockContentBuilder<BlockQuote>) => builder
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockContentBuilder<Node> = {
  (strings: TemplateStringsArray, ...values: ReadonlyArray<BlockTemplateValue>): Node;
  (children: BlockContent): Node;
};

/**
 * Child input accepted inside list item constructors.
 *
 * **Example** (Strong list item child)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { ListItemChildInput } from "@beep/md/Md"
 *
 * const item: ListItemChildInput = Md.strong("Item")
 * console.log(item)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemChildInput = InlineInput | Block;

/**
 * List item child content accepted by ordered, unordered, and task list builders.
 *
 * **Example** (Nested list item content)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { ListItemContent } from "@beep/md/Md"
 *
 * const content: ListItemContent = [Md.p("Parent"), Md.ul(["Child"])]
 * console.log(content)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemContent = ListItemChildInput | ReadonlyArray<ListItemChildInput>;

/**
 * Overloaded builder shape for list item content constructors.
 *
 * **Example** (Accept Li builder)
 *
 * ```ts
 * import type { ListItemContentBuilder } from "@beep/md/Md"
 * import type { Li } from "@beep/md/Md.model"
 *
 * const accept = (builder: ListItemContentBuilder<Li>) => builder
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemContentBuilder<Node> = {
  (strings: TemplateStringsArray, ...values: ReadonlyArray<ListItemContent>): Node;
  (children: ListItemContent): Node;
};

/**
 * Input accepted by ordered and unordered list constructors.
 *
 * **Example** (List item input array)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { ListItemInput } from "@beep/md/Md"
 *
 * const item: ListItemInput = [Md.strong("Item")]
 * console.log(item)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemInput = ListItemContent | Li;

/**
 * Input accepted by table cell constructors.
 *
 * **Example** (String table cell)
 *
 * ```ts
 * import type { TableCellInput } from "@beep/md/Md"
 *
 * const cell: TableCellInput = "Name"
 * console.log(cell)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableCellInput = InlineContent | TableCell;

/**
 * Input accepted by table row constructors.
 *
 * **Example** (Row with table cell)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import type { TableRowInput } from "@beep/md/Md"
 *
 * const row: TableRowInput = [Md.tableCell("Name")]
 * console.log(row)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableRowInput = TableRow | ReadonlyArray<TableCellInput>;

const blockTemplateFormattingLinePattern = /[\r\n]/;
const isTemplateStringsArray = (input: unknown): input is TemplateStringsArray =>
  A.isArray(input) && P.hasProperty(input, "raw");

// Constructor content is always a string, an array of children, or a tagged
// node; the trailing options object of the same constructors never is. That
// gap is what makes the data-first / data-last dispatch below decidable.
const isContentArgument = (input: unknown): boolean =>
  P.isString(input) || A.isArray(input) || P.hasProperty(input, "_tag");

// Data-first when the leading argument carries the content, e.g. `pre(value)`
// and `pre(value, options)` against the data-last `pre(options)`.
const isLeadingContentCall = (args: IArguments): boolean => isContentArgument(args[0]);

// Data-first when the content follows a keying argument (href, kind), e.g.
// `a(href, children)` against the data-last `a(children, options)`.
const isKeyedContentCall = (args: IArguments): boolean => args.length >= 2 && isContentArgument(args[1]);

const isInlineInputArray = (input: InlineContent): input is ReadonlyArray<InlineInput> => A.isArray(input);

const isBlockInputArray = (input: BlockContent): input is ReadonlyArray<BlockInput> => A.isArray(input);

const isListItemChildInputArray = (input: ListItemContent): input is ReadonlyArray<ListItemChildInput> =>
  A.isArray(input);

const isListItemContentBlockValue = (input: ListItemContent): boolean =>
  BlockSchema.is(input) || (A.isArray(input) && A.some(input, BlockSchema.is));

const isBlockTemplateFormattingChunk = (chunk: string): boolean =>
  Str.isEmpty(Str.trim(chunk)) && blockTemplateFormattingLinePattern.test(chunk);

// A template chunk is rendered unless it is whitespace-only formatting sitting
// next to a block interpolation (where it is just source-layout indentation).
const shouldAppendTemplateChunk = (chunk: string, hasBlockNeighbor: boolean): boolean =>
  Str.isNonEmpty(chunk) && !(hasBlockNeighbor && isBlockTemplateFormattingChunk(chunk));

const asInline = (input: InlineInput): Inline =>
  Match.value(input).pipe(
    Match.when(P.isString, text),
    Match.orElse((node) => node)
  );

const asInlineArray = (input: InlineContent): ReadonlyArray<Inline> =>
  isInlineInputArray(input) ? A.map(input, asInline) : [asInline(input)];

const templateToInlineArray = (
  strings: TemplateStringsArray,
  values: ReadonlyArray<InlineContent>
): ReadonlyArray<Inline> =>
  A.flatMap(strings, (chunk, index) =>
    A.appendAll(
      Str.isNonEmpty(chunk) ? [text(chunk)] : A.empty<Inline>(),
      O.match(A.get(values, index), { onNone: A.empty<Inline>, onSome: asInlineArray })
    )
  );

const makeInlineContentBuilder = <Node>(
  makeNode: (children: ReadonlyArray<Inline>) => Node
): InlineContentBuilder<Node> => {
  function build(strings: TemplateStringsArray, ...values: ReadonlyArray<InlineContent>): Node;
  function build(children: InlineContent): Node;
  function build(input: TemplateStringsArray | InlineContent, ...values: ReadonlyArray<InlineContent>): Node {
    return isTemplateStringsArray(input)
      ? makeNode(templateToInlineArray(input, values))
      : makeNode(asInlineArray(input));
  }

  return build;
};

const asBlock = (input: BlockInput): Block =>
  Match.value(input).pipe(
    Match.when(P.isString, p),
    Match.orElse((node) => node)
  );

const asBlockArray = (input: BlockContent): ReadonlyArray<Block> =>
  isBlockInputArray(input) ? A.map(input, asBlock) : [asBlock(input)];

const hasBlockTemplateNeighbor = (
  value: O.Option<BlockTemplateValue>,
  previousValue: O.Option<BlockTemplateValue>
): boolean => O.exists(value, BlockSchema.is) || O.exists(previousValue, BlockSchema.is);

interface BlockTemplateState {
  readonly out: ReadonlyArray<Block>;
  readonly pending: ReadonlyArray<Inline>;
}

const flushBlockTemplateInline = (state: BlockTemplateState): BlockTemplateState =>
  A.isReadonlyArrayNonEmpty(state.pending)
    ? { out: A.append(state.out, p(state.pending)), pending: A.empty<Inline>() }
    : state;

const templateToBlockArray = (
  strings: TemplateStringsArray,
  values: ReadonlyArray<BlockTemplateValue>
): ReadonlyArray<Block> => {
  const initial: BlockTemplateState = { out: A.empty<Block>(), pending: A.empty<Inline>() };

  return pipe(
    strings,
    A.map((chunk, index) => ({ chunk, value: A.get(values, index), previousValue: A.get(values, index - 1) })),
    A.reduce(initial, (state, { chunk, value, previousValue }) => {
      const withChunk = shouldAppendTemplateChunk(chunk, hasBlockTemplateNeighbor(value, previousValue))
        ? { ...state, pending: A.append(state.pending, text(chunk)) }
        : state;

      return O.match(value, {
        onNone: () => withChunk,
        onSome: (templateValue) =>
          BlockSchema.is(templateValue)
            ? {
                out: A.appendAll(flushBlockTemplateInline(withChunk).out, asBlockArray(templateValue)),
                pending: A.empty<Inline>(),
              }
            : { ...withChunk, pending: A.appendAll(withChunk.pending, asInlineArray(templateValue)) },
      });
    }),
    flushBlockTemplateInline,
    (state) => state.out
  );
};

const makeBlockContentBuilder = <Node>(
  makeNode: (children: ReadonlyArray<Block>) => Node
): BlockContentBuilder<Node> => {
  function build(strings: TemplateStringsArray, ...values: ReadonlyArray<BlockTemplateValue>): Node;
  function build(children: BlockContent): Node;
  function build(input: TemplateStringsArray | BlockContent, ...values: ReadonlyArray<BlockTemplateValue>): Node {
    return isTemplateStringsArray(input)
      ? makeNode(templateToBlockArray(input, values))
      : makeNode(asBlockArray(input));
  }

  return build;
};

const asListItemChild = (input: ListItemChildInput): ListItemChild =>
  Match.value(input).pipe(
    Match.when(P.isString, text),
    Match.orElse((node) => node)
  );

const asListItemChildren = (input: ListItemContent): ReadonlyArray<ListItemChild> =>
  isListItemChildInputArray(input) ? A.map(input, asListItemChild) : [asListItemChild(input)];

const hasListItemTemplateBlockNeighbor = (
  value: O.Option<ListItemContent>,
  previousValue: O.Option<ListItemContent>
): boolean => O.exists(value, isListItemContentBlockValue) || O.exists(previousValue, isListItemContentBlockValue);

const templateToListItemChildren = (
  strings: TemplateStringsArray,
  values: ReadonlyArray<ListItemContent>
): ReadonlyArray<ListItemChild> =>
  pipe(
    strings,
    A.map((chunk, index) => ({ chunk, value: A.get(values, index), previousValue: A.get(values, index - 1) })),
    A.reduce(A.empty<ListItemChild>(), (out, { chunk, value, previousValue }) => {
      const withChunk = shouldAppendTemplateChunk(chunk, hasListItemTemplateBlockNeighbor(value, previousValue))
        ? A.append(out, text(chunk))
        : out;

      return O.match(value, {
        onNone: () => withChunk,
        onSome: (listItemValue) => A.appendAll(withChunk, asListItemChildren(listItemValue)),
      });
    })
  );

const makeListItemContentBuilder = <Node>(
  makeNode: (children: ReadonlyArray<ListItemChild>) => Node
): ListItemContentBuilder<Node> => {
  function build(strings: TemplateStringsArray, ...values: ReadonlyArray<ListItemContent>): Node;
  function build(children: ListItemContent): Node;
  function build(input: TemplateStringsArray | ListItemContent, ...values: ReadonlyArray<ListItemContent>): Node {
    return isTemplateStringsArray(input)
      ? makeNode(templateToListItemChildren(input, values))
      : makeNode(asListItemChildren(input));
  }

  return build;
};

const asListItem = (input: ListItemInput): Li => (Li.is(input) ? input : li(input));

const asTableCell = (input: TableCellInput): TableCell =>
  TableCell.is(input) ? input : TableCell.make({ children: asInlineArray(input) });

const asTableRow = (input: TableRowInput): TableRow =>
  TableRow.is(input) ? input : TableRow.make({ children: A.map(input, asTableCell) });

/**
 * Creates plain escaped inline text.
 *
 * **Example** (Create plain text)
 *
 * ```ts import.meta.vitest name="Create plain text"
 * import { Md } from "@beep/md"
 *
 * const node = Md.text("Hello")
 * node._tag // => "text"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const text = (value: string): Text => Text.make({ value });

/**
 * Creates trusted raw Markdown inline content.
 *
 * **Example** (Create raw Markdown)
 *
 * ```ts import.meta.vitest name="Create raw Markdown"
 * import { Md } from "@beep/md"
 *
 * const node = Md.rawMarkdown("**trusted**")
 * node._tag // => "rawMarkdown"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rawMarkdown = (value: string): RawMarkdown => RawMarkdown.make({ value });

/**
 * Creates raw HTML inline content for adapters that opt into trusted HTML rendering.
 *
 * **Details**
 *
 * The built-in {@link HtmlFragmentAdapter} escapes this value by default.
 *
 * **Example** (Create raw HTML)
 *
 * ```ts
 * import { Md } from "@beep/md"
 *
 * const node = Md.rawHtml("<span>trusted</span>")
 * console.log(node._tag) // "rawHtml"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rawHtml = (value: string): RawHtml => RawHtml.make({ value });

/**
 * Creates strong inline content.
 *
 * **Example** (Strong with nested code)
 *
 * ```ts import.meta.vitest name="Strong with nested code"
 * import { Md } from "@beep/md"
 *
 * const node = Md.strong`Hello ${Md.code("beep")}`
 * node._tag // => "strong"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const strong = makeInlineContentBuilder((children): Strong => Strong.make({ children }));

/**
 * Creates emphasized inline content.
 *
 * **Example** (Create emphasized text)
 *
 * ```ts import.meta.vitest name="Create emphasized text"
 * import { Md } from "@beep/md"
 *
 * const node = Md.em("quiet")
 * node._tag // => "em"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const em = makeInlineContentBuilder((children): Em => Em.make({ children }));

/**
 * Creates deleted inline content.
 *
 * **Example** (Create deleted text)
 *
 * ```ts import.meta.vitest name="Create deleted text"
 * import { Md } from "@beep/md"
 *
 * const node = Md.del("removed")
 * node._tag // => "del"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const del = makeInlineContentBuilder((children): Del => Del.make({ children }));

/**
 * Creates an inline code span.
 *
 * **Example** (Create inline code)
 *
 * ```ts import.meta.vitest name="Create inline code"
 * import { Md } from "@beep/md"
 *
 * const node = Md.code("console.log()")
 * node._tag // => "code"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const code = (value: string): Code => Code.make({ value });

/**
 * Creates an inline hyperlink.
 *
 * **Example** (Create hyperlink)
 *
 * ```ts import.meta.vitest name="Create hyperlink"
 * import { Md } from "@beep/md"
 *
 * const node = Md.a("https://example.com", "Example")
 * node._tag // => "a"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const a: {
  (children: InlineContent, options?: { readonly title?: string }): (href: string) => ANode;
  (href: string, children: InlineContent, options?: { readonly title?: string }): ANode;
} = dual(
  isKeyedContentCall,
  (href: string, children: InlineContent, options: { readonly title?: string } = {}): ANode =>
    ANode.make({ href, children: asInlineArray(children), title: O.fromUndefinedOr(options.title) })
);

/**
 * Creates an inline image.
 *
 * **Details**
 *
 * Alternate text lives in the options object so the constructor keeps a single
 * positional argument; omitting it yields the empty alt text.
 *
 * **Example** (Create inline image)
 *
 * ```ts import.meta.vitest name="Create inline image"
 * import { Md } from "@beep/md"
 *
 * const node = Md.img("/logo.png", { alt: "Logo" })
 * node._tag // => "img"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const img: {
  (options?: { readonly alt?: string; readonly title?: string }): (src: string) => Img;
  (src: string, options?: { readonly alt?: string; readonly title?: string }): Img;
} = dual(
  isLeadingContentCall,
  (src: string, options: { readonly alt?: string; readonly title?: string } = {}): Img =>
    Img.make({ src, alt: options.alt ?? "", title: O.fromUndefinedOr(options.title) })
);

/**
 * Creates an inline line break.
 *
 * **Example** (Create line break)
 *
 * ```ts import.meta.vitest name="Create line break"
 * import { Md } from "@beep/md"
 *
 * Md.br._tag // => "br"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const br: Br = Br.make({});

/**
 * Creates inline TeX math content.
 *
 * **Example** (Create inline math)
 *
 * ```ts import.meta.vitest name="Create inline math"
 * import { Md } from "@beep/md"
 *
 * const node = Md.inlineMath("a^2")
 * node._tag // => "inlineMath"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const inlineMath = (value: string): InlineMath => InlineMath.make({ value });

/**
 * Creates an inline footnote reference.
 *
 * **Example** (Create footnote reference)
 *
 * ```ts import.meta.vitest name="Create footnote reference"
 * import { Md } from "@beep/md"
 *
 * const node = Md.footnoteRef("note-1")
 * node._tag // => "footnoteReference"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const footnoteRef = (identifier: string): FootnoteReference =>
  FootnoteReference.make({ identifier: FootnoteIdentifier.make(identifier) });

/**
 * Creates a level-one heading block.
 *
 * **Example** (Create h1 heading)
 *
 * ```ts import.meta.vitest name="Create h1 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h1`Hello ${Md.em("world")}`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h1 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 1, children }));

/**
 * Creates a level-two heading block.
 *
 * **Example** (Create h2 heading)
 *
 * ```ts import.meta.vitest name="Create h2 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h2`Install`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h2 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 2, children }));

/**
 * Creates a level-three heading block.
 *
 * **Example** (Create h3 heading)
 *
 * ```ts import.meta.vitest name="Create h3 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h3`Config`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h3 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 3, children }));

/**
 * Creates a level-four heading block.
 *
 * **Example** (Create h4 heading)
 *
 * ```ts import.meta.vitest name="Create h4 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h4`Details`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h4 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 4, children }));

/**
 * Creates a level-five heading block.
 *
 * **Example** (Create h5 heading)
 *
 * ```ts import.meta.vitest name="Create h5 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h5`Notes`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h5 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 5, children }));

/**
 * Creates a level-six heading block.
 *
 * **Example** (Create h6 heading)
 *
 * ```ts import.meta.vitest name="Create h6 heading"
 * import { Md } from "@beep/md"
 *
 * const node = Md.h6`Footnote`
 * node._tag // => "heading"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const h6 = makeInlineContentBuilder((children): Heading => Heading.make({ level: 6, children }));

/**
 * Creates a paragraph block.
 *
 * **Example** (Create paragraph)
 *
 * ```ts import.meta.vitest name="Create paragraph"
 * import { Md } from "@beep/md"
 *
 * const node = Md.p`Hello ${Md.strong("world")}`
 * node._tag // => "p"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const p = makeInlineContentBuilder((children): PNode => PNode.make({ children }));

/**
 * Creates a list item node.
 *
 * **Example** (Create list item)
 *
 * ```ts import.meta.vitest name="Create list item"
 * import { Md } from "@beep/md"
 *
 * const node = Md.li`Item`
 * node._tag // => "li"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const li = makeListItemContentBuilder((children): Li => Li.make({ children }));

/**
 * Creates an unordered list block.
 *
 * **Example** (Create unordered list)
 *
 * ```ts import.meta.vitest name="Create unordered list"
 * import { Md } from "@beep/md"
 *
 * const node = Md.ul(["One", Md.li("Two")])
 * node._tag // => "ul"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ul = (children: ReadonlyArray<ListItemInput>): Ul => Ul.make({ children: A.map(children, asListItem) });

/**
 * Creates an ordered list block.
 *
 * **Example** (Create ordered list)
 *
 * ```ts import.meta.vitest name="Create ordered list"
 * import { Md } from "@beep/md"
 *
 * const node = Md.ol(["One", "Two"])
 * node._tag // => "ol"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ol: {
  (options?: { readonly start?: number }): (children: ReadonlyArray<ListItemInput>) => Ol;
  (children: ReadonlyArray<ListItemInput>, options?: { readonly start?: number }): Ol;
} = dual(
  isLeadingContentCall,
  (children: ReadonlyArray<ListItemInput>, options: { readonly start?: number } = {}): Ol =>
    Ol.make({
      children: A.map(children, asListItem),
      ...(P.isNumber(options.start) ? { start: OrderedListStart.decodeUnknownSync(options.start) } : {}),
    })
);

/**
 * Creates a GFM task list item.
 *
 * **Example** (Create checked task item)
 *
 * ```ts import.meta.vitest name="Create checked task item"
 * import { Md } from "@beep/md"
 *
 * const node = Md.taskItem("Done", { checked: true })
 * node.checked // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const taskItem: {
  (options?: { readonly checked?: boolean }): (children: ListItemContent) => TaskItem;
  (children: ListItemContent, options?: { readonly checked?: boolean }): TaskItem;
} = dual(
  isLeadingContentCall,
  (children: ListItemContent, options: { readonly checked?: boolean } = {}): TaskItem =>
    TaskItem.make({
      children: asListItemChildren(children),
      ...(P.isBoolean(options.checked) ? { checked: options.checked } : {}),
    })
);

/**
 * Creates a GFM task list from canonical tagged task items.
 *
 * **Example** (Task list from items)
 *
 * ```ts import.meta.vitest name="Task list from items"
 * import { Md } from "@beep/md"
 *
 * const node = Md.taskListFromItems([
 *   Md.taskItem("Done", { checked: true }),
 *   Md.taskItem("Todo"),
 * ])
 * node.children.length // => 2
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const taskListFromItems = (children: ReadonlyArray<TaskListItemSpec>): TaskList => TaskList.make({ children });

/**
 * Creates a block quote container.
 *
 * **Example** (Create blockquote)
 *
 * ```ts import.meta.vitest name="Create blockquote"
 * import { Md } from "@beep/md"
 *
 * const node = Md.blockquote`Hello ${Md.strong("world")}`
 * node._tag // => "blockquote"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const blockquote = makeBlockContentBuilder((children): BlockQuote => BlockQuote.make({ children }));

/**
 * Creates a fenced code block.
 *
 * **Example** (Create fenced code block)
 *
 * ```ts import.meta.vitest name="Create fenced code block"
 * import { Md } from "@beep/md"
 *
 * const node = Md.pre("console.log('beep')", { language: "ts" })
 * node._tag // => "pre"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pre: {
  (options?: { readonly language?: string }): (value: string) => Pre;
  (value: string, options?: { readonly language?: string }): Pre;
} = dual(
  isLeadingContentCall,
  (value: string, options: { readonly language?: string } = {}): Pre =>
    Pre.make({ value, language: O.flatMap(O.fromUndefinedOr(options.language), CodeFenceLanguage.decodeOption) })
);

/**
 * Creates a table cell with inline content.
 *
 * **Example** (Create table cell)
 *
 * ```ts import.meta.vitest name="Create table cell"
 * import { Md } from "@beep/md"
 *
 * const node = Md.tableCell("Name")
 * node._tag // => "tableCell"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const tableCell = (children: InlineContent): TableCell => TableCell.make({ children: asInlineArray(children) });

/**
 * Creates a table row from table cells.
 *
 * **Example** (Create table row)
 *
 * ```ts import.meta.vitest name="Create table row"
 * import { Md } from "@beep/md"
 *
 * const node = Md.tableRow(["Name", "Value"])
 * node._tag // => "tableRow"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const tableRow = (children: ReadonlyArray<TableCellInput>): TableRow =>
  TableRow.make({ children: A.map(children, asTableCell) });

/**
 * Creates a Markdown table block.
 *
 * **Example** (Create table with header)
 *
 * ```ts import.meta.vitest name="Create table with header"
 * import { Md } from "@beep/md"
 *
 * const node = Md.table([["Name", "Value"]], { headerRow: true })
 * node._tag // => "table"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const table: {
  (options?: {
    readonly headerRow?: boolean;
    readonly align?: ReadonlyArray<TableAlignment>;
  }): (children: ReadonlyArray<TableRowInput>) => Table;
  (
    children: ReadonlyArray<TableRowInput>,
    options?: { readonly headerRow?: boolean; readonly align?: ReadonlyArray<TableAlignment> }
  ): Table;
} = dual(
  isLeadingContentCall,
  (
    children: ReadonlyArray<TableRowInput>,
    options: { readonly headerRow?: boolean; readonly align?: ReadonlyArray<TableAlignment> } = {}
  ): Table =>
    Table.make({
      children: A.map(children, asTableRow),
      align: options.align ?? [],
      ...(P.isBoolean(options.headerRow) ? { headerRow: options.headerRow } : {}),
    })
);

/**
 * Creates a display TeX math block.
 *
 * **Example** (Create math block)
 *
 * ```ts import.meta.vitest name="Create math block"
 * import { Md } from "@beep/md"
 *
 * const node = Md.mathBlock("a^2 + b^2 = c^2")
 * node._tag // => "mathBlock"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mathBlock = (value: string): MathBlock => MathBlock.make({ value });

/**
 * Creates a footnote definition block.
 *
 * **Example** (Create footnote definition)
 *
 * ```ts import.meta.vitest name="Create footnote definition"
 * import { Md } from "@beep/md"
 *
 * const node = Md.footnoteDef("note-1", "Body")
 * node._tag // => "footnoteDefinition"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const footnoteDef: {
  (children: BlockContent): (identifier: string) => FootnoteDefinition;
  (identifier: string, children: BlockContent): FootnoteDefinition;
} = dual(
  2,
  (identifier: string, children: BlockContent): FootnoteDefinition =>
    FootnoteDefinition.make({ identifier: FootnoteIdentifier.make(identifier), children: asBlockArray(children) })
);

/**
 * Creates a typed admonition block.
 *
 * **Example** (Create warning admonition)
 *
 * ```ts import.meta.vitest name="Create warning admonition"
 * import { Md } from "@beep/md"
 *
 * const node = Md.admonition("warning", "Careful")
 * node._tag // => "admonition"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const admonition: {
  (children: BlockContent, options?: { readonly title?: string }): (kind: AdmonitionKind) => Admonition;
  (kind: AdmonitionKind, children: BlockContent, options?: { readonly title?: string }): Admonition;
} = dual(
  isKeyedContentCall,
  (kind: AdmonitionKind, children: BlockContent, options: { readonly title?: string } = {}): Admonition =>
    Admonition.make({ kind, title: O.fromUndefinedOr(options.title), children: asBlockArray(children) })
);

/**
 * Creates a safe generalized block embed.
 *
 * **Example** (Create video embed)
 *
 * ```ts import.meta.vitest name="Create video embed"
 * import { Md } from "@beep/md"
 *
 * const node = Md.embed("video", "https://example.com/video", { title: "Demo" })
 * node._tag // => "embed"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const embed: {
  (src: string, options?: { readonly title?: string; readonly description?: string }): (kind: EmbedKind) => Embed;
  (kind: EmbedKind, src: string, options?: { readonly title?: string; readonly description?: string }): Embed;
} = dual(
  isKeyedContentCall,
  (kind: EmbedKind, src: string, options: { readonly title?: string; readonly description?: string } = {}): Embed =>
    Embed.make({
      kind,
      src,
      title: O.fromUndefinedOr(options.title),
      description: O.fromUndefinedOr(options.description),
    })
);

/**
 * Creates the encoded YouTube embed payload decoded by public constructors.
 *
 * **Example** (Create YouTube embed result)
 *
 * ```ts import.meta.vitest name="Create YouTube embed result"
 * import { Result } from "effect"
 * import { Md } from "@beep/md"
 *
 * const result = Md.youtube("M7lc1UVf-VE")
 * Result.isSuccess(result) && result.success._tag === "youtube" // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
const youtubeInput = (videoId: string): YouTube.Encoded => ({ _tag: "youtube", videoId });

/**
 * Creates a YouTube embed block and captures schema validation failures.
 *
 * **Example** (Create YouTube embed)
 *
 * ```ts import.meta.vitest name="Create YouTube embed"
 * import { Md } from "@beep/md"
 * import { Result } from "effect"
 *
 * const result = Md.youtube("M7lc1UVf-VE")
 * Result.isSuccess(result) && result.success._tag === "youtube" // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const youtube = (videoId: string): Result.Result<YouTube, S.SchemaError> =>
  S.decodeResult(YouTube)(youtubeInput(videoId));

/**
 * Effectful YouTube embed constructor.
 *
 * **Example** (Effectful YouTube constructor)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Md } from "@beep/md"
 *
 * const program = Md.youtubeEffect("M7lc1UVf-VE")
 * Effect.runPromise(program).then((node) => console.log(node._tag)) // "youtube"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const youtubeEffect = Effect.fn("Md.youtubeEffect")(function* (videoId: string) {
  return yield* S.decodeEffect(YouTube)(youtubeInput(videoId));
});

/**
 * Creates a YouTube embed block and throws on schema validation failure.
 *
 * **Details**
 *
 * Prefer {@link youtube} or {@link youtubeEffect} at input boundaries.
 *
 * **Example** (Unsafe YouTube constructor)
 *
 * ```ts import.meta.vitest name="Unsafe YouTube constructor"
 * import { Md } from "@beep/md"
 *
 * const node = Md.youtubeUnsafe("M7lc1UVf-VE")
 * node._tag // => "youtube"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const youtubeUnsafe = (videoId: string): YouTube => YouTube.make({ videoId });

/**
 * Creates a horizontal rule block.
 *
 * **Example** (Create horizontal rule)
 *
 * ```ts import.meta.vitest name="Create horizontal rule"
 * import { Md } from "@beep/md"
 *
 * Md.hr._tag // => "hr"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const hr: Hr = Hr.make({});

/**
 * Creates a Markdown document from block children.
 *
 * **Example** (Create Markdown document)
 *
 * ```ts import.meta.vitest name="Create Markdown document"
 * import { Md } from "@beep/md"
 *
 * const document = Md.make([Md.h1`Hello`, Md.p`World`])
 * document._tag // => "document"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: {
  (options?: { readonly frontmatter?: JsonObject }): (children: ReadonlyArray<Block>) => Document;
  (children: ReadonlyArray<Block>, options?: { readonly frontmatter?: JsonObject }): Document;
} = dual(
  isLeadingContentCall,
  (children: ReadonlyArray<Block>, options: { readonly frontmatter?: JsonObject } = {}): Document =>
    P.isUndefined(options.frontmatter)
      ? Document.make({ children })
      : Document.make({ children, frontmatter: O.some(options.frontmatter) })
);

/**
 * Namespace-style public Markdown DSL.
 *
 * **Details**
 *
 * Simple text-oriented block builders such as {@link h1}, {@link h2}, and
 * {@link p} are intended to read naturally as tagged template literals while
 * keeping function-call overloads for dynamic strings and structured inline
 * children.
 *
 * **Example** (Build and render document)
 *
 * ```ts import.meta.vitest name="Build and render document"
 * import { Md } from "@beep/md"
 * import { Result } from "effect"
 *
 * const document = Md.make([Md.h1`Hello`, Md.p`World`])
 * Result.getOrThrow(Md.render(document)) // => "# Hello\n\nWorld"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Md = {
  MarkdownAdapter,
  HtmlFragmentAdapter,
  PlainTextAdapter,
  a,
  admonition,
  blockquote,
  br,
  code,
  decodeSafeDocument,
  decodeSafeDocumentEffect,
  decodeSafeDocumentUnsafe,
  del,
  documentSafetyIssues,
  embed,
  em,
  footnoteDef,
  footnoteRef,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  hr,
  img,
  inlineMath,
  li,
  makeHtmlFragmentAdapter,
  makeMarkdownAdapter,
  make,
  mathBlock,
  ol,
  p,
  pre,
  rawHtml,
  rawMarkdown,
  refineSafeDocument,
  render,
  renderEffectWith,
  renderEffectWithUnsafe,
  renderHtml,
  renderHtmlUnsafe,
  renderPlainText,
  renderPlainTextUnsafe,
  renderSafeHtml,
  renderUnsafe,
  renderWith,
  renderWithUnsafe,
  strong,
  safeHtmlValue,
  table,
  tableCell,
  tableRow,
  taskItem,
  taskListFromItems,
  text,
  ul,
  youtube,
  youtubeEffect,
  youtubeUnsafe,
} as const;
