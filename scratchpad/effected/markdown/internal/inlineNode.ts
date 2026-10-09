// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The mutable node list the inline pass builds into, and the sibling
// operations upstream's `lib/node.js` provides.
//
// It exists for one reason: `processEmphasis` reaches back to a text node it
// recorded on the delimiter stack, truncates it, moves every node BETWEEN two
// delimiters into a new emphasis node, and unlinks what is left empty. On an
// array that is O(n) index lookups per match, which turns the pathological
// emphasis corpus quadratic; on a doubly linked list every one of those steps
// is O(1), which is the whole reason upstream uses one. `inlineParser.ts`
// materializes the immutable, mdast-shaped classes once the list is final.
//
// Leaf module: imports only node-shape types.

import type { BreakStyle, EmphasisChar, ReferenceType } from "../MarkdownNode.ts";

/** The node kinds the inline pass builds. */
export type InlineNodeType =
	| "text"
	| "inlineCode"
	| "html"
	| "break"
	| "emphasis"
	| "strong"
	| "delete"
	| "link"
	| "image"
	| "linkReference"
	| "imageReference"
	| "footnoteReference";

/** Per-kind fields, all optional and never explicitly `undefined`. */
export interface InlineNodeData {
	url?: string;
	title?: string;
	identifier?: string;
	label?: string;
	referenceType?: ReferenceType;
	markerChar?: EmphasisChar;
	breakStyle?: BreakStyle;
}

/** A node under construction, with its sibling and child links. */
export interface InlineNode {
	readonly type: InlineNodeType;
	/** Literal content, for the kinds that carry it. */
	value: string;
	/** Local indices into the leaf's content; resolved to offsets at the end. */
	start: number;
	end: number;
	readonly data: InlineNodeData;
	prev: InlineNode | undefined;
	next: InlineNode | undefined;
	parent: InlineNode | undefined;
	firstChild: InlineNode | undefined;
	lastChild: InlineNode | undefined;
}

/** Open a node with no links. */
export const makeInlineNode = (type: InlineNodeType, start: number, end: number, value = ""): InlineNode => ({
	type,
	value,
	start,
	end,
	data: {},
	prev: undefined,
	next: undefined,
	parent: undefined,
	firstChild: undefined,
	lastChild: undefined,
});

/** Append `child` to `parent`'s children. */
export const appendChild = (parent: InlineNode, child: InlineNode): void => {
	unlink(child);
	child.parent = parent;
	child.prev = parent.lastChild;
	child.next = undefined;
	if (parent.lastChild === undefined) {
		parent.firstChild = child;
	} else {
		parent.lastChild.next = child;
	}
	parent.lastChild = child;
};

/** Insert `sibling` immediately after `node`. */
export const insertAfter = (node: InlineNode, sibling: InlineNode): void => {
	unlink(sibling);
	sibling.parent = node.parent;
	sibling.prev = node;
	sibling.next = node.next;
	if (node.next === undefined) {
		if (node.parent !== undefined) {
			node.parent.lastChild = sibling;
		}
	} else {
		node.next.prev = sibling;
	}
	node.next = sibling;
};

/** Detach `node` from its siblings and parent. */
export const unlink = (node: InlineNode): void => {
	if (node.prev !== undefined) {
		node.prev.next = node.next;
	} else if (node.parent !== undefined) {
		node.parent.firstChild = node.next;
	}

	if (node.next !== undefined) {
		node.next.prev = node.prev;
	} else if (node.parent !== undefined) {
		node.parent.lastChild = node.prev;
	}

	node.prev = undefined;
	node.next = undefined;
	node.parent = undefined;
};

/** Every child of `node`, in order. */
export const childrenOf = (node: InlineNode): ReadonlyArray<InlineNode> => {
	const children: InlineNode[] = [];
	for (let child = node.firstChild; child !== undefined; child = child.next) {
		children.push(child);
	}
	return children;
};
