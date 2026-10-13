// Tag-handle resolution and directive parsing/validation local to tags.
// `parseDirective` lives here (not in `document.ts`) because
// `validateTagHandlesInDocument` needs it and `document.ts` already imports
// this module — the reverse import would be a cycle.

import type { CstNode } from "../cst.ts";
import { parseCSTAll } from "../cst-parser.ts";
import type { RawDirective } from "../raw-document.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import * as MutableHashSet from "effect/MutableHashSet";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";

/**
 * Resolves a tag shorthand using the document's `%TAG` directives.
 *
 * **Details**
 *
 * For example, with `%TAG !! tag:example.com,2000:app/`, the tag `!!int`
 * resolves to `tag:example.com,2000:app/int`.
 *
 * Returns the resolved tag URI, or the original tag if no directive matches.
 *
 * **Example** (Resolve a custom secondary tag)
 *
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import { resolveTagHandle } from "@beep/scratchpad/effected/yaml/internal/composer/tags"
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * MutableHashMap.set(state.tagMap, "!!", "tag:example.com,2000:app/")
 * console.log(resolveTagHandle("!!int", state)) // tag:example.com,2000:app/int
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function resolveTagHandle(...[tag, state, span]: [tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]]): string {
	// Verbatim tags: !<...> — return the content as-is
	if (tag.startsWith("!<") && tag.endsWith(">")) {
		return tag.slice(2, -1);
	}
	// Secondary tag handle: !!suffix
	if (tag.startsWith("!!")) {
		const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, "!!"));
		if ((prefix !== undefined && prefix !== "")) {
			return prefix + decodeTagSuffix(tag.slice(2), tag, state, span);
		}
		// Default secondary tag handle: tag:yaml.org,2002:
		return `tag:yaml.org,2002:${decodeTagSuffix(tag.slice(2), tag, state, span)}`;
	}
	// Named tag handle: !name!suffix
	const namedMatch = tag.match(/^(![\w-]*!)(.*)$/);
	if ((namedMatch !== null)) {
		const handle = A.getUnsafe(namedMatch, 1);
		const suffix = A.getUnsafe(namedMatch, 2);
		const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, handle));
		if ((prefix !== undefined && prefix !== "")) {
			return prefix + decodeTagSuffix(suffix, tag, state, span);
		}
	}
	// Primary tag handle: !suffix (non-empty suffix)
	if (tag.startsWith("!") && tag.length > 1 && !tag.startsWith("!!")) {
		const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, "!"));
		if ((prefix !== undefined && prefix !== "")) {
			return prefix + decodeTagSuffix(tag.slice(1), tag, state, span);
		}
		// Default primary: local tag
		return `!${decodeTagSuffix(tag.slice(1), tag, state, span)}`;
	}
	// Non-specific tag: ! alone
	return tag;
}

// Composition always supplies its pending tag's CST span. Standalone callers
// retain their original next-occurrence behavior through a cached CST inventory,
// avoiding repeated lexical scans and leaving unrelated diagnostics untouched.
function standaloneTagSpan(tag: string, state: ComposerState): NodeMeta["tagSpan"] {
	if (state.tagCstCache === undefined) {
		const tags: CstNode[] = [];
		const stack = A.reverse(parseCSTAll(state.text));
		while (stack.length > 0) {
			const node = O.getOrThrow(A.last(stack));
			stack.pop();
			if (node.type === "tag") tags.push(node);
			const children = node.children ?? [];
			for (const child of A.reverse(children)) stack.push(child);
		}
		state.tagCstCache = tags;
	}
	return O.getOrUndefined(A.findFirst(state.tagCstCache, (node) => node.source === tag &&
		!state.errors.some((error) => error.code === "UnresolvedTag" && error.offset === node.offset)));
}

function decodeTagSuffix(suffix: string, tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]): string {
	try {
		return decodeURIComponent(suffix);
	} catch {
		const provenance = span ?? standaloneTagSpan(tag, state);
		if (provenance !== undefined && !state.errors.some((e) =>
			e.code === "UnresolvedTag" && e.offset === provenance.offset && e.length === provenance.length &&
			e.message === `Malformed percent encoding in tag ${tag}`)) {
			state.errors.push({
				code: "UnresolvedTag",
				message: `Malformed percent encoding in tag ${tag}`,
				offset: provenance.offset,
				length: provenance.length,
			});
		}
		return suffix;
	}
}

/**
 * Extracts a directive name and parameters from source text beginning with `%`.
 *
 * **Details**
 *
 * Leading and trailing whitespace is trimmed, and parameters stop at a trailing
 * comment. Source without a directive marker or name returns `null`.
 *
 * **Example** (Read directive parameters before a comment)
 *
 * ```ts
 * import { parseDirective } from "@beep/scratchpad/effected/yaml/internal/composer/tags"
 *
 * const directive = parseDirective("%YAML 1.2 # version")
 * console.log(directive?.name) // YAML
 * console.log(directive?.parameters.join(",")) // 1.2
 * console.log(parseDirective("plain scalar")) // null
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function parseDirective(source: string): RawDirective | null {
	const trimmed = source.trim();
	if (!trimmed.startsWith("%")) return null;
	const parts = trimmed.slice(1).split(/\s+/);
	const name = parts[0];
	if (!((name !== undefined && name !== ""))) return null;
	// Strip trailing comments from parameters (e.g. `%FOO bar # comment`).
	const parameters: string[] = [];
	for (const p of parts.slice(1)) {
		if (p.startsWith("#")) break;
		parameters.push(p);
	}
	return { name, parameters };
}

/**
 * Validates that each `!handle!suffix` tag reference in this document is
 * declared by a `%TAG` directive in the same document (QLJ7).
 *
 * **Details**
 *
 * `%TAG` directives are local to a single document and do not leak across `---`
 * boundaries. The `!!` shorthand and the primary `!` handle are always available.
 * Undeclared handles and malformed percent encoding append diagnostics to `state.errors`.
 *
 * **Example** (Report an undeclared document tag)
 *
 * ```ts
 * import { validateTagHandlesInDocument } from "@beep/scratchpad/effected/yaml/internal/composer/tags"
 * import { createState } from "@beep/scratchpad/effected/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/scratchpad/effected/yaml/internal/composer/flow"
 * import { parseCSTAll } from "@beep/scratchpad/effected/yaml/internal/cst-parser"
 *
 * const text = "!app!value hello"
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * for (const document of parseCSTAll(text)) {
 *   validateTagHandlesInDocument(document, state)
 * }
 * console.log(state.errors[0]?.code) // UnresolvedTag
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function validateTagHandlesInDocument(...[docCst, state, mode = "all"]: [docCst: CstNode, state: ComposerState, mode?: "all" | "handles" | "percent"]): void {
	const children = docCst.children ?? [];
	// Build local tagMap from %TAG directives in this doc.
	const localHandles = MutableHashSet.empty<string>();
	for (const child of children) {
		if (child.type !== "directive") continue;
		const directive = parseDirective(child.source);
		if ((directive !== null) && directive.name === "TAG" && directive.parameters.length >= 2) {
			const handle = A.getUnsafe(directive.parameters, 0);
			MutableHashSet.add(localHandles, handle);
		}
	}
	// Walk the doc's CST nodes for `tag` children and validate references.
	const stack: CstNode[] = [docCst];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) continue;
		if (node.type === "tag") {
			// Plain continuation collectors can absorb tag-shaped CST tokens.
			// Per-document percent validation sees only actual node properties;
			// standalone and cross-document handle validation retain their scope.
			if (mode === "percent" && !MutableHashSet.has(state.tagOffsets, node.offset)) continue;
			const src = node.source;
			if (mode !== "handles" && !src.startsWith("!<")) {
				const named = src.match(/^(![\w-]*!)(.*)$/);
				const suffix = src.startsWith("!!") ? src.slice(2) : named !== null ? A.getUnsafe(named, 2) : src.slice(1);
				decodeTagSuffix(suffix, src, state, node);
			}
			// Verbatim tags `!<...>` and `!!`-prefixed (default secondary handle)
			// and bare `!` are always valid.
			if (mode === "percent" || src.startsWith("!<") || src.startsWith("!!") || src === "!") continue;
			const m = src.match(/^(![\w-]*!)/);
			if ((m !== null)) {
				const handle = m[1];
				if ((handle !== undefined && handle !== "") && !MutableHashSet.has(localHandles, handle)) {
					state.errors.push({
						code: "UnresolvedTag",
						message: `Tag handle ${handle} is not declared in this document`,
						offset: node.offset,
						length: node.length,
					});
				}
			}
		}
		if ((node.children !== undefined)) {
			for (const c of node.children) stack.push(c);
		}
	}
}
