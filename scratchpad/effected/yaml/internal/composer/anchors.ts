// Anchor/alias machinery: alias node construction, anchor registration and
// name scanning, plus the anchor-map/value-extraction helpers the facade and
// compliance harness drive (`buildAnchorMap`, `getNodeValue`).

import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import * as S from "effect/Schema";
import * as MutableHashMap from "effect/MutableHashMap";

const isScalar = S.is(YamlScalar);
const isMap = S.is(YamlMap);
const isSeq = S.is(YamlSeq);

/**
 * Check if a pending anchor is being applied to an alias node (invalid in YAML 1.2 §3.2.2).
 *
 * **Details**
 *
 * Aliases represent references to existing anchored nodes and cannot have their own anchors.
 *
 * Uses `DuplicateAnchor` error code as a pragmatic reuse — semantically this is
 * "anchor on alias" rather than "same anchor name defined twice", but adding a
 * dedicated `AnchorOnAlias` code would be a public API change. The error message
 * distinguishes the two cases for consumers inspecting the message text.
 *
 * **Example** (Reject an anchor attached to an alias)
 *
 * ```ts
 * import { checkAnchorOnAlias } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("*name", { composeFlowMap, composeFlowSeq })
 * checkAnchorOnAlias({ anchor: "other" }, { type: "alias", source: "*name", offset: 0, length: 5 }, state)
 * console.log(state.errors[0]?.message) // Anchor &other cannot be applied to alias *name
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function checkAnchorOnAlias(...[pendingMeta, cst, state]: [pendingMeta: NodeMeta, cst: CstNode, state: ComposerState]): void {
	if (pendingMeta.anchor !== undefined) {
		state.errors.push({
			code: "DuplicateAnchor",
			message: `Anchor &${pendingMeta.anchor} cannot be applied to alias *${getAliasName(cst, state.text)}`,
			offset: cst.offset,
			length: cst.length,
		});
	}
}

/**
 * Constructs an alias node while recording undefined references or an exceeded alias limit.
 *
 * **Details**
 *
 * Only defined aliases count toward the limit. Existence is checked first so an
 * undefined reference produces the more specific diagnostic. A node is returned
 * even when a diagnostic is recorded.
 *
 * **Example** (Report an undefined alias)
 *
 * ```ts
 * import { makeAlias } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("*missing", { composeFlowMap, composeFlowSeq })
 * const alias = makeAlias({ type: "alias", source: "*missing", offset: 0, length: 8 }, state)
 * console.log(alias.name) // missing
 * console.log(state.errors[0]?.code) // UndefinedAlias
 * console.log(state.aliasCount) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function makeAlias(...[cst, state]: [cst: CstNode, state: ComposerState]): YamlAlias {
	const name = getAliasName(cst, state.text);

	// Check existence first — an undefined alias is a more specific error
	// than a count exceeded error.
	if (!MutableHashMap.has(state.anchors, name)) {
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
}

/**
 * Registers a node under an anchor name and warns when replacing an existing registration.
 *
 * **Details**
 *
 * The latest node replaces the previous registration even when a duplicate warning
 * is added. This updates the state map; it does not attach an anchor field to the node.
 *
 * **Example** (Warn when reusing an anchor name)
 *
 * ```ts
 * import { registerAnchor } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 * import { YamlScalar } from "@beep/scratchpad/effected/yaml/YamlNode"
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("&name hello", { composeFlowMap, composeFlowSeq })
 * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 6, length: 5 })
 * registerAnchor(node, "name", state, 0)
 * registerAnchor(node, "name", state, 0)
 * console.log(state.warnings[0]?.code) // DuplicateAnchor
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function registerAnchor(...[node, anchor, state, offset]: [node: YamlNode, anchor: string, state: ComposerState, offset: number]): void {
	if (MutableHashMap.has(state.anchors, anchor)) {
		state.warnings.push({
			code: "DuplicateAnchor",
			message: `Duplicate anchor: &${anchor}`,
			offset,
			length: anchor.length + 1,
		});
	}
	MutableHashMap.set(state.anchors, anchor, node);
}

/**
 * Reads the anchor name from source text after its sigil, falling back to the CST source.
 *
 * **Details**
 *
 * When the expected sigil is present at the CST offset, the name is scanned
 * independently of the CST length. Otherwise the CST source is returned unchanged.
 *
 * **Example** (Read an anchor name independently of span length)
 *
 * ```ts
 * import { getAnchorName } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 *
 * console.log(getAnchorName({ type: "anchor", source: "&name", offset: 0, length: 1 }, "&name value")) // name
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function getAnchorName(...[cst, text]: [cst: CstNode, text: string]): string {
	// The CST anchor node carries the lexer token's span, which covers the
	// "&" sigil plus the name. Scan the name from the original text starting
	// after the sigil rather than slicing by length, keeping this independent
	// of the span arithmetic.
	const rawStart = text[cst.offset];
	if (rawStart === "&") {
		return scanName(text, cst.offset + 1);
	}
	return cst.source;
}

/**
 * Reads the alias name from source text after its sigil, falling back to the CST source.
 *
 * **Details**
 *
 * When the expected sigil is present at the CST offset, the name is scanned
 * independently of the CST length. Otherwise the CST source is returned unchanged.
 *
 * **Example** (Read an alias name independently of span length)
 *
 * ```ts
 * import { getAliasName } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 *
 * console.log(getAliasName({ type: "alias", source: "*name", offset: 0, length: 1 }, "*name value")) // name
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function getAliasName(...[cst, text]: [cst: CstNode, text: string]): string {
	const rawStart = text[cst.offset];
	if (rawStart === "*") {
		return scanName(text, cst.offset + 1);
	}
	return cst.source;
}

/**
 * Scans an anchor or alias name from a source offset until whitespace or a flow indicator.
 *
 * **Details**
 *
 * The scan stops at spaces, tabs, line feeds, carriage returns, braces, brackets,
 * commas, or the end of the text. Start after the sigil to exclude it from the result.
 *
 * **Example** (Stop an anchor name at a flow delimiter)
 *
 * ```ts
 * import { scanName } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 *
 * console.log(scanName("&name, next", 1)) // name
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function scanName(...[text, start]: [text: string, start: number]): string {
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
}

// ---------------------------------------------------------------------------
// Anchor map / value extraction
// ---------------------------------------------------------------------------

/**
 * Build an anchor map by walking the AST, collecting nodes that have anchors.
 *
 * **Details**
 *
 * Used to resolve aliases when extracting plain JavaScript values from
 * parsed YAML documents.
 *
 * **Example** (Collect a scalar anchor for alias lookup)
 *
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import { buildAnchorMap } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 * import { YamlScalar } from "@beep/scratchpad/effected/yaml/YamlNode"
 *
 * const node = YamlScalar.make({ value: "hello", style: "plain", anchor: "name", offset: 0, length: 5 })
 * const anchors = buildAnchorMap(node)
 * console.log(MutableHashMap.has(anchors, "name")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function buildAnchorMap(node: YamlNode | null): MutableHashMap.MutableHashMap<string, YamlNode> {
	const anchors = MutableHashMap.empty<string, YamlNode>();
	collectAnchors(node, anchors);
	return anchors;
}

function collectAnchors(node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>): void {
	if (node === null) return;
	if (isScalar(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
	} else if (isMap(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
		for (const pair of node.items) {
			collectAnchors(pair.key, anchors);
			collectAnchors(pair.value, anchors);
		}
	} else if (isSeq(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
		for (const item of node.items) {
			collectAnchors(item, anchors);
		}
	}
	// YamlAlias has no anchor field — it references one.
}

/**
 * Extract a plain JavaScript value from a YAML AST node.
 *
 * **Details**
 *
 * Delegates to the
 * single implementation on the public node classes (`YamlNode.toValue`),
 * which resolves aliases through the optional anchor map with incremental
 * registration and handles `__proto__` keys as own data properties.
 *
 * **Example** (Resolve an alias through collected anchors)
 *
 * ```ts
 * import { buildAnchorMap, getNodeValue } from "@beep/scratchpad/effected/yaml/internal/composer/anchors"
 * import { YamlAlias, YamlScalar } from "@beep/scratchpad/effected/yaml/YamlNode"
 *
 * const node = YamlScalar.make({ value: "hello", style: "plain", anchor: "name", offset: 0, length: 5 })
 * const alias = YamlAlias.make({ name: "name", offset: 6, length: 5 })
 * console.log(getNodeValue(alias, buildAnchorMap(node))) // hello
 * console.log(getNodeValue(null)) // null
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export function getNodeValue(...[node, anchors]: [node: YamlNode | null, anchors?: MutableHashMap.MutableHashMap<string, YamlNode>]): unknown {
	return node === null ? null : node.toValue(anchors);
}
