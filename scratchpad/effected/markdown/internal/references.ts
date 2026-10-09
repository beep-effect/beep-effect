// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The reference-parsing primitives from `lib/inlines.js`: the subject scanner
// (`match`/`peek`/`spnl`), `parseLinkLabel`, `parseLinkDestination`,
// `parseLinkTitle`, `normalizeReference` and `parseReference`.
//
// They live in their own leaf rather than inside the block construct that
// needs them first, because the inline pass (Tasks 8 and 9) parses inline
// links and images with exactly these functions — a link destination is the
// same grammar wherever it appears.
//
// Port notes, two changes from upstream:
//
// 1. `parseLinkDestination` returns the UNESCAPED, un-percent-encoded
//    destination. Upstream applies `normalizeURI` here so its renderer can
//    emit the value verbatim; mdast defines `url` as the decoded destination,
//    so the encoding moves to the renderer (the test writer does it, and any
//    consumer rendering HTML must too).
// 2. `parseReference` returns the parsed data instead of mutating a refmap
//    object. Definitions become nodes in this port, so the caller decides
//    what to do with the result, and the map is keyed through a real `Map`.

import { stickyOf } from "./patterns.ts";
import { unescapeString } from "./unescape.ts";
import * as O from "@beep/utils/Option";

const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";
const ESCAPED_CHAR = `\\\\${ESCAPABLE}`;

const reLinkTitle = new RegExp(
	`^(?:"(${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\"\\x00])*"` +
		`|'(${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\'\\x00])*'` +
		`|\\((${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\()\\x00])*\\))`,
);

// Upstream spells the control characters in these two classes as `\x00` and
// `\x0b\x0c\x0d`; the equivalent standard escapes are the same characters
// written the way the linter accepts.
const reLinkDestinationBraces = /^(?:<(?:[^<>\n\\\0]|\\.)*>)/;
const reEscapable = new RegExp(`^${ESCAPABLE}`);
const reSpnl = /^ *(?:\n *)?/;
const reSpaceAtEndOfLine = /^ *(?:\n|$)/;
const reLinkLabel = /^\[(?:[^\\[\]]|\\.){0,1000}\]/s;

/**
 * The whitespace set a link destination may not contain, as codes.
 *
 * The destination walk below tests every character it passes. Upstream spells
 * that test `reWhitespaceChar.exec(fromCodePoint(c))`, which allocates a
 * string and runs a regex per character — in a scan that is already O(n) per
 * attempt on an unterminated destination, that constant is the difference
 * between seconds and minutes.
 */
const isWhitespaceCode = (code: number): boolean =>
	code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0b || code === 0x0c || code === 0x0d;

/**
 * The most `(` a bare link destination may hold open at once.
 *
 * cmark's `MAX_LINK_DEST_PARENS` bound in `manual_scan_link_url`, and the
 * limit the spec explicitly sanctions ("Implementations may impose limits on
 * parentheses nesting to avoid performance issues, but at least three levels
 * of nesting should be supported"). Without it the bare-destination walk is
 * the engine's one quadratic: on `"[a](b".repeat(n)` there is no whitespace
 * and no unbalanced `)` to stop at, so every failed inline-link attempt
 * scanned to the end of the subject — O(n) per `]`, O(n^2) overall. With the
 * cap a failed attempt stops at the 33rd `(`, a constant distance, and the
 * pathological suite's "unclosed links B" runs linear. commonmark.js@0.31.2
 * has no such cap and shares the quadratic; the C reference is the authority
 * here.
 */
const MAX_LINK_DESTINATION_PARENS = 32;

const C_BACKSLASH = 0x5c;
const C_COLON = 0x3a;
const C_LESSTHAN = 0x3c;
const C_OPEN_PAREN = 0x28;
const C_CLOSE_PAREN = 0x29;

/**
 * A cursor over a subject string, with the handful of primitives upstream's
 * inline parser is built from.
 */
export class ReferenceScanner {
	pos = 0;

	readonly subject: string;
	constructor(subject: string) {
		this.subject = subject;
	}

	/** The char code at the cursor, or `-1` at the end of the subject. */
	peek(): number {
		return this.pos < this.subject.length ? this.subject.charCodeAt(this.pos) : -1;
	}

	/**
	 * Match `pattern` at the cursor, advancing past it on success.
	 *
	 * Sticky rather than upstream's slice-then-match: every pattern here is
	 * anchored, and slicing the subject per attempt is quadratic on a large
	 * one (`patterns.ts`).
	 */
	match(pattern: RegExp): string | undefined {
		const sticky = stickyOf(pattern);
		sticky.lastIndex = this.pos;
		const found = sticky.exec(this.subject);
		if (found === null) {
			return undefined;
		}
		this.pos = sticky.lastIndex;
		return found[0];
	}

	/** Consume optional spaces and up to one line ending. */
	spnl(): void {
		this.match(reSpnl);
	}

	/** The length of the link label at the cursor, or `0` if there is none. */
	parseLinkLabel(): number {
		const found = this.match(reLinkLabel);
		return found === undefined || found.length > 1001 ? 0 : found.length;
	}

	/**
	 * The link destination at the cursor, unescaped, or `undefined` if there
	 * is none. Never percent-encoded (see the port notes).
	 */
	parseLinkDestination(): string | undefined {
		const braced = this.match(reLinkDestinationBraces);
		if (braced !== undefined) {
			return unescapeString(braced.slice(1, -1));
		}

		if (this.peek() === C_LESSTHAN) {
			return undefined;
		}

		const start = this.pos;
		let openParens = 0;
		let code = this.peek();

		while (code !== -1) {
			if (code === C_BACKSLASH && reEscapable.test(this.subject.charAt(this.pos + 1))) {
				this.pos += 1;
				if (this.peek() !== -1) {
					this.pos += 1;
				}
			} else if (code === C_OPEN_PAREN) {
				this.pos += 1;
				openParens += 1;
				if (openParens > MAX_LINK_DESTINATION_PARENS) {
					return undefined;
				}
			} else if (code === C_CLOSE_PAREN) {
				if (openParens < 1) {
					break;
				}
				this.pos += 1;
				openParens -= 1;
			} else if (isWhitespaceCode(code)) {
				break;
			} else {
				this.pos += 1;
			}
			code = this.peek();
		}

		if (this.pos === start && code !== C_CLOSE_PAREN) {
			return undefined;
		}
		if (openParens !== 0) {
			return undefined;
		}

		return unescapeString(this.subject.slice(start, this.pos));
	}

	/** The link title at the cursor, quotes stripped and unescaped. */
	parseLinkTitle(): string | undefined {
		const title = this.match(reLinkTitle);
		return title === undefined ? undefined : unescapeString(title.slice(1, -1));
	}
}

/**
 * Case-fold a bare label: trim, collapse internal whitespace, fold case.
 *
 * The `toLowerCase().toUpperCase()` pair is upstream's Unicode case-folding
 * trick, not redundancy — it is what makes `ẞ` and `ß` the same label.
 *
 * Split out of {@link normalizeReference} because GFM footnote labels are the
 * same fold applied to a label that never carried brackets to strip: this is
 * cmark-gfm's `normalize_map_label`, which its footnote map and its link
 * refmap both call.
 */
export const normalizeLabelText = (label: string): string =>
	label
		.trim()
		.replace(/[ \t\r\n]+/g, " ")
		.toLowerCase()
		.toUpperCase();

/**
 * commonmark.js `normalizeReference`: strip the brackets, then case-fold what
 * is left.
 */
export const normalizeReference = (rawLabel: string): string =>
	normalizeLabelText(rawLabel.slice(1, rawLabel.length - 1));

/** A link reference definition, parsed but not yet placed in the tree. */
export interface ParsedReference {
	/** The case-folded lookup key (`normalizeReference` of the raw label). */
	readonly key: string;
	/** mdast's `identifier`: the normalized label, lowercased. */
	readonly identifier: string;
	/** mdast's `label`: the raw label text, brackets stripped. */
	readonly label: string;
	/** The decoded destination. */
	readonly url: string;
	/** The decoded title, absent when the definition carries none. */
	readonly title?: string;
	/** How many characters of `text` the definition consumed. */
	readonly length: number;
}

/**
 * Parse a link reference definition at the start of `text`.
 *
 * Returns `undefined` when `text` does not begin with one — which is not an
 * error: the text is simply paragraph content.
 */
export const parseReference = (text: string): ParsedReference | undefined => {
	const scanner = new ReferenceScanner(text);

	const labelLength = scanner.parseLinkLabel();
	if (labelLength === 0) {
		return undefined;
	}
	const rawLabel = text.slice(0, labelLength);

	if (scanner.peek() !== C_COLON) {
		return undefined;
	}
	scanner.pos += 1;

	scanner.spnl();
	const url = scanner.parseLinkDestination();
	if (url === undefined) {
		return undefined;
	}

	const beforeTitle = scanner.pos;
	scanner.spnl();
	let title = scanner.pos === beforeTitle ? undefined : scanner.parseLinkTitle();
	if (title === undefined) {
		scanner.pos = beforeTitle;
	}

	// The definition must end the line. A title that does not is discarded and
	// the destination alone is retried — that is still a legal definition.
	let atLineEnd = true;
	if (scanner.match(reSpaceAtEndOfLine) === undefined) {
		if (title === undefined) {
			atLineEnd = false;
		} else {
			title = undefined;
			scanner.pos = beforeTitle;
			atLineEnd = scanner.match(reSpaceAtEndOfLine) !== undefined;
		}
	}
	if (!atLineEnd) {
		return undefined;
	}

	const key = normalizeReference(rawLabel);
	if (key === "") {
		// A label must hold at least one non-whitespace character.
		return undefined;
	}

	return {
		key,
		identifier: key.toLowerCase(),
		label: rawLabel.slice(1, -1),
		url,
		...O.getSomesStruct({ title: O.fromUndefinedOr(title) }),
		length: scanner.pos,
	};
};
