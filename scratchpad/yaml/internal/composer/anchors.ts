/**
 * Anchor and alias machinery: alias construction, anchor registration, name
 * scanning, and the value-extraction helpers the facade drives.
 *
 * Alias budget counting and DuplicateAnchor channel reuse (error vs
 * warning) live here. `__proto__` mapping keys round-trip as own data
 * properties, not prototype mutation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MutableHashMap } from "effect";
import { dual } from "effect/Function";
import type { YamlNode } from "../../YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { ComposerState, NodeMeta } from "./state.ts";

/**
 * Check if a pending anchor is being applied to an alias node (invalid in YAML 1.2 §3.2.2).
 * Aliases represent references to existing anchored nodes and cannot have their own anchors.
 *
 * Uses `DuplicateAnchor` error code as a pragmatic reuse — semantically this is
 * "anchor on alias" rather than "same name defined twice", but adding a
 * dedicated `AnchorOnAlias` code would be a public API change. The error message
 * distinguishes the two cases for consumers inspecting the message text.
 *
 * **Gotchas**
 *
 * Same code, different channel: this path pushes to `state.errors` (fatal
 * if it lands in errors). {@link registerAnchor} pushes the same code to
 * `state.warnings` and last-write-wins the map. Inspect `message` to tell
 * the cases apart. Do not invent an `AnchorOnAlias` code.
 *
 * **Example** (Anchor on alias is a fatal parse)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const result = Yaml.parseResult("&a *b\n")
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.diagnostics[0]?.code) // "DuplicateAnchor"
 * }
 * ```
 *
 * @see {@link registerAnchor} for the warning-channel DuplicateAnchor path.
 * @internal
 * @category predicates
 * @since 0.0.0
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

/**
 * Build an alias node, recording `UndefinedAlias` or `AliasCountExceeded`.
 *
 * **Gotchas**
 *
 * Undefined aliases emit `UndefinedAlias` and do **not** increment
 * `aliasCount`. `AliasCountExceeded` fires only after a defined alias
 * pushes the count past `options.maxAliasCount`. A hostile document of
 * dangling `*x` references does not trip the DoS guard.
 *
 * **Example** (Defined alias resolves; dangling alias is fatal)
 *
 * ```ts
 * import { Effect, Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: &id 1\nb: *id\n"))) // { a: 1, b: 1 }
 * console.log(Result.isFailure(Yaml.parseResult("*missing\n"))) // true
 * ```
 *
 * @see {@link ParseOptionsInput} for the default `maxAliasCount` of 100.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeAlias: {
	(cst: CstNode, state: ComposerState): YamlAlias;
	(state: ComposerState): (cst: CstNode) => YamlAlias;
} = dual(2, (cst: CstNode, state: ComposerState): YamlAlias => {
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
});

/**
 * Register `node` under `anchor`, warning on a reused name.
 *
 * **Gotchas**
 *
 * Duplicate names emit `DuplicateAnchor` on the **warning** channel and
 * last-write-wins the map. Contrast {@link checkAnchorOnAlias}, which uses
 * the same code on the error channel.
 *
 * **Example** (Last duplicate anchor wins)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: &id 1\nb: &id 2\nc: *id\n"))) // { a: 1, b: 2, c: 2 }
 * ```
 *
 * @see {@link checkAnchorOnAlias} for the error-channel DuplicateAnchor path.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const registerAnchor: {
	(node: YamlNode, anchor: string, state: ComposerState, offset: number): void;
	(anchor: string, state: ComposerState, offset: number): (node: YamlNode) => void;
} = dual(4, (node: YamlNode, anchor: string, state: ComposerState, offset: number): void => {
	if (MutableHashMap.has(state.anchors, anchor)) {
		state.warnings.push({
			code: "DuplicateAnchor",
			message: `Duplicate anchor: &${anchor}`,
			offset,
			length: anchor.length + 1,
		});
	}
	MutableHashMap.set(state.anchors, anchor, node);
});

/**
 * Read an anchor name from a CST node, scanning past the `&` sigil.
 *
 * **Example** (Parse an anchored scalar)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: &id 1\n"))) // { a: 1 }
 * ```
 *
 * @see {@link scanName} for the ns-anchor-char scan used after the sigil.
 * @internal
 * @category getters
 * @since 0.0.0
 */
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

/**
 * Read an alias name from a CST node, scanning past the `*` sigil.
 *
 * **Example** (Resolve a named alias)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: &id hi\nb: *id\n"))) // { a: "hi", b: "hi" }
 * ```
 *
 * @see {@link scanName} for the ns-anchor-char scan used after the sigil.
 * @internal
 * @category getters
 * @since 0.0.0
 */
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

/**
 * Scan a YAML 1.2 ns-anchor-char name from `start` (any non-whitespace
 * except flow indicators).
 *
 * **Example** (Anchors stop at flow indicators)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("{&id a: 1, b: *id}\n"))) // { a: 1, b: 1 }
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
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
 *
 * **Example** (Alias resolution through the public value path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { YamlDocument } from "@beep/scratchpad/yaml"
 *
 * const doc = Effect.runSync(YamlDocument.parse("a: &id 1\nb: *id\n"))
 * console.log(doc.toValue()) // { a: 1, b: 1 }
 * ```
 *
 * @see {@link getNodeValue} for value extraction that consults this map.
 * @internal
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
	if (YamlScalar.is(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
	} else if (YamlMap.is(node)) {
		if (node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
		for (const pair of node.items) {
			collectAnchors(pair.key, anchors);
			collectAnchors(pair.value, anchors);
		}
	} else if (YamlSeq.is(node)) {
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
 *
 * **Gotchas**
 *
 * `__proto__` is data, not a setter. Do not "sanitize" by dropping the key
 * — it round-trips as an own property on the plain object, not as
 * `Object.prototype` mutation.
 *
 * **Example** (`__proto__` is an own mapping key)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const value = Effect.runSync(Yaml.parse("__proto__: 1\n"))
 * console.log(typeof value === "object" && value !== null && Object.hasOwn(value, "__proto__")) // true
 * ```
 *
 * @see {@link YamlNode.toValue} for the public node method this delegates to.
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const getNodeValue: {
	(node: YamlNode | null, anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown;
	(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): (node: YamlNode | null) => unknown;
} = dual(
	(args) =>
		args.length >= 2 ||
		args[0] === null ||
		YamlScalar.is(args[0]) ||
		YamlMap.is(args[0]) ||
		YamlSeq.is(args[0]) ||
		YamlAlias.is(args[0]),
	(node: YamlNode | null, anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown =>
		node === null ? null : node.toValue(anchors),
);
