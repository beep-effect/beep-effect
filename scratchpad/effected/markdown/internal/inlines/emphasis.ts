// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `scanDelims` and `handleDelim`: the opening half of the emphasis algorithm.
// The closing half — `processEmphasis`, which walks the delimiter stack and
// builds the nodes — lives on the parser (`inlineParser.ts`), because a link
// closing runs it too, over its own span of the stack.
//
// Upstream's smart-punctuation arms (`'` and `"` becoming curly quotes) are
// deliberately not ported: the `smart` option is not offered, so those
// two characters never reach the delimiter stack at all.

import type { EmphasisChar } from "../../MarkdownNode.ts";
import type { InlineConstruct, InlineScanner } from "../inlineTypes.ts";

const C_ASTERISK = 0x2a;
const C_UNDERSCORE = 0x5f;

// The spec's punctuation class: ASCII punctuation plus the Unicode P and S
// categories.
const rePunctuation = /^[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\p{P}\p{S}]/u;
const reUnicodeWhitespaceChar = /^\s/;

/**
 * What a run of delimiters at the cursor can do.
 *
 * Exported because GFM strikethrough reuses this measurement verbatim:
 * cmark-gfm's `strikethrough.c` calls the same `scan_delimiters` the emphasis
 * algorithm does and reads the same two flanking flags out of it.
 */
export interface DelimiterRun {
	readonly numdelims: number;
	readonly canOpen: boolean;
	readonly canClose: boolean;
}

/**
 * Measure the delimiter run at the cursor and decide whether it can open or
 * close emphasis, per the spec's left- and right-flanking rules. Leaves the
 * cursor where it found it.
 *
 * The `_` arm is the only character-specific rule here, so `~` (which follows
 * `*`'s rules) reuses this as it stands.
 */
export const scanDelims = (scanner: InlineScanner, cc: number): DelimiterRun | undefined => {
	const startpos = scanner.pos;
	let numdelims = 0;

	while (scanner.peek() === cc) {
		numdelims += 1;
		scanner.pos += 1;
	}

	if (numdelims === 0) {
		scanner.pos = startpos;
		return undefined;
	}

	const charBefore = startpos === 0 ? "\n" : scanner.subject.charAt(startpos - 1);
	const ccAfter = scanner.peek();
	const charAfter = ccAfter === -1 ? "\n" : String.fromCodePoint(ccAfter);

	const afterIsWhitespace = reUnicodeWhitespaceChar.test(charAfter);
	const afterIsPunctuation = rePunctuation.test(charAfter);
	const beforeIsWhitespace = reUnicodeWhitespaceChar.test(charBefore);
	const beforeIsPunctuation = rePunctuation.test(charBefore);

	const leftFlanking = !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation);
	const rightFlanking = !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation);

	// `_` is stricter than `*`: intraword emphasis is not allowed.
	const canOpen = cc === C_UNDERSCORE ? leftFlanking && (!rightFlanking || beforeIsPunctuation) : leftFlanking;
	const canClose = cc === C_UNDERSCORE ? rightFlanking && (!leftFlanking || afterIsPunctuation) : rightFlanking;

	scanner.pos = startpos;
	return { numdelims, canOpen, canClose };
};

const markerCharOf = (cc: number): EmphasisChar => (cc === C_UNDERSCORE ? "_" : "*");

/**
 * Consume a delimiter run as literal text and, when it could open or close
 * emphasis, push it onto the delimiter stack for `processEmphasis` to pair up.
 */
const handleDelim = (scanner: InlineScanner, cc: number): boolean => {
	const res = scanDelims(scanner, cc);
	if (res === undefined) {
		return false;
	}

	const startpos = scanner.pos;
	scanner.pos += res.numdelims;
	const node = scanner.appendText(scanner.subject.slice(startpos, scanner.pos), startpos, scanner.pos);
	node.data.markerChar = markerCharOf(cc);

	if (res.canOpen || res.canClose) {
		const delimiter = {
			cc,
			numdelims: res.numdelims,
			origdelims: res.numdelims,
			node,
			previous: scanner.delimiters,
			next: undefined,
			canOpen: res.canOpen,
			canClose: res.canClose,
		};
		if (delimiter.previous !== undefined) {
			delimiter.previous.next = delimiter;
		}
		scanner.delimiters = delimiter;
	}

	return true;
};

/** Emphasis and strong emphasis: `*` and `_` runs. */
export const emphasisConstruct: InlineConstruct = {
	name: "emphasis",
	triggers: [C_ASTERISK, C_UNDERSCORE],
	parse: (scanner) => handleDelim(scanner, scanner.peek()),
};
