// Tag-handle resolution and directive parsing/validation local to tags.
// `parseDirective` lives here (not in `document.ts`) because
// `validateTagHandlesInDocument` needs it and `document.ts` already imports
// this module — the reverse import would be a cycle.

import type { CstNode } from "../cst.ts";
import type { RawDirective } from "../raw-document.ts";
import type { ComposerState } from "./state.ts";
import * as MutableHashSet from "effect/MutableHashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import { lexAll } from "../lexer.ts";

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
export function resolveTagHandle(...[tag, state]: [tag: string, state: ComposerState]): string {
	// Verbatim tags: !<...> — return the content as-is
	if (tag.startsWith("!<") && tag.endsWith(">")) {
		return tag.slice(2, -1);
	}
	// Secondary tag handle: !!suffix
	if (tag.startsWith("!!")) {
		const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, "!!"));
		if ((prefix !== undefined && prefix !== "")) {
			return prefix + decodeTagSuffix(tag.slice(2), tag, state);
		}
		// Default secondary tag handle: tag:yaml.org,2002:
		return `tag:yaml.org,2002:${decodeTagSuffix(tag.slice(2), tag, state)}`;
	}
	// Named tag handle: !name!suffix
	const namedMatch = tag.match(/^(![\w-]*!)(.*)$/);
	if ((namedMatch !== null)) {
		const handle = namedMatch[1];
		const suffix = namedMatch[2];
		if ((handle !== undefined && handle !== "")) {
			const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, handle));
			if ((prefix !== undefined && prefix !== "")) {
				return prefix + decodeTagSuffix(suffix ?? "", tag, state);
			}
		}
	}
	// Primary tag handle: !suffix (non-empty suffix)
	if (tag.startsWith("!") && tag.length > 1 && !tag.startsWith("!!")) {
		const prefix = O.getOrUndefined(MutableHashMap.get(state.tagMap, "!"));
		if ((prefix !== undefined && prefix !== "")) {
			return prefix + decodeTagSuffix(tag.slice(1), tag, state);
		}
		// Default primary: local tag
		return `!${decodeTagSuffix(tag.slice(1), tag, state)}`;
	}
	// Non-specific tag: ! alone
	return tag;
}

function decodeTagSuffix(suffix: string, tag: string, state: ComposerState): string {
	try {
		return decodeURIComponent(suffix);
	} catch {
		// Resolution receives the spelling, not its CST span. Locate the next
		// matching lexical tag, excluding positions already diagnosed, so
		// repeated malformed tags retain their own source positions.
		for (const token of lexAll(state.text)) {
			if (token.kind !== "tag" || token.value !== tag) continue;
			if (state.errors.some((e) => e.offset === token.offset && e.code === "UnresolvedTag")) continue;
			state.errors.push({
				code: "UnresolvedTag",
				message: `Malformed percent encoding in tag ${tag}`,
				offset: token.offset,
				length: token.length,
			});
			break;
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
export function validateTagHandlesInDocument(...[docCst, state]: [docCst: CstNode, state: ComposerState]): void {
	const children = docCst.children ?? [];
	// Build local tagMap from %TAG directives in this doc.
	const localHandles = MutableHashSet.empty<string>();
	for (const child of children) {
		if (child.type !== "directive") continue;
		const directive = parseDirective(child.source);
		if ((directive !== null) && directive.name === "TAG" && directive.parameters.length >= 2) {
			const handle = directive.parameters[0];
			if ((handle !== undefined && handle !== "")) MutableHashSet.add(localHandles, handle);
		}
	}
	// Walk the doc's CST nodes for `tag` children and validate references.
	const stack: CstNode[] = [docCst];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) continue;
		if (node.type === "tag") {
			const src = node.source;
			if (!src.startsWith("!<")) {
				const named = src.match(/^(![\w-]*!)(.*)$/);
				const suffix = src.startsWith("!!") ? src.slice(2) : named !== null ? named[2] ?? "" : src.slice(1);
				try {
					decodeURIComponent(suffix);
				} catch {
					state.errors.push({
						code: "UnresolvedTag",
						message: `Malformed percent encoding in tag ${src}`,
						offset: node.offset,
						length: node.length,
					});
				}
			}
			// Verbatim tags `!<...>` and `!!`-prefixed (default secondary handle)
			// and bare `!` are always valid.
			if (src.startsWith("!<") || src.startsWith("!!") || src === "!") continue;
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
