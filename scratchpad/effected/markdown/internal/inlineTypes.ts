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
 * `RawInlineSlice` widens this with the node that will own the children;
 * a slice is therefore usable wherever a source is.
 */
export interface InlineSource {
	readonly text: string;
	readonly startOffset: number;
	readonly segments: ReadonlyArray<RawInlineSegment>;
}

/**
 * One entry of the delimiter stack: a run of `*` or `_` that might open or
 * close emphasis, and the text node holding those characters.
 */
export interface Delimiter {
	/** The delimiter character's code. */
	readonly cc: number;
	/** How many delimiters are still unused. */
	numdelims: number;
	/** How many there were to begin with — the multiple-of-three rule reads this. */
	readonly origdelims: number;
	/** The text node carrying the run; emphasis truncates it in place. */
	readonly node: InlineNode;
	previous: Delimiter | undefined;
	next: Delimiter | undefined;
	readonly canOpen: boolean;
	readonly canClose: boolean;
}

/** One entry of the bracket stack: an unmatched `[` or `![`. */
export interface Bracket {
	/** The text node carrying the bracket. */
	readonly node: InlineNode;
	previous: Bracket | undefined;
	/** The delimiter stack top when this bracket opened. */
	readonly previousDelimiter: Delimiter | undefined;
	/** Where the bracket's content starts. */
	readonly index: number;
	/** Whether this opener was `![`. */
	readonly image: boolean;
	/** Cleared when an enclosing link forms — links do not nest. */
	active: boolean;
	/** Whether another bracket opened after this one. */
	bracketAfter?: boolean;
}

/**
 * The cursor, output list and stacks an inline construct drives — upstream's
 * `InlineParser` object, as the interface its constructs see.
 *
 * Positions are the reason the source is here: every local index maps back
 * through the segment table to an absolute source offset, so a node built
 * here is positioned in the ORIGINAL document rather than in the stripped,
 * tab-expanded content the block pass accumulated.
 */
export interface InlineScanner {
	/** The content being parsed — a leaf block's trimmed text. */
	readonly subject: string;
	/** The cursor. */
	pos: number;
	/** The definitions a reference may resolve against. */
	readonly refmap: HashMap.HashMap<string, Definition>;
	/**
	 * The case-folded labels a GFM footnote reference may form against.
	 *
	 * A set rather than a map to the definitions: a footnote definition's own
	 * children are inline-parsed, so an index holding materialized nodes could
	 * not exist yet (`blockParser.collectReferences` carries the full reason).
	 * Empty under `commonmark`, which never forms a footnote reference.
	 */
	readonly footnoteLabels: HashSet.HashSet<string>;
	/** The delimiter stack top. */
	delimiters: Delimiter | undefined;
	/** The bracket stack top. */
	brackets: Bracket | undefined;

	/** The char code at the cursor, or `-1` at the end. */
	peek(): number;
	/** Match `pattern` AT the cursor, advancing past it on success. */
	match(pattern: RegExp): string | undefined;
	/**
	 * Scan forward for `pattern`, advancing past it on success.
	 *
	 * Almost nothing wants this — a construct asks whether it begins at the
	 * cursor, and a match found further along is not one.
	 */
	matchAhead(pattern: RegExp): string | undefined;
	/**
	 * Whether `needle` occurs at or after the cursor.
	 *
	 * Memoized per needle: once a search from some position finds nothing,
	 * nothing later can either, so a construct whose closing sequence is
	 * missing entirely fails in constant time after the first look. Without
	 * it, a document of 300k unclosed `<!--` costs one full scan per opener.
	 */
	hasAhead(needle: string): boolean;
	/**
	 * The start of the next backtick run of exactly `length`, at or after
	 * `from`, or `undefined` when there is none.
	 *
	 * Backed by an index built once per subject. Walking run by run is
	 * quadratic on a document of thousands of distinct-length runs, which is
	 * precisely the vendored "backticks" pathological case.
	 */
	closingBacktickRun(from: number, length: number): number | undefined;

	/** Append a node to the output list. */
	append(node: InlineNode): void;
	/** Append a literal text node spanning local `[from, to)`. */
	appendText(value: string, from: number, to: number): InlineNode;
	/** The last node appended, if any. */
	lastChild(): InlineNode | undefined;
	/**
	 * Take `count` characters back off the end of the output — cmark-gfm's
	 * `cmark_node_unput`, which its `url_match` uses to reclaim the scheme it
	 * already emitted as text before the `:` triggered.
	 *
	 * Refuses (leaving the output untouched) unless those characters are all
	 * literal text: a run that came out of an entity or an escape is not the
	 * source it looks like, and a construct that cannot reclaim it must not
	 * pretend it did.
	 */
	unputText(count: number): boolean;
	/**
	 * Strip trailing spaces from the trailing text node, pulling its end back,
	 * and report how many were removed. Removes the node if nothing survives.
	 */
	trimTrailingSpaces(): number;

	/** Drop `delimiter` from the stack. */
	removeDelimiter(delimiter: Delimiter): void;
	/** Push a bracket opener. */
	addBracket(node: InlineNode, index: number, image: boolean): void;
	/** Pop the top bracket opener. */
	removeBracket(): void;
	/**
	 * Spend every link opener still on the stack — links do not nest.
	 *
	 * A method rather than a loop at the call site because it keeps an O(1)
	 * fast path: image openers accumulate without ever being closed, and
	 * walking past them on every link close is quadratic.
	 */
	deactivateLinkOpeners(): void;
	/** Run the emphasis algorithm down to `stackBottom`. */
	processEmphasis(stackBottom: Delimiter | undefined): void;
}

/** One inline construct: upstream's `parse*` methods, one per module. */
export interface InlineConstruct {
	readonly name: string;
	/**
	 * The character codes that give this construct a chance. A construct with
	 * no triggers is the fallback that consumes ordinary text.
	 */
	readonly triggers: ReadonlyArray<number>;
	/** Try to parse at the cursor; `false` leaves the cursor untouched. */
	parse(scanner: InlineScanner): boolean;
}

/** A dialect: a trigger table, the text fallback, and its postprocess passes. */
export interface InlineDialect {
	readonly byTrigger: HashMap.HashMap<number, ReadonlyArray<InlineConstruct>>;
	readonly text: InlineConstruct;
	/**
	 * Passes run over the finished node list, before it is materialized —
	 * cmark-gfm's `postprocess` extension hook.
	 *
	 * A construct belongs here rather than in the trigger table when it has to
	 * see text the cursor has already gone past: GFM's email autolinks scan
	 * backwards from an `@`, which is only safe once the delimiter stack that
	 * text may be pinned to has been spent.
	 */
	readonly postprocess: ReadonlyArray<(root: InlineNode) => void>;
}
