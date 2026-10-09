// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The block pass: `incorporateLine` and the scanner state it drives
// (`advanceOffset`, `advanceNextNonspace`, `findNextNonspace`, `addLine`,
// `addChild`, `finalize`, `closeUnmatchedBlocks`), plus the materialization
// step that turns the mutable block tree into mdast-shaped nodes.
//
// Port notes, four changes from upstream:
//
// 1. Offsets. Upstream tracks `lineNumber`/`column` and nothing else; every
//    scanner mutation here also has an absolute source offset behind it
//    (`lineStart + offset`), because the edit layer splices on offsets and
//    reconstructing them after the fact is not possible once tabs are
//    expanded and container prefixes stripped. `addLine` records the source
//    provenance of everything it copies (see `blockTypes.ts`).
// 2. The construct and block-start tables are per-dialect and injected
//    (`blockRegistry.ts`) rather than module globals.
// 3. Upstream mutates one `Node` type into the rendered AST; this port keeps
//    a private mutable `BlockNode` for the pass and materializes the
//    immutable schema classes afterwards, so no half-built node is ever
//    reachable from a public type.
// 4. Materialization runs in two walks: definitions are built and indexed
//    first, because the inline pass resolves references against the refmap and
//    a definition may follow the paragraph that references it.
//
// Imports node classes from `../MarkdownNode.js` (the sanctioned exception to
// the cycle firewall) and nothing else public.

import type { Definition } from "../MarkdownNode.ts";
import { Frontmatter, Point, Position, Root } from "../MarkdownNode.ts";
import type { MarkdownDialect } from "./blockRegistry.ts";
import { blockDialect } from "./blockRegistry.ts";
import type { FrontmatterCapture } from "./blocks/frontmatter.ts";
import { scanFrontmatter } from "./blocks/frontmatter.ts";
import { isHtmlBlockEnd } from "./blocks/htmlBlock.ts";
import type {
	BlockConstruct,
	BlockDialect,
	BlockNode,
	BlockScanner,
	BlockType,
	InlineHost,
	MaterializeContext,
	MaterializedBlock,
	PreparedInline,
	RawInlineSlice,
} from "./blockTypes.ts";
import { makeBlockNode } from "./blockTypes.ts";
import type { RawDiagnostic } from "./carriers.ts";
import { GuardExceeded } from "./carriers.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import { LineIndex } from "./lineIndex.ts";
import type { SourceLine } from "./preprocess.ts";
import { columnsToNextTabStop, preprocessLines } from "./preprocess.ts";
import { prepareInline } from "./rawInline.ts";

/** Upstream's cheap pre-filter: a line that cannot start any block. */
const reMaybeSpecial = /^[#`~*+_=<>0-9-]/;

/** What the block pass hands to the inline pass and the facade. */
export interface BlockPassResult {
	/** The document, with every node positioned. */
	readonly root: Root;
	/** Leaf-block raw text awaiting the inline pass. */
	readonly rawInlines: ReadonlyArray<RawInlineSlice>;
	/** Non-fatal engine diagnostics; the facade materializes them. */
	readonly carriers: ReadonlyArray<RawDiagnostic>;
	/**
	 * Every {@link Definition} in the tree, keyed by its case-folded label,
	 * first definition winning.
	 *
	 * The definitions stay in `root` as well — this map is a lookup index
	 * over them, not a place they were moved to. References are emitted
	 * unresolved, so whoever resolves them (the inline pass, a renderer, a
	 * consumer) does it against this.
	 */
	readonly refmap: ReadonlyMap<string, Definition>;
	/**
	 * The case-folded label of every GFM footnote definition in the tree.
	 *
	 * The GFM counterpart of `refmap`, and a SET rather than a map for a
	 * structural reason: a footnote definition's own children are inline-parsed
	 * during materialization, and that parse consults this index, so the index
	 * cannot hold materialized nodes without a cycle. Formation only ever asks
	 * whether a label exists; the definitions themselves stay in `root` at
	 * their source position, where a consumer resolves against them.
	 *
	 * Always empty under the `commonmark` dialect, which has no such construct.
	 */
	readonly footnoteLabels: ReadonlySet<string>;
}

class BlockParser implements BlockScanner {
	private readonly lines: ReadonlyArray<SourceLine>;
	private readonly lineIndex: LineIndex;
	private readonly dialect: BlockDialect;
	/**
	 * The dialect's NAME, kept alongside its block tables because the inline
	 * pass keys its own registry off the same string.
	 */
	private readonly dialectName: MarkdownDialect;
	private readonly sourceLength: number;

	private readonly doc: BlockNode;
	private tipNode: BlockNode | undefined;
	private oldtip: BlockNode;
	private lastMatchedContainer: BlockNode;

	currentLine = "";
	lineStart = 0;
	lineNumber = 0;
	offset = 0;
	column = 0;
	nextNonspace = 0;
	nextNonspaceColumn = 0;
	indent = 0;
	indented = false;
	blank = false;
	allClosed = true;

	private partiallyConsumedTab = false;
	private lastLineLength = 0;
	private readonly frontmatterCapture: FrontmatterCapture | null;

	constructor(text: string, dialect: BlockDialect, dialectName: MarkdownDialect, frontmatter = false) {
		this.lines = preprocessLines(text);
		// The capture is an offset-0 pre-scan, not a block start: it may fire
		// at most once, before any line enters the loop, so it lives outside
		// the dialect registries entirely (see blocks/frontmatter.ts).
		this.frontmatterCapture = frontmatter ? scanFrontmatter(this.lines, text) : null;
		// The index is built from the preprocessor's OWN line table, not from a
		// second scan of the text: the two disagree about bare `\r`, and a
		// document with one would otherwise report line numbers off by however
		// many it contains. One addition the preprocessor deliberately omits:
		// a text ending in `\n` has a phantom empty final line whose start is
		// `text.length`, and unist point mapping (vfile, mdast-util) places the
		// end-of-input offset on it (`line N+1, column 1`) rather than clamping
		// into the last content line. Only the root's end point can sit there.
		const starts = this.lines.map((line) => line.start);
		if (text.endsWith("\n")) {
			starts.push(text.length);
		}
		this.lineIndex = LineIndex.fromLineStarts(text, starts);
		this.sourceLength = text.length;
		this.dialect = dialect;
		this.dialectName = dialectName;
		this.doc = makeBlockNode("document", 0, 1);
		this.tipNode = this.doc;
		this.oldtip = this.doc;
		this.lastMatchedContainer = this.doc;
	}

	/**
	 * The deepest open block. Only reachable while the document is open — a
	 * read after the final finalize is a wiring bug and dies as a defect.
	 */
	get tip(): BlockNode {
		const tip = this.tipNode;
		if (tip === undefined) {
			throw new TypeError("block parser: the tip was read after the document was finalized");
		}
		return tip;
	}

	private constructOf(type: BlockType): BlockConstruct {
		const construct = this.dialect.constructs.get(type);
		if (construct === undefined) {
			throw new TypeError(`block parser: no construct registered for block type ${type}`);
		}
		return construct;
	}

	// --- scanner ------------------------------------------------------------

	advanceOffset(count: number, columns = false): void {
		const line = this.currentLine;
		let remaining = count;
		let char = line.charAt(this.offset);

		while (remaining > 0 && char !== "") {
			if (char === "\t") {
				const charsToTab = columnsToNextTabStop(this.column);
				if (columns) {
					this.partiallyConsumedTab = charsToTab > remaining;
					const charsToAdvance = charsToTab > remaining ? remaining : charsToTab;
					this.column += charsToAdvance;
					this.offset += this.partiallyConsumedTab ? 0 : 1;
					remaining -= charsToAdvance;
				} else {
					this.partiallyConsumedTab = false;
					this.column += charsToTab;
					this.offset += 1;
					remaining -= 1;
				}
			} else {
				this.partiallyConsumedTab = false;
				this.offset += 1;
				// Block starts are ASCII, so one character is one column.
				this.column += 1;
				remaining -= 1;
			}
			char = line.charAt(this.offset);
		}
	}

	advanceNextNonspace(): void {
		this.offset = this.nextNonspace;
		this.column = this.nextNonspaceColumn;
		this.partiallyConsumedTab = false;
	}

	findNextNonspace(): void {
		const line = this.currentLine;
		let index = this.offset;
		let cols = this.column;
		let char = line.charAt(index);

		while (char !== "") {
			if (char === " ") {
				index += 1;
				cols += 1;
			} else if (char === "\t") {
				index += 1;
				cols += columnsToNextTabStop(cols);
			} else {
				break;
			}
			char = line.charAt(index);
		}

		this.blank = char === "\n" || char === "\r" || char === "";
		this.nextNonspace = index;
		this.nextNonspaceColumn = cols;
		this.indent = this.nextNonspaceColumn - this.column;
		this.indented = this.indent >= 4;
	}

	addLine(): void {
		const tip = this.tip;

		if (this.partiallyConsumedTab) {
			// The tab straddles the container prefix: consume it and pad out to
			// the tab stop. Those spaces come from no source character, so they
			// deliberately fall outside every segment.
			this.offset += 1;
			tip.stringContent += " ".repeat(columnsToNextTabStop(this.column));
		}

		const content = this.currentLine.slice(this.offset);
		tip.segments.push({
			textOffset: tip.stringContent.length,
			sourceOffset: this.lineStart + this.offset,
			length: content.length,
		});
		tip.stringContent += `${content}\n`;
	}

	addChild(type: BlockType, offsetInLine: number): BlockNode {
		while (!this.constructOf(this.tip.type).canContain(type)) {
			this.finalizeBlock(this.tip, this.lineNumber - 1);
		}

		const parent = this.tip;
		const depth = parent.depth + 1;
		if (depth > MAX_NESTING_DEPTH) {
			// The hardening guard. Container nesting is the block pass's only
			// unbounded recursion surface — the line loop itself is iterative —
			// and materialization walks whatever this builds, so refusing here
			// is what keeps the walk inside the stack. The facade materializes
			// the typed error; the engine only ever throws the raw carrier.
			throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, this.lineStart + offsetInLine);
		}

		const child = makeBlockNode(type, this.lineStart + offsetInLine, this.lineNumber, depth);
		child.parent = parent;
		parent.children.push(child);
		this.tipNode = child;
		return child;
	}

	setScanPosition(offset: number, column: number): void {
		this.offset = offset;
		this.column = column;
	}

	setLastLineLength(length: number): void {
		this.lastLineLength = length;
	}

	replaceBlock(block: BlockNode, type: BlockType): BlockNode {
		const parent = block.parent;
		const replacement = makeBlockNode(type, block.startOffset, block.startLine, block.depth);
		replacement.parent = parent;
		replacement.stringContent = block.stringContent;
		replacement.segments.push(...block.segments);
		replacement.endOffset = block.endOffset;
		replacement.endLine = block.endLine;

		if (parent !== undefined) {
			const at = parent.children.indexOf(block);
			if (at === -1) {
				parent.children.push(replacement);
			} else {
				parent.children[at] = replacement;
			}
		}

		block.open = false;
		this.tipNode = replacement;
		return replacement;
	}

	insertBefore(block: BlockNode, type: BlockType): BlockNode {
		const parent = block.parent;
		const sibling = makeBlockNode(type, block.startOffset, block.startLine, block.depth);
		sibling.parent = parent;
		// Closed on arrival: it is a block the parser has already read past, so
		// the container-match loop must never descend into it, and the tip is
		// deliberately left where the caller had it.
		sibling.open = false;

		if (parent !== undefined) {
			const at = parent.children.indexOf(block);
			if (at === -1) {
				parent.children.push(sibling);
			} else {
				parent.children.splice(at, 0, sibling);
			}
		}
		return sibling;
	}

	closeUnmatchedBlocks(): void {
		if (this.allClosed) {
			return;
		}
		while (this.oldtip !== this.lastMatchedContainer) {
			const parent = this.oldtip.parent;
			this.finalizeBlock(this.oldtip, this.lineNumber - 1);
			this.oldtip = parent ?? this.doc;
		}
		this.allClosed = true;
	}

	finalizeBlock(block: BlockNode, lineNumber: number): void {
		const above = block.parent;
		block.open = false;
		block.endLine = lineNumber;
		block.endOffset = this.endOfLine(lineNumber, this.lastLineLength);
		this.constructOf(block.type).finalize?.(this, block);
		this.tipNode = above;
	}

	/**
	 * The absolute offset `length` characters into line `lineNumber` — the
	 * offset form of upstream's `sourcepos[1] = [lineNumber, lastLineLength]`.
	 * Out-of-range line numbers clamp rather than throw.
	 */
	private endOfLine(lineNumber: number, length: number): number {
		const index = Math.min(Math.max(lineNumber - 1, 0), this.lines.length - 1);
		const line = this.lines[index];
		if (line === undefined) {
			return 0;
		}
		return line.start + Math.min(Math.max(length, 0), line.text.length);
	}

	// --- the line loop ------------------------------------------------------

	private incorporateLine(line: SourceLine): void {
		let container = this.doc;

		this.oldtip = this.tip;
		this.offset = 0;
		this.column = 0;
		this.blank = false;
		this.partiallyConsumedTab = false;
		this.lineNumber += 1;
		this.currentLine = line.text;
		this.lineStart = line.start;

		// Match each open container against this line; bail at the first that
		// fails, leaving `container` on the deepest one that matched.
		let lastChild = container.children[container.children.length - 1];
		while (lastChild !== undefined && lastChild.open) {
			container = lastChild;
			this.findNextNonspace();

			const verdict = this.constructOf(container.type).continue(this, container);
			if (verdict === 2) {
				// The construct consumed the whole line (a closing fence).
				return;
			}
			if (verdict === 1) {
				// Upstream's `all_matched` flag lives only to reach this branch
				// on the next statement, so it collapses into the branch itself.
				container = container.parent ?? this.doc;
				break;
			}

			lastChild = container.children[container.children.length - 1];
		}

		this.allClosed = container === this.oldtip;
		this.lastMatchedContainer = container;

		let matchedLeaf = container.type !== "paragraph" && this.constructOf(container.type).acceptsLines;
		const starts = this.dialect.starts;

		while (!matchedLeaf) {
			this.findNextNonspace();

			// Upstream's fast path: no block can start here, so stop looking —
			// unless the dialect has a construct the filter cannot see (GFM
			// table rows begin on any character there is).
			if (!this.indented) {
				const rest = this.currentLine.slice(this.nextNonspace);
				if (!reMaybeSpecial.test(rest) && !(this.dialect.mayStartBlock?.(rest, container) ?? false)) {
					this.advanceNextNonspace();
					break;
				}
			}

			let index = 0;
			while (index < starts.length) {
				const start = starts[index];
				const result = start === undefined ? 0 : start.trigger(this, container);
				if (result === 1) {
					container = this.tip;
					break;
				}
				if (result === 2) {
					container = this.tip;
					matchedLeaf = true;
					break;
				}
				index += 1;
			}

			if (index === starts.length) {
				this.advanceNextNonspace();
				break;
			}
		}

		// Whatever is left at the scan position is text; give it to a block.
		if (!this.allClosed && !this.blank && this.tip.type === "paragraph") {
			// Lazy paragraph continuation: a line that failed to match the open
			// containers, but is non-blank and lands on an open paragraph,
			// belongs to that paragraph anyway — and crucially the unmatched
			// containers are NOT closed, because the paragraph is still inside
			// them. That is why this arm skips `closeUnmatchedBlocks` entirely.
			this.addLine();
		} else {
			this.closeUnmatchedBlocks();

			if (this.constructOf(container.type).acceptsLines) {
				this.addLine();
				// An HTML block of type 1 through 5 ends on the line that
				// carries its closing pattern, which is only knowable after
				// that line has been appended.
				if (container.type === "html" && isHtmlBlockEnd(container, this.currentLine.slice(this.offset))) {
					this.lastLineLength = this.currentLine.length;
					this.finalizeBlock(container, this.lineNumber);
				}
			} else if (this.offset < this.currentLine.length && !this.blank) {
				container = this.addChild("paragraph", this.offset);
				this.advanceNextNonspace();
				this.addLine();
			}
		}

		this.lastLineLength = this.currentLine.length;
	}

	// --- materialization ----------------------------------------------------

	/**
	 * Prepend the captured frontmatter node, when there is one. The root's
	 * own span widens to cover the block if the body ended before it — the
	 * frontmatter-only document, where the block pass saw no lines at all.
	 */
	private withFrontmatter(root: Root): Root {
		const capture = this.frontmatterCapture;
		if (capture === null) {
			return root;
		}
		const node = Frontmatter.make({
			type: "frontmatter",
			format: capture.format,
			value: capture.value,
			position: this.position(0, capture.endOffset),
		});
		const position =
			root.position.end.offset >= capture.endOffset ? root.position : this.position(0, capture.endOffset);
		return Root.make({
			type: "root",
			children: [node, ...root.children],
			position,
		});
	}

	private position(startOffset: number, endOffset: number): Position {
		const start = Math.min(Math.max(startOffset, 0), this.sourceLength);
		const end = Math.min(Math.max(endOffset, start), this.sourceLength);
		const startPoint = this.lineIndex.positionAt(start);
		const endPoint = this.lineIndex.positionAt(end);
		return Position.make({
			start: Point.make({ line: startPoint.line, column: startPoint.column, offset: start }),
			end: Point.make({ line: endPoint.line, column: endPoint.column, offset: end }),
		});
	}

	/**
	 * Depth-first materialization. Recursion depth is container nesting depth,
	 * which `addChild`'s `MAX_NESTING_DEPTH` guard caps at parse time — this
	 * walk can never see a tree the line loop refused to build.
	 */
	private materializeBlock(
		block: BlockNode,
		context: MaterializeContext,
		definitions: ReadonlyMap<BlockNode, Definition>,
	): MaterializedBlock | undefined {
		const children: MaterializedBlock[] = [];
		for (const child of block.children) {
			const node = this.materializeBlock(child, context, definitions);
			if (node !== undefined && node.type !== "root") {
				children.push(node);
			}
		}

		// A definition was already built by the refmap pre-pass; reusing that
		// node is what keeps the tree and the refmap pointing at one object.
		const definition = definitions.get(block);
		if (definition !== undefined) {
			return definition;
		}

		return this.constructOf(block.type).materialize(block, children, context);
	}

	/**
	 * Index every reference target in the tree — link reference definitions and
	 * GFM footnote definition labels — before anything else is built.
	 *
	 * The inline pass resolves references against these, and a definition can
	 * appear anywhere, including after the paragraph that references it, so
	 * both maps have to exist before the first leaf is parsed. Walking twice is
	 * the price; the alternative is a mutable tree the inline pass patches
	 * afterwards.
	 *
	 * Link reference definitions are MATERIALIZED here, so the tree and the
	 * refmap point at one object. Footnote definitions deliberately are not:
	 * a footnote definition is a container whose children are flow blocks, and
	 * materializing those runs the inline pass over them — which consults this
	 * very map. Only the labels are collected, which is all formation needs,
	 * and the nodes are built in document order by the ordinary walk. That is
	 * why `footnoteLabels` is a set of labels rather than a map to nodes; a
	 * consumer wanting the node walks the tree, where it still sits.
	 */
	private collectReferences(
		block: BlockNode,
		context: MaterializeContext,
		nodes: Map<BlockNode, Definition>,
		refmap: Map<string, Definition>,
		footnoteLabels: Set<string>,
	): void {
		if (block.type === "definition") {
			const materialized = this.constructOf(block.type).materialize(block, [], context);
			const key = block.data.definition?.key;
			if (materialized?.type === "definition" && key !== undefined) {
				nodes.set(block, materialized);
				// First definition wins, which is CommonMark's rule and the
				// order this walk visits in.
				if (!refmap.has(key)) {
					refmap.set(key, materialized);
				}
			}
			return;
		}

		const footnoteKey = block.data.footnote?.key;
		if (footnoteKey !== undefined) {
			footnoteLabels.add(footnoteKey);
		}

		for (const child of block.children) {
			this.collectReferences(child, context, nodes, refmap, footnoteLabels);
		}
	}

	parse(): BlockPassResult {
		// A captured frontmatter block never enters the line loop: the pass
		// starts on the line after the closing fence, with `lineNumber`
		// pre-advanced so every position downstream stays absolute.
		const skippedLines = this.frontmatterCapture?.lineCount ?? 0;
		this.lineNumber = skippedLines;
		for (let index = skippedLines; index < this.lines.length; index += 1) {
			const line = this.lines[index];
			if (line !== undefined) {
				this.incorporateLine(line);
			}
		}

		while (this.tipNode !== undefined) {
			this.finalizeBlock(this.tipNode, this.lines.length);
		}

		// The root spans the entire input, trailing line ending included — the
		// span every ecosystem producer (micromark, mdast-util-from-markdown)
		// emits for `root`, pinned by the vendored interop corpus, and the
		// natural whole-document range for the edit layer. Block-level
		// finalization above ends at the last content character; this widens
		// only the document node.
		this.doc.endOffset = this.sourceLength;

		// A real Map: link labels are attacker-controlled, so a `__proto__`
		// label must be a key and not a prototype write.
		const refmap = new Map<string, Definition>();
		// A real Set for the same reason the refmap is a real Map: footnote
		// labels are attacker-controlled, so `__proto__` must be a member and
		// not a prototype write.
		const footnoteLabels = new Set<string>();
		const definitionNodes = new Map<BlockNode, Definition>();
		const rawInlines: RawInlineSlice[] = [];

		const context: MaterializeContext = {
			position: (start, end) => this.position(start, end),
			inlineSlice: (block) =>
				prepareInline(block, (start, end) => this.position(start, end), refmap, this.dialectName, footnoteLabels),
			registerInline: (parent: InlineHost, prepared: PreparedInline) => {
				rawInlines.push({
					parent,
					text: prepared.text,
					startOffset: prepared.startOffset,
					segments: prepared.segments,
				});
			},
		};

		this.collectReferences(this.doc, context, definitionNodes, refmap, footnoteLabels);

		const materialized = this.materializeBlock(this.doc, context, definitionNodes);
		if (materialized === undefined || materialized.type !== "root") {
			throw new TypeError("block parser: the document construct did not materialize a root");
		}

		const root = this.withFrontmatter(materialized);

		return { root, rawInlines, carriers: [], refmap, footnoteLabels };
	}
}

/**
 * Run the block pass over `text`.
 *
 * Every node carries a complete {@link Position}, leaf blocks have their
 * inline content parsed, and `rawInlines` reports the raw text each leaf was
 * built from.
 */
// The engine's default is the BASE dialect the registries compose on top of —
// not the public default, which is `"gfm"` and lives in the facade's
// `dialectOf`. The facade always passes its resolved dialect explicitly, so
// this default only ever serves engine-level callers (tests, mostly) that
// mean "the substrate".
// A dialect string can also be input text, so optional arguments make the two call forms ambiguous.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const parseBlocks = (
	text: string,
	dialect: MarkdownDialect = "commonmark",
	frontmatter = false,
): BlockPassResult => new BlockParser(text, blockDialect(dialect), dialect, frontmatter).parse();
