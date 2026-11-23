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

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { blockDialect, MarkdownDialect } from "./blockRegistry.ts";
import { scanFrontmatter } from "./blocks/frontmatter.ts";
import { isHtmlBlockEnd } from "./blocks/htmlBlock.ts";
import { BlockScanner, makeBlockNode, RawInlineSlice } from "./blockTypes.ts";
import { GuardExceeded } from "./carriers.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import { LineIndex } from "./lineIndex.ts";
import { trustedNode } from "./nodes.ts";
import { unitAt } from "./patterns.ts";
import { columnsToNextTabStop, matchesAt, preprocessLines } from "./preprocess.ts";
import { prepareInline } from "./rawInline.ts";
import type { FrontmatterCapture } from "./blocks/frontmatter.ts";
import type {
  BlockConstruct,
  BlockDialect,
  BlockNode,
  BlockStartResult,
  BlockType,
  InlineHost,
  MaterializeContext,
  MaterializedBlock,
  PreparedInline,
} from "./blockTypes.ts";
import type { RawDiagnostic } from "./carriers.ts";
import type { Definition, Frontmatter, MarkdownNode, Point, Position, Root } from "./nodes.ts";
import type { SourceLine } from "./preprocess.ts";

const $I = $MarkdownId.create("internal/blockParser");

/** A block-parser invariant was violated. */
class BlockParserError extends S.TaggedError<BlockParserError, { readonly brand: unique symbol }>($I`BlockParserError`)(
  "BlockParserError",
  {
    message: S.String.pipe(
      $I.annoteKey("BlockParserError.message", { description: "The block-parser invariant failure message." })
    ),
  },
  $I.annoteError<BlockParserError>("BlockParserError", { description: "A block-parser invariant was violated." })
) {}

/** Upstream's cheap pre-filter, sticky at the scan position: a line that cannot start any block. */
const reMaybeSpecial = /[#`~*+_=<>0-9-]/y;

const endsWithNewline = Str.endsWith("\n");

/** The last child of `block`, read by index: the line loop asks once per open container per line. */
const lastChildOf = (block: BlockNode): BlockNode | undefined => block.children[block.children.length - 1];

/**
 * Carries the block-pass document and indexes to the inline pass and facade.
 *
 * **Details**
 *
 * An engine pass result (D-42), not a wire record: it carries live
 * `HashMap`/`HashSet` indexes and a tree that has not been admitted yet. The
 * facade admits `root` exactly once (D-39), so a schema `make` here would be
 * a second whole-tree walk on every parse.
 *
 * **Example** (Read the definition index of a block pass)
 *
 * ```ts
 * import { parseBlocks } from "@beep/markdown/internal/blockParser"
 *
 * const pass = parseBlocks("[a]: /url\n")
 * console.log(pass.definitionOrder.length, pass.root.type) // 1 root
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockPassResult {
  /** Non-fatal engine diagnostics; the facade materializes them. */
  readonly carriers: ReadonlyArray<RawDiagnostic>;
  /** Winning normalized labels and definition nodes, in document order. */
  readonly definitionOrder: ReadonlyArray<readonly [string, Definition]>;
  /**
   * The case-folded label of every GFM footnote definition in the tree.
   *
   * **Details**
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
  readonly footnoteLabels: HashSet.HashSet<string>;
  /** Leaf-block raw text awaiting the inline pass. */
  readonly rawInlines: ReadonlyArray<RawInlineSlice>;
  /**
   * Every {@link Definition} in the tree, keyed by its case-folded label,
   * first definition winning.
   *
   * **Details**
   *
   * The definitions stay in `root` as well — this map is a lookup index
   * over them, not a place they were moved to. References are emitted
   * unresolved, so whoever resolves them (the inline pass, a renderer, a
   * consumer) does it against this.
   */
  readonly refmap: HashMap.HashMap<string, Definition>;
  /** The document, with every node positioned. */
  readonly root: Root;

  constructor(root: Root, rawInlines: ReadonlyArray<RawInlineSlice>, references: ReferenceIndex) {
    this.root = root;
    this.rawInlines = rawInlines;
    this.carriers = [];
    this.refmap = references.refmap;
    this.definitionOrder = references.definitionOrder;
    this.footnoteLabels = references.footnoteLabels;
  }
}

/**
 * The reference targets the pre-pass collects before anything is built: the
 * engine-internal accumulator of `collectReferences` (D-42).
 */
class ReferenceIndex {
  readonly definitionNodes = MutableHashMap.empty<number, Definition>();
  readonly definitionOrder: Array<readonly [string, Definition]> = [];
  footnoteLabels = HashSet.empty<string>();
  refmap = HashMap.empty<string, Definition>();
  private readonly seen = MutableHashMap.empty<string, Definition>();

  /** Index one materialized definition; the first one per label wins (CommonMark's rule). */
  addDefinition(startOffset: number, key: string, definition: Definition): void {
    MutableHashMap.set(this.definitionNodes, startOffset, definition);
    if (!MutableHashMap.has(this.seen, key)) {
      MutableHashMap.set(this.seen, key, definition);
      this.definitionOrder.push([key, definition]);
    }
  }

  /** Freeze the lookup map once every definition is indexed. */
  seal(): void {
    this.refmap = HashMap.fromIterable(this.definitionOrder);
  }
}

class BlockParser extends BlockScanner {
  private readonly lines: ReadonlyArray<SourceLine.Encoded>;
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

  constructor(text: string, dialect: BlockDialect, dialectName: MarkdownDialect, frontmatter: boolean) {
    super();
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
    const starts = A.map(this.lines, (line) => line.start);
    if (endsWithNewline(text)) {
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
      throw BlockParserError.make({ message: "block parser: the tip was read after the document was finalized" });
    }
    return tip;
  }

  private constructOf(type: BlockType): BlockConstruct {
    return this.dialect.construct(type);
  }

  // --- scanner ------------------------------------------------------------

  /**
   * Consume one tab at the scan position: a whole tab stop, or — when
   * advancing by columns and fewer than a stop's worth remain — only part of
   * one, leaving the tab itself unconsumed. Returns what was consumed from
   * the `remaining` budget.
   */
  private advanceTab(remaining: number, columns: boolean): number {
    const charsToTab = columnsToNextTabStop(this.column);
    if (!columns) {
      this.partiallyConsumedTab = false;
      this.column += charsToTab;
      this.offset += 1;
      return 1;
    }
    this.partiallyConsumedTab = charsToTab > remaining;
    const charsToAdvance = this.partiallyConsumedTab ? remaining : charsToTab;
    this.column += charsToAdvance;
    this.offset += this.partiallyConsumedTab ? 0 : 1;
    return charsToAdvance;
  }

  readonly advanceOffset: BlockScanner["advanceOffset"] = dual(
    (args) => P.isNumber(args[0]),
    (count: number, columns = false): void => {
      const line = this.currentLine;
      let remaining = count;
      let char = unitAt(line, this.offset);

      while (remaining > 0 && char !== "") {
        if (char === "\t") {
          remaining -= this.advanceTab(remaining, columns);
        } else {
          this.partiallyConsumedTab = false;
          this.offset += 1;
          // Block starts are ASCII, so one character is one column.
          this.column += 1;
          remaining -= 1;
        }
        char = unitAt(line, this.offset);
      }
    }
  );

  advanceNextNonspace(): void {
    this.offset = this.nextNonspace;
    this.column = this.nextNonspaceColumn;
    this.partiallyConsumedTab = false;
  }

  findNextNonspace(): void {
    const line = this.currentLine;
    let index = this.offset;
    let cols = this.column;
    let char = unitAt(line, index);

    while (char === " " || char === "\t") {
      index += 1;
      cols += char === " " ? 1 : columnsToNextTabStop(cols);
      char = unitAt(line, index);
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
      tip.stringContent += Str.repeat(columnsToNextTabStop(this.column))(" ");
    }

    const content = Str.slice(this.offset)(this.currentLine);
    tip.segments.push({
      textOffset: tip.stringContent.length,
      sourceOffset: this.lineStart + this.offset,
      length: content.length,
    });
    tip.stringContent += `${content}\n`;
  }

  readonly addChild: BlockScanner["addChild"] = dual(2, (type: BlockType, offsetInLine: number): BlockNode => {
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
      throw GuardExceeded.new("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, this.lineStart + offsetInLine);
    }

    const child = makeBlockNode(type, this.lineStart + offsetInLine, this.lineNumber, depth);
    child.parent = parent;
    parent.children.push(child);
    this.tipNode = child;
    return child;
  });

  readonly setScanPosition: BlockScanner["setScanPosition"] = dual(2, (offset: number, column: number): void => {
    this.offset = offset;
    this.column = column;
  });

  setLastLineLength(length: number): void {
    this.lastLineLength = length;
  }

  readonly replaceBlock: BlockScanner["replaceBlock"] = dual(2, (block: BlockNode, type: BlockType): BlockNode => {
    const parent = block.parent;
    const replacement = makeBlockNode(type, block.startOffset, block.startLine, block.depth);
    replacement.parent = parent;
    replacement.stringContent = block.stringContent;
    for (const segment of block.segments) {
      replacement.segments.push(segment);
    }
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
  });

  readonly insertBefore: BlockScanner["insertBefore"] = dual(2, (block: BlockNode, type: BlockType): BlockNode => {
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
  });

  closeUnmatchedBlocks(): void {
    if (this.allClosed) {
      return;
    }
    while (this.oldtip !== this.lastMatchedContainer) {
      const parent = this.oldtip.parent;
      this.finalizeBlock(this.oldtip, this.lineNumber - 1);
      this.oldtip = O.getOrThrow(O.fromUndefinedOr(parent));
    }
    this.allClosed = true;
  }

  readonly finalizeBlock: BlockScanner["finalizeBlock"] = dual(2, (block: BlockNode, lineNumber: number): void => {
    const above = block.parent;
    block.open = false;
    block.endLine = lineNumber;
    block.endOffset = this.endOfLine(lineNumber, this.lastLineLength);
    this.constructOf(block.type).finalize?.(this, block);
    this.tipNode = above;
  });

  /**
   * The absolute offset `length` characters into line `lineNumber` — the
   * offset form of upstream's `sourcepos[1] = [lineNumber, lastLineLength]`.
   * Out-of-range line numbers clamp rather than throw.
   */
  private endOfLine(lineNumber: number, length: number): number {
    const index = Math.min(Math.max(lineNumber - 1, 0), this.lines.length - 1);
    // preprocessLines always supplies at least one line, including for
    // empty input, and the index is clamped to that nonempty table.
    const line = A.getUnsafe(this.lines, index);
    return line.start + Math.min(Math.max(length, 0), line.text.length);
  }

  // --- the line loop ------------------------------------------------------
  //
  // `incorporateLine` is upstream's, split at its three natural seams: match
  // the open containers, open new blocks, then add the rest of the line as
  // text. Each phase is a method; the order and every branch are upstream's.

  private incorporateLine(line: SourceLine.Encoded): void {
    this.oldtip = this.tip;
    this.offset = 0;
    this.column = 0;
    this.blank = false;
    this.partiallyConsumedTab = false;
    this.lineNumber += 1;
    this.currentLine = line.text;
    this.lineStart = line.start;

    const matched = this.matchContainers();
    if (matched === undefined) {
      // A construct consumed the whole line (a closing fence).
      return;
    }

    this.allClosed = matched === this.oldtip;
    this.lastMatchedContainer = matched;

    const opened = this.openNewBlocks(matched);
    this.addTextToContainer(opened);
    this.lastLineLength = this.currentLine.length;
  }

  /**
   * Match each open container against this line; stop at the first that
   * fails, returning the deepest one that matched — or `undefined` when a
   * construct consumed the whole line.
   */
  private matchContainers(): BlockNode | undefined {
    let container = this.doc;
    let lastChild = lastChildOf(container);
    while (lastChild?.open === true) {
      container = lastChild;
      this.findNextNonspace();

      const verdict = this.constructOf(container.type).continue(this, container);
      if (verdict === 2) {
        return undefined;
      }
      if (verdict === 1) {
        // Upstream's `all_matched` flag lives only to reach this branch
        // on the next statement, so it collapses into the branch itself.
        return O.getOrThrow(O.fromUndefinedOr(container.parent));
      }
      lastChild = lastChildOf(container);
    }
    return container;
  }

  /**
   * Whether no block can start at the scan position — upstream's fast path —
   * unless the dialect has a construct the filter cannot see (GFM table rows
   * begin on any character there is).
   */
  private cannotStartBlock(container: BlockNode): boolean {
    if (this.indented) {
      return false;
    }
    return (
      !matchesAt(reMaybeSpecial, this.currentLine, this.nextNonspace) &&
      !(this.dialect.mayStartBlock?.(this, container) ?? false)
    );
  }

  /**
   * Try the dialect's block starts in order at the scan position. Returns the
   * first nonzero verdict, or `0` when none of them fired.
   */
  private tryBlockStarts(container: BlockNode): BlockStartResult {
    for (const start of this.dialect.starts) {
      const result = start.trigger(this, container);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  }

  /**
   * Open new blocks while the line keeps starting them, returning the
   * container the rest of the line belongs to.
   */
  private openNewBlocks(matched: BlockNode): BlockNode {
    let container = matched;
    let matchedLeaf = container.type !== "paragraph" && this.constructOf(container.type).acceptsLines;

    while (!matchedLeaf) {
      this.findNextNonspace();
      const result = this.cannotStartBlock(container) ? 0 : this.tryBlockStarts(container);
      if (result === 0) {
        this.advanceNextNonspace();
        break;
      }
      container = this.tip;
      matchedLeaf = result === 2;
    }
    return container;
  }

  /** Whatever is left at the scan position is text; give it to a block. */
  private addTextToContainer(opened: BlockNode): void {
    if (!this.allClosed && !this.blank && this.tip.type === "paragraph") {
      // Lazy paragraph continuation: a line that failed to match the open
      // containers, but is non-blank and lands on an open paragraph,
      // belongs to that paragraph anyway — and crucially the unmatched
      // containers are NOT closed, because the paragraph is still inside
      // them. That is why this arm skips `closeUnmatchedBlocks` entirely.
      this.addLine();
      return;
    }

    this.closeUnmatchedBlocks();

    if (this.constructOf(opened.type).acceptsLines) {
      this.addLine();
      // An HTML block of type 1 through 5 ends on the line that carries its
      // closing pattern, which is only knowable after that line has been
      // appended.
      if (opened.type === "html" && isHtmlBlockEnd(opened, Str.slice(this.offset)(this.currentLine))) {
        this.lastLineLength = this.currentLine.length;
        this.finalizeBlock(opened, this.lineNumber);
      }
    } else if (this.offset < this.currentLine.length && !this.blank) {
      this.addChild("paragraph", this.offset);
      this.advanceNextNonspace();
      this.addLine();
    }
  }

  // --- materialization ----------------------------------------------------

  /**
   * Prepend the captured frontmatter node, when there is one. The root
   * already spans the entire source, including frontmatter-only documents.
   */
  private withFrontmatter(root: Root): Root {
    const capture = this.frontmatterCapture;
    if (capture === null) {
      return root;
    }
    const node = trustedNode<Frontmatter>({
      type: "frontmatter",
      format: capture.format,
      value: capture.value,
      position: this.position(0, capture.endOffset),
    });
    return trustedNode<Root>({ type: "root", children: [node, ...root.children], position: root.position });
  }

  private position(startOffset: number, endOffset: number): Position {
    const start = Math.min(Math.max(startOffset, 0), this.sourceLength);
    const end = Math.min(Math.max(endOffset, start), this.sourceLength);
    const startPoint = this.lineIndex.positionAt(start);
    const endPoint = this.lineIndex.positionAt(end);
    return trustedNode<Position>({
      start: trustedNode<Point>({ line: startPoint.line, column: startPoint.column, offset: start }),
      end: trustedNode<Point>({ line: endPoint.line, column: endPoint.column, offset: end }),
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
    definitions: MutableHashMap.MutableHashMap<number, Definition>
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
    // Definition source offsets are unique; containers can share an offset,
    // so only a definition block consults this primitive-keyed index.
    const definition =
      block.type === "definition" ? O.getOrUndefined(MutableHashMap.get(definitions, block.startOffset)) : undefined;
    if (definition !== undefined) {
      return definition;
    }

    return this.constructOf(block.type).materialize(block, children, context);
  }

  /**
   * Index every reference target in the tree — link reference definitions and
   * GFM footnote definition labels — before anything else is built.
   *
   * **Details**
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
  private collectReferences(block: BlockNode, context: MaterializeContext, index: ReferenceIndex): void {
    if (block.type === "definition") {
      this.collectDefinition(block, context, index);
      return;
    }

    const footnoteKey = block.data.footnote?.key;
    if (footnoteKey !== undefined) {
      index.footnoteLabels = HashSet.add(index.footnoteLabels, footnoteKey);
    }

    for (const child of block.children) {
      this.collectReferences(child, context, index);
    }
  }

  private collectDefinition(block: BlockNode, context: MaterializeContext, index: ReferenceIndex): void {
    const materialized = this.constructOf(block.type).materialize(block, [], context);
    const key = block.data.definition?.key;
    if (materialized?.type === "definition" && key !== undefined) {
      index.addDefinition(block.startOffset, key, materialized);
    }
  }

  private validateDepth(node: MarkdownNode, depth: number): void {
    if (depth > MAX_NESTING_DEPTH) {
      throw GuardExceeded.new("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, node.position.start.offset);
    }
    if ("children" in node) {
      for (const child of node.children) this.validateDepth(child, depth + 1);
    }
  }

  parse(): BlockPassResult {
    // A captured frontmatter block never enters the line loop: the pass
    // starts on the line after the closing fence, with `lineNumber`
    // pre-advanced so every position downstream stays absolute.
    const skippedLines = this.frontmatterCapture?.lineCount ?? 0;
    this.lineNumber = skippedLines;
    for (const line of A.drop(this.lines, skippedLines)) {
      this.incorporateLine(line);
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

    // Keep lookup and document order separate, retaining the original nodes.
    const references = new ReferenceIndex();
    const rawInlines: RawInlineSlice[] = [];

    const positionOf: MaterializeContext["position"] = dual(
      2,
      (start: number, end: number): Position => this.position(start, end)
    );
    const context: MaterializeContext = {
      position: positionOf,
      inlineSlice: (block) =>
        prepareInline(block, positionOf, references.refmap, this.dialectName, references.footnoteLabels),
      registerInline: dual(2, (parent: InlineHost, prepared: PreparedInline): void => {
        rawInlines.push(new RawInlineSlice(parent, prepared));
      }),
    };

    this.collectReferences(this.doc, context, references);
    references.seal();

    const materialized = this.materializeBlock(this.doc, context, references.definitionNodes);
    if (materialized === undefined || materialized.type !== "root") {
      throw BlockParserError.make({ message: "block parser: the document construct did not materialize a root" });
    }

    const root = this.withFrontmatter(materialized);
    this.validateDepth(root, 0);

    return new BlockPassResult(root, rawInlines, references);
  }
}

/**
 * Configures an engine block pass; defaults to CommonMark with capture disabled.
 *
 * **Example** (Validate GFM block options)
 *
 * ```ts
 * import { BlockParseOptions } from "@beep/markdown/internal/blockParser"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BlockParseOptions)({ dialect: "gfm", frontmatter: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BlockParseOptions extends S.Opaque<BlockParseOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dialect: S.optionalKey(MarkdownDialect).pipe(
      $I.annoteKey("BlockParseOptions.dialect", { description: "Registry dialect to apply; defaults to commonmark" })
    ),
    frontmatter: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("BlockParseOptions.frontmatter", {
        description: "Whether to capture an opening frontmatter block; defaults to false",
      })
    ),
  }).pipe(
    $I.annoteSchema("BlockParseOptions", {
      description: "Engine parse options that distinguish curried configuration from document text.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BlockParseOptions {
  /**
   * The plain options object the block pass accepts: a constructed
   * {@link BlockParseOptions} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BlockParseOptions.Encoded;
}

// The engine's default is the BASE dialect the registries compose on top of —
// not the public default, which is `"gfm"` and lives in the facade's
// `dialectOf`. The facade always passes its resolved dialect explicitly, so
// this default only ever serves engine-level callers (tests, mostly) that
// mean "the substrate".
/**
 * Run the block pass over `text`.
 *
 * **Details**
 *
 * Every node carries a complete {@link Position}, leaf blocks have their
 * inline content parsed, and `rawInlines` reports the raw text each leaf was
 * built from.
 * **Example** (Parse a heading with the block engine)
 *
 * ```ts
 * import { parseBlocks } from "@beep/markdown/internal/blockParser"
 *
 * const parsed = parseBlocks("# Hello\n", { dialect: "commonmark" })
 * console.log(parsed.root.children[0]?.type) // heading
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseBlocks: {
  (text: string, options?: BlockParseOptions.Encoded): BlockPassResult;
  (options?: BlockParseOptions.Encoded): (text: string) => BlockPassResult;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, options?: BlockParseOptions.Encoded): BlockPassResult => {
    const dialect = options?.dialect ?? "commonmark";
    return new BlockParser(text, blockDialect(dialect), dialect, options?.frontmatter ?? false).parse();
  }
);
