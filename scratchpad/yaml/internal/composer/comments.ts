// Comment-fidelity helpers shared by the block and flow composers: blank-line
// detection between source spans, and immutable node rebuilds that merge the
// comment field triple (`commentBefore` / `comment` / `spaceBefore`) onto an
// already-composed node.
//
// Attribution semantics (the NODE-LEVEL model, prior art: the `yaml` npm
// package). Comments live on NODES; `YamlPair` carries none. An own-line
// comment attaches FORWARD to the following entry's KEY node as
// `commentBefore`; a comment on the same line as the end of an entry attaches
// to that entry's VALUE node as the trailing `comment`; own-line comments
// after a collection's last entry become the collection's own `comment` when
// at (or beyond) the collection's content column and escape to the outer
// scope when shallower; `spaceBefore` is set on the key node when a blank
// line precedes the entry (and its `commentBefore` block); blank lines
// within/after a comment run embed as extra `\n`s in the joined string;
// comment text is the RAW post-`#` slice (see `rawCommentText`).
//
// Two node slots per entry rather than one pair slot is the whole point: a
// key-line comment (`a: # kc`) and a value's trailing comment are different
// fields, so neither has to relocate onto the other's line.
//
// ── Recorded divergences from the reference `yaml` npm package ─────────────
//
// The one place the divergences live; each is deliberate, and the emitted
// bytes remain reparse-stable in every case. The list used to have six
// entries. Four of them — pair-level placement, the alias drop, the
// multi-line complex-key drop, and the document field naming — were all
// symptoms of storing comments on the pair, and went away with the move to
// node-level fields rather than being patched one at a time.
//
// 1. ABSENT-value placement. A trailing comment on an entry with no value
//    (`a: # kc`) lands on the KEY node; the reference materializes `a:` as
//    `Scalar(null)` and puts it on that. Our `value` is `null` for an absent
//    value, and making it always-a-node for parity would silently break every
//    consumer's `pair.value === null` check at RUNTIME rather than at compile
//    time. The emitted bytes are identical, so this is invisible to a
//    formatter and visible only to a consumer reading the field.
// 2. PRE-`#` spacing normalizes to one space on trailing comments
//    (`a: 1   # t` → `a: 1 # t`) — the post-`#` storage form cannot carry
//    it. The reference behaves identically.
// 3. MULTI-document `...` trailers. A comment after a `...` marker in a
//    multi-document stream may attach to the following document's header
//    rather than the preceding document's trailer, depending on CST document
//    splitting.

import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";

/** The comment field triple accepted by {@link withCommentFields}. */
export interface CommentFields {
	commentBefore?: string;
	comment?: string;
	spaceBefore?: boolean;
}

/**
 * True when the source text between `start` (exclusive of its line) and `end`
 * contains at least one blank line (a newline followed, after optional
 * horizontal whitespace, by another newline).
 */
export function hasBlankLineBetween(text: string, start: number, end: number): boolean {
	if (start < 0) return false;
	const gap = text.slice(Math.max(0, start), Math.max(0, end));
	return /\n[ \t\r]*\n/.test(gap);
}

/** True when there is no line break between `start` and `end` in `text`. */
export function sameLineSpan(text: string, start: number, end: number): boolean {
	if (start < 0) return false;
	return !text.slice(Math.max(0, start), Math.max(0, end)).includes("\n");
}

/**
 * True when only horizontal whitespace precedes `offset` on its line — i.e.
 * the token at `offset` starts its own line. Purely local, so it stays
 * correct even when a preceding node's span over-extends past line ends.
 */
export function isOwnLineAt(text: string, offset: number): boolean {
	let i = offset - 1;
	while (i >= 0) {
		const ch = text[i];
		if (ch === " " || ch === "\t") {
			i--;
			continue;
		}
		return ch === "\n" || ch === "\r";
	}
	return true;
}

/**
 * True when the only thing before `offset` on its line is a block indicator —
 * `?`, `:` or `-` — plus whitespace. Such a comment sits on an indicator line
 * with its node BELOW, so it leads that node rather than trailing whatever
 * came before (`? # c` / ` - seq1`). Without this, the `? ` prefix makes the
 * comment look like a trailing comment on the previous entry.
 */
export function isAfterIndicatorOnly(text: string, offset: number): boolean {
	let i = offset - 1;
	let sawIndicator = false;
	while (i >= 0) {
		const ch = text[i];
		if (ch === " " || ch === "\t") {
			i--;
			continue;
		}
		if (!sawIndicator && (ch === "?" || ch === "-" || ch === ":")) {
			sawIndicator = true;
			i--;
			continue;
		}
		return sawIndicator && (ch === "\n" || ch === "\r");
	}
	return sawIndicator;
}

/**
 * True when the line immediately above the line containing `offset` is blank
 * (empty or horizontal whitespace only). Purely local — see
 * {@link isOwnLineAt} for why span-based gap checks are not used.
 */
export function hasBlankLineAbove(text: string, offset: number): boolean {
	return blankLineAboveStart(text, offset) >= 0;
}

/**
 * Start offset of the blank line immediately above the line containing
 * `offset`, or `-1` when that line is not blank. The offset form of
 * {@link hasBlankLineAbove}, for callers that must locate the blank line
 * (e.g. to test whether it falls inside a preceding scalar token's span).
 */
export function blankLineAboveStart(text: string, offset: number): number {
	const lineBreak = text.lastIndexOf("\n", Math.max(0, offset - 1));
	if (lineBreak < 0) return -1;
	const prevBreak = text.lastIndexOf("\n", lineBreak - 1);
	const prevLine = text.slice(prevBreak + 1, lineBreak);
	return prevLine.trim() === "" ? prevBreak + 1 : -1;
}

/**
 * The deepest trailing scalar reached by descending last-child edges from
 * `node` (a map's last pair's value, a seq's last item) — the node whose
 * token span a textually-following blank line could fall inside.
 */
function deepestTrailingScalar(node: YamlNode): YamlScalar | undefined {
	let current: YamlNode = node;
	for (;;) {
		if (current instanceof YamlScalar) return current;
		if (current instanceof YamlMap) {
			const last = current.items[current.items.length - 1];
			if (last === undefined) return undefined;
			current = last.value ?? last.key;
			continue;
		}
		if (current instanceof YamlSeq) {
			const last = current.items[current.items.length - 1];
			if (last === undefined) return undefined;
			current = last;
			continue;
		}
		return undefined; // alias — carries no chomp
	}
}

/**
 * True when the blank line immediately above `offset` is CONTENT of the
 * preceding keep-chomp block scalar, not a stylistic blank. Under `+`
 * chomping the trailing line breaks are part of the scalar's VALUE (the
 * composer already stores them there), so recording the same blank line as
 * `spaceBefore` (or a leading-blank embed on a terminal comment run) would
 * double-count it: emission renders both the kept newline and the stylistic
 * blank, growing the document on every format pass. Clip/strip scalars are
 * deliberately NOT excluded — their emission drops the trailing blank from
 * the value, so the `spaceBefore` capture is exactly what re-creates it.
 *
 * `prev` is the last composed node before `offset` (a pair's value, a seq
 * item); the check descends to its deepest trailing scalar and requires the
 * blank line to start inside that scalar's token span.
 */
export function blankAboveIsKeepChompContent(text: string, offset: number, prev: YamlNode | undefined): boolean {
	if (prev === undefined) return false;
	const scalar = deepestTrailingScalar(prev);
	if (scalar === undefined || scalar.chomp !== "keep") return false;
	if (scalar.style !== "block-literal" && scalar.style !== "block-folded") return false;
	const start = blankLineAboveStart(text, offset);
	return start >= scalar.offset && start < scalar.offset + scalar.length;
}

/**
 * True when the line immediately below the line containing `offset` is blank
 * (empty or horizontal whitespace only) AND is itself followed by another
 * line. Purely local, the mirror of {@link hasBlankLineAbove} — used to embed
 * a blank line AFTER a comment run as a trailing empty line in the stored
 * comment string.
 */
export function hasBlankLineBelow(text: string, offset: number): boolean {
	const lineEnd = text.indexOf("\n", Math.max(0, offset));
	if (lineEnd < 0) return false;
	const nextEnd = text.indexOf("\n", lineEnd + 1);
	if (nextEnd < 0) return false;
	return text.slice(lineEnd + 1, nextEnd).trim() === "";
}

/**
 * The stored text of a comment token: the RAW post-`#` slice, reference
 * parity with the `yaml` npm package — `# section` stores `" section"`,
 * `#no-space` stores `"no-space"`, `#   aligned` keeps its alignment.
 *
 * The one reserved string is `""`, which encodes an embedded blank line
 * inside a joined comment run — so a spaces-only raw slice stores with ONE
 * extra trailing space and the renderers strip it back off. A bare `#`
 * (raw `""`) stores `" "`, `# ` (raw `" "`) stores `"  "`, and so on; the
 * escape is injective, so every comment spelling roundtrips byte-intact.
 * Raw storage is what makes byte-intact roundtrip possible; trimming would
 * canonicalize every comment to `# text`.
 */
export function rawCommentText(source: string): string {
	const raw = source.startsWith("#") ? source.slice(1) : source;
	return /^ *$/.test(raw) ? `${raw} ` : raw;
}

/** Join two optional comment blocks with a newline. */
export function joinComments(a: string | undefined, b: string): string {
	return a === undefined ? b : `${a}\n${b}`;
}

/** Zero-based column of `offset` within its line. */
export function columnAt(text: string, offset: number): number {
	if (offset <= 0) return 0;
	return offset - (text.lastIndexOf("\n", offset - 1) + 1);
}

/**
 * A comment that outlived its collection: it sat after the collection's last
 * entry at a column SHALLOWER than the collection's content, so it belongs
 * to an outer scope (reference parity — a column-0 `# tail` between a nested
 * block and the next root key documents the next root key, not the nested
 * block). Escaped comments ride `ComposerState` up one level, where the
 * enclosing composer re-injects them into its own item stream.
 */
export interface EscapedComment {
	readonly text: string;
	readonly offset: number;
}

/**
 * Rebuild `node` with the given comment fields merged in (existing fields are
 * kept unless overridden; `commentBefore`/`comment` join with a newline when
 * both sides are present). Every node class carries the triple, aliases
 * included.
 */
export function withCommentFields(node: YamlNode, fields: CommentFields): YamlNode {
	if (node instanceof YamlScalar) {
		return new YamlScalar({
			value: node.value,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...mergedCommentFields(node, fields),
			...(node.chomp !== undefined ? { chomp: node.chomp } : {}),
			...(node.blockIndent !== undefined ? { blockIndent: node.blockIndent } : {}),
			...(node.raw !== undefined ? { raw: node.raw } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlMap) {
		return new YamlMap({
			items: node.items,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...mergedCommentFields(node, fields),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlSeq) {
		return new YamlSeq({
			items: node.items,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...mergedCommentFields(node, fields),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	return new YamlAlias({
		name: node.name,
		...mergedCommentFields(node, fields),
		offset: node.offset,
		length: node.length,
	});
}

function mergedCommentFields(existing: CommentFields, incoming: CommentFields): CommentFields {
	const commentBefore =
		incoming.commentBefore !== undefined
			? existing.commentBefore !== undefined
				? `${existing.commentBefore}\n${incoming.commentBefore}`
				: incoming.commentBefore
			: existing.commentBefore;
	const comment =
		incoming.comment !== undefined
			? existing.comment !== undefined
				? `${existing.comment}\n${incoming.comment}`
				: incoming.comment
			: existing.comment;
	const spaceBefore = incoming.spaceBefore ?? existing.spaceBefore;
	return {
		...(commentBefore !== undefined ? { commentBefore } : {}),
		...(comment !== undefined ? { comment } : {}),
		...(spaceBefore !== undefined ? { spaceBefore } : {}),
	};
}
