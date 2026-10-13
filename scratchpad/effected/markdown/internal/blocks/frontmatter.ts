// The frontmatter capture — an offset-0 pre-scan, deliberately NOT a
// registry construct.
//
// A registry entry would give this construct powers it must never have:
// block starts can fire on any line, and frontmatter exists only as the very
// first thing in a document. The scan runs once, before the line loop, and
// on success the block pass simply starts after the closing fence. The
// captured text is raw — it never enters the inline pass, and the engine
// never decodes it (the codec modules do, over the public node).
//
// Grammar and its authorities (the fence set is deliberately closed):
// - `---` opens yaml, closed by `---` — gray-matter@4.0.3's default
//   delimiters and default language, and remark-frontmatter's yaml preset.
// - `+++` opens toml, closed by `+++` — remark-frontmatter's toml preset
//   (the markdown-ecosystem standard; mdast-util-frontmatter names the
//   `toml` node the same way).
// - `---json` opens json, closed by `---` — gray-matter's language-hint
//   form (`---<language>` after the opening delimiter) with its built-in
//   JSON engine; the closing fence is the plain delimiter, as gray-matter
//   closes it.
// - No other language hint is recognized (`---yaml`, `---toml`, `---coffee`
//   are content, not fences) — gray-matter parity is capability parity at
//   the `Frontmatter.schema` seam, not convention-for-convention emulation.
// - A fence line is exactly the fence: no leading or trailing whitespace
//   (micromark-extension-frontmatter's posture). Line terminators are
//   already stripped by the preprocessor, so CRLF sources need no special
//   casing here.
// - No closing fence, no frontmatter: the scan returns null and the
//   document parses as if the toggle were off. That is remark-frontmatter's
//   behavior too, and it is not a diagnostic — an opening fence with no
//   close IS a thematic break followed by content.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SourceLine } from "../preprocess.ts";

const $I = $ScratchpadId.create("effected/markdown/internal/blocks/frontmatter");

/** The metadata formats selected by frontmatter opening fences.
 *
 * **Example** (Validate FrontmatterFormat data)
 *
 * ```ts
 * import { FrontmatterFormat } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterFormat)("yaml")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterFormat = LiteralKit(["yaml", "toml", "json"]).annotate(
	$I.annote("FrontmatterFormat", { description: "The frontmatter formats selected by the YAML, TOML and JSON opening fences." }),
);
/**
 * The schema-derived FrontmatterFormat value type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterFormat = typeof FrontmatterFormat.Type;

/** What the fence's opening line commits the scan to. */
const FenceRule = S.Struct({
	format: FrontmatterFormat.annotateKey({ description: "The format selected by the opening fence." }),
	close: S.String.annotateKey({ description: "The exact closing fence line." }),
}).annotate($I.annote("FenceRule", { description: "The format and exact closing fence committed to by an opening line." }));
type FenceRule = typeof FenceRule.Type;

const FENCES = HashMap.fromIterable<string, FenceRule>([
	["---", { format: "yaml", close: "---" }],
	["+++", { format: "toml", close: "+++" }],
	["---json", { format: "json", close: "---" }],
]);

/**
 * A successful capture: everything the parser needs to skip and materialize.
 *
 * **Example** (Validate FrontmatterCapture data)
 *
 * ```ts
 * import { FrontmatterCapture } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterCapture)({ format: "yaml", value: "title: Guide", lineCount: 3, endOffset: 20 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FrontmatterCapture = S.Struct({
	format: FrontmatterFormat.annotateKey({ description: "The metadata format selected by the opening fence." }),
	value: S.String.annotateKey({ description: "Raw text between fences with original interior terminators and no fence lines." }),
	lineCount: S.Finite.annotateKey({ description: "Number of source lines spanned, including both fences." }),
	endOffset: S.Finite.annotateKey({ description: "Exclusive absolute offset of the closing fence's last character." }),
}).annotate($I.annote("FrontmatterCapture", { description: "A preprocessed frontmatter capture with raw interior terminators and source boundaries." }));
/**
 * The schema-derived FrontmatterCapture value type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterCapture = typeof FrontmatterCapture.Type;

/**
 * Scan the head of a preprocessed document for a frontmatter block.
 *
 * **Details**
 *
 * `lines` is the preprocessor's line table (U+0000 already replaced,
 * terminators stripped, absolute `start` offsets); `text` is the original
 * source, consulted only for the terminators between value lines — a
 * terminator can never contain U+0000, so slicing it from the source is
 * exact, and the value keeps CRLF interiors verbatim while the line content
 * keeps the preprocessor's U+FFFD replacement.
 *
 * Returns `null` when the document has no frontmatter — which is the common
 * case and never an error.
 *
 * **Example** (Capture preprocessed YAML frontmatter)
 *
 * ```ts
 * import { scanFrontmatter } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 * import { preprocessLines } from "@beep/scratchpad/effected/markdown/internal/preprocess";
 *
 * const text = "---\nname: Ada\n---\nbody";
 * const capture = scanFrontmatter(preprocessLines(text), text);
 * console.log(capture?.format); // yaml
 * console.log(capture?.value); // name: Ada
 * console.log(scanFrontmatter(preprocessLines("body"), "body")); // null
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanFrontmatter: {
	(lines: ReadonlyArray<SourceLine>, text: string): FrontmatterCapture | null;
	(text: string): (lines: ReadonlyArray<SourceLine>) => FrontmatterCapture | null;
} = dual(2, (lines: ReadonlyArray<SourceLine>, text: string): FrontmatterCapture | null => {
	const opening = lines[0];
	if (opening === undefined || opening.start !== 0) {
		return null;
	}
	const rule = O.getOrUndefined(HashMap.get(FENCES, opening.text));
	if (rule === undefined) {
		return null;
	}

	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (line === undefined || line.text !== rule.close) {
			continue;
		}

		const parts: string[] = [];
		for (let inner = 1; inner < index; inner += 1) {
			const current = lines[inner];
			const next = lines[inner + 1];
			if (current === undefined || next === undefined) {
				break;
			}
			parts.push(current.text);
			if (inner + 1 < index) {
				parts.push(text.slice(current.start + current.text.length, next.start));
			}
		}

		return {
			format: rule.format,
			value: parts.join(""),
			lineCount: index + 1,
			endOffset: line.start + line.text.length,
		};
	}

	return null;
});

/**
 * The three raw line terminators recognized by the frontmatter scanners.
 *
 * **Example** (Read the accepted terminators)
 *
 * ```ts
 * import { RawNewline } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 *
 * console.log(RawNewline.literals.length); // 3
 * console.log(RawNewline.literals.includes("\r\n")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawNewline = LiteralKit(["\n", "\r\n", "\r"]).annotate(
	$I.annote("RawNewline", { description: "The three raw line terminators recognized by the frontmatter scanners." }),
);

/**
 * A raw line terminator spelling derived from the shared literal domain.
 *
 * @category schemas
 * @since 0.0.0
 */
export type RawNewline = typeof RawNewline.Type;

/**
 * A successful raw string-level capture: exact byte boundaries into the
 * ORIGINAL source, no preprocessing (no U+0000 replacement — the value slice
 * is verbatim bytes; a fence line containing U+0000 simply is not a fence,
 * matching the preprocessed scan where the replacement character breaks the
 * exact match the same way).
 *
 * **Example** (Validate RawFrontmatterCapture data)
 *
 * ```ts
 * import { RawFrontmatterCapture } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RawFrontmatterCapture)({ format: "yaml", value: "title: Guide\n", newline: "\n", bodyOffset: 21 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RawFrontmatterCapture = S.Struct({
	format: FrontmatterFormat.annotateKey({ description: "The metadata format selected by the opening fence." }),
	value: S.String.annotateKey({ description: "Exact source between fences, including each value line's terminator; empty and a blank value line stay distinct." }),
	newline: RawNewline.annotateKey({ description: "The line terminator following the opening fence." }),
	bodyOffset: S.Finite.annotateKey({ description: "Absolute offset after the closing fence and its terminator, where the body begins." }),
}).annotate($I.annote("RawFrontmatterCapture", { description: "An exact raw frontmatter capture retaining value bytes, opening newline and body boundary." }));
/**
 * The schema-derived RawFrontmatterCapture value type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawFrontmatterCapture = typeof RawFrontmatterCapture.Type;

/** The terminator starting at `offset`, or null when none does. */
const terminatorAt = (source: string, offset: number): RawNewline | null => {
	const code = source.charCodeAt(offset);
	if (code === 0x0a) {
		return "\n";
	}
	if (code === 0x0d) {
		return source.charCodeAt(offset + 1) === 0x0a ? "\r\n" : "\r";
	}
	return null;
};

/**
 * Captures frontmatter from raw source with exact offsets for string-level
 * splitting and joining.
 *
 * **Details**
 *
 * Uses the same closed fence grammar as {@link scanFrontmatter}, over
 * unpreprocessed bytes, returning exact offsets. The two scans agree on every
 * input about WHETHER a block exists
 * (the preprocessor's substitutions are length-preserving and can only break
 * a fence match both scans require); this one exists for the string-level
 * split/join surface, whose contract is byte exactness.
 *
 * Returns `null` when the document has no frontmatter — no fence at offset
 * 0, or an opening fence with no closing fence, which per the grammar is not
 * frontmatter at all.
 *
 * **Example** (Preserve raw terminators and locate the body)
 *
 * ```ts
 * import { scanRawFrontmatter } from "@beep/scratchpad/effected/markdown/internal/blocks/frontmatter";
 *
 * const source = "---\r\nname: Ada\r\n---\r\nbody";
 * const capture = scanRawFrontmatter(source);
 * console.log(capture?.format); // yaml
 * console.log(capture?.value === "name: Ada\r\n"); // true
 * console.log(source.slice(capture?.bodyOffset)); // body
 * console.log(scanRawFrontmatter("---\nno closing fence")); // null
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanRawFrontmatter = (source: string): RawFrontmatterCapture | null => {
	// The opening fence line: source up to the first terminator. It must be
	// exactly a fence and must be terminated — a closing fence needs
	// somewhere to live.
	let index = 0;
	while (index < source.length && terminatorAt(source, index) === null) {
		index += 1;
	}
	const openNewline = index < source.length ? terminatorAt(source, index) : null;
	const rule = O.getOrUndefined(HashMap.get(FENCES, source.slice(0, index)));
	if (rule === undefined || openNewline === null) {
		return null;
	}
	const valueStart = index + openNewline.length;

	// Scan the remaining lines for the exact closing fence.
	let lineStart = valueStart;
	index = valueStart;
	while (index <= source.length) {
		const terminator = index === source.length ? null : terminatorAt(source, index);
		if (terminator === null && index < source.length) {
			index += 1;
			continue;
		}
		if (source.slice(lineStart, index) === rule.close) {
			return {
				format: rule.format,
				value: source.slice(valueStart, lineStart),
				newline: openNewline,
				bodyOffset: terminator === null ? index : index + terminator.length,
			};
		}
		if (terminator === null) {
			break;
		}
		index += terminator.length;
		lineStart = index;
	}

	return null;
};
