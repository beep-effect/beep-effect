// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The vocabulary the inline constructs and the inline parser share, extracted
// into a leaf for the same reason `blockTypes.ts` is one: the registry imports
// the construct modules, so the constructs cannot import the registry.
//
// Upstream dispatches on a character in a `switch` inside `parseInline`. Here
// the same dispatch is a per-dialect table keyed by trigger character, which
// is what lets the GFM constructs (autolink literals, strikethrough) register
// without touching the parser.

import type * as HashMap from "effect/HashMap";
import type * as HashSet from "effect/HashSet";
import type { Definition } from "../MarkdownNode.ts";
import type { RawInlineSegment } from "./blockTypes.ts";
import type { InlineNode } from "./inlineNode.ts";

/**
 * A leaf block's raw text with the provenance needed to position what the
 * inline pass builds out of it.
 *
 * **Details**
 *
 * `RawInlineSlice` widens this with the node that will own the children;
 * a slice is therefore usable wherever a source is.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineSource {
	readonly text: string;
	readonly startOffset: number;
	readonly segments: ReadonlyArray<RawInlineSegment>;
}

/**
 * One entry of the delimiter stack: a run of `*` or `_` that might open or
 * close emphasis, and the text node holding those characters.
 *
 * @category models
 * @since 0.0.0
 */
export interface Delimiter {
	/**
	 * The delimiter character's code.
	 *
	 * @since 0.0.0
	 */
	readonly cc: number;
	/**
	 * How many delimiters are still unused.
	 *
	 * @since 0.0.0
	 */
	numdelims: number;
	/**
	 * How many there were to begin with — the multiple-of-three rule reads this.
	 *
	 * @since 0.0.0
	 */
	readonly origdelims: number;
	/**
	 * The text node carrying the run; emphasis truncates it in place.
	 *
	 * @since 0.0.0
	 */
	readonly node: InlineNode;
	previous: Delimiter | undefined;
	next: Delimiter | undefined;
	readonly canOpen: boolean;
	readonly canClose: boolean;
}

/**
 * One entry of the bracket stack: an unmatched `[` or `![`.
 *
 * @category models
 * @since 0.0.0
 */
export interface Bracket {
	/**
	 * The text node carrying the bracket.
	 *
	 * @since 0.0.0
	 */
	readonly node: InlineNode;
	previous: Bracket | undefined;
	/**
	 * The delimiter stack top when this bracket opened.
	 *
	 * @since 0.0.0
	 */
	readonly previousDelimiter: Delimiter | undefined;
	/**
	 * Where the bracket's content starts.
	 *
	 * @since 0.0.0
	 */
	readonly index: number;
	/**
	 * Whether this opener was `![`.
	 *
	 * @since 0.0.0
	 */
	readonly image: boolean;
	/**
	 * Cleared when an enclosing link forms — links do not nest.
	 *
	 * @since 0.0.0
	 */
	active: boolean;
	/**
	 * Whether another bracket opened after this one.
	 *
	 * @since 0.0.0
	 */
	bracketAfter?: boolean;
}

/**
 * The cursor, output list and stacks an inline construct drives — upstream's
 * `InlineParser` object, as the interface its constructs see.
 *
 * **Details**
 *
 * Positions are the reason the source is here: every local index maps back
 * through the segment table to an absolute source offset, so a node built
 * here is positioned in the ORIGINAL document rather than in the stripped,
 * tab-expanded content the block pass accumulated.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineScanner {
	/**
	 * The content being parsed — a leaf block's trimmed text.
	 *
	 * @since 0.0.0
	 */
	readonly subject: string;
	/**
	 * The cursor.
	 *
	 * @since 0.0.0
	 */
	pos: number;
	/**
	 * The definitions a reference may resolve against.
	 *
	 * @since 0.0.0
	 */
	readonly refmap: HashMap.HashMap<string, Definition>;
	/**
	 * The case-folded labels a GFM footnote reference may form against.
	 *
	 * **Details**
	 *
	 * A set rather than a map to the definitions: a footnote definition's own
	 * children are inline-parsed, so an index holding materialized nodes could
	 * not exist yet (`blockParser.collectReferences` carries the full reason).
	 * Empty under `commonmark`, which never forms a footnote reference.
	 *
	 * @since 0.0.0
	 */
	readonly footnoteLabels: HashSet.HashSet<string>;
	/**
	 * The delimiter stack top.
	 *
	 * @since 0.0.0
	 */
	delimiters: Delimiter | undefined;
	/**
	 * The bracket stack top.
	 *
	 * @since 0.0.0
	 */
	brackets: Bracket | undefined;

	/**
	 * The char code at the cursor, or `-1` at the end.
	 *
	 * @since 0.0.0
	 */
	peek(): number;
	/**
	 * Match `pattern` AT the cursor, advancing past it on success.
	 *
	 * @since 0.0.0
	 */
	match(pattern: RegExp): string | undefined;
	/**
	 * Scan forward for `pattern`, advancing past it on success.
	 *
	 * **Details**
	 *
	 * Almost nothing wants this — a construct asks whether it begins at the
	 * cursor, and a match found further along is not one.
	 *
	 * @since 0.0.0
	 */
	matchAhead(pattern: RegExp): string | undefined;
	/**
	 * Whether `needle` occurs at or after the cursor.
	 *
	 * **Details**
	 *
	 * Memoized per needle: once a search from some position finds nothing,
	 * nothing later can either, so a construct whose closing sequence is
	 * missing entirely fails in constant time after the first look. Without
	 * it, a document of 300k unclosed `<!--` costs one full scan per opener.
	 *
	 * @since 0.0.0
	 */
	hasAhead(needle: string): boolean;
	/**
	 * The start of the next backtick run of exactly `length`, at or after
	 * `from`, or `undefined` when there is none.
	 *
	 * **Details**
	 *
	 * Backed by an index built once per subject. Walking run by run is
	 * quadratic on a document of thousands of distinct-length runs, which is
	 * precisely the vendored "backticks" pathological case.
	 *
	 * @since 0.0.0
	 */
	closingBacktickRun(from: number, length: number): number | undefined;

	/**
	 * Append a node to the output list.
	 *
	 * @since 0.0.0
	 */
	append(node: InlineNode): void;
	/**
	 * Append a literal text node spanning local `[from, to)`.
	 *
	 * @since 0.0.0
	 */
	appendText(value: string, from: number, to: number): InlineNode;
	/**
	 * The last node appended, if any.
	 *
	 * @since 0.0.0
	 */
	lastChild(): InlineNode | undefined;
	/**
	 * Take `count` characters back off the end of the output — cmark-gfm's
	 * `cmark_node_unput`, which its `url_match` uses to reclaim the scheme it
	 * already emitted as text before the `:` triggered.
	 *
	 * **Details**
	 *
	 * Refuses (leaving the output untouched) unless those characters are all
	 * literal text: a run that came out of an entity or an escape is not the
	 * source it looks like, and a construct that cannot reclaim it must not
	 * pretend it did.
	 *
	 * @since 0.0.0
	 */
	unputText(count: number): boolean;
	/**
	 * Strip trailing spaces from the trailing text node, pulling its end back,
	 * and report how many were removed. Removes the node if nothing survives.
	 *
	 * @since 0.0.0
	 */
	trimTrailingSpaces(): number;

	/**
	 * Drop `delimiter` from the stack.
	 *
	 * @since 0.0.0
	 */
	removeDelimiter(delimiter: Delimiter): void;
	/**
	 * Push a bracket opener.
	 *
	 * @since 0.0.0
	 */
	addBracket(node: InlineNode, index: number, image: boolean): void;
	/**
	 * Pop the top bracket opener.
	 *
	 * @since 0.0.0
	 */
	removeBracket(): void;
	/**
	 * Spend every link opener still on the stack — links do not nest.
	 *
	 * **Details**
	 *
	 * A method rather than a loop at the call site because it keeps an O(1)
	 * fast path: image openers accumulate without ever being closed, and
	 * walking past them on every link close is quadratic.
	 *
	 * @since 0.0.0
	 */
	deactivateLinkOpeners(): void;
	/**
	 * Run the emphasis algorithm down to `stackBottom`.
	 *
	 * @since 0.0.0
	 */
	processEmphasis(stackBottom: Delimiter | undefined): void;
}

/**
 * One inline construct: upstream's `parse*` methods, one per module.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineConstruct {
	readonly name: string;
	/**
	 * The character codes that give this construct a chance. A construct with
	 * no triggers is the fallback that consumes ordinary text.
	 *
	 * @since 0.0.0
	 */
	readonly triggers: ReadonlyArray<number>;
	/**
	 * Try to parse at the cursor; `false` leaves the cursor untouched.
	 *
	 * @since 0.0.0
	 */
	parse(scanner: InlineScanner): boolean;
}

/**
 * A dialect: a trigger table, the text fallback, and its postprocess passes.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineDialect {
	readonly byTrigger: HashMap.HashMap<number, ReadonlyArray<InlineConstruct>>;
	readonly text: InlineConstruct;
	/**
	 * Passes run over the finished node list, before it is materialized —
	 * cmark-gfm's `postprocess` extension hook.
	 *
	 * **Details**
	 *
	 * A construct belongs here rather than in the trigger table when it has to
	 * see text the cursor has already gone past: GFM's email autolinks scan
	 * backwards from an `@`, which is only safe once the delimiter stack that
	 * text may be pinned to has been spent.
	 *
	 * @since 0.0.0
	 */
	readonly postprocess: ReadonlyArray<(root: InlineNode) => void>;
}
