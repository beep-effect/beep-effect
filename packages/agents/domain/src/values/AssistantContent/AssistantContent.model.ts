/**
 * AssistantContent value-object model — the stratified (non-recursive)
 * block-to-inline subset of rich text used for forced-tool structured outputs. Blocks contain
 * inlines and inlines contain nothing, so the schema is non-recursive. Field
 * annotations become JSON-Schema descriptions that steer generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $AgentsDomainId.create("values/AssistantContent/AssistantContent.model");
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/u;

/**
 * **Example** (Decode bold text inline)
 *
 * ```ts
 * import { TextInline } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const inline = S.decodeUnknownSync(TextInline)({
 *   type: "text",
 *   text: "Hello",
 *   bold: true,
 * })
 * console.log(inline.text)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TextInline extends S.Opaque<TextInline, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("text"),
    text: S.String.annotateKey({ description: "The visible text content" }),
    bold: S.optionalKey(S.Boolean.annotate({ description: "Render bold" })).annotateKey({ description: "Render bold" }),
    italic: S.optionalKey(S.Boolean.annotate({ description: "Render italic" })).annotateKey({
      description: "Render italic",
    }),
    code: S.optionalKey(S.Boolean.annotate({ description: "Render as inline code" })).annotateKey({
      description: "Render as inline code",
    }),
  }).pipe(
    $I.annoteSchema("TextInline", {
      description: "A run of styled text.",
    })
  )
) {}

/**
 * **Example** (Decode hyperlink inline)
 *
 * ```ts
 * import { LinkInline } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const inline = S.decodeUnknownSync(LinkInline)({
 *   type: "link",
 *   url: "https://example.com",
 *   text: "Example",
 * })
 * console.log(inline.url)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LinkInline extends S.Opaque<LinkInline, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("link"),
    url: S.String.annotateKey({ description: "Absolute http(s) url" }),
    text: S.String.annotateKey({ description: "The visible link text" }),
  }).pipe(
    $I.annoteSchema("LinkInline", {
      description: "A hyperlink.",
    })
  )
) {}

const InlineNodeUntagged = pipe(
  S.Union([TextInline, LinkInline]),
  $I.annoteSchema("InlineNode", {
    description: "Inline content held by an assistant block.",
  })
);

/**
 * Inline content held by an assistant block.
 *
 * **Example** (Decode text inline node)
 *
 * ```ts
 * import { InlineNode } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownSync(InlineNode)({ type: "text", text: "Hello" })
 * console.log(node.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const InlineNode = InlineNodeUntagged.pipe(S.toTaggedUnion("type"));

/**
 * Type accepted by the {@link InlineNode} schema.
 *
 * **Example** (Annotate a constructed InlineNode)
 *
 * ```ts
 * import { type InlineNode, TextInline } from "@beep/agents-domain/values/AssistantContent"
 *
 * const inline: InlineNode = TextInline.make({ text: "Hello" })
 * console.log(inline.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type InlineNode = typeof InlineNode.Type;

const ParagraphBlockInlineNode = InlineNode.pipe($I.annoteSchema("ParagraphBlockInlineNode"));
const HeadingBlockInlineNode = InlineNode.pipe($I.annoteSchema("HeadingBlockInlineNode"));
const QuoteBlockInlineNode = InlineNode.pipe($I.annoteSchema("QuoteBlockInlineNode"));
const ListItemInlineNode = InlineNode.pipe($I.annoteSchema("ListItemInlineNode"));
const TableCellBlockInlineNode = InlineNode.pipe($I.annoteSchema("TableCellBlockInlineNode"));

/**
 * **Example** (Access heading tag enum)
 *
 * ```ts
 * import { AssistantHeadingTag } from "@beep/agents-domain/values/AssistantContent"
 *
 * const headingTag = AssistantHeadingTag.Enum.h2
 * console.log(AssistantHeadingTag.is.h2(headingTag))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AssistantHeadingTag = LiteralKit(["h1", "h2", "h3"]).pipe(
  $I.annoteSchema("AssistantHeadingTag", {
    description: "Heading tags supported by assistant-content heading blocks.",
  })
);

/**
 * **Example** (Satisfy heading tag type)
 *
 * ```ts
 * import type { AssistantHeadingTag } from "@beep/agents-domain/values/AssistantContent"
 *
 * const headingTag = "h2" satisfies AssistantHeadingTag
 * console.log(headingTag)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type AssistantHeadingTag = typeof AssistantHeadingTag.Type;

/**
 * **Example** (Decode paragraph block)
 *
 * ```ts
 * import { ParagraphBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(ParagraphBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ParagraphBlock extends S.Opaque<ParagraphBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("paragraph"),
    children: S.Array(ParagraphBlockInlineNode).annotateKey({ description: "Inline content in order" }),
  }).pipe(
    $I.annoteSchema("ParagraphBlock", {
      description: "A paragraph of inline content.",
    })
  )
) {}

/**
 * **Example** (Decode heading block)
 *
 * ```ts
 * import { HeadingBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(HeadingBlock)({
 *   type: "heading",
 *   level: "h1",
 *   children: [{ type: "text", text: "Title" }],
 * })
 * console.log(block.level)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class HeadingBlock extends S.Opaque<HeadingBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("heading"),
    level: AssistantHeadingTag.annotateKey({ description: "Heading level" }),
    children: S.Array(HeadingBlockInlineNode).annotateKey({ description: "Inline content in order" }),
  }).pipe(
    $I.annoteSchema("HeadingBlock", {
      description: "A section heading.",
    })
  )
) {}

/**
 * **Example** (Decode quote block)
 *
 * ```ts
 * import { QuoteBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(QuoteBlock)({
 *   type: "quote",
 *   children: [{ type: "text", text: "Quote" }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class QuoteBlock extends S.Opaque<QuoteBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("quote"),
    children: S.Array(QuoteBlockInlineNode).annotateKey({ description: "Inline content in order" }),
  }).pipe(
    $I.annoteSchema("QuoteBlock", {
      description: "A block quotation.",
    })
  )
) {}

/**
 * **Example** (Access list type enum)
 *
 * ```ts
 * import { AssistantListType } from "@beep/agents-domain/values/AssistantContent"
 *
 * const listType = AssistantListType.Enum.bullet
 * console.log(AssistantListType.is.bullet(listType))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AssistantListType = LiteralKit(["bullet", "number"]).pipe(
  $I.annoteSchema("AssistantListType", {
    description: "List markers supported by assistant-content list blocks.",
  })
);

/**
 * **Example** (Satisfy list type)
 *
 * ```ts
 * import type { AssistantListType } from "@beep/agents-domain/values/AssistantContent"
 *
 * const listType = "bullet" satisfies AssistantListType
 * console.log(listType)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type AssistantListType = typeof AssistantListType.Type;

/**
 * **Example** (Make list item)
 *
 * ```ts
 * import { ListItem } from "@beep/agents-domain/values/AssistantContent"
 *
 * const item = ListItem.make({ children: [{ type: "text", text: "Item" }] })
 * console.log(item.children.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ListItem extends S.Opaque<ListItem, { readonly brand: unique symbol }>()(
  S.Struct({
    children: S.Array(ListItemInlineNode).annotateKey({ description: "Inline content of the item" }),
  }).pipe(
    $I.annoteSchema("ListItem", {
      description: "A single item within a list block.",
    })
  )
) {}

/**
 * **Example** (Decode bullet list block)
 *
 * ```ts
 * import { ListBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(ListBlock)({
 *   type: "list",
 *   listType: "bullet",
 *   items: [{ children: [{ type: "text", text: "Item" }] }],
 * })
 * console.log(block.listType)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ListBlock extends S.Opaque<ListBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("list"),
    listType: AssistantListType.annotateKey({ description: "Bulleted or numbered list" }),
    items: S.Array(ListItem).annotateKey({ description: "List items in order" }),
  }).pipe(
    $I.annoteSchema("ListBlock", {
      description: "A flat list of items.",
    })
  )
) {}

/**
 * **Example** (Decode TypeScript code block)
 *
 * ```ts
 * import { CodeBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(CodeBlock)({
 *   type: "code",
 *   language: "typescript",
 *   code: "console.log('beep')",
 * })
 * console.log(block.code)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class CodeBlock extends S.Opaque<CodeBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("code"),
    language: S.optionalKey(S.String.annotate({ description: "Language identifier, e.g. typescript" })).annotateKey({
      description: "Language identifier, e.g. typescript",
    }),
    code: S.String.annotateKey({ description: "Raw source code without fences" }),
  }).pipe(
    $I.annoteSchema("CodeBlock", {
      description: "A fenced code block.",
    })
  )
) {}

/**
 * **Example** (Decode table cell)
 *
 * ```ts
 * import { TableCellBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const cell = S.decodeUnknownSync(TableCellBlock)({
 *   children: [{ type: "text", text: "Name" }],
 * })
 * console.log(cell.children.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TableCellBlock extends S.Opaque<TableCellBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    children: S.Array(TableCellBlockInlineNode).annotateKey({ description: "Inline content of the cell" }),
  }).pipe(
    $I.annoteSchema("TableCellBlock", {
      description: "A single table cell in an assistant-generated table.",
    })
  )
) {}

/**
 * **Example** (Decode table row)
 *
 * ```ts
 * import { TableRowBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(TableRowBlock)({
 *   cells: [{ children: [{ type: "text", text: "Name" }] }],
 * })
 * console.log(row.cells.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TableRowBlock extends S.Opaque<TableRowBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: S.Array(TableCellBlock).annotateKey({ description: "Cells in column order" }),
  }).pipe(
    $I.annoteSchema("TableRowBlock", {
      description: "A single row in an assistant-generated table.",
    })
  )
) {}

const isRectangularNonEmptyTableRows = (rows: ReadonlyArray<TableRowBlock>): boolean =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => false,
      onSome: (firstRow) => {
        const width = A.length(firstRow.cells);
        return width > 0 && A.every(rows, (row) => A.length(row.cells) === width);
      },
    })
  );

const RectangularTableRows = S.Array(TableRowBlock)
  .check(
    S.makeFilter(
      isRectangularNonEmptyTableRows,
      $I.annote("RectangularTableRowsCheck", {
        title: "Rectangular Table Rows",
        description: "Checks that table rows are non-empty and have the same non-zero cell count.",
        message:
          "Tables must contain at least one row, at least one cell, and every row must have the same cell count.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("RectangularTableRows", {
      description: "Non-empty assistant table rows with a consistent non-zero cell count.",
    })
  );

const YouTubeVideoId = S.String.check(
  S.isPattern(
    youtubeVideoIdPattern,
    $I.annote("YouTubeVideoIdPatternCheck", {
      title: "YouTube Video ID",
      description: "Checks that a YouTube embed references only the bare 11-character video id.",
      message: "YouTube blocks must use the bare 11-character video id, not a URL.",
    })
  )
).pipe(
  $I.annoteSchema("YouTubeVideoId", {
    description: "Bare 11-character YouTube video id accepted by assistant content blocks.",
  })
);

/**
 * **Example** (Decode table with header)
 *
 * ```ts
 * import { TableBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(TableBlock)({
 *   type: "table",
 *   headerRow: true,
 *   rows: [{ cells: [{ children: [{ type: "text", text: "Name" }] }] }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TableBlock extends S.Opaque<TableBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("table"),
    headerRow: S.optionalKey(S.Boolean.annotate({ description: "Render the first row as a header row" })).annotateKey({
      description: "Render the first row as a header row",
    }),
    rows: RectangularTableRows.annotateKey({
      description: "Rows in order; every row must have the same number of cells",
    }),
  }).pipe(
    $I.annoteSchema("TableBlock", {
      description: "A rectangular data table.",
    })
  )
) {}

/**
 * **Example** (Decode YouTube video block)
 *
 * ```ts
 * import { YouTubeBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(YouTubeBlock)({ type: "youtube", videoId: "dQw4w9WgXcQ" })
 * console.log(block.videoId)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class YouTubeBlock extends S.Opaque<YouTubeBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("youtube"),
    videoId: YouTubeVideoId.annotateKey({
      description: "The bare 11-character YouTube video id; extract it from watch/share/embed URLs.",
    }),
  }).pipe(
    $I.annoteSchema("YouTubeBlock", {
      description: "An embedded YouTube video.",
    })
  )
) {}

/**
 * **Example** (Decode paragraph assistant block)
 *
 * ```ts
 * import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const block = S.decodeUnknownSync(AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AssistantBlock = pipe(
  S.Union([ParagraphBlock, HeadingBlock, QuoteBlock, ListBlock, CodeBlock, TableBlock, YouTubeBlock]),
  $I.annoteSchema("AssistantBlock", {
    description: "A single block of an assistant turn.",
  }),
  S.toTaggedUnion("type")
);

/**
 * **Example** (Annotate a constructed AssistantBlock)
 *
 * ```ts
 * import { type AssistantBlock, ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent"
 *
 * const block: AssistantBlock = ParagraphBlock.make({
 *   children: [TextInline.make({ text: "Hello" })],
 * })
 * console.log(block.type)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type AssistantBlock = typeof AssistantBlock.Type;

/**
 * A complete assistant turn as structured rich text. This is the forced-tool
 * structured-output envelope the model fills in.
 *
 * **Example** (Decode assistant content)
 *
 * ```ts
 * import { AssistantContent } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 *
 * const content = S.decodeUnknownSync(AssistantContent)({
 *   blocks: [{ type: "paragraph", children: [{ type: "text", text: "Hello" }] }],
 * })
 * console.log(content.blocks.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class AssistantContent extends S.Opaque<AssistantContent, { readonly brand: unique symbol }>()(
  S.Struct({
    blocks: S.Array(AssistantBlock).annotateKey({
      description: "The assistant response as an ordered list of rich-text blocks",
    }),
  }).pipe(
    $I.annoteSchema("AssistantContent", {
      description: "A complete assistant turn as structured rich text.",
    })
  )
) {}
