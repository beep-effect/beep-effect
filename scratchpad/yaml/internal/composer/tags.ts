/**
 * Tag-handle resolution and directive parsing local to a document.
 *
 * `parseDirective` lives here (not in `document.ts`) because
 * `validateTagHandlesInDocument` needs it and `document.ts` already imports
 * this module — the reverse import would be a cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { CstNode } from "../cst.ts";
import type { RawDirective } from "../raw-document.ts";
import type { ComposerState } from "./state.ts";

/**
 * Resolve a tag shorthand using the document's %TAG directives.
 * For example, with `%TAG !! tag:example.com,2000:app/`, the tag `!!int`
 * resolves to `tag:example.com,2000:app/int`.
 *
 * Returns the resolved tag URI, or the original tag if no directive matches.
 *
 * **Example** (Default `!!int` vs undeclared named handle)
 *
 * ```ts
 * import { Effect, Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parse("a: !!int 1\n"))) // { a: 1 }
 * console.log(Result.isFailure(Yaml.parseResult("!e!foo: 1\n"))) // true
 * ```
 *
 * @see {@link validateTagHandlesInDocument} for same-document handle checks.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function resolveTagHandle(tag: string, state: ComposerState): string {
	// Verbatim tags: !<...> — return the content as-is
	if (tag.startsWith("!<") && tag.endsWith(">")) {
		return tag.slice(2, -1);
	}
	// Secondary tag handle: !!suffix
	if (tag.startsWith("!!")) {
		const prefix = state.tagMap.get("!!");
		if (prefix) {
			return prefix + tag.slice(2);
		}
		// Default secondary tag handle: tag:yaml.org,2002:
		return `tag:yaml.org,2002:${tag.slice(2)}`;
	}
	// Named tag handle: !name!suffix
	const namedMatch = tag.match(/^(![\w-]*!)(.*)$/);
	if (namedMatch) {
		const handle = namedMatch[1];
		const suffix = namedMatch[2];
		if (handle) {
			const prefix = state.tagMap.get(handle);
			if (prefix) {
				return prefix + (suffix ?? "");
			}
		}
	}
	// Primary tag handle: !suffix (non-empty suffix)
	if (tag.startsWith("!") && tag.length > 1 && !tag.startsWith("!!")) {
		const prefix = state.tagMap.get("!");
		if (prefix) {
			return prefix + tag.slice(1);
		}
		// Default primary: local tag
		return tag;
	}
	// Non-specific tag: ! alone
	return tag;
}

/**
 * Parse a `%NAME args` directive line into a raw name/parameters record.
 *
 * **Gotchas**
 *
 * Lives here so `document.ts` does not import it back from tags (cycle).
 * Trailing `#` comments on the directive line are stripped from parameters.
 *
 * **Example** (Document-local `%TAG` does not leak across `---`)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const leaked = Yaml.parseAllResult("%TAG !e! tag:example.com,2000:app/\n---\n!e!foo: 1\n")
 * console.log(Result.isFailure(leaked)) // true
 * ```
 *
 * @see {@link FlowComposers} for the other composer cycle firewall.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function parseDirective(source: string): RawDirective | null {
	const trimmed = source.trim();
	if (!trimmed.startsWith("%")) return null;
	const parts = trimmed.slice(1).split(/\s+/);
	const name = parts[0];
	if (!name) return null;
	// Strip trailing comments from parameters (e.g. `%FOO bar # comment`).
	const parameters: string[] = [];
	for (const p of parts.slice(1)) {
		if (p.startsWith("#")) break;
		parameters.push(p);
	}
	return { name, parameters };
}

/**
 * QLJ7: validate that any `!handle!suffix` tag reference in this document
 * is declared by a `%TAG` directive in the SAME document. %TAG directives
 * are local to a single document and do not leak across `---` boundaries.
 * The `!!` shorthand and the primary `!` handle are always available.
 *
 * **Gotchas**
 *
 * Copying `%TAG !e!` into document 1 and using `!e!` in document 2 looks
 * like a resolver bug; it is this rule. `!!` and `!` are always available.
 *
 * **Example** (Named handle must be declared in the same document)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const leaked = Yaml.parseAllResult("%TAG !e! tag:example.com,2000:app/\n---\n!e!foo: 1\n")
 * console.log(Result.isFailure(leaked)) // true
 * ```
 *
 * @see {@link validateCrossDocumentDirectives} for the stream-level companion check.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function validateTagHandlesInDocument(docCst: CstNode, state: ComposerState): void {
	const children = docCst.children ?? [];
	// Build local tagMap from %TAG directives in this doc.
	const localHandles = new Set<string>();
	for (const child of children) {
		if (child.type !== "directive") continue;
		const directive = parseDirective(child.source);
		if (directive && directive.name === "TAG" && directive.parameters.length >= 2) {
			const handle = directive.parameters[0];
			if (handle) localHandles.add(handle);
		}
	}
	// Walk the doc's CST nodes for `tag` children and validate references.
	const stack: CstNode[] = [docCst];
	while (stack.length > 0) {
		const node = stack.pop();
		if (!node) continue;
		if (node.type === "tag") {
			const src = node.source;
			// Verbatim tags `!<...>` and `!!`-prefixed (default secondary handle)
			// and bare `!` are always valid.
			if (src.startsWith("!<") || src.startsWith("!!") || src === "!") continue;
			const m = src.match(/^(![\w-]*!)/);
			if (m) {
				const handle = m[1];
				if (handle && !localHandles.has(handle)) {
					state.errors.push({
						code: "UnresolvedTag",
						message: `Tag handle ${handle} is not declared in this document`,
						offset: node.offset,
						length: node.length,
					});
				}
			}
		}
		if (node.children) {
			for (const c of node.children) stack.push(c);
		}
	}
}
