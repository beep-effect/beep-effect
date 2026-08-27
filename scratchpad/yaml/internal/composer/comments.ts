/**
 * Comment-fidelity helpers shared by the block and flow composers: blank-line
 * detection between source spans, and immutable node rebuilds that merge the
 * comment field triple (`commentBefore` / `comment` / `spaceBefore`) onto an
 * already-composed node.
 *
 * Comments live on nodes; `YamlPair` carries none. An own-line comment
 * attaches forward to the following entry's KEY as `commentBefore`; a
 * same-line trailing comment attaches to the VALUE; absent-value trailing
 * comments land on the KEY because `pair.value === null`. `""` is reserved
 * for an embedded blank in stored comment text. Keep-chomp blanks are VALUE
 * and must not be recorded as `spaceBefore`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";

/**
 * The comment field triple accepted by {@link withCommentFields}.
 *
 * **Details**
 *
 * Node-level model: comments live on nodes, not pairs. Absent-value
 * trailing comments land on the key.
 *
 * @see {@link withCommentFields} for the merge helper that consumes this triple.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface CommentFields {
	commentBefore?: string;
	comment?: string;
	spaceBefore?: boolean;
}

/**
 * True when the source text between `start` (exclusive of its line) and `end`
 * contains at least one blank line (a newline followed, after optional
 * horizontal whitespace, by another newline).
 *
 * **Example** (Blank line before an entry is preserved)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: 1\n\nb: 2\n").includes("\n\n")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export function hasBlankLineBetween(text: string, start: number, end: number): boolean {
	if (start < 0) return false;
	const gap = text.slice(Math.max(0, start), Math.max(0, end));
	return /\n[ \t\r]*\n/.test(gap);
}

/**
 * True when there is no line break between `start` and `end` in `text`.
 *
 * **Example** (Trailing comment stays on the same line)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: 1 # t\n").includes("1 # t")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export function sameLineSpan(text: string, start: number, end: number): boolean {
	if (start < 0) return false;
	return !text.slice(Math.max(0, start), Math.max(0, end)).includes("\n");
}

/**
 * True when only horizontal whitespace precedes `offset` on its line — i.e.
 * the token at `offset` starts its own line. Purely local, so it stays
 * correct even when a preceding node's span over-extends past line ends.
 *
 * **Example** (Own-line comment stays above the next key)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("# lead\na: 1\n").startsWith("# lead")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
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
 *
 * **Example** (Sequence-entry comment stays with the item)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("- # c\n  item\n").includes("# c")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
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
 *
 * **Example** (spaceBefore blank is preserved)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: 1\n\nb: 2\n").includes("\n\nb:")) // true
 * ```
 *
 * @see {@link blankLineAboveStart} for the offset form of this check.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export function hasBlankLineAbove(text: string, offset: number): boolean {
	return blankLineAboveStart(text, offset) >= 0;
}

/**
 * Start offset of the blank line immediately above the line containing
 * `offset`, or `-1` when that line is not blank. The offset form of
 * {@link hasBlankLineAbove}, for callers that must locate the blank line
 * (e.g. to test whether it falls inside a preceding scalar token's span).
 *
 * **Example** (Used to decide keep-chomp content vs style)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: |+\n  keep\n\n").includes("|+")) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * A keep-chomp blank is not `spaceBefore`. Treating it as style grows the
 * document on every format pass. Aliases carry no chomp, so the deepest
 * trailing scalar walk returns undefined for them.
 *
 * **Example** (Keep-chomp trailing blank is value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const value = Effect.runSync(Yaml.parse("a: |+\n  keep\n\n"))
 * console.log(JSON.stringify(value).includes("keep")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
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
 *
 * **Example** (Blank after a comment run is stored, not dropped)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("# a\n\nb: 1\n").includes("# a")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * Trimming comment text canonicalizes every comment. `rawCommentText("#")`
 * is `" "` and `rawCommentText("# ")` is `"  "` so the empty string stays
 * reserved for an embedded blank line.
 *
 * **Example** (Bare `#` and spaced `# ` both round-trip)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("#\na: 1\n").includes("#")) // true
 * console.log(YamlFormat.formatToString("# \na: 1\n").includes("#")) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export function rawCommentText(source: string): string {
	const raw = source.startsWith("#") ? source.slice(1) : source;
	return /^ *$/.test(raw) ? `${raw} ` : raw;
}

/**
 * Join two optional comment blocks with a newline.
 *
 * **Example** (Consecutive own-line comments stay stacked)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("# a\n# b\nc: 1\n").includes("# a")) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function joinComments(a: string | undefined, b: string): string {
	return a === undefined ? b : `${a}\n${b}`;
}

/**
 * Zero-based column of `offset` within its line.
 *
 * **Example** (Indented comment stays indented)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a:\n  # inner\n  b: 1\n").includes("# inner")) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export function columnAt(text: string, offset: number): number {
	if (offset <= 0) return 0;
	return offset - (text.lastIndexOf("\n", offset - 1) + 1);
}

/**
 * A comment that outlived its collection: it sat after the collection's last
 * entry at a column shallower than the collection's content, so it belongs
 * to an outer scope (reference parity — a column-0 `# tail` between a nested
 * block and the next root key documents the next root key, not the nested
 * block). Escaped comments ride `ComposerState` up one level, where the
 * enclosing composer re-injects them into its own item stream.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
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
 *
 * **Gotchas**
 *
 * Looking for comments on `YamlPair` or on an absent value node will miss
 * them. Absent-value trailing comments live on the key.
 *
 * **Example** (Key-line comment on an absent value)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a: # kc\nb: 1\n").includes("# kc")) // true
 * ```
 *
 * @see {@link CommentFields} for the triple this merge accepts.
 * @internal
 * @category mapping
 * @since 0.0.0
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
