// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `blocks.html_block`, the seven open conditions from `reHtmlBlockOpen` and
// the five close conditions from `reHtmlBlockClose`. Types 6 and 7 end at a
// blank line; types 1 through 5 end at their own closing pattern, which the
// line loop checks after appending each line (`isHtmlBlockEnd`).
//
// The tag grammar lives in `htmlTags.ts`, shared with the inline pass, which
// matches the full `HTMLTAG` union this file's type 7 is a subset of.

import { dual } from "effect/Function";
import { Html } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockNode, BlockStart } from "../blockTypes.ts";
import { CLOSETAG, OPENTAG } from "../htmlTags.ts";
import { peekCode } from "../preprocess.ts";

const C_LESSTHAN = 0x3c;

// Index 0 is a placeholder so the array is indexed by the spec's 1-based
// block type, exactly as upstream's is.
const reHtmlBlockOpen: ReadonlyArray<RegExp> = [
	/./,
	/^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
	/^<!--/,
	/^<[?]/,
	/^<![A-Za-z]/,
	/^<!\[CDATA\[/,
	/^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|search|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
	new RegExp(`^(?:${OPENTAG}|${CLOSETAG})\\s*$`, "i"),
];

const reHtmlBlockClose: ReadonlyArray<RegExp> = [/./, /<\/(?:script|pre|textarea|style)>/i, /-->/, /\?>/, />/, /\]\]>/];

/**
 * Whether `rest` closes `block` — only types 1 through 5 have a closing
 * pattern, and the line loop calls this after the line has been appended.
 */
export const isHtmlBlockEnd: {
	(block: BlockNode, rest: string): boolean;
	(rest: string): (block: BlockNode) => boolean;
} = dual(2, (block: BlockNode, rest: string): boolean => {
	const type = block.data.htmlBlockType;
	if (type === undefined || type < 1 || type > 5) {
		return false;
	}
	return reHtmlBlockClose[type]?.test(rest) ?? false;
});

/** HTML block: absorbs lines verbatim, contains nothing. */
export const htmlBlockConstruct: BlockConstruct = {
	type: "html",
	acceptsLines: true,
	canContain: () => false,
	continue: (scanner, block) => {
		const type = block.data.htmlBlockType;
		// Types 6 and 7 have no closing pattern: a blank line ends them.
		return scanner.blank && (type === 6 || type === 7) ? 1 : 0;
	},
	finalize: (_scanner, block) => {
		block.stringContent = block.stringContent.replace(/\n$/, "");
	},
	materialize: (block, _children, context) =>
		Html.make({
			value: block.stringContent,
			position: context.position(block.startOffset, block.endOffset),
		}),
};

/** The HTML block start: one of seven open conditions after an unindented `<`. */
export const htmlBlockStart: BlockStart = {
	name: "htmlBlock",
	trigger: (scanner, container) => {
		if (scanner.indented || peekCode(scanner.currentLine, scanner.nextNonspace) !== C_LESSTHAN) {
			return 0;
		}

		const rest = scanner.currentLine.slice(scanner.nextNonspace);
		for (let blockType = 1; blockType <= 7; blockType += 1) {
			const opens = reHtmlBlockOpen[blockType]?.test(rest) ?? false;
			// Type 7 may not interrupt a paragraph, nor be opened by a line
			// that is about to become a lazy continuation of one.
			const mayOpen =
				blockType < 7 ||
				(container.type !== "paragraph" && !(!scanner.allClosed && !scanner.blank && scanner.tip.type === "paragraph"));

			if (opens && mayOpen) {
				scanner.closeUnmatchedBlocks();
				// The scan position is deliberately not advanced: leading
				// spaces are part of the HTML block's content.
				const block = scanner.addChild("html", scanner.offset);
				block.data.htmlBlockType = blockType;
				return 2;
			}
		}

		return 0;
	},
};
