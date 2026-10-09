// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream keeps the block-construct table (`blocks`), the
// block-start array (`blockStarts`) and the parser itself in one file, with
// each construct reaching into parser internals by name. Here the vocabulary
// the two sides share is extracted into this leaf so the registry can import
// the construct modules and the construct modules can import these types
// without closing an import cycle (`noImportCycles` is error-level).
//
// The mutable `BlockNode` is upstream's `Node` during the block pass only. It
// never leaves the engine: `blockParser.ts` materializes the immutable,
// mdast-shaped `MarkdownNode` classes from it once the tree is closed. Two
// fields have no upstream counterpart, both serving the offset delta —
// `startOffset`/`endOffset`, and the `segments` that map accumulated string
// content back to the source it was copied from.

import { dual } from "effect/Function";
import { isString } from "effect/Predicate";
import type {
	BulletChar,
	FenceChar,
	FlowContent,
	Heading,
	HeadingDepth,
	HeadingStyle,
	ListDelimiter,
	ListItem,
	Paragraph,
	PhrasingContent,
	Position,
	Root,
	TableAlign,
	TableCell,
	TableRow,
	ThematicBreakChar,
} from "../MarkdownNode.ts";

/**
 * The block constructs the engine knows. Keys of a dialect's construct table.
 *
 * **Details**
 *
 * `definition` has no block start of its own: link reference definitions are
 * split out of a paragraph's content when it closes, and spliced into the
 * tree ahead of what is left of that paragraph.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BlockType =
	| "document"
	| "blockquote"
	| "list"
	| "listItem"
	| "paragraph"
	| "heading"
	| "thematicBreak"
	| "code"
	| "html"
	| "definition"
	| "footnoteDefinition"
	| "table"
	| "tableRow"
	| "tableCell";

/**
 * A run of characters copied verbatim from the source into a leaf block's
 * accumulated content.
 *
 * **Details**
 *
 * The block pass strips container prefixes and expands tabs, so a leaf's
 * content is not a contiguous source slice. Each segment pins one run that
 * IS contiguous, which is what lets the inline pass give its nodes
 * absolute source positions instead of guessing. Characters the engine
 * injects — the `\n` between lines, the spaces a partially consumed tab
 * expands to — lie between segments and belong to no source range.
 *
 * @category models
 * @since 0.0.0
 */
export interface RawInlineSegment {
	/** Index into the block's accumulated content where this run starts. */
	readonly textOffset: number;
	/** Absolute source offset of that same character. */
	readonly sourceOffset: number;
	/** Length of the run, in characters. */
	readonly length: number;
}

/**
 * A node that owns parsed phrasing content — the parent side of a
 * {@link RawInlineSlice}.
 *
 * **Details**
 *
 * A GFM table cell is one of these even though it is not a leaf block: cells
 * are the block pass's other inline host, and they go through the same
 * `inlineSlice`/`registerInline` seam every leaf does.
 *
 * @category type-level
 * @since 0.0.0
 */
export type InlineHost = Paragraph | Heading | TableCell;

/**
 * A leaf block's raw inline text, handed to the inline pass.
 *
 * **Details**
 *
 * `parent` is the materialized node the parsed children belong to; `text` is
 * the trimmed content; `startOffset` is where `text` begins in the source,
 * and `segments` maps the rest of it (see {@link RawInlineSegment}).
 *
 * @category models
 * @since 0.0.0
 */
export interface RawInlineSlice {
	readonly parent: InlineHost;
	readonly text: string;
	readonly startOffset: number;
	readonly segments: ReadonlyArray<RawInlineSegment>;
}

/**
 *  A leaf's inline text prepared for materialization, before it has a parent.
 *
 * @category models
 * @since 0.0.0
 */
export interface PreparedInline {
	readonly text: string;
	readonly startOffset: number;
	readonly endOffset: number;
	readonly segments: ReadonlyArray<RawInlineSegment>;
	/** The temporary passthrough children (see `rawInline.ts`). */
	readonly children: ReadonlyArray<PhrasingContent>;
}

/**
 * Construct-specific state carried on a {@link BlockNode} during the pass —
 * upstream's `_level`, `_isFenced`, `_listData` and friends, gathered into one
 * bag. Every field is optional and none is ever assigned `undefined`
 * explicitly (`exactOptionalPropertyTypes` is on).
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockData {
	/** Heading depth, set by the ATX and setext starts. */
	level?: HeadingDepth;
	/** Which spelling produced a heading. */
	headingStyle?: HeadingStyle;
	/** Which character drew a thematic break. */
	markerChar?: ThematicBreakChar;
	/** Fenced code: set by the fenced-code start, absent for indented code. */
	isFenced?: boolean;
	fenceChar?: FenceChar;
	fenceLength?: number;
	fenceOffset?: number;
	/** Fenced code info string, split at finalize. */
	lang?: string;
	meta?: string;
	/** HTML block kind, 1 through 7. */
	htmlBlockType?: number;
	/** List and list-item bookkeeping. */
	listData?: ListData;
	/**
	 * A GFM task-list item's checkbox state, set by the task-list block start
	 * and absent on every item that carried no marker (and under every dialect
	 * that has no such start).
	 */
	checked?: boolean;
	/** mdast's `spread`, computed for a list and each of its items at finalize. */
	spread?: boolean;
	/** A split-out link reference definition (see {@link BlockType}). */
	definition?: DefinitionData;
	/** A GFM footnote definition's label, set by the footnote block start. */
	footnote?: FootnoteData;
	/** GFM table bookkeeping, set by the table block starts. */
	tableData?: TableData;
	/**
	 * Set on a paragraph whose delimiter row failed to match its header —
	 * cmark-gfm's `CMARK_NODE__TABLE_VISITED`, which stops a paragraph being
	 * rescanned for a table once for every line it goes on to absorb.
	 */
	tableVisited?: boolean;
}

/**
 *  A GFM table's parsed shape, carried on the table block.
 *
 * @category models
 * @since 0.0.0
 */
export interface TableData {
	/** The header's column count; every row is truncated or padded to it. */
	readonly columns: number;
	/** One entry per column, `null` where the delimiter row declared none. */
	readonly align: ReadonlyArray<TableAlign | null>;
	/** Rows added so far, and cells among them that came from real source. */
	rows: number;
	nonemptyCells: number;
}

/**
 *  A parsed link reference definition, awaiting materialization.
 *
 * @category models
 * @since 0.0.0
 */
export interface DefinitionData {
	/** The case-folded lookup key. */
	readonly key: string;
	/** mdast's `identifier`: the normalized label, lowercased. */
	readonly identifier: string;
	/** mdast's `label`: the raw label text. */
	readonly label: string;
	/** The decoded destination — never percent-encoded (`references.ts`). */
	readonly url: string;
	readonly title?: string;
}

/**
 * A GFM footnote definition's label, carried on the block.
 *
 * **Details**
 *
 * The fold happens once, at the block start, so the label map the inline pass
 * consults and the node's `identifier` can never disagree.
 *
 * @category models
 * @since 0.0.0
 */
export interface FootnoteData {
	/** The case-folded lookup key. */
	readonly key: string;
	/** mdast's `identifier`: the normalized label, lowercased. */
	readonly identifier: string;
	/** mdast's `label`: the raw label text, as written. */
	readonly label: string;
}

/**
 *  A list marker's parsed shape, upstream's `_listData`.
 *
 * @category models
 * @since 0.0.0
 */
export interface ListData {
	type: "bullet" | "ordered";
	tight: boolean;
	bulletChar?: BulletChar;
	start?: number;
	delimiter?: ListDelimiter;
	padding: number;
	markerOffset: number;
}

/**
 * A block under construction. Mutable by design — the block pass appends
 * lines and children to it across the line loop — and engine-private.
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockNode {
	readonly type: BlockType;
	parent: BlockNode | undefined;
	readonly children: BlockNode[];
	/** False once the block has been finalized. */
	open: boolean;
	/** Accumulated line content, for constructs whose `acceptsLines` is true. */
	stringContent: string;
	/** Source provenance of `stringContent` (see {@link RawInlineSegment}). */
	readonly segments: RawInlineSegment[];
	startOffset: number;
	endOffset: number;
	startLine: number;
	endLine: number;
	/**
	 * Distance from the document, which is depth 0. Recorded at open time so
	 * the nesting guard is a comparison rather than a walk up the parents.
	 */
	readonly depth: number;
	readonly data: BlockData;
}

/**
 * A construct's `continue` verdict for the current line.
 *
 * **Details**
 *
 * - `0` — the block continues.
 * - `1` — it does not; close it.
 * - `2` — the line is fully consumed (a fence close); go to the next line.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BlockContinueResult = 0 | 1 | 2;

/**
 * A block start's verdict.
 *
 * **Details**
 *
 * - `0` — no match.
 * - `1` — a container opened; keep looking for starts inside it.
 * - `2` — a leaf opened; stop looking.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BlockStartResult = 0 | 1 | 2;

/**
 * The parser surface a construct may drive: upstream's scanner state and the
 * handful of parser methods its `blockStarts` functions call, as an
 * interface so constructs never import the parser (and cannot cycle).
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockScanner {
	/** The current line, terminator stripped. */
	readonly currentLine: string;
	/** Absolute source offset of `currentLine[0]`. */
	readonly lineStart: number;
	/** 1-based number of the current line. */
	readonly lineNumber: number;
	/** Character index into `currentLine` of the scan position. */
	readonly offset: number;
	/** Tab-expanded column of the scan position. */
	readonly column: number;
	/** Character index of the next non-whitespace character. */
	readonly nextNonspace: number;
	/** Tab-expanded column of that character. */
	readonly nextNonspaceColumn: number;
	/** Columns of indentation between the scan position and `nextNonspace`. */
	readonly indent: number;
	/** Whether `indent` reaches the code-indent threshold. */
	readonly indented: boolean;
	/** Whether the rest of the line is blank. */
	readonly blank: boolean;
	/** The deepest open block. */
	readonly tip: BlockNode;
	/** Whether every open block matched this line. */
	readonly allClosed: boolean;
	/** Advance `count` characters, or `count` columns when `columns` is true. */
	advanceOffset(count: number, columns?: boolean): void;
	/** Jump the scan position to `nextNonspace`. */
	advanceNextNonspace(): void;
	/**
	 * Recompute `nextNonspace`, `nextNonspaceColumn`, `indent`, `indented` and
	 * `blank` from the scan position.
	 *
	 * **Details**
	 *
	 * Upstream's `S_find_first_nonspace`, which the line loop runs before each
	 * pass over the block starts and `add_text_to_container` runs again before
	 * it decides what to do with the rest of the line. A construct that
	 * consumes characters and then STOPS the start scan has to re-establish it
	 * itself, because the loop it exited will not.
	 */
	findNextNonspace(): void;
	/** Finalize every open block that failed to match this line. */
	closeUnmatchedBlocks(): void;
	/** Open a block of `type` as a child of the tip, starting at `offsetInLine`. */
	addChild(type: BlockType, offsetInLine: number): BlockNode;
	/**
	 * Rewind the scan position, upstream's direct `parser.offset`/
	 * `parser.column` assignment in `parseListMarker`. Deliberately does NOT
	 * clear the partially-consumed-tab flag: upstream's assignment does not
	 * either, and the caller re-establishes it on the next `advanceOffset`.
	 */
	setScanPosition(offset: number, column: number): void;
	/**
	 * Override the length the next `finalize` treats the current line as
	 * having — upstream's `parser.lastLineLength` write in the closing-fence
	 * path, where the block ends mid-line rather than at its end.
	 */
	setLastLineLength(length: number): void;
	/**
	 * Swap `block` for a fresh block of `type` carrying its position, content
	 * and segments, and make it the tip. Upstream's
	 * `insertAfter` + `unlink` pair in the setext-heading start.
	 */
	replaceBlock(block: BlockNode, type: BlockType): BlockNode;
	/**
	 * Open a closed block of `type` as `block`'s immediately preceding sibling,
	 * without disturbing the tip.
	 *
	 * **Details**
	 *
	 * cmark-gfm's `cmark_node_insert_before` in the table header reclaim: when
	 * a paragraph becomes a table, the lines above the header row have to go
	 * back into the tree as the paragraph they were.
	 */
	insertBefore(block: BlockNode, type: BlockType): BlockNode;
	/** Close `block`, ending it at the end of `lineNumber`. */
	finalizeBlock(block: BlockNode, lineNumber: number): void;
	/** Append the rest of the current line to the tip's content. */
	addLine(): void;
}

/**
 * What a construct materializes into: flow content, a list item, a table row
 * or cell, or the root.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MaterializedBlock = Root | FlowContent | ListItem | TableRow | TableCell;

/**
 *  Services a construct needs to turn its {@link BlockNode} into a real node.
 *
 * @category models
 * @since 0.0.0
 */
export interface MaterializeContext {
	/** Build a {@link Position} from an absolute source range. */
	position(startOffset: number, endOffset: number): Position;
	/** Trim and prepare a leaf's accumulated content for the inline pass. */
	inlineSlice(block: BlockNode): PreparedInline;
	/** Record a leaf's raw inline text against the node that will own it. */
	registerInline(parent: InlineHost, prepared: PreparedInline): void;
}

/**
 * One block construct: upstream's entry in the `blocks` table, plus the
 * `materialize` step this port adds (upstream renders its own node type, so
 * it has no equivalent).
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockConstruct {
	readonly type: BlockType;
	/** Whether the construct absorbs line content (upstream's `acceptsLines`). */
	readonly acceptsLines: boolean;
	/** Whether a block of `child` may be opened inside this one. */
	canContain(child: BlockType): boolean;
	/** Whether this block continues on the scanner's current line. */
	continue(scanner: BlockScanner, block: BlockNode): BlockContinueResult;
	/** Post-processing when the block closes. */
	finalize?(scanner: BlockScanner, block: BlockNode): void;
	/**
	 * Build the immutable node. Returning `undefined` drops the block from the
	 * tree (an emptied paragraph, for instance).
	 */
	materialize(
		block: BlockNode,
		children: ReadonlyArray<MaterializedBlock>,
		context: MaterializeContext,
	): MaterializedBlock | undefined;
}

/**
 *  Narrow materialized children to the flow content most constructs contain.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select paragraph content from mixed children)
 *
 * ```ts
 * import { flowChildren } from "@beep/scratchpad/effected/markdown/internal/blockTypes";
 * import { ListItem, Paragraph } from "@beep/scratchpad/effected/markdown/MarkdownNode";
 *
 * const paragraph = Paragraph.make({ children: [] });
 * const item = ListItem.make({ children: [] });
 * const children = flowChildren([item, paragraph]);
 *
 * console.log(children.length, children[0]?.type) // 1 paragraph
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const flowChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<FlowContent> =>
	children.filter(
		(child): child is FlowContent =>
			child.type !== "root" && child.type !== "listItem" && child.type !== "tableRow" && child.type !== "tableCell",
	);

/**
 *  Narrow materialized children to the list items a list contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select list items from mixed children)
 *
 * ```ts
 * import { listItemChildren } from "@beep/scratchpad/effected/markdown/internal/blockTypes";
 * import { ListItem, Paragraph } from "@beep/scratchpad/effected/markdown/MarkdownNode";
 *
 * const paragraph = Paragraph.make({ children: [] });
 * const item = ListItem.make({ children: [] });
 * const children = listItemChildren([paragraph, item]);
 *
 * console.log(children.length, children[0]?.type) // 1 listItem
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const listItemChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<ListItem> =>
	children.filter((child): child is ListItem => child.type === "listItem");

/**
 *  Narrow materialized children to the rows a table contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select table rows from mixed children)
 *
 * ```ts
 * import { tableRowChildren } from "@beep/scratchpad/effected/markdown/internal/blockTypes";
 * import { TableCell, TableRow } from "@beep/scratchpad/effected/markdown/MarkdownNode";
 *
 * const cell = TableCell.make({ children: [] });
 * const row = TableRow.make({ children: [cell] });
 * const children = tableRowChildren([cell, row]);
 *
 * console.log(children.length, children[0]?.type) // 1 tableRow
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const tableRowChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<TableRow> =>
	children.filter((child): child is TableRow => child.type === "tableRow");

/**
 *  Narrow materialized children to the cells a table row contains.
 *
 * **Details**
 *
 * Nonmatching nodes are omitted. Matching nodes keep their input order and
 * object identity; the input collection is unchanged.
 *
 * **Example** (Select table cells from mixed children)
 *
 * ```ts
 * import { tableCellChildren } from "@beep/scratchpad/effected/markdown/internal/blockTypes";
 * import { TableCell, TableRow } from "@beep/scratchpad/effected/markdown/MarkdownNode";
 *
 * const cell = TableCell.make({ children: [] });
 * const row = TableRow.make({ children: [cell] });
 * const children = tableCellChildren([row, cell]);
 *
 * console.log(children.length, children[0]?.type) // 1 tableCell
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const tableCellChildren = (children: ReadonlyArray<MaterializedBlock>): ReadonlyArray<TableCell> =>
	children.filter((child): child is TableCell => child.type === "tableCell");

/**
 *  One entry of a dialect's ordered block-start table.
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockStart {
	/** Diagnostic name; the table's order is what the algorithm depends on. */
	readonly name: string;
	trigger(scanner: BlockScanner, container: BlockNode): BlockStartResult;
}

/**
 *  A dialect: a construct table plus an ordered block-start table, nothing more.
 *
 * @category models
 * @since 0.0.0
 */
export interface BlockDialect {
	readonly constructs: ReadonlyMap<BlockType, BlockConstruct>;
	readonly starts: ReadonlyArray<BlockStart>;
	/**
	 * An escape hatch from the line loop's fast path.
	 *
	 * **Details**
	 *
	 * commonmark.js skips the whole block-start table when the line cannot
	 * begin any CommonMark construct (`reMaybeSpecial`). cmark-gfm has no such
	 * filter, so a dialect whose constructs start on other characters — a GFM
	 * table row starts on anything at all — says so here, and the loop tries
	 * its starts anyway. Absent means the CommonMark filter is the whole truth.
	 */
	readonly mayStartBlock?: (rest: string, container: BlockNode) => boolean;
}

/**
 *  Open a fresh {@link BlockNode}.
 *
 * **Details**
 *
 * The new block is open, has no parent or children, and starts with empty
 * content, segments and construct data. Its end position initially equals
 * its start position. Depth defaults to zero; the curried form accepts the
 * source position before the block type.
 *
 * **Example** (Open a paragraph at its source position)
 *
 * ```ts
 * import { makeBlockNode } from "@beep/scratchpad/effected/markdown/internal/blockTypes";
 *
 * const block = makeBlockNode("paragraph", 12, 3, 1);
 *
 * console.log(block.type, block.open, block.startOffset, block.depth) // paragraph true 12 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBlockNode: {
	(type: BlockType, startOffset: number, startLine: number, depth?: number): BlockNode;
	(startOffset: number, startLine: number, depth?: number): (type: BlockType) => BlockNode;
} = dual((args) => isString(args[0]), (type: BlockType, startOffset: number, startLine: number, depth = 0): BlockNode => ({
	type,
	depth,
	parent: undefined,
	children: [],
	open: true,
	stringContent: "",
	segments: [],
	startOffset,
	endOffset: startOffset,
	startLine,
	endLine: startLine,
	data: {},
}));
