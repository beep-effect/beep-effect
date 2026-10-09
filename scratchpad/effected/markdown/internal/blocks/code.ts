// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `blocks.code_block`: the construct both code-block spellings share, exactly
// as upstream shares one table entry between them. The two block starts live
// in `indentedCode.ts` and `fencedCode.ts`; which one opened the block is
// recorded as `data.isFenced`, and every method below branches on it.
//
// The absence of `fenceChar`/`fenceLength` on the materialized node is what
// tells an indented block from a fenced one on the way back out, so the
// indented branch must never set them (the `Code` schema contract).

import { Code } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockNode } from "../blockTypes.ts";
import { CODE_INDENT, isSpaceOrTab, peekCode } from "../preprocess.ts";
import { unescapeString } from "../unescape.ts";

const reBlankLine = /^[ \t]*$/;
const reClosingCodeFence = /^(?:`{3,}|~{3,})(?=[ \t]*$)/;

/**
 * Drop the trailing blank lines an indented code block accumulates, and pull
 * the block's end back to the last line that survived.
 */
const finalizeIndented = (block: BlockNode): void => {
	const lines = block.stringContent.split("\n");
	while (lines.length > 0 && reBlankLine.test(lines[lines.length - 1] ?? "")) {
		lines.pop();
	}

	block.stringContent = lines.length === 0 ? "" : `${lines.join("\n")}\n`;

	const lastSegment = block.segments[lines.length - 1];
	if (lastSegment !== undefined) {
		block.endOffset = lastSegment.sourceOffset + lastSegment.length;
		block.endLine = block.startLine + lines.length - 1;
	}
};

/**
 * Split a fenced block's first line off as the info string, and the rest as
 * the literal content.
 *
 * mdast splits the info string into `lang` (the first word) and `meta` (the
 * rest); upstream keeps it whole as `info`. Each half is unescaped
 * separately, so a backslash-escaped space inside the language word does not
 * become a split point.
 */
const finalizeFenced = (block: BlockNode): void => {
	const content = block.stringContent;
	const newlineAt = content.indexOf("\n");
	const firstLine = (newlineAt === -1 ? content : content.slice(0, newlineAt)).trim();
	block.stringContent = newlineAt === -1 ? "" : content.slice(newlineAt + 1);

	if (firstLine.length === 0) {
		return;
	}

	const wordEnd = firstLine.search(/[ \t]/);
	if (wordEnd === -1) {
		block.data.lang = unescapeString(firstLine);
		return;
	}

	block.data.lang = unescapeString(firstLine.slice(0, wordEnd));
	const meta = firstLine.slice(wordEnd).trim();
	if (meta.length > 0) {
		block.data.meta = unescapeString(meta);
	}
};

/** Code: absorbs lines verbatim, contains nothing. */
export const codeConstruct: BlockConstruct = {
	type: "code",
	acceptsLines: true,
	canContain: () => false,
	continue: (scanner, block) => {
		if (block.data.isFenced === true) {
			const line = scanner.currentLine;
			const closing =
				scanner.indent <= 3 && line.charAt(scanner.nextNonspace) === block.data.fenceChar
					? reClosingCodeFence.exec(line.slice(scanner.nextNonspace))
					: null;

			if (closing !== null && closing[0].length >= (block.data.fenceLength ?? 3)) {
				// A closing fence ends the block and the line together.
				scanner.setLastLineLength(scanner.offset + scanner.indent + closing[0].length);
				scanner.finalizeBlock(block, scanner.lineNumber);
				return 2;
			}

			// Otherwise skip up to as many leading spaces as the opening fence
			// was indented by.
			let remaining = block.data.fenceOffset ?? 0;
			while (remaining > 0 && isSpaceOrTab(peekCode(line, scanner.offset))) {
				scanner.advanceOffset(1, true);
				remaining -= 1;
			}
			return 0;
		}

		if (scanner.indent >= CODE_INDENT) {
			scanner.advanceOffset(CODE_INDENT, true);
		} else if (scanner.blank) {
			scanner.advanceNextNonspace();
		} else {
			return 1;
		}
		return 0;
	},
	finalize: (_scanner, block) => {
		if (block.data.isFenced === true) {
			finalizeFenced(block);
		} else {
			finalizeIndented(block);
		}
	},
	materialize: (block, _children, context) => {
		const { isFenced, fenceChar, fenceLength, lang, meta } = block.data;
		return Code.make({
			value: block.stringContent,
			position: context.position(block.startOffset, block.endOffset),
			...(lang === undefined ? {} : { lang }),
			...(meta === undefined ? {} : { meta }),
			...(isFenced === true && fenceChar !== undefined ? { fenceChar } : {}),
			...(isFenced === true && fenceLength !== undefined ? { fenceLength } : {}),
		});
	},
};
