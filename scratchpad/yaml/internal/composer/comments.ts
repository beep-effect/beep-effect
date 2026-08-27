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

import { $ScratchpadId } from "@beep/identity";
import { O as OU } from "@beep/utils";
import { Schema } from "effect";
import { dual } from "effect/Function";
import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";

const $I = $ScratchpadId.create("yaml/internal/composer/comments");

/**
 * The comment field triple accepted by {@link withCommentFields}.
 *
 * **Details**
 *
 * Node-level model: comments live on nodes, not pairs. Absent-value
 * trailing comments land on the key.
 *
 * **Example** (Guard a comment field bag)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommentFields } from "@beep/scratchpad/yaml/internal/composer/comments"
 *
 * console.log(S.is(CommentFields)({ commentBefore: "lead", spaceBefore: true })) // true
 * ```
 *
 * @see {@link withCommentFields} for the merge helper that consumes this triple.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const CommentFields = Schema.Struct({
	commentBefore: Schema.optionalKey(Schema.String),
	comment: Schema.optionalKey(Schema.String),
	spaceBefore: Schema.optionalKey(Schema.Boolean),
}).pipe(
	$I.annoteSchema("CommentFields", {
		description: "Optional leading, trailing and blank-line fidelity carried by a YAML node.",
	}),
);

export type CommentFields = typeof CommentFields.Type;

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
 * **Example** (Guard an escaped comment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EscapedComment } from "@beep/scratchpad/yaml/internal/composer/comments"
 *
 * console.log(S.is(EscapedComment)({ text: "tail", offset: 4 })) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const hasBlankLineBetween: {
	(text: string, start: number, end: number): boolean;
	(start: number, end: number): (text: string) => boolean;
} = dual(3, (text: string, start: number, end: number): boolean => {
	if (start < 0) return false;
	const gap = text.slice(Math.max(0, start), Math.max(0, end));
	return /\n[ \t\r]*\n/.test(gap);
});

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
export const sameLineSpan: {
	(text: string, start: number, end: number): boolean;
	(start: number, end: number): (text: string) => boolean;
} = dual(3, (text: string, start: number, end: number): boolean => {
	if (start < 0) return false;
	return !text.slice(Math.max(0, start), Math.max(0, end)).includes("\n");
});

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
export const isOwnLineAt: {
	(text: string, offset: number): boolean;
	(offset: number): (text: string) => boolean;
} = dual(2, (text: string, offset: number): boolean => {
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
});

/**
 * True when the only thing before `offset` on its line is a block indicator —
 * `?`, `:` or `-` — plus whitespace. Such a comment sits on an indicator line
 * with its node BELOW, so it leads that node rather than trailing whatever
 * came before (`? # c` / ` - seq1`). Without this, the `? ` prefix makes the
 * comment look like a trailing comment on the previous entry.
 *
 * **Example** (Sequence-entry comment leads the item)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("- # c\n  item\n").startsWith("# c\n- item")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isAfterIndicatorOnly: {
	(text: string, offset: number): boolean;
	(offset: number): (text: string) => boolean;
} = dual(2, (text: string, offset: number): boolean => {
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
});

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
export const hasBlankLineAbove: {
	(text: string, offset: number): boolean;
	(offset: number): (text: string) => boolean;
} = dual(2, (text: string, offset: number): boolean => blankLineAboveStart(text, offset) >= 0);

/**
 * Start offset of the blank line immediately above the line containing
 * `offset`, or `-1` when that line is not blank. The offset form of
 * {@link hasBlankLineAbove}, for callers that must locate the blank line
 * (e.g. to test whether it falls inside a preceding scalar token's span).
 *
 * **Example** (Format does not grow a keep-chomp trailing blank)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * const src = "a: |+\n  keep\n\n"
 * const formatted = YamlFormat.formatToString(src)
 * console.log(formatted.includes("|+")) // true
 * console.log(YamlFormat.formatToString(formatted) === formatted) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const blankLineAboveStart: {
	(text: string, offset: number): number;
	(offset: number): (text: string) => number;
} = dual(2, (text: string, offset: number): number => {
	const lineBreak = text.lastIndexOf("\n", Math.max(0, offset - 1));
	if (lineBreak < 0) return -1;
	const prevBreak = text.lastIndexOf("\n", lineBreak - 1);
	const prevLine = text.slice(prevBreak + 1, lineBreak);
	return prevLine.trim() === "" ? prevBreak + 1 : -1;
});

/**
 * The deepest trailing scalar reached by descending last-child edges from
 * `node` (a map's last pair's value, a seq's last item) — the node whose
 * token span a textually-following blank line could fall inside.
 */
function deepestTrailingScalar(node: YamlNode): YamlScalar | undefined {
	let current: YamlNode = node;
	for (;;) {
		if (YamlScalar.is(current)) return current;
		if (YamlMap.is(current)) {
			const last = current.items[current.items.length - 1];
			if (last === undefined) return undefined;
			current = last.value ?? last.key;
			continue;
		}
		if (YamlSeq.is(current)) {
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
 * console.log(JSON.stringify(value).includes("keep\\n\\n")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const blankAboveIsKeepChompContent: {
	(text: string, offset: number, prev: YamlNode | undefined): boolean;
	(offset: number, prev: YamlNode | undefined): (text: string) => boolean;
} = dual(3, (text: string, offset: number, prev: YamlNode | undefined): boolean => {
	if (prev === undefined) return false;
	const scalar = deepestTrailingScalar(prev);
	if (scalar === undefined || scalar.chomp !== "keep") return false;
	if (scalar.style !== "block-literal" && scalar.style !== "block-folded") return false;
	const start = blankLineAboveStart(text, offset);
	return start >= scalar.offset && start < scalar.offset + scalar.length;
});

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
 * console.log(YamlFormat.formatToString("# a\n\nb: 1\n").includes("# a\n\nb:")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const hasBlankLineBelow: {
	(text: string, offset: number): boolean;
	(offset: number): (text: string) => boolean;
} = dual(2, (text: string, offset: number): boolean => {
	const lineEnd = text.indexOf("\n", Math.max(0, offset));
	if (lineEnd < 0) return false;
	const nextEnd = text.indexOf("\n", lineEnd + 1);
	if (nextEnd < 0) return false;
	return text.slice(lineEnd + 1, nextEnd).trim() === "";
});

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
 * console.log(YamlFormat.formatToString("#\na: 1\n").includes("#\n")) // true
 * console.log(YamlFormat.formatToString("# \na: 1\n").includes("# \n")) // true
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
 * console.log(YamlFormat.formatToString("# a\n# b\nc: 1\n").includes("# a\n# b")) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const joinComments: {
	(a: string | undefined, b: string): string;
	(b: string): (a: string | undefined) => string;
} = dual(2, (a: string | undefined, b: string): string => a === undefined ? b : `${a}\n${b}`);

/**
 * Zero-based column of `offset` within its line.
 *
 * **Example** (Indented comment stays indented)
 *
 * ```ts
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlFormat.formatToString("a:\n  # inner\n  b: 1\n").includes("  # inner")) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const columnAt: {
	(text: string, offset: number): number;
	(offset: number): (text: string) => number;
} = dual(2, (text: string, offset: number): number => {
	if (offset <= 0) return 0;
	return offset - (text.lastIndexOf("\n", offset - 1) + 1);
});

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
export const EscapedComment = Schema.Struct({
	text: Schema.String,
	offset: Schema.Finite,
}).pipe(
	$I.annoteSchema("EscapedComment", {
		description: "Comment promoted from a nested collection for attachment by an outer composer scope.",
	}),
);

export type EscapedComment = typeof EscapedComment.Type;

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
export const withCommentFields: {
	(node: YamlNode, fields: CommentFields): YamlNode;
	(fields: CommentFields): (node: YamlNode) => YamlNode;
} = dual(2, (node: YamlNode, fields: CommentFields): YamlNode => {
	if (YamlScalar.is(node)) {
		return YamlScalar.make({
			value: node.value,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...mergedCommentFields(node, fields),
			...OU.getSomesStruct({ chomp: OU.fromUndefinedOr(node.chomp), blockIndent: OU.fromUndefinedOr(node.blockIndent), raw: OU.fromUndefinedOr(node.raw), sourceMultiline: OU.fromUndefinedOr(node.sourceMultiline) }),
			offset: node.offset,
			length: node.length,
		});
	}
	if (YamlMap.is(node)) {
		return YamlMap.make({
			items: node.items,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...mergedCommentFields(node, fields),
			...OU.getSomesStruct({ sourceMultiline: OU.fromUndefinedOr(node.sourceMultiline) }),
			offset: node.offset,
			length: node.length,
		});
	}
	if (YamlSeq.is(node)) {
		return YamlSeq.make({
			items: node.items,
			style: node.style,
			...OU.getSomesStruct({ tag: OU.fromUndefinedOr(node.tag), anchor: OU.fromUndefinedOr(node.anchor) }),
			...mergedCommentFields(node, fields),
			...OU.getSomesStruct({ sourceMultiline: OU.fromUndefinedOr(node.sourceMultiline) }),
			offset: node.offset,
			length: node.length,
		});
	}
	return YamlAlias.make({
		name: node.name,
		...mergedCommentFields(node, fields),
		offset: node.offset,
		length: node.length,
	});
});

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
		...OU.getSomesStruct({ commentBefore: OU.fromUndefinedOr(commentBefore), comment: OU.fromUndefinedOr(comment), spaceBefore: OU.fromUndefinedOr(spaceBefore) })
	};
}
