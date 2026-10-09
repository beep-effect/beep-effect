// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: this module owns the shared `heading` construct as well as the
// ATX block start, because upstream's `blocks.heading` entry serves both
// spellings. The setext start (`setextHeading.ts`) promotes a paragraph into
// a `heading` block and sets `data.headingStyle` to "setext"; materialization
// reads that field, so both spellings land on the same construct.
//
// The offset delta: upstream records only a start column for the heading and
// lets the inline pass inherit it. Here the content run is pushed onto the
// block's segment table with its absolute source offset, so the inline pass
// can place real offsets inside the heading.

import type { HeadingDepth } from "../../MarkdownNode.ts";
import { Heading } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockStart } from "../blockTypes.ts";

const reATXHeadingMarker = /^#{1,6}(?:[ \t]+|$)/;
const reOnlyTrailingHashes = /^[ \t]*#+[ \t]*$/;
const reClosingHashes = /[ \t]+#+[ \t]*$/;

/** Narrow a `#`-run length to the schema's depth literal; the regex caps it at 6. */
const headingDepth = (hashes: number): HeadingDepth => (hashes < 1 ? 1 : hashes > 6 ? 6 : (hashes as HeadingDepth));

/** Heading: never spans more than one line, and contains no blocks. */
export const headingConstruct: BlockConstruct = {
	type: "heading",
	acceptsLines: false,
	canContain: () => false,
	// A heading can never contain more than one line, so it never continues.
	continue: () => 1,
	materialize: (block, _children, context) => {
		const inline = context.inlineSlice(block);
		const style = block.data.headingStyle ?? "atx";
		const node = Heading.make({
			depth: block.data.level ?? 1,
			children: inline.children,
			position: context.position(block.startOffset, block.endOffset),
			headingStyle: style,
		});
		context.registerInline(node, inline);
		return node;
	},
};

/** The ATX heading block start: `#` through `######`, optionally closed. */
export const atxHeadingStart: BlockStart = {
	name: "atxHeading",
	trigger: (scanner) => {
		if (scanner.indented) {
			return 0;
		}

		const match = reATXHeadingMarker.exec(scanner.currentLine.slice(scanner.nextNonspace));
		if (match === null) {
			return 0;
		}

		scanner.advanceNextNonspace();
		scanner.advanceOffset(match[0].length, false);
		scanner.closeUnmatchedBlocks();

		const container = scanner.addChild("heading", scanner.nextNonspace);
		container.data.level = headingDepth(match[0].trim().length);
		container.data.headingStyle = "atx";

		// Both replacements strip a suffix, so the surviving content is still a
		// prefix of the line remainder — which is what makes the single segment
		// below exact.
		const content = scanner.currentLine
			.slice(scanner.offset)
			.replace(reOnlyTrailingHashes, "")
			.replace(reClosingHashes, "");
		container.stringContent = content;
		container.segments.push({
			textOffset: 0,
			sourceOffset: scanner.lineStart + scanner.offset,
			length: content.length,
		});

		scanner.advanceOffset(scanner.currentLine.length - scanner.offset, false);
		return 2;
	},
};
