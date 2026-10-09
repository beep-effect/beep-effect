// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream splits the input with `input.split(/\r\n|\n|\r/)` and
// throws the line offsets away — it only ever needs line NUMBERS for its
// sourcepos. This package's edit layer is offset-based, so the split is
// rewritten as a manual scan that keeps each line's absolute start offset.
// Everything else (the NUL replacement, the trailing-newline rule, the
// tab-stop arithmetic) is upstream's behavior verbatim.
//
// Leaf module: imports nothing.

/** Columns of indentation that open an indented code block. */
export const CODE_INDENT = 4;

/** The tab stop width CommonMark fixes for indentation arithmetic. */
export const TAB_STOP = 4;

/**
 * One source line: its text with the line terminator stripped, and the
 * absolute offset of its first character in the original source.
 *
 * `text` is NUL-replaced (see {@link preprocessLines}), which is a 1:1
 * character substitution — every index into `text` is still a valid
 * `start + index` offset into the original source.
 */
export interface SourceLine {
	readonly text: string;
	readonly start: number;
}

/**
 * Split `text` into lines, preserving each line's absolute start offset.
 *
 * `\r\n`, `\n` and `\r` all terminate a line. U+0000 is replaced with U+FFFD
 * per the spec's security note; the replacement is length-preserving so
 * offsets stay aligned with the original source.
 *
 * A single trailing `\n` does not produce a final empty line (upstream's
 * rule — the document "foo\n" is one line, not two). A trailing bare `\r`
 * does, which is also upstream's behavior: the extra blank line is inert.
 */
export const preprocessLines = (text: string): ReadonlyArray<SourceLine> => {
	const lines: SourceLine[] = [];
	let start = 0;
	let index = 0;

	while (index < text.length) {
		const code = text.charCodeAt(index);
		if (code === 0x0a) {
			lines.push({ text: replaceNul(text.slice(start, index)), start });
			index += 1;
			start = index;
		} else if (code === 0x0d) {
			lines.push({ text: replaceNul(text.slice(start, index)), start });
			index += text.charCodeAt(index + 1) === 0x0a ? 2 : 1;
			start = index;
		} else {
			index += 1;
		}
	}

	// The trailing segment: either the last line of a text that does not end
	// with a terminator, or the empty remainder after one that does. Upstream
	// drops that remainder only for `\n` (`input.charCodeAt(len - 1) === 10`),
	// so a bare-`\r`-terminated text keeps a final blank line.
	if (start < text.length || !text.endsWith("\n")) {
		lines.push({ text: replaceNul(text.slice(start)), start });
	}

	return lines;
};

/** The spec's security substitution: U+0000 becomes U+FFFD, 1:1 by length. */
export const replaceNul = (line: string): string =>
	line.includes("\u0000") ? line.replaceAll("\u0000", "\uFFFD") : line;

const reNonSpace = /[^ \t\f\v\r\n]/;

/** True when `line` holds nothing but whitespace. */
export const isBlankLine = (line: string): boolean => !reNonSpace.test(line);

/** True for the two characters CommonMark treats as horizontal whitespace. */
export const isSpaceOrTab = (code: number): boolean => code === 0x20 || code === 0x09;

/** The char code at `position`, or `-1` past the end of `line`. */
export const peekCode = (line: string, position: number): number =>
	position >= 0 && position < line.length ? line.charCodeAt(position) : -1;

/**
 * Columns from `column` to the next tab stop — the width a `\t` expands to.
 *
 * `column` is the tab-expanded column the block pass tracks, not a character
 * index: a tab at column 2 is two columns wide, at column 4 it is four.
 */
export const columnsToNextTabStop = (column: number): number => TAB_STOP - (column % TAB_STOP);
