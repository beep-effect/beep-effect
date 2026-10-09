// Anchor/alias machinery: alias node construction, anchor registration and
// name scanning, plus the anchor-map/value-extraction helpers the facade and
// compliance harness drive (`buildAnchorMap`, `getNodeValue`).

import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import * as Schema from "effect/Schema";
import * as MutableHashMap from "effect/MutableHashMap";
import { dual } from "effect/Function";

/**
 * Check if a pending anchor is being applied to an alias node (invalid in YAML 1.2 §3.2.2).
 * Aliases represent references to existing anchored nodes and cannot have their own anchors.
 *
 * Uses `DuplicateAnchor` error code as a pragmatic reuse — semantically this is
 * "anchor on alias" rather than "same anchor name defined twice", but adding a
 * dedicated `AnchorOnAlias` code would be a public API change. The error message
 * distinguishes the two cases for consumers inspecting the message text.
 */
export const checkAnchorOnAlias: {
	(pendingMeta: NodeMeta, cst: CstNode, state: ComposerState): void;
	(cst: CstNode, state: ComposerState): (pendingMeta: NodeMeta) => void;
} = dual(3, (pendingMeta: NodeMeta, cst: CstNode, state: ComposerState): void => {
	if (pendingMeta.anchor !== undefined) {
		state.errors.push({
			code: "DuplicateAnchor",
			message: `Anchor &${pendingMeta.anchor} cannot be applied to alias *${getAliasName(cst, state.text)}`,
			offset: cst.offset,
			length: cst.length,
		});
	}
});

export const makeAlias: {
	(cst: CstNode, state: ComposerState): YamlAlias;
	(state: ComposerState): (cst: CstNode) => YamlAlias;
} = dual(2, (cst: CstNode, state: ComposerState): YamlAlias => {
	const name = getAliasName(cst, state.text);

	// Check existence first — an undefined alias is a more specific error
	// than a count exceeded error.
	if (!state.anchors.has(name)) {
		state.errors.push({
			code: "UndefinedAlias",
			message: `Undefined alias: *${name}`,
			offset: cst.offset,
			length: cst.length,
		});
	} else {
		// Only count valid (defined) aliases toward the limit.
		state.aliasCount++;
		if (state.aliasCount > state.options.maxAliasCount) {
			state.errors.push({
				code: "AliasCountExceeded",
				message: `Alias count exceeded maximum of ${state.options.maxAliasCount}`,
				offset: cst.offset,
				length: cst.length,
			});
		}
	}

	return YamlAlias.make({ name, offset: cst.offset, length: cst.length });
});

export const registerAnchor: {
	(node: YamlNode, anchor: string, state: ComposerState, offset: number): void;
	(anchor: string, state: ComposerState, offset: number): (node: YamlNode) => void;
} = dual(4, (node: YamlNode, anchor: string, state: ComposerState, offset: number): void => {
	if (state.anchors.has(anchor)) {
		state.warnings.push({
			code: "DuplicateAnchor",
			message: `Duplicate anchor: &${anchor}`,
			offset,
			length: anchor.length + 1,
		});
	}
	state.anchors.set(anchor, node);
});

export const getAnchorName: {
	(cst: CstNode, text: string): string;
	(text: string): (cst: CstNode) => string;
} = dual(2, (cst: CstNode, text: string): string => {
	// The CST anchor node carries the lexer token's span, which covers the
	// "&" sigil plus the name. Scan the name from the original text starting
	// after the sigil rather than slicing by length, keeping this independent
	// of the span arithmetic.
	const rawStart = text[cst.offset];
	if (rawStart === "&") {
		return scanName(text, cst.offset + 1);
	}
	return cst.source;
});

export const getAliasName: {
	(cst: CstNode, text: string): string;
	(text: string): (cst: CstNode) => string;
} = dual(2, (cst: CstNode, text: string): string => {
	const rawStart = text[cst.offset];
	if (rawStart === "*") {
		return scanName(text, cst.offset + 1);
	}
	return cst.source;
});

export const scanName: {
	(text: string, start: number): string;
	(start: number): (text: string) => string;
} = dual(2, (text: string, start: number): string => {
	let end = start;
	// YAML 1.2 ns-anchor-char: any non-whitespace char except c-flow-indicator
	while (end < text.length) {
		const ch = text[end];
		if (
			ch === " " ||
			ch === "\t" ||
			ch === "\n" ||
			ch === "\r" ||
			ch === "{" ||
			ch === "}" ||
			ch === "[" ||
			ch === "]" ||
			ch === "," ||
			ch === undefined
		) {
			break;
		}
		end++;
	}
	return text.slice(start, end);
});

// ---------------------------------------------------------------------------
// Anchor map / value extraction
// ---------------------------------------------------------------------------

/**
 * Build an anchor map by walking the AST, collecting nodes that have anchors.
 * Used to resolve aliases when extracting plain JavaScript values from
 * parsed YAML documents.
 */
export function buildAnchorMap(node: YamlNode | null): Map<string, YamlNode> {
	const anchors = MutableHashMap.empty<string, YamlNode>();
	collectAnchors(node, anchors);
	// Value extraction accepts a native Map, including data-last dispatch.
	return anchors.backing;
}

function collectAnchors(node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>): void {
	if (node === null) return;
	if (Schema.is(YamlScalar)(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
	} else if (Schema.is(YamlMap)(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
		for (const pair of node.items) {
			collectAnchors(pair.key, anchors);
			collectAnchors(pair.value, anchors);
		}
	} else if (Schema.is(YamlSeq)(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
		for (const item of node.items) {
			collectAnchors(item, anchors);
		}
	}
	// YamlAlias has no anchor field — it references one.
}

/**
 * Extract a plain JavaScript value from a YAML AST node. Delegates to the
 * single implementation on the public node classes (`YamlNode.toValue`),
 * which resolves aliases through the optional anchor map with incremental
 * registration and handles `__proto__` keys as own data properties.
 */
export const getNodeValue: {
	(node: YamlNode | null, anchors?: Map<string, YamlNode>): unknown;
	(anchors?: Map<string, YamlNode>): (node: YamlNode | null) => unknown;
} = dual((args) => args[0] === null || (args[0] !== undefined && !(args[0] instanceof Map)), (node: YamlNode | null, anchors?: Map<string, YamlNode>): unknown => node === null ? null : node.toValue(anchors));
