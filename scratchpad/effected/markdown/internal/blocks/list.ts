// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `blocks.list`, `blocks.item`, `parseListMarker`, `listsMatch`,
// `endsWithBlankLine` and the list-item block start. Upstream calls the item
// construct `item`; this port calls it `listItem`, which is the mdast name.
//
// Port notes:
//
// 1. Tightness. Upstream computes one `tight` flag per list and renders
//    accordingly. mdast wants `spread` on the list AND on each item, so the
//    finalize pass records both: the list's `spread` is the negation of
//    upstream's `tight`, and an item's `spread` is set by the same
//    blank-line rule applied to that item's own children.
// 2. The empty-item end position. Upstream sets the end COLUMN to
//    `markerOffset + padding`; the offset form of that is the item's start
//    plus its padding, which is what the fallback below uses.

import type { BulletChar, ListDelimiter } from "../../MarkdownNode.ts";
import { List, ListItem } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockNode, BlockScanner, BlockStart, ListData } from "../blockTypes.ts";
import { flowChildren, listItemChildren } from "../blockTypes.ts";
import { isSpaceOrTab, peekCode } from "../preprocess.ts";

const reBulletListMarker = /^[*+-]/;
const reOrderedListMarker = /^(\d{1,9})([.)])/;
const reNonSpace = /[^ \t\f\v\r\n]/;

const bulletCharOf = (char: string): BulletChar | undefined =>
	char === "-" || char === "*" || char === "+" ? char : undefined;

const delimiterOf = (char: string): ListDelimiter | undefined => (char === "." || char === ")" ? char : undefined);

/**
 * Parse a list marker at the scanner's next non-whitespace position,
 * advancing past it on success.
 */
const parseListMarker = (scanner: BlockScanner, container: BlockNode): ListData | undefined => {
	if (scanner.indent >= 4) {
		return undefined;
	}

	const rest = scanner.currentLine.slice(scanner.nextNonspace);
	const markerOffset = scanner.indent;

	let data: ListData;
	let markerLength: number;

	const bullet = reBulletListMarker.exec(rest);
	const ordered = bullet === null ? reOrderedListMarker.exec(rest) : null;

	if (bullet !== null) {
		const bulletChar = bulletCharOf(bullet[0].charAt(0));
		data = {
			type: "bullet",
			tight: true,
			padding: 0,
			markerOffset,
			...(bulletChar === undefined ? {} : { bulletChar }),
		};
		markerLength = bullet[0].length;
	} else if (ordered !== null && (container.type !== "paragraph" || Number.parseInt(ordered[1] ?? "", 10) === 1)) {
		const delimiter = delimiterOf(ordered[2] ?? "");
		data = {
			type: "ordered",
			tight: true,
			padding: 0,
			markerOffset,
			start: Number.parseInt(ordered[1] ?? "1", 10),
			...(delimiter === undefined ? {} : { delimiter }),
		};
		markerLength = ordered[0].length;
	} else {
		return undefined;
	}

	// The marker must be followed by whitespace or the end of the line.
	const afterMarker = peekCode(scanner.currentLine, scanner.nextNonspace + markerLength);
	if (!(afterMarker === -1 || isSpaceOrTab(afterMarker))) {
		return undefined;
	}

	// A marker interrupting a paragraph may not open an empty item.
	if (
		container.type === "paragraph" &&
		!reNonSpace.test(scanner.currentLine.slice(scanner.nextNonspace + markerLength))
	) {
		return undefined;
	}

	scanner.advanceNextNonspace();
	scanner.advanceOffset(markerLength, true);
	const spacesStartColumn = scanner.column;
	const spacesStartOffset = scanner.offset;

	do {
		scanner.advanceOffset(1, true);
	} while (scanner.column - spacesStartColumn < 5 && isSpaceOrTab(peekCode(scanner.currentLine, scanner.offset)));

	const blankItem = peekCode(scanner.currentLine, scanner.offset) === -1;
	const spacesAfterMarker = scanner.column - spacesStartColumn;

	if (spacesAfterMarker >= 5 || spacesAfterMarker < 1 || blankItem) {
		data.padding = markerLength + 1;
		scanner.setScanPosition(spacesStartOffset, spacesStartColumn);
		if (isSpaceOrTab(peekCode(scanner.currentLine, scanner.offset))) {
			scanner.advanceOffset(1, true);
		}
	} else {
		data.padding = markerLength + spacesAfterMarker;
	}

	return data;
};

/** Two markers belong to the same list when type, delimiter and bullet agree. */
const listsMatch = (listData: ListData, itemData: ListData): boolean =>
	listData.type === itemData.type &&
	listData.delimiter === itemData.delimiter &&
	listData.bulletChar === itemData.bulletChar;

/** Whether `block` is followed by a sibling that a blank line separates from it. */
const endsWithBlankLine = (block: BlockNode, next: BlockNode | undefined): boolean =>
	next !== undefined && block.endLine !== next.startLine - 1;

/** Whether any of `block`'s children are separated from the next by a blank line. */
const hasBlankLineBetweenChildren = (block: BlockNode): boolean =>
	block.children.some((child, index) => endsWithBlankLine(child, block.children[index + 1]));

/** List: a container of list items and nothing else. */
export const listConstruct: BlockConstruct = {
	type: "list",
	acceptsLines: false,
	canContain: (child) => child === "listItem",
	continue: () => 0,
	finalize: (_scanner, block) => {
		let tight = true;
		for (const [index, item] of block.children.entries()) {
			// An item followed by a blank line, or one whose own children are
			// blank-line separated, makes the whole list loose.
			const itemSpread = hasBlankLineBetweenChildren(item);
			item.data.spread = itemSpread;
			if (endsWithBlankLine(item, block.children[index + 1]) || itemSpread) {
				tight = false;
			}
		}

		const listData = block.data.listData;
		if (listData !== undefined) {
			listData.tight = tight;
		}
		block.data.spread = !tight;

		const last = block.children[block.children.length - 1];
		if (last !== undefined) {
			block.endOffset = last.endOffset;
			block.endLine = last.endLine;
		}
	},
	materialize: (block, children, context) => {
		const listData = block.data.listData;
		const ordered = listData?.type === "ordered";
		return List.make({
			ordered,
			spread: block.data.spread ?? false,
			children: listItemChildren(children),
			position: context.position(block.startOffset, block.endOffset),
			...(ordered && listData?.start !== undefined ? { start: listData.start } : {}),
			...(listData?.bulletChar === undefined ? {} : { bulletChar: listData.bulletChar }),
			...(listData?.delimiter === undefined ? {} : { delimiter: listData.delimiter }),
		});
	},
};

/** List item: a container of anything but a bare list item. */
export const listItemConstruct: BlockConstruct = {
	type: "listItem",
	acceptsLines: false,
	canContain: (child) => child !== "listItem",
	continue: (scanner, block) => {
		const listData = block.data.listData;
		if (listData === undefined) {
			return 1;
		}

		if (scanner.blank) {
			if (block.children.length === 0) {
				// A blank line straight after an empty item closes it.
				return 1;
			}
			scanner.advanceNextNonspace();
		} else if (scanner.indent >= listData.markerOffset + listData.padding) {
			scanner.advanceOffset(listData.markerOffset + listData.padding, true);
		} else {
			return 1;
		}
		return 0;
	},
	finalize: (_scanner, block) => {
		const last = block.children[block.children.length - 1];
		if (last !== undefined) {
			block.endOffset = last.endOffset;
			block.endLine = last.endLine;
			return;
		}
		// An empty item ends where its marker and padding do.
		block.endLine = block.startLine;
		block.endOffset = block.startOffset + (block.data.listData?.padding ?? 0);
	},
	materialize: (block, children, context) =>
		ListItem.make({
			spread: block.data.spread ?? false,
			children: flowChildren(children),
			position: context.position(block.startOffset, block.endOffset),
			// GFM's task-list start (`gfm` dialect only) is the only writer of
			// `checked`; an item that carried no checkbox keeps the key ABSENT
			// rather than false, which is the mdast contract.
			...(block.data.checked === undefined ? {} : { checked: block.data.checked }),
		}),
};

/** The list-item block start: a bullet or ordered marker. */
export const listItemStart: BlockStart = {
	name: "listItem",
	trigger: (scanner, container) => {
		if (scanner.indented && container.type !== "list") {
			return 0;
		}

		const data = parseListMarker(scanner, container);
		if (data === undefined) {
			return 0;
		}

		scanner.closeUnmatchedBlocks();

		// Open a new list unless the marker continues the one already open.
		const openList = scanner.tip;
		const openListData = openList.data.listData;
		if (openList.type !== "list" || openListData === undefined || !listsMatch(openListData, data)) {
			const list = scanner.addChild("list", scanner.nextNonspace);
			list.data.listData = data;
		}

		const item = scanner.addChild("listItem", scanner.nextNonspace);
		item.data.listData = data;
		return 1;
	},
};
