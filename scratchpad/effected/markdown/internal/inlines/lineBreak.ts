// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseNewline`: a line ending inside a leaf block.
//
// Port note: upstream emits a `softbreak` NODE. mdast has none — a soft line
// break is a literal `\n` inside a text value — so the soft case appends `\n`
// to the run instead, which merges into the preceding text. Two or more
// trailing spaces still make a hard break, as a `break` node with
// `breakStyle: "spaces"`; the trailing spaces are stripped either way, which
// is upstream's behavior for a single trailing space too.

import { makeInlineNode } from "../inlineNode.ts";
import type { InlineConstruct } from "../inlineTypes.ts";

const C_NEWLINE = 0x0a;

const reInitialSpace = /^ */;

/** A soft or hard line break. */
export const lineBreakConstruct: InlineConstruct = {
	name: "lineBreak",
	triggers: [C_NEWLINE],
	parse: (scanner) => {
		const from = scanner.pos;
		scanner.pos += 1;

		const trailingSpaces = scanner.trimTrailingSpaces();
		if (trailingSpaces >= 2) {
			const node = makeInlineNode("break", from - trailingSpaces, scanner.pos);
			node.data.breakStyle = "spaces";
			scanner.append(node);
		} else {
			// A soft break is the newline itself, kept as text.
			scanner.appendText("\n", from, scanner.pos);
		}

		// Leading whitespace on the next line is not content.
		scanner.match(reInitialSpace);
		return true;
	},
};
