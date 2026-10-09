// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: `markerChar` is a fidelity extra with no upstream counterpart —
// upstream renders `<hr />` and forgets which character drew it.

import type { ThematicBreakChar } from "../../MarkdownNode.ts";
import { ThematicBreak } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockStart } from "../blockTypes.ts";
import * as O from "@beep/utils/Option";

const reThematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/;

const markerCharOf = (char: string): ThematicBreakChar | undefined =>
	char === "-" || char === "_" || char === "*" ? char : undefined;

/** Thematic break: one line, no children. */
export const thematicBreakConstruct: BlockConstruct = {
	type: "thematicBreak",
	acceptsLines: false,
	canContain: () => false,
	// A thematic break can never contain more than one line.
	continue: () => 1,
	materialize: (block, _children, context) => {
		const marker = block.data.markerChar;
		return ThematicBreak.make({
			position: context.position(block.startOffset, block.endOffset),
			// Conditional spread: an absent optionalKey must be genuinely
			// absent, never an explicit `undefined` — passing one throws at
			// construction.
			...O.getSomesStruct({ markerChar: O.fromUndefinedOr(marker) }),
		});
	},
};

/** The thematic-break block start: three or more `-`, `_` or `*`. */
export const thematicBreakStart: BlockStart = {
	name: "thematicBreak",
	trigger: (scanner) => {
		if (scanner.indented || !reThematicBreak.test(scanner.currentLine.slice(scanner.nextNonspace))) {
			return 0;
		}

		scanner.closeUnmatchedBlocks();
		const container = scanner.addChild("thematicBreak", scanner.nextNonspace);
		const marker = markerCharOf(scanner.currentLine.charAt(scanner.nextNonspace));
		if (marker !== undefined) {
			container.data.markerChar = marker;
		}
		scanner.advanceOffset(scanner.currentLine.length - scanner.offset, false);
		return 2;
	},
};
