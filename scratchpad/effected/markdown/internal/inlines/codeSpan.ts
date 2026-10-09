// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseBackticks`: a run of backticks opens a code span that the next run of
// exactly the same length closes. Line endings inside become spaces, and one
// space of padding on each side is stripped when the content is not all
// spaces.

import { makeInlineNode } from "../inlineNode.ts";
import type { InlineConstruct } from "../inlineTypes.ts";

const C_BACKTICK = 0x60;

const reTicksHere = /^`+/;
const reNewline = /\n/gm;
const reNonSpace = /[^ ]/;

/**
 * Parses a code span enclosed by backtick runs of equal length.
 *
 * **Details**
 *
 * **Example** (Register the backtick trigger)
 *
 * ```ts
 * import { codeSpanConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/codeSpan"
 *
 * console.log(codeSpanConstruct.triggers.map((code) => String.fromCharCode(code)).join("")) // `
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const codeSpanConstruct: InlineConstruct = {
	name: "codeSpan",
	triggers: [C_BACKTICK],
	parse: (scanner) => {
		const from = scanner.pos;
		const ticks = scanner.match(reTicksHere);
		if (ticks === undefined) {
			return false;
		}

		const afterOpenTicks = scanner.pos;

		// Upstream walks run by run until it meets one of equal length, which
		// is quadratic on a document of many distinct-length runs (the vendored
		// "backticks" case). The run index answers the same question directly.
		const closing = scanner.closingBacktickRun(afterOpenTicks, ticks.length);
		if (closing !== undefined) {
			const contents = scanner.subject.slice(afterOpenTicks, closing).replace(reNewline, " ");
			const stripped =
				contents.length > 0 && reNonSpace.test(contents) && contents.startsWith(" ") && contents.endsWith(" ")
					? contents.slice(1, -1)
					: contents;

			scanner.pos = closing + ticks.length;
			scanner.append(makeInlineNode("inlineCode", from, scanner.pos, stripped));
			return true;
		}

		// No closing run of the same length: the opening ticks are literal.
		scanner.pos = afterOpenTicks;
		scanner.appendText(ticks, from, scanner.pos);
		return true;
	},
};
