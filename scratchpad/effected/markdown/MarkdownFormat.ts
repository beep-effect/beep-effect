// The formatting/modification concept: non-mutating text splices
// (MarkdownEdit) that normalize concrete-syntax markers or surgically replace
// one node, both computed against the original source so everything outside
// the spliced spans survives byte-for-byte — the offset-splice editing model
// chosen over a lossless CST.
//
// `format` is conservative by construction: an edit is emitted only when the
// rewrite is provably safe against re-parse hazards, and every hazard is
// guarded by SKIPPING the rewrite, never by attempting a cleverer one. The
// guarded hazards, each pinned by a test: a `-` thematic break under a
// non-blank line reads as a setext underline; normalizing bullets can merge
// two adjacent sibling lists into one; `_` emphasis cannot open or close at
// an intraword boundary; abutting same-marker emphasis runs change the
// delimiter algebra; a backtick fence's info string cannot hold a backtick;
// an atx-to-setext conversion is only safe flush-left with single-line,
// paragraph-shaped content.
//
// `modify` is toml-strict: a replacement is a node fragment or plain text —
// both rendered through the canonical stringifier — so a modified document
// re-parses cleanly by construction. Raw markdown replacement is deliberately
// not offered; it would delegate the structure-escape problem to the
// caller. Target scope: flow nodes, phrasing nodes and table cells;
// container-slot nodes (list items, table rows, the root, frontmatter)
// refuse with a typed error, as does any multi-line replacement whose target
// sits inside a container whose continuation lines carry a prefix the splice
// cannot reproduce.
//
// Cycle firewall: this module composes the public facades (`Markdown.
// parseResult`/`Markdown.stringifyResult`) and the node classes; it never
// imports the engine.

import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as O from "@beep/utils/Option";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Markdown, MarkdownDialect, MarkdownParseOptions } from "./Markdown.ts";
import type { MarkdownDocument } from "./MarkdownDocument.ts";
import type { MarkdownRange } from "./MarkdownEdit.ts";
import { MarkdownEdit } from "./MarkdownEdit.ts";
import type {
	Code,
	Emphasis,
	Heading,
	List,
	MarkdownNode,
	Strong,
	ThematicBreak,
} from "./MarkdownNode.ts";
import {
	BulletChar,
	EmphasisChar,
	FenceChar,
	FlowContent,
	HeadingStyle,
	Paragraph,
	PhrasingContent,
	Root,
	Text,
	ThematicBreakChar,
} from "./MarkdownNode.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/markdown/MarkdownFormat");

/**
 * A range accepted at the `format`/`formatToString` call sites: either a
 * {@link MarkdownRange} instance or a plain `{ offset, length }` literal (the
 * two are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownRangeLike = MarkdownRange | { readonly offset: number; readonly length: number };

/**
 * The two ways CommonMark spells a code block: `fenced` (a backtick or tilde
 * fence) and `indented` (four-space indentation).
 *
 * **Details**
 *
 * A formatting target for {@link MarkdownFormattingOptions}, not a node
 * fidelity field: on a {@link Code} node the two spellings are told apart by
 * the presence or absence of `fenceChar`/`fenceLength`, and a language-less
 * node with neither serializes as an **indented** block by default.
 *
 * **Example** (Validate a code block spelling)
 *
 * ```ts
 * import { CodeBlockStyle } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CodeBlockStyle)("fenced")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CodeBlockStyle = LiteralKit(["fenced", "indented"]).annotate($I.annote("CodeBlockStyle", { description: "The two ways CommonMark spells a code block: `fenced` (a backtick or tilde fence) and `indented` (four-space indentation)." }));

/**
 * The union of all code-block-style string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CodeBlockStyle = typeof CodeBlockStyle.Type;

/**
 * Options controlling formatting: which concrete-syntax markers to normalize,
 * plus the parse knobs (`dialect`, `frontmatter`) the formatter parses the
 * source with (same defaults as `Markdown.parse`). Every marker option is
 * optional and independent; an absent option normalizes nothing.
 *
 * **Details**
 *
 * Scope is marker normalization only — heading style, bullet
 * character, emphasis/strong marker, fence character, thematic-break
 * character, code-block style. Content is never rewritten, rewrapped or
 * reflowed.
 *
 * **Gotchas**
 *
 * `codeBlockStyle` is the opt-in that converts between the two code-block
 * spellings for **language-less** blocks (a block with a `lang` has no
 * indented spelling and is never touched). It exists because the default
 * surprises: absent this option, a language-less code block keeps its
 * spelling — and a language-less {@link Code} node with no explicit
 * `fenceChar` **serializes as an indented block** through
 * `Markdown.stringify`. `"fenced"` rewrites indented blocks to fences (the
 * fence character follows `fenceChar` when also set, backtick otherwise);
 * `"indented"` rewrites language-less fences to indented form where provably
 * safe. Like every other option, hazardous conversions are skipped, never
 * attempted: both directions apply to root-level, flush-left blocks only,
 * and the `"indented"` direction additionally skips blocks whose indented
 * spelling would lazily continue a paragraph, be absorbed into a preceding
 * list or footnote definition, merge with an adjacent code block, or fail
 * representability (empty, or blank first/last lines).
 *
 * **Example** (Request bullet marker normalization)
 *
 * ```ts
 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
 *
 * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
 * console.log(JSON.stringify(MarkdownFormat.formatToString("* one\n", undefined, options))) // "- one\n"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class MarkdownFormattingOptions extends S.Class<MarkdownFormattingOptions>($I`MarkdownFormattingOptions`)({
	dialect: S.optionalKey(MarkdownDialect).annotateKey({ description: "Markdown syntax used to parse the source before formatting; defaults to `gfm`" }),
	frontmatter: S.optionalKey(S.Boolean).annotateKey({ description: "Whether to capture an opening frontmatter block while parsing for formatting; disabled by default" }),
	headingStyle: S.optionalKey(HeadingStyle).annotateKey({ description: "Requested `atx` or `setext` heading spelling, applied only where conversion is safe; omission preserves existing spelling" }),
	bulletChar: S.optionalKey(BulletChar).annotateKey({ description: "Requested unordered-list marker, applied only where normalization is safe; omission preserves existing markers" }),
	emphasisChar: S.optionalKey(EmphasisChar).annotateKey({ description: "Requested delimiter character for emphasis and strong emphasis, applied only where normalization is safe; omission preserves existing delimiters" }),
	fenceChar: S.optionalKey(FenceChar).annotateKey({ description: "Requested code-fence character for safe fence normalization and conversion to fenced blocks; omission preserves existing fences" }),
	thematicBreakChar: S.optionalKey(ThematicBreakChar).annotateKey({ description: "Requested thematic-break marker character, applied only where normalization is safe; omission preserves existing markers" }),
	codeBlockStyle: S.optionalKey(CodeBlockStyle).annotateKey({ description: "Requested fenced or indented spelling for safe conversion of root-level, flush-left code blocks without language or metadata" }),
}, $I.annote("MarkdownFormattingOptions", { description: "Options controlling formatting: which concrete-syntax markers to normalize, plus the parse knobs (`dialect`, `frontmatter`) the formatter parses the source with (same defaults as `Markdown.parse`). Every marker option is optional and independent; an absent option normalizes nothing." })) {}

/**
 * Error codes `MarkdownFormat.modify` can fail with.
 *
 * **Example** (Validate a replacement failure code)
 *
 * ```ts
 * import { MarkdownModificationErrorCode } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MarkdownModificationErrorCode)("UnsupportedTarget")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownModificationErrorCode = LiteralKit([
	"NodeNotInDocument",
	"UnsupportedTarget",
	"FragmentCategoryMismatch",
	"FragmentUnrenderable",
]).annotate($I.annote("MarkdownModificationErrorCode", { description: "Error codes `MarkdownFormat.modify` can fail with." }));

/**
 * The union of all modification-error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownModificationErrorCode = typeof MarkdownModificationErrorCode.Type;

/**
 * Raised when `MarkdownFormat.modify` cannot perform the requested
 * replacement: the target node is not in the document (`NodeNotInDocument`),
 * the target kind or splice context is outside the supported scope
 * (`UnsupportedTarget`), the fragment's content category does not fit the
 * target's slot (`FragmentCategoryMismatch`), or the fragment trips the
 * stringifier's hardening guard (`FragmentUnrenderable`). Carries the typed
 * `code` plus the target's `offset`/`length` where known — never a collapsed
 * reason string alone.
 *
 * **Example** (Inspect a typed replacement failure)
 *
 * ```ts
 * import { MarkdownModificationError } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
 *
 * const error = MarkdownModificationError.make({
 *   code: "UnsupportedTarget", detail: "root cannot be replaced", offset: 0, length: 6,
 * });
 * console.log(error.code) // UnsupportedTarget
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MarkdownModificationError extends S.TaggedError<MarkdownModificationError>($I`MarkdownModificationError`)(
	"MarkdownModificationError",
	{
		code: MarkdownModificationErrorCode.annotateKey({ description: "Reason replacement failed: target absent, unsupported target or context, incompatible fragment category, or unrenderable fragment" }),
		detail: S.String.annotateKey({ description: "Explanation of the replacement failure, included in the error message" }),
		offset: S.Finite.annotateKey({ description: "Zero-based source position reported by the target node, measured in UTF-16 code units" }),
		length: S.Finite.annotateKey({ description: "Extent of the target node's reported source span, measured in UTF-16 code units" }),
	}, $I.annote("MarkdownModificationError", { description: "Raised when `MarkdownFormat.modify` cannot perform the requested replacement: the target node is not in the document (`NodeNotInDocument`), the target kind or splice context is outside the supported scope (`UnsupportedTarget`), the fragment's content category does not fit the target's slot (`FragmentCategoryMismatch`), or the fragment trips the stringifier's hardening guard (`FragmentUnrenderable`). Carries the typed `code` plus the target's `offset`/`length` where known — never a collapsed reason string alone." }),
) {
	/**
	 * Explains the modification failure using its typed code and detail.
	 *
	 * **Example** (Read a replacement failure message)
	 *
	 * ```ts
	 * import { MarkdownModificationError } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
	 *
	 * const error = MarkdownModificationError.make({
	 *   code: "UnsupportedTarget", detail: "root cannot be replaced", offset: 0, length: 6,
	 * });
	 * console.log(error.message) // Markdown modification failed: UnsupportedTarget root cannot be replaced
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Markdown modification failed: ${this.code} ${this.detail}`;
	}
}

// ── Internal: tree walking ──────────────────────────────────────────────────

const childrenOf = (node: MarkdownNode): ReadonlyArray<MarkdownNode> => ("children" in node ? node.children : []);

/** Walk the tree, invoking `visit` with each node, its parent and its siblings. */
const walk = (
	node: MarkdownNode,
	parent: MarkdownNode | undefined,
	siblings: ReadonlyArray<MarkdownNode>,
	index: number,
	visit: (
		node: MarkdownNode,
		parent: MarkdownNode | undefined,
		siblings: ReadonlyArray<MarkdownNode>,
		index: number,
	) => void | boolean,
): void => {
	if (visit(node, parent, siblings, index) === false) {
		return;
	}
	const children = childrenOf(node);
	for (const [child, index] of A.map(children, (child, index) => [child, index] as const)) {
		walk(child, node, children, index, visit);
	}
};

const spanOf = (node: MarkdownNode): { readonly start: number; readonly end: number } => ({
	start: node.position.start.offset,
	end: node.position.end.offset,
});

// ── Internal: format guards ─────────────────────────────────────────────────

const ALPHANUMERIC = /[\p{L}\p{N}]/u;

/** The start offset of the line containing `offset`. */
const lineStartOf = (source: string, offset: number): number => {
	let i = offset;
	while (i > 0 && source.charCodeAt(i - 1) !== 0x0a && source.charCodeAt(i - 1) !== 0x0d) {
		i--;
	}
	return i;
};

/** True when the line before the one containing `offset` is blank or absent. */
const previousLineBlank = (source: string, offset: number): boolean => {
	const lineStart = lineStartOf(source, offset);
	if (lineStart === 0) {
		return true;
	}
	let i = lineStart - 1;
	if (source.charCodeAt(i) === 0x0a && i > 0 && source.charCodeAt(i - 1) === 0x0d) {
		i--;
	}
	const prevStart = lineStartOf(source, i);
	for (let j = prevStart; j < i; j++) {
		const code = source.charCodeAt(j);
		if (code !== 0x20 && code !== 0x09) {
			return false;
		}
	}
	return true;
};

/** Content that cannot stand as a setext heading's text line. */
const SETEXT_CONTENT_HAZARD = /^(?:[-+*>#=]|\d{1,9}[.)](?:\s|$)|`{3}|~{3}|\s)/;

/** The longest run of `char` anywhere in `value`. */
const longestRun = (value: string, char: string): number => {
	let longest = 0;
	let current = 0;
	for (const ch of value) {
		current = ch === char ? current + 1 : 0;
		if (current > longest) {
			longest = current;
		}
	}
	return longest;
};

const isUnorderedList = (node: MarkdownNode): node is List => node.type === "list" && node.ordered !== true;

/** True when only blank text separates the two spans. */
const adjacentSpans = (source: string, endOfFirst: number, startOfSecond: number): boolean => {
	for (let i = endOfFirst; i < startOfSecond; i++) {
		const code = source.charCodeAt(i);
		if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
			return false;
		}
	}
	return true;
};

// ── Internal: format edit collection ────────────────────────────────────────

interface TaggedEdit {
	readonly offset: number;
	readonly length: number;
	readonly content: string;
	readonly nodeStart: number;
	readonly nodeEnd: number;
	readonly bullet: boolean;
}

/** Accumulates edits after the formatting helpers have excluded unchanged markers. */
class FormatEmitter {
	readonly edits: Array<TaggedEdit> = [];
	push(node: MarkdownNode, offset: number, length: number, content: string, bullet = false): void {
		const { start, end } = spanOf(node);
		this.edits.push({ offset, length, content, nodeStart: start, nodeEnd: end, bullet });
	}
}

const formatThematicBreak = (
	source: string,
	emit: FormatEmitter,
	node: ThematicBreak,
	target: ThematicBreakChar,
): void => {
	const fidelity = node.markerChar;
	if (fidelity === target) {
		return;
	}
	const { start, end } = spanOf(node);
	if (target === "-" && !previousLineBlank(source, start)) {
		return;
	}
	emit.push(node, start, end - start, target.repeat(3));
};

const formatHeading = (
	source: string,
	emit: FormatEmitter,
	node: Heading,
	target: HeadingStyle,
	emphasisChar: EmphasisChar | undefined,
): boolean => {
	const fidelity = node.headingStyle;
	if (fidelity === target || A.isReadonlyArrayNonEmpty(node.children) === false) {
		return false;
	}
	const { start, end } = spanOf(node);
	const first = A.headNonEmpty(node.children);
	const last = A.lastNonEmpty(node.children);
	const contentStart = first.position.start.offset;
	const contentEnd = last.position.end.offset;
	const original = source.slice(contentStart, contentEnd);
	if (original.includes("\n") || original.includes("\r")) {
		return false;
	}
	if (target === "setext") {
		if (node.depth > 2 || SETEXT_CONTENT_HAZARD.test(original)) {
			return false;
		}
		if (lineStartOf(source, start) !== start || !previousLineBlank(source, start)) {
			return false;
		}
	}
	// Normalize the descendants against the original source, then compose
	// their splices into the heading's single replacement. The outer walk
	// skips these descendants only when this whole-heading edit is emitted.
	const descendants = new FormatEmitter();
	if (emphasisChar !== undefined) {
		walk(node, undefined, [], 0, (child, _parent, siblings, index) => {
			if (isEmphasisLike(child)) {
				formatEmphasis(source, descendants, child, siblings, index, emphasisChar);
			}
		});
	}
	const content = MarkdownEdit.applyAll(original, A.map(descendants.edits, (edit) =>
		MarkdownEdit.make({ offset: edit.offset - contentStart, length: edit.length, content: edit.content }),
	));
	if (target === "atx") {
		if (/(?:^|[ \t])#+[ \t]*$/.test(content)) return false;
		emit.push(node, start, end - start, `${"#".repeat(node.depth)} ${content}`);
		return true;
	}
	if (SETEXT_CONTENT_HAZARD.test(content)) {
		return false;
	}
	const underline = (node.depth === 1 ? "=" : "-").repeat(Math.max(3, content.length));
	emit.push(node, start, end - start, `${content}\n${underline}`);
	return true;
};

const formatList = (
	source: string,
	emit: FormatEmitter,
	node: List,
	siblings: ReadonlyArray<MarkdownNode>,
	index: number,
	target: BulletChar,
): void => {
	if (!isUnorderedList(node) || node.bulletChar === target) {
		return;
	}
	const previous = index > 0 ? siblings[index - 1] : undefined;
	const next = index + 1 < siblings.length ? siblings[index + 1] : undefined;
	const { start, end } = spanOf(node);
	if (previous !== undefined && isUnorderedList(previous) && adjacentSpans(source, spanOf(previous).end, start)) {
		return;
	}
	if (next !== undefined && isUnorderedList(next) && adjacentSpans(source, end, spanOf(next).start)) {
		return;
	}
	for (const item of node.children) {
		emit.push(node, item.position.start.offset, 1, target, true);
	}
};

const codePointBefore = (source: string, offset: number): string => {
	let start = offset - 1;
	const low = O.exists(Str.charCodeAt(source, start), (code) => code >= 0xdc00 && code <= 0xdfff);
	const high = O.exists(Str.charCodeAt(source, start - 1), (code) => code >= 0xd800 && code <= 0xdbff);
	if (low && high) start--;
	return Str.slice(Math.max(0, start), offset)(source);
};

const codePointAfter = (source: string, offset: number): string =>
	Str.slice(offset, offset + (O.exists(Str.codePointAt(source, offset), (code) => code > 0xffff) ? 2 : 1))(source);

const isEmphasisLike = (node: MarkdownNode): node is Emphasis | Strong => node.type === "emphasis" || node.type === "strong";

const formatEmphasis = (
	source: string,
	emit: FormatEmitter,
	node: Emphasis | Strong,
	siblings: ReadonlyArray<MarkdownNode>,
	index: number,
	target: EmphasisChar,
): void => {
	const fidelity = node.markerChar;
	if (fidelity === target) {
		return;
	}
	const markerLength = node.type === "strong" ? 2 : 1;
	const { start, end } = spanOf(node);
	if (
		target === "_" &&
		((start > 0 && ALPHANUMERIC.test(codePointBefore(source, start))) || (end < source.length && ALPHANUMERIC.test(codePointAfter(source, end))))
	) {
		return;
	}
	for (const child of childrenOf(node)) {
		if (!isEmphasisLike(child)) {
			continue;
		}
		const childSpan = spanOf(child);
		if (childSpan.start === start + markerLength || childSpan.end === end - markerLength) {
			return;
		}
	}
	const previous = index > 0 ? siblings[index - 1] : undefined;
	const next = index + 1 < siblings.length ? siblings[index + 1] : undefined;
	if (previous !== undefined && isEmphasisLike(previous) && spanOf(previous).end === start) {
		return;
	}
	if (next !== undefined && isEmphasisLike(next) && spanOf(next).start === end) {
		return;
	}
	emit.push(node, start, markerLength, target.repeat(markerLength));
	emit.push(node, end - markerLength, markerLength, target.repeat(markerLength));
};

const formatFence = (source: string, emit: FormatEmitter, node: Code, target: FenceChar): void => {
	const fidelity = node.fenceChar;
	if (fidelity === undefined || fidelity === target) {
		return;
	}
	if (target === "`" && `${node.lang ?? ""}${node.meta ?? ""}`.includes("`")) {
		return;
	}
	const { start, end } = spanOf(node);
	let openLength = 0;
	while (start + openLength < end && source[start + openLength] === fidelity) {
		openLength++;
	}
	const newLength = Math.max(3, openLength, longestRun(node.value, target) + 1);
	emit.push(node, start, openLength, target.repeat(newLength));
	// A genuine closing line is the one source line after all content lines.
	// The parsed value already accounts for actual container prefixes: every
	// unclosed content line contributes a newline, including a literal run
	// of backticks. Count locally so normalizing many fences stays linear.
	let lineEnd = end;
	while (lineEnd > start && (source[lineEnd - 1] === " " || source[lineEnd - 1] === "\t")) lineEnd--;
	const closeLineStart = lineStartOf(source, lineEnd);
	if (closeLineStart <= start) return;
	let closeStart = lineEnd;
	while (closeStart > closeLineStart && source[closeStart - 1] === fidelity) closeStart--;
	if (lineEnd - closeStart < openLength) return;
	const physicalLines = A.length(Str.split(Str.slice(start, lineEnd)(source), /\r\n|[\r\n]/));
	const contentLines = A.length(Str.split(node.value, "\n")) - 1;
	if (physicalLines === contentLines + 2) emit.push(node, closeStart, lineEnd - closeStart, target.repeat(newLength));
};

/** A line that is empty or holds only spaces and tabs. */
const BLANK_LINE = /^[ \t]*$/;

/** Whether a sibling is a code block with no info string (either spelling). */
const isLanguagelessCode = (node: MarkdownNode): boolean =>
	node.type === "code" && node.lang === undefined && node.meta === undefined;

/**
 * Convert a language-less code block toward the requested style. Returns
 * whether a whole-block conversion edit was emitted, so the caller can keep
 * `formatFence` off a span this conversion already rewrote.
 *
 * **Gotchas**
 *
 * Both directions are whole-block rewrites, so both are restricted to
 * root-level, flush-left blocks — a container's continuation-line prefix
 * (`> `, list indentation) is not reproducible by a single splice. The
 * indented direction carries the re-parse hazards an indented block is
 * subject to and skips each one: it cannot follow a non-blank line (lazy
 * paragraph continuation), a list or footnote definition absorbs it as item
 * continuation, an adjacent language-less code block would merge with it
 * across the blank line, and an empty value or one with blank first/last
 * lines (or interior whitespace-only lines, which blankness would erase) has
 * no indented spelling at all.
 */
const formatCodeBlockStyle = (
	source: string,
	emit: FormatEmitter,
	node: Code,
	parent: MarkdownNode | undefined,
	siblings: ReadonlyArray<MarkdownNode>,
	index: number,
	target: CodeBlockStyle,
	fenceChar: FenceChar | undefined,
): boolean => {
	if (node.lang !== undefined || node.meta !== undefined) {
		return false;
	}
	if (parent === undefined || parent.type !== "root") {
		return false;
	}
	const { start, end } = spanOf(node);
	if (lineStartOf(source, start) !== start) {
		return false;
	}
	const value = node.value.endsWith("\n") ? node.value.slice(0, -1) : node.value;
	if (target === "fenced") {
		if (node.fenceChar !== undefined) {
			return false;
		}
		const char = fenceChar ?? "`";
		const fence = char.repeat(Math.max(3, longestRun(value, char) + 1));
		emit.push(node, start, end - start, `${fence}\n${value}\n${fence}`);
		return true;
	}
	if (node.fenceChar === undefined) {
		return false;
	}
	const lines = value === "" ? [] : value.split("\n");
	if (A.isReadonlyArrayNonEmpty(lines) === false) {
		return false;
	}
	if (BLANK_LINE.test(A.headNonEmpty(lines)) || BLANK_LINE.test(A.lastNonEmpty(lines))) {
		return false;
	}
	if (lines.some((line) => line !== "" && BLANK_LINE.test(line))) {
		return false;
	}
	if (!previousLineBlank(source, start)) {
		return false;
	}
	const previous = index > 0 ? siblings[index - 1] : undefined;
	const next = index + 1 < siblings.length ? siblings[index + 1] : undefined;
	if (previous !== undefined && (previous.type === "list" || previous.type === "footnoteDefinition")) {
		return false;
	}
	if ((previous !== undefined && isLanguagelessCode(previous)) || (next !== undefined && isLanguagelessCode(next))) {
		return false;
	}
	emit.push(node, start, end - start, lines.map((line) => (line === "" ? "" : `    ${line}`)).join("\n"));
	return true;
};

// ── Internal: modify support ────────────────────────────────────────────────

const FLOW_TYPES = LiteralKit([
	"blockquote",
	"code",
	"definition",
	"footnoteDefinition",
	"heading",
	"html",
	"list",
	"paragraph",
	"table",
	"thematicBreak",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const PHRASING_TYPES = LiteralKit([
	"break",
	"delete",
	"emphasis",
	"footnoteReference",
	"html",
	"image",
	"imageReference",
	"inlineCode",
	"link",
	"linkReference",
	"strong",
	"text",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const isFlowReplacement = P.and(S.is(FlowContent), S.is(S.Struct({ type: FLOW_TYPES })));

const isPhrasingReplacement = P.and(S.is(PhrasingContent), S.is(S.Struct({ type: PHRASING_TYPES })));

/** Parent types whose child slot holds flow content. */
const FLOW_PARENTS = LiteralKit(["root", "blockquote", "listItem", "footnoteDefinition"] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

/** Parent types whose child slot holds phrasing content. */
const PHRASING_PARENTS = LiteralKit([
	"paragraph",
	"heading",
	"emphasis",
	"strong",
	"delete",
	"link",
	"linkReference",
	"tableCell",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

/** Ancestor types whose continuation lines carry a prefix (or forbid newlines outright). */
const NO_MULTILINE_ANCESTORS = LiteralKit([
	"blockquote",
	"list",
	"listItem",
	"footnoteDefinition",
	"table",
	"tableRow",
	"tableCell",
	"heading",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const isFlowParent = S.is(FLOW_PARENTS);
const isPhrasingParent = S.is(PHRASING_PARENTS);
const isNoMultilineAncestor = S.is(NO_MULTILINE_ANCESTORS);

/**
 * The stringifier's parity-aware cell post-pass, kept at the facade boundary
 * because this module cannot import the engine. An odd backslash run already
 * escapes a pipe; an even run needs one more backslash for the cell splitter.
 */
const escapeCellPipes = (content: string): string => {
	let out = "";
	let backslashes = 0;
	for (const char of content) {
		if (char === "|" && backslashes % 2 === 0) out += "\\";
		backslashes = char === "\\" ? backslashes + 1 : 0;
		out += char;
	}
	return out;
};

/** Find `target` by identity; returns its ancestor chain (nearest first) or undefined. */
const findAncestry = (root: Root, target: MarkdownNode): ReadonlyArray<MarkdownNode> | undefined => {
	const search = (node: MarkdownNode, trail: Array<MarkdownNode>): ReadonlyArray<MarkdownNode> | undefined => {
		if (node === target) {
			return trail;
		}
		for (const child of childrenOf(node)) {
			const found = search(child, [node, ...trail]);
			if (found !== undefined) {
				return found;
			}
		}
		return undefined;
	};
	return search(root, []);
};

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Normalizes markdown markers and replaces a single node, as byte-minimal
 * edits that leave the rest of the source untouched. Not instantiable.
 *
 * **Details**
 *
 * `format`/`formatToString` are pure and total: input that trips a parse
 * hardening guard yields no edits rather than corrupting the document, and
 * every emitted edit is guarded against the re-parse hazards listed in the
 * module documentation — a hazardous conversion is skipped, never attempted.
 * `modify`/`modifyToString` carry a real error channel
 * ({@link MarkdownModificationError}) and render every replacement through
 * the canonical stringifier, so a modified document re-parses cleanly by
 * construction.
 *
 * **Example** (Normalize markdown markers and replace a paragraph)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
 * import * as Effect from "effect/Effect";
 *
 * const options = MarkdownFormattingOptions.make({ bulletChar: "-", headingStyle: "atx" });
 * const normalized = MarkdownFormat.formatToString("* a\n* b\n\nSetext\n======\n", undefined, options);
 * console.log(JSON.stringify(normalized)) // "- a\n- b\n\n# Setext\n"
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* MarkdownDocument.parse("# Title\n\nHello world\n");
 *   const paragraph = doc.root.children[1];
 *   if (paragraph === undefined) return doc.source;
 *   return yield* MarkdownFormat.modifyToString(doc, paragraph, "Goodbye");
 * });
 * console.log(JSON.stringify(Effect.runSync(program))) // "# Title\n\nGoodbye\n"
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export abstract class MarkdownFormat {

	/**
	 * Compute marker-normalization edits per the requested
	 * {@link MarkdownFormattingOptions}: heading style, bullet character,
	 * emphasis/strong marker, fence character, thematic-break character and
	 * code-block style, each only where the node's concrete syntax differs
	 * from the target and the rewrite is provably safe. Content is never
	 * touched. `range` restricts edits to the nodes intersecting it (the
	 * owning-node intersection posture, matching toml). Non-mutating — apply
	 * with `MarkdownEdit.applyAll` (or use
	 * {@link MarkdownFormat.formatToString}).
	 *
	 * **Gotchas**
	 *
	 * Note the code-block default: absent `codeBlockStyle`, a language-less
	 * code block keeps whichever spelling it has — `fenceChar` alone
	 * normalizes existing fences and deliberately leaves indented blocks
	 * indented.
	 *
	 * **Example** (Compute bullet marker edits)
	 *
	 * ```ts
	 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
	 *
	 * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
	 * const edits = MarkdownFormat.format("* one\n", undefined, options);
	 * console.log(edits.length) // 1
	 * ```
	 *
	 * @param text - The markdown source to format.
	 * @param range - Optional sub-range; only edits whose node intersects it are
	 *   returned.
	 * @param options - Optional {@link MarkdownFormattingOptions}; an absent
	 *   marker option normalizes nothing.
	 * @returns The edits that normalize the requested markers; apply them with
	 *   `MarkdownEdit.applyAll`. Empty when the input trips a parse hardening
	 *   guard.
	 * @category formatting
	 * @since 0.0.0
	 */
	static format(
		text: string,
		range?: MarkdownRangeLike,
		options?: MarkdownFormattingOptions,
	): ReadonlyArray<MarkdownEdit> {
		const parseOptions = MarkdownParseOptions.make({
			...O.getSomesStruct({
				dialect: O.fromUndefinedOr(options?.dialect),
				frontmatter: O.fromUndefinedOr(options?.frontmatter),
			}),
		});
		const parsed = Markdown.parseResult(text, parseOptions);
		if (Result.isFailure(parsed)) {
			return [];
		}
		const emit = new FormatEmitter();
		walk(parsed.success, undefined, [], 0, (node, parent, siblings, index) => {
			if (options?.thematicBreakChar !== undefined && node.type === "thematicBreak") {
				formatThematicBreak(text, emit, node, options.thematicBreakChar);
			}
			if (options?.headingStyle !== undefined && node.type === "heading") {
				if (formatHeading(text, emit, node, options.headingStyle, options.emphasisChar)) {
					return false;
				}
			}
			if (options?.bulletChar !== undefined && node.type === "list") {
				formatList(text, emit, node, siblings, index, options.bulletChar);
			}
			if (options?.emphasisChar !== undefined && isEmphasisLike(node)) {
				formatEmphasis(text, emit, node, siblings, index, options.emphasisChar);
			}
			if (node.type === "code") {
				// A style conversion rewrites the whole block; formatFence must
				// not also splice inside a span the conversion replaced.
				const converted =
					options?.codeBlockStyle !== undefined &&
					formatCodeBlockStyle(text, emit, node, parent, siblings, index, options.codeBlockStyle, options.fenceChar);
				if (!converted && options?.fenceChar !== undefined) {
					formatFence(text, emit, node, options.fenceChar);
				}
			}
			return true;
		});
		const filtered =
			range === undefined
				? emit.edits
				: emit.edits.filter(
						(edit) => Math.max(edit.nodeStart, range.offset) <= Math.min(edit.nodeEnd, range.offset + range.length),
					);
		const bulletEdits = A.filter(filtered, (edit) => edit.bullet);
		const hazardousLines: Array<number> = [];
		if (A.isReadonlyArrayNonEmpty(bulletEdits)) {
			const originalBreaks: Array<number> = [];
			walk(parsed.success, undefined, [], 0, (node) => {
				if (node.type === "thematicBreak") originalBreaks.push(spanOf(node).start);
			});
			const existingBreaks = HashSet.fromIterable(originalBreaks);
			// Project the complete range-filtered wave, including nested lists on
			// the same physical line, before judging the thematic-break hazard.
			const projected = MarkdownEdit.applyAll(text, A.map(bulletEdits, (edit) => MarkdownEdit.make(edit)));
			const reparsed = Markdown.parseResult(projected, parseOptions);
			if (Result.isSuccess(reparsed)) {
				walk(reparsed.success, undefined, [], 0, (node) => {
					if (node.type === "thematicBreak" && !HashSet.has(existingBreaks, spanOf(node).start)) {
						hazardousLines.push(lineStartOf(projected, spanOf(node).start));
					}
				});
			} else {
				for (const edit of bulletEdits) hazardousLines.push(lineStartOf(text, edit.offset));
			}
		}
		const hazards = HashSet.fromIterable(hazardousLines);
		return A.map(A.filter(filtered, (edit) => !edit.bullet || !HashSet.has(hazards, lineStartOf(text, edit.offset))), (edit) =>
			MarkdownEdit.make({ offset: edit.offset, length: edit.length, content: edit.content }),
		);
	}

	/**
	 * Format `text` and apply the resulting edits in one step
	 * (`MarkdownEdit.applyAll ∘ format`). Pure and total.
	 *
	 * **Example** (Normalize a list in one step)
	 *
	 * ```ts
	 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
	 *
	 * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
	 * console.log(JSON.stringify(MarkdownFormat.formatToString("* one\n", undefined, options))) // "- one\n"
	 * ```
	 *
	 * @param text - The markdown source to format.
	 * @param range - Optional sub-range; only edits whose node intersects it are
	 *   applied.
	 * @param options - Optional {@link MarkdownFormattingOptions}.
	 * @returns The formatted text.
	 * @category formatting
	 * @since 0.0.0
	 */
	static formatToString(text: string, range?: MarkdownRangeLike, options?: MarkdownFormattingOptions): string {
		return MarkdownEdit.applyAll(text, MarkdownFormat.format(text, range, options));
	}

	/**
	 * Compute the edit that replaces `target` — a node from `document`'s own
	 * tree, matched by identity — with `replacement`: a plain string (treated
	 * as literal text and escaped; block-wrapped when the target is a flow
	 * node) or a node fragment whose content category must fit the target's
	 * slot (flow for flow targets, phrasing for phrasing targets and table
	 * cells). Every replacement renders through the canonical stringifier, so
	 * the modified document re-parses cleanly by construction. List
	 * items, table rows, frontmatter and the root refuse with
	 * `UnsupportedTarget`, as does a multi-line replacement whose target sits
	 * inside a container (a blockquote, list, table or heading) whose
	 * continuation lines the splice cannot prefix.
	 *
	 * **Example** (Compute a paragraph replacement edit)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import { MarkdownFormat } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const document = yield* MarkdownDocument.parse("Hello\n");
	 *   const target = document.root.children[0];
	 *   if (target === undefined) return 0;
	 *   const edits = yield* MarkdownFormat.modify(document, target, "Goodbye");
	 *   return edits.length;
	 * });
	 * console.log(Effect.runSync(program)) // 1
	 * ```
	 *
	 * @param document - The parsed {@link MarkdownDocument} the target belongs to.
	 * @param target - The node to replace; it must be a node of
	 *   `document.root`, matched by identity.
	 * @param replacement - A plain string (literal text) or a node fragment of
	 *   the target's content category.
	 * @returns An `Effect` that succeeds with the edit to apply (via
	 *   `MarkdownEdit.applyAll`), or fails with {@link MarkdownModificationError}.
	 * @category formatting
	 * @since 0.0.0
	 */
	static readonly modify = Effect.fn("MarkdownFormat.modify")(function* (
		document: MarkdownDocument,
		target: MarkdownNode,
		replacement: MarkdownNode | string,
	) {
		const { start, end } = spanOf(target);
		const fail = (code: MarkdownModificationErrorCode, detail: string) =>
			MarkdownModificationError.make({ code, detail, offset: start, length: end - start });
		const ancestry = findAncestry(document.root, target);
		if (ancestry === undefined) {
			return yield* fail("NodeNotInDocument", "the target node is not part of the document's tree");
		}
		const parent = ancestry[0];
		if (parent === undefined || target.type === "frontmatter") {
			return yield* fail("UnsupportedTarget", `a ${target.type} node cannot be replaced`);
		}
		let slot: "flow" | "phrasing" | "cell";
		if (target.type === "tableCell" && parent.type === "tableRow") {
			slot = "cell";
		} else if (isFlowParent(parent.type)) {
			slot = "flow";
		} else if (isPhrasingParent(parent.type)) {
			slot = "phrasing";
		} else {
			return yield* fail("UnsupportedTarget", `a ${target.type} node inside a ${parent.type} cannot be replaced`);
		}
		if (!P.isString(replacement) && A.some(ancestry, (node) => node.type === "link" || node.type === "linkReference")) {
			let containsLink = false;
			walk(replacement, undefined, [], 0, (node) => {
				if (node.type === "link" || node.type === "linkReference") containsLink = true;
			});
			if (containsLink) return yield* fail("UnsupportedTarget", "a link replacement cannot be nested inside another link");
		}
		let renderRoot: Root;
		if (P.isString(replacement)) {
			// Synthesized render scaffolding: `make` fills the zero-width
			// sentinel position, and the stringifier never reads it.
			const textNode = Text.make({ value: replacement });
			const paragraph = Paragraph.make({ children: [textNode] });
			renderRoot = Root.make({ children: [paragraph] });
		} else if (slot === "flow") {
			if (!isFlowReplacement(replacement)) {
				return yield* fail(
					"FragmentCategoryMismatch",
					`a ${replacement.type} fragment does not fit a flow slot — pass flow content or a plain string`,
				);
			}
			renderRoot = Root.make({ children: [replacement] });
		} else {
			if (!isPhrasingReplacement(replacement)) {
				return yield* fail(
					"FragmentCategoryMismatch",
					`a ${replacement.type} fragment does not fit a phrasing slot — pass phrasing content or a plain string`,
				);
			}
			const paragraph = Paragraph.make({ children: [replacement] });
			renderRoot = Root.make({ children: [paragraph] });
		}
		const rendered = Markdown.stringifyResult(renderRoot);
		if (Result.isFailure(rendered)) {
			return yield* fail("FragmentUnrenderable", rendered.failure.message);
		}
		const renderedContent = rendered.success.replace(/\n+$/, "");
		const inCell = slot === "cell" || A.some(ancestry, (ancestor) => ancestor.type === "tableCell");
		let content = inCell ? escapeCellPipes(renderedContent) : renderedContent;
		if (/[\r\n]/.test(content) && A.some(ancestry, (ancestor) => isNoMultilineAncestor(ancestor.type))) {
			return yield* fail(
				"UnsupportedTarget",
				"a multi-line replacement cannot be spliced inside a container whose continuation lines carry a prefix",
			);
		}
		const heading = A.findFirst(ancestry, (node): node is Heading => node.type === "heading" && node.headingStyle === "atx");
		if (O.isSome(heading)) {
			const headingStart = spanOf(heading.value).start;
			const prefix = Str.slice(headingStart, start)(document.source);
			const projected = prefix + content + Str.slice(end, spanOf(heading.value).end)(document.source);
			let hashEnd = projected.length;
			while (projected[hashEnd - 1] === " " || projected[hashEnd - 1] === "\t") hashEnd--;
			let hashStart = hashEnd;
			while (projected[hashStart - 1] === "#") hashStart--;
			if (hashStart < hashEnd && (hashStart === 0 || projected[hashStart - 1] === " " || projected[hashStart - 1] === "\t") &&
				hashStart >= prefix.length && hashStart < prefix.length + content.length) {
				const at = hashStart - prefix.length;
				content = Str.slice(0, at)(content) + "\\" + Str.slice(at)(content);
			}
		}
		if (slot === "flow") {
			const parseOptions = MarkdownParseOptions.make({ frontmatter: document.frontmatter !== undefined });
			const standalone = Markdown.parseResult(content, parseOptions);
			const projected = Markdown.parseResult(Str.slice(0, start)(document.source) + content + Str.slice(end)(document.source), parseOptions);
			if (Result.isFailure(standalone) || Result.isFailure(projected)) {
				return yield* fail("UnsupportedTarget", "the flow replacement cannot be parsed in its source context");
			}
			const contextualBlocks: Array<MarkdownNode> = [];
			walk(projected.success, undefined, [], 0, (node, candidateParent) => {
				if (candidateParent?.type === parent.type && spanOf(candidateParent).start === spanOf(parent).start) {
					contextualBlocks.push(node);
				}
			});
			// Reuse actual interruption grammar: each standalone block must still
			// begin at its splice-relative offset in the same container slot.
			if (!A.every(standalone.success.children, (node) => A.some(contextualBlocks, (candidate) =>
				candidate.type === node.type && spanOf(candidate).start === start + spanOf(node).start))) {
				return yield* fail("UnsupportedTarget", "the preceding block context would absorb the flow replacement");
			}
		}
		const edits: ReadonlyArray<MarkdownEdit> = [MarkdownEdit.make({ offset: start, length: end - start, content })];
		return edits;
	});

	/**
	 * Modify `document` and apply the resulting edit in one step
	 * (`MarkdownEdit.applyAll ∘ modify`).
	 *
	 * **Example** (Replace a paragraph and apply its edit)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import { MarkdownFormat } from "@beep/scratchpad/effected/markdown/MarkdownFormat";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const document = yield* MarkdownDocument.parse("Hello\n");
	 *   const target = document.root.children[0];
	 *   if (target === undefined) return document.source;
	 *   return yield* MarkdownFormat.modifyToString(document, target, "Goodbye");
	 * });
	 * console.log(JSON.stringify(Effect.runSync(program))) // "Goodbye\n"
	 * ```
	 *
	 * @param document - The parsed {@link MarkdownDocument} the target belongs to.
	 * @param target - The node to replace; it must be a node of
	 *   `document.root`, matched by identity.
	 * @param replacement - A plain string (literal text) or a node fragment of
	 *   the target's content category.
	 * @returns An `Effect` that succeeds with the modified source, or fails with
	 *   {@link MarkdownModificationError}.
	 * @category formatting
	 * @since 0.0.0
	 */
	static readonly modifyToString = Effect.fn("MarkdownFormat.modifyToString")(function* (
		document: MarkdownDocument,
		target: MarkdownNode,
		replacement: MarkdownNode | string,
	) {
		const edits = yield* MarkdownFormat.modify(document, target, replacement);
		return MarkdownEdit.applyAll(document.source, edits);
	});
}
