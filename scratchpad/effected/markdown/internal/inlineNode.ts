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

import { dual } from "effect/Function";
import { isString } from "effect/Predicate";
import type { BreakStyle, EmphasisChar, ReferenceType } from "../MarkdownNode.ts";

/**
 * The node kinds the inline pass builds.
 *
 * @category type-level
 * @since 0.0.0
 */
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

/**
 * Per-kind fields, all optional and never explicitly `undefined`.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineNodeData {
	url?: string;
	title?: string;
	identifier?: string;
	label?: string;
	referenceType?: ReferenceType;
	markerChar?: EmphasisChar;
	breakStyle?: BreakStyle;
}

/**
 * A node under construction, with its sibling and child links.
 *
 * @category models
 * @since 0.0.0
 */
export interface InlineNode {
	readonly type: InlineNodeType;
	/**
	 * Literal content, for the kinds that carry it.
	 * @since 0.0.0
	 */
	value: string;
	/**
	 * Local indices into the leaf's content; resolved to offsets at the end.
	 * @since 0.0.0
	 */
	start: number;
	end: number;
	readonly data: InlineNodeData;
	prev: InlineNode | undefined;
	next: InlineNode | undefined;
	parent: InlineNode | undefined;
	firstChild: InlineNode | undefined;
	lastChild: InlineNode | undefined;
}

/**
 * Open a node with no links.
 *
 * **Example** (Create a detached text node)
 *
 * ```ts
 * import { makeInlineNode } from "@beep/scratchpad/effected/markdown/internal/inlineNode";
 *
 * const node = makeInlineNode("text", 0, 5, "hello");
 * console.log(node.value, node.parent) // hello undefined
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInlineNode: {
	(type: InlineNodeType, start: number, end: number, value?: string): InlineNode;
	(start: number, end: number, value?: string): (type: InlineNodeType) => InlineNode;
} = dual((args) => isString(args[0]), (type: InlineNodeType, start: number, end: number, value = ""): InlineNode => ({
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
}));

/**
 * Append `child` to `parent`'s children.
 *
 * **Example** (Append a child to a container)
 *
 * ```ts
 * import { appendChild, makeInlineNode } from "@beep/scratchpad/effected/markdown/internal/inlineNode";
 *
 * const parent = makeInlineNode("emphasis", 0, 3);
 * const child = makeInlineNode("text", 1, 2, "a");
 * appendChild(parent, child);
 * console.log(parent.firstChild === child, child.parent === parent) // true true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const appendChild: {
	(parent: InlineNode, child: InlineNode): void;
	(child: InlineNode): (parent: InlineNode) => void;
} = dual(2, (parent: InlineNode, child: InlineNode): void => {
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
});

/**
 * Insert `sibling` immediately after `node`.
 *
 * **Example** (Insert a sibling between children)
 *
 * ```ts
 * import { appendChild, insertAfter, makeInlineNode } from "@beep/scratchpad/effected/markdown/internal/inlineNode";
 *
 * const parent = makeInlineNode("emphasis", 0, 4);
 * const first = makeInlineNode("text", 1, 2, "a");
 * const second = makeInlineNode("text", 2, 3, "b");
 * appendChild(parent, first);
 * insertAfter(first, second);
 * console.log(first.next === second, parent.lastChild === second) // true true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const insertAfter: {
	(node: InlineNode, sibling: InlineNode): void;
	(sibling: InlineNode): (node: InlineNode) => void;
} = dual(2, (node: InlineNode, sibling: InlineNode): void => {
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
});

/**
 * Detach `node` from its siblings and parent.
 *
 * **Example** (Detach the only child)
 *
 * ```ts
 * import { appendChild, makeInlineNode, unlink } from "@beep/scratchpad/effected/markdown/internal/inlineNode";
 *
 * const parent = makeInlineNode("emphasis", 0, 3);
 * const child = makeInlineNode("text", 1, 2, "a");
 * appendChild(parent, child);
 * unlink(child);
 * console.log(parent.firstChild, child.parent) // undefined undefined
 * ```
 *
 * @category destructors
 * @since 0.0.0
 */
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

/**
 * Every child of `node`, in order.
 *
 * **Example** (Read children in sibling order)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { appendChild, childrenOf, makeInlineNode } from "@beep/scratchpad/effected/markdown/internal/inlineNode";
 *
 * const parent = makeInlineNode("emphasis", 0, 4);
 * appendChild(parent, makeInlineNode("text", 1, 2, "a"));
 * appendChild(parent, makeInlineNode("text", 2, 3, "b"));
 * console.log(A.map(childrenOf(parent), (child) => child.value).join("")) // ab
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const childrenOf = (node: InlineNode): ReadonlyArray<InlineNode> => {
	const children: InlineNode[] = [];
	for (let child = node.firstChild; child !== undefined; child = child.next) {
		children.push(child);
	}
	return children;
};
