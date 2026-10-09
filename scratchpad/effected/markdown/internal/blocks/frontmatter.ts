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

import { dual } from "effect/Function";
import type { FrontmatterFormat } from "../../MarkdownNode.ts";
import type { SourceLine } from "../preprocess.ts";

/** What the fence's opening line commits the scan to. */
interface FenceRule {
	readonly format: FrontmatterFormat;
	readonly close: string;
}

const FENCES: ReadonlyMap<string, FenceRule> = new Map([
	["---", { format: "yaml", close: "---" }],
	["+++", { format: "toml", close: "+++" }],
	["---json", { format: "json", close: "---" }],
]);

/** A successful capture: everything the parser needs to skip and materialize. */
export interface FrontmatterCapture {
	readonly format: FrontmatterFormat;
	/** Raw text between the fences — original terminators, no fence lines. */
	readonly value: string;
	/** How many source lines the block spans, both fences included. */
	readonly lineCount: number;
	/** Absolute offset of the closing fence's last character, exclusive. */
	readonly endOffset: number;
}

/**
 * Scan the head of a preprocessed document for a frontmatter block.
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
 */
export const scanFrontmatter: {
	(lines: ReadonlyArray<SourceLine>, text: string): FrontmatterCapture | null;
	(text: string): (lines: ReadonlyArray<SourceLine>) => FrontmatterCapture | null;
} = dual(2, (lines: ReadonlyArray<SourceLine>, text: string): FrontmatterCapture | null => {
	const opening = lines[0];
	if (opening === undefined || opening.start !== 0) {
		return null;
	}
	const rule = FENCES.get(opening.text);
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

/** A raw line terminator spelling. */
export type RawNewline = "\n" | "\r\n" | "\r";

/**
 * A successful raw string-level capture: exact byte boundaries into the
 * ORIGINAL source, no preprocessing (no U+0000 replacement — the value slice
 * is verbatim bytes; a fence line containing U+0000 simply is not a fence,
 * matching the preprocessed scan where the replacement character breaks the
 * exact match the same way).
 */
export interface RawFrontmatterCapture {
	readonly format: FrontmatterFormat;
	/**
	 * The exact bytes strictly between the opening fence line (terminator
	 * included) and the closing fence line: every value line WITH its own
	 * terminator, verbatim. Empty for a block with no value lines; `"\n"`
	 * for a block whose value is one blank line — the two stay distinct.
	 */
	readonly value: string;
	/** The line terminator following the opening fence line. */
	readonly newline: RawNewline;
	/**
	 * Absolute offset of the first byte after the closing fence line and its
	 * line terminator — where the body begins. Equal to the source length
	 * when the closing fence ends the document.
	 */
	readonly bodyOffset: number;
}

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
 * Scan raw source for a frontmatter block — the same closed fence grammar as
 * {@link scanFrontmatter}, over unpreprocessed bytes, returning exact
 * offsets. The two scans agree on every input about WHETHER a block exists
 * (the preprocessor's substitutions are length-preserving and can only break
 * a fence match both scans require); this one exists for the string-level
 * split/join surface, whose contract is byte exactness.
 *
 * Returns `null` when the document has no frontmatter — no fence at offset
 * 0, or an opening fence with no closing fence, which per the grammar is not
 * frontmatter at all.
 */
export const scanRawFrontmatter = (source: string): RawFrontmatterCapture | null => {
	// The opening fence line: source up to the first terminator. It must be
	// exactly a fence and must be terminated — a closing fence needs
	// somewhere to live.
	let index = 0;
	while (index < source.length && terminatorAt(source, index) === null) {
		index += 1;
	}
	const openNewline = index < source.length ? (terminatorAt(source, index) as RawNewline) : null;
	const rule = FENCES.get(source.slice(0, index));
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
