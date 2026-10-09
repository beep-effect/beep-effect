// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The indented-code block start. The construct both code spellings share
// lives in `code.ts`.

import type { BlockStart } from "../blockTypes.ts";
import { CODE_INDENT } from "../preprocess.ts";

/** The indented-code block start: four columns of indentation. */
export const indentedCodeStart: BlockStart = {
	name: "indentedCode",
	trigger: (scanner) => {
		if (!scanner.indented || scanner.tip.type === "paragraph" || scanner.blank) {
			return 0;
		}

		// The node spans from the line's current parse position — BEFORE the
		// four columns of code indentation are consumed. The indent is part of
		// the block's source extent (mdast-util starts indented code at the
		// line start, pinned by the interop corpus); only the value excludes
		// it.
		const start = scanner.offset;
		scanner.advanceOffset(CODE_INDENT, true);
		scanner.closeUnmatchedBlocks();
		scanner.addChild("code", start);
		return 2;
	},
};
