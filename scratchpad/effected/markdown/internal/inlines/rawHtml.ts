// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseHtmlTag`: raw inline HTML, kept verbatim.
//
// Port note: upstream has two node types, `html_inline` and `html_block`.
// mdast has one `html` node for both, which is what this emits — a renderer
// tells them apart by where the node sits, as the test writer does.

import { reHtmlTag } from "../htmlTags.ts";
import { makeInlineNode } from "../inlineNode.ts";
import type { InlineConstruct } from "../inlineTypes.ts";

const C_LESSTHAN = 0x3c;

/** The raw-HTML forms that scan forward for a fixed closing sequence. */
const UNTERMINATED_FORMS: ReadonlyArray<readonly [opener: string, closer: string]> = [
	["<!--", "-->"],
	["<?", "?>"],
	["<![CDATA[", "]]>"],
	["<!", ">"],
];

/**
 * Recognizes a raw HTML tag, comment, processing instruction, declaration or CDATA.
 *
 * **Details**
 *
 * Matched HTML is kept verbatim in an `html` node.
 *
 * **Gotchas**
 *
 * A comment, processing instruction, declaration or CDATA opener without its
 * closing sequence does not match.
 *
 * **Example** (Inspect the raw HTML trigger)
 *
 * ```ts
 * import { rawHtmlConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/rawHtml"
 *
 * console.log(rawHtmlConstruct.triggers[0]) // 60
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const rawHtmlConstruct: InlineConstruct = {
	name: "rawHtml",
	triggers: [C_LESSTHAN],
	parse: (scanner) => {
		const from = scanner.pos;

		// The comment, instruction, CDATA and declaration forms all end in a fixed sequence
		// that their pattern scans forward for. When the document holds no such
		// sequence at all, that scan runs to the end of input for EVERY opener —
		// 300k unclosed `<!--` is one of the vendored pathological cases. Asking
		// first is memoized and constant-time after the first miss.
		for (const [opener, closer] of UNTERMINATED_FORMS) {
			if (scanner.subject.startsWith(opener, from) && !scanner.hasAhead(closer)) {
				return false;
			}
		}

		const matched = scanner.match(reHtmlTag);
		if (matched === undefined) {
			return false;
		}
		scanner.append(makeInlineNode("html", from, scanner.pos, matched));
		return true;
	},
};
