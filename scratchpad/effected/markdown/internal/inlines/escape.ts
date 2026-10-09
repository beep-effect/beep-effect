// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseBackslash`: a backslash escapes the punctuation that follows it, ends
// the line as a hard break, or stands for itself.

import { makeInlineNode } from "../inlineNode.ts";
import type { InlineConstruct } from "../inlineTypes.ts";
import { ESCAPABLE } from "../unescape.ts";

const C_BACKSLASH = 0x5c;
const C_NEWLINE = 0x0a;

const reEscapable = new RegExp(`^${ESCAPABLE}`);

/**
 * Parses a backslash escape, or a backslash hard line break.
 *
 * **Details**
 *
 * **Example** (Register the backslash trigger)
 *
 * ```ts
 * import { escapeConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/escape"
 *
 * console.log(escapeConstruct.triggers.includes(92)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const escapeConstruct: InlineConstruct = {
	name: "escape",
	triggers: [C_BACKSLASH],
	parse: (scanner) => {
		const from = scanner.pos;
		scanner.pos += 1;

		if (scanner.peek() === C_NEWLINE) {
			scanner.pos += 1;
			const node = makeInlineNode("break", from, scanner.pos);
			node.data.breakStyle = "backslash";
			scanner.append(node);
			return true;
		}

		const escaped = scanner.subject.charAt(scanner.pos);
		if (reEscapable.test(escaped)) {
			scanner.pos += 1;
			scanner.appendText(escaped, from, scanner.pos);
			return true;
		}

		// A backslash before anything else is a literal backslash.
		scanner.appendText("\\", from, scanner.pos);
		return true;
	},
};
