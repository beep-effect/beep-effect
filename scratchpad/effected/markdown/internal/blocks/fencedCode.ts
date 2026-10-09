// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The fenced-code block start. The construct both code spellings share lives
// in `code.ts`, which branches on the `isFenced` flag this start sets.

import type { FenceChar } from "../../MarkdownNode.ts";
import type { BlockStart } from "../blockTypes.ts";

const reCodeFence = /^`{3,}(?!.*`)|^~{3,}/;

// A successful fence match begins with one of these two characters.
const fenceCharOf = (char: string): FenceChar => (char === "`" ? "`" : "~");

/**
 * Opens a fenced code block with three or more backticks or tildes.
 *
 * **Example** (Identify the fenced code start)
 *
 * ```ts
 * import { fencedCodeStart } from "@beep/scratchpad/effected/markdown/internal/blocks/fencedCode";
 *
 * console.log(fencedCodeStart.name); // fencedCode
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const fencedCodeStart: BlockStart = {
	name: "fencedCode",
	trigger: (scanner) => {
		if (scanner.indented) {
			return 0;
		}

		const match = reCodeFence.exec(scanner.currentLine.slice(scanner.nextNonspace));
		if (match === null) {
			return 0;
		}

		const fenceChar = fenceCharOf(match[0].charAt(0));

		scanner.closeUnmatchedBlocks();
		const container = scanner.addChild("code", scanner.nextNonspace);
		container.data.isFenced = true;
		container.data.fenceLength = match[0].length;
		container.data.fenceChar = fenceChar;
		container.data.fenceOffset = scanner.indent;
		scanner.advanceNextNonspace();
		scanner.advanceOffset(match[0].length, false);
		return 2;
	},
};
