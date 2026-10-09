// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `blocks.block_quote` and its block start. The `>` marker consumes one
// optional following space or tab, which is where a partially consumed tab
// first becomes reachable (`addLine` pads the remainder back out).

import { Blockquote } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockStart } from "../blockTypes.ts";
import { flowChildren } from "../blockTypes.ts";
import { isSpaceOrTab, peekCode } from "../preprocess.ts";

const C_GREATERTHAN = 0x3e;

/**
 * Materializes a blockquote that continues while each line carries its `>` marker.
 *
 * **Example** (Inspect blockquote containment)
 *
 * ```ts
 * import { blockquoteConstruct } from "@beep/scratchpad/effected/markdown/internal/blocks/blockquote";
 *
 * console.log(blockquoteConstruct.canContain("paragraph")); // true
 * console.log(blockquoteConstruct.canContain("listItem")); // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const blockquoteConstruct: BlockConstruct = {
	type: "blockquote",
	acceptsLines: false,
	canContain: (child) => child !== "listItem",
	continue: (scanner) => {
		const line = scanner.currentLine;
		if (scanner.indented || peekCode(line, scanner.nextNonspace) !== C_GREATERTHAN) {
			return 1;
		}
		scanner.advanceNextNonspace();
		scanner.advanceOffset(1, false);
		if (isSpaceOrTab(peekCode(line, scanner.offset))) {
			scanner.advanceOffset(1, true);
		}
		return 0;
	},
	materialize: (block, children, context) =>
		Blockquote.make({
			children: flowChildren(children),
			position: context.position(block.startOffset, block.endOffset),
		}),
};

/**
 * Opens a blockquote at an unindented `>` marker.
 *
 * **Example** (Identify the blockquote start)
 *
 * ```ts
 * import { blockquoteStart } from "@beep/scratchpad/effected/markdown/internal/blocks/blockquote";
 *
 * console.log(blockquoteStart.name); // blockquote
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const blockquoteStart: BlockStart = {
	name: "blockquote",
	trigger: (scanner) => {
		if (scanner.indented || peekCode(scanner.currentLine, scanner.nextNonspace) !== C_GREATERTHAN) {
			return 0;
		}

		scanner.advanceNextNonspace();
		scanner.advanceOffset(1, false);
		if (isSpaceOrTab(peekCode(scanner.currentLine, scanner.offset))) {
			scanner.advanceOffset(1, true);
		}
		scanner.closeUnmatchedBlocks();
		scanner.addChild("blockquote", scanner.nextNonspace);
		return 1;
	},
};
