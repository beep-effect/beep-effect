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

import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { EmphasisChar } from "../../MarkdownNode.ts";
import type { InlineConstruct, InlineScanner } from "../inlineTypes.ts";

const $I = $ScratchpadId.create("effected/markdown/internal/inlines/emphasis");

const C_ASTERISK = 0x2a;
const C_UNDERSCORE = 0x5f;

// The spec's punctuation class: ASCII punctuation plus the Unicode P and S
// categories.
const rePunctuation = /^[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\p{P}\p{S}]/u;
const reUnicodeWhitespaceChar = /^\s/;

/**
 * What a run of delimiters at the cursor can do.
 *
 * **Details**
 *
 * Exported because GFM strikethrough reuses this measurement verbatim:
 * cmark-gfm's `strikethrough.c` calls the same `scan_delimiters` the emphasis
 * algorithm does and reads the same two flanking flags out of it.
 *
 * **Example** (Build an opening delimiter run)
 *
 * ```ts
 * import { DelimiterRun } from "@beep/scratchpad/effected/markdown/internal/inlines/emphasis"
 *
 * const run = DelimiterRun.make({ numdelims: 2, canOpen: true, canClose: false })
 * console.log(run.numdelims, run.canOpen, run.canClose) // 2 true false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DelimiterRun = S.Struct({
	numdelims: S.Finite.annotateKey({ description: "Length of the delimiter run in UTF-16 code units." }),
	canOpen: S.Boolean.annotateKey({ description: "Whether the run satisfies the opening flanking rule." }),
	canClose: S.Boolean.annotateKey({ description: "Whether the run satisfies the closing flanking rule." }),
}).annotate($I.annote("DelimiterRun", {
	description: "The length and flanking capabilities shared by emphasis and strikethrough.",
}));

/**
 * The payload measured by {@link DelimiterRun}.
 *
 * **Details**
 *
 * @category type-level
 * @since 0.0.0
 */
export type DelimiterRun = typeof DelimiterRun.Type;

/**
 * Measure the delimiter run at the cursor and decide whether it can open or
 * close emphasis, per the spec's left- and right-flanking rules. Leaves the
 * cursor where it found it.
 *
 * **Details**
 *
 * The `_` arm is the only character-specific rule here, so `~` (which follows
 * `*`'s rules) reuses this as it stands.
 *
 * **Example** (Prepare an asterisk run scanner)
 *
 * ```ts
 * import { scanDelims } from "@beep/scratchpad/effected/markdown/internal/inlines/emphasis"
 *
 * const scanAsterisks = scanDelims(42)
 * console.log(typeof scanAsterisks) // function
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanDelims: {
	(scanner: InlineScanner, cc: number): O.Option<DelimiterRun>;
	(cc: number): (scanner: InlineScanner) => O.Option<DelimiterRun>;
} = dual(2, (scanner: InlineScanner, cc: number): O.Option<DelimiterRun> => {
	const startpos = scanner.pos;
	let numdelims = 0;

	while (scanner.peek() === cc) {
		numdelims += 1;
		scanner.pos += 1;
	}

	if (numdelims === 0) {
		scanner.pos = startpos;
		return O.none();
	}

	// The scanner counts UTF-16 units; flanking classifies Unicode code points.
	let beforeStart = startpos - 1;
	const beforeUnit = O.getOrElse(Str.charCodeAt(scanner.subject, beforeStart), () => -1);
	if (beforeUnit >= 0xdc00 && beforeUnit <= 0xdfff && beforeStart > 0) {
		const precedingUnit = O.getOrThrow(Str.charCodeAt(scanner.subject, beforeStart - 1));
		if (precedingUnit >= 0xd800 && precedingUnit <= 0xdbff) {
			beforeStart -= 1;
		}
	}
	const charBefore = startpos === 0 ? "\n" : Str.slice(beforeStart, startpos)(scanner.subject);
	const ccAfter = O.getOrElse(Str.codePointAt(scanner.subject, scanner.pos), () => -1);
	const charAfter = ccAfter === -1 ? "\n" : Str.slice(scanner.pos, scanner.pos + (ccAfter > 0xffff ? 2 : 1))(scanner.subject);

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
	return O.some(DelimiterRun.make({ numdelims, canOpen, canClose }));
});

const markerCharOf = (cc: number): EmphasisChar => (cc === C_UNDERSCORE ? "_" : "*");

/**
 * Consume a delimiter run as literal text and, when it could open or close
 * emphasis, push it onto the delimiter stack for `processEmphasis` to pair up.
 */
const handleDelim = (scanner: InlineScanner, cc: number): boolean => {
	// The construct passes the current peek code, so at least one delimiter matches.
	const run = O.getOrThrow(scanDelims(scanner, cc));
	const startpos = scanner.pos;
	scanner.pos += run.numdelims;
	const node = scanner.appendText(scanner.subject.slice(startpos, scanner.pos), startpos, scanner.pos);
	node.data.markerChar = markerCharOf(cc);

	if (run.canOpen || run.canClose) {
		const delimiter = {
			cc,
			numdelims: run.numdelims,
			origdelims: run.numdelims,
			node,
			previous: scanner.delimiters,
			next: undefined,
			canOpen: run.canOpen,
			canClose: run.canClose,
		};
		if (delimiter.previous !== undefined) {
			delimiter.previous.next = delimiter;
		}
		scanner.delimiters = delimiter;
	}

	return true;
};

/**
 * Consumes `*` and `_` runs for emphasis and strong emphasis pairing.
 *
 * **Details**
 *
 * **Example** (Register both emphasis markers)
 *
 * ```ts
 * import { emphasisConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/emphasis"
 *
 * console.log(emphasisConstruct.triggers.map((code) => String.fromCharCode(code)).join("")) // *_
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const emphasisConstruct: InlineConstruct = {
	name: "emphasis",
	triggers: [C_ASTERISK, C_UNDERSCORE],
	parse: (scanner) => handleDelim(scanner, scanner.peek()),
};
