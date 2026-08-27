/**
 * Scanner-based path navigation for the modifier. Private implementation.
 *
 * Resolves a {@link JsoncPath} through scanner tokens rather than a
 * `lastIndexOf('"segment"')` search of the raw text, so keys containing quote
 * characters are located from the key token itself. Returns a plain
 * structural result; {@link JsoncModifier} synthesizes edits and constructs
 * {@link JsoncModificationError} from it, so this module never imports the
 * facade or the edit vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { JsoncPath } from "../JsoncNode.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";

/**
 * The target property/element was located.
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface Located {
	readonly _tag: "Located";
	readonly container: "object" | "array";
	/** Start offset of the property key (object) or the element value (array). */
	readonly keyStart: number;
	/** Start offset of the value token. */
	readonly valueStart: number;
	/** Tight end offset of the value (excludes trailing whitespace/comments). */
	readonly valueEnd: number;
	/**
	 * Offset of the separator comma preceding this entry in its container, or
	 * undefined when the entry is first. Captured from the comma token itself so
	 * edit synthesis never searches raw text (commas inside comments are
	 * invisible here).
	 */
	readonly commaBefore?: number | undefined;
	/** Offset of the comma token immediately following the value, if any. */
	readonly commaAfter?: number | undefined;
}

/**
 * The target does not exist; an insertion point was resolved instead.
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface Insert {
	readonly _tag: "Insert";
	readonly container: "object" | "array";
	/** Offset at which new content should be inserted. */
	readonly at: number;
	/** Whether the container is empty (affects surrounding punctuation). */
	readonly isFirst: boolean;
	/** Depth of the insertion (path length) for indentation. */
	readonly depth: number;
}

/**
 * A structural type mismatch: expected an object or array but found otherwise.
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface Mismatch {
	readonly _tag: "Mismatch";
	readonly depth: number;
	readonly expected: "object" | "array";
}

/**
 * Nothing to resolve (for example navigating an empty path segment set).
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface NoOp {
	readonly _tag: "NoOp";
}

/**
 * The outcome of navigating a {@link JsoncPath} through JSONC source.
 *
 * @see {@link navigate} for the function that returns this union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type NavigateResult = Located | Insert | Mismatch | NoOp;

/**
 * Resolve `path` against `text`, returning where the target is (or where it
 * would be inserted). `path` must be non-empty — the whole-document case is
 * handled by the caller.
 *
 * **Example** (Locate, insert-miss, and mismatch)
 *
 * ```ts
 * import { navigate } from "../../jsonc/internal/navigate.ts";
 *
 * const located = navigate('{ "port": 3000 }', ["port"]);
 * console.log(located._tag); // "Located"
 *
 * const insert = navigate('{ "port": 3000 }', ["host"]);
 * console.log(insert._tag); // "Insert"
 *
 * const mismatch = navigate("[1, 2]", ["port"]);
 * console.log(mismatch._tag); // "Mismatch"
 * ```
 *
 * @see {@link NavigateResult} for the `Located` / `Insert` / `Mismatch` / `NoOp` union.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function navigate(text: string, path: JsoncPath): NavigateResult {
	if (path.length === 0) {
		return { _tag: "NoOp" };
	}

	const scanner = createScanner(text, true);
	let currentToken = scanner.scan();

	// Tight end-of-token offset for the CURRENT token. Because this scanner
	// ignores trivia, scan() silently skips whitespace when advancing, so
	// getTokenOffset() after advancing is the start of the NEXT token; capture
	// this value before advancing.
	function tokenEnd(): number {
		return scanner.getTokenOffset() + scanner.getTokenLength();
	}

	// Cursor adapter for the shared iterative bracket-balance skip (see
	// internal/skip.ts). Being non-recursive, the skip cannot overflow the
	// stack on hostile deeply-nested input, so `navigate` (and `JsoncModifier`)
	// need no separate depth cap. Malformed input can route a non-value token
	// here (JsoncModifier.modify passes raw text straight to navigate(), so a
	// value slot may hold a closer, e.g. `{"k":}`) — the helper's guard leaves
	// the cursor untouched in that case.
	const skipCursor: SkipCursor = {
		getToken: () => currentToken,
		advance: () => {
			currentToken = scanner.scan();
		},
		tokenStart: () => scanner.getTokenOffset(),
		tokenEnd,
	};

	// Skip the value starting at currentToken and return its tight end offset.
	function skipValue(): number {
		return skipBalancedValue(skipCursor);
	}

	let depth = 0;
	for (const segment of path) {
		depth++;
		if (typeof segment === "string") {
			if (currentToken !== "OpenBrace") {
				return { _tag: "Mismatch", depth, expected: "object" };
			}
			currentToken = scanner.scan();
			let found = false;
			let lastValueEnd = scanner.getTokenOffset();
			let isFirst = true;
			let lastComma: number | undefined;

			while (currentToken !== "CloseBrace" && currentToken !== "EOF") {
				if (!isFirst && currentToken === "Comma") {
					lastComma = scanner.getTokenOffset();
					currentToken = scanner.scan();
				}
				if (currentToken === "String") {
					const keyStart = scanner.getTokenOffset();
					const key = scanner.getTokenValue();
					currentToken = scanner.scan(); // skip key
					if (currentToken === "Colon") {
						currentToken = scanner.scan(); // skip colon
					}
					if (key === segment) {
						found = true;
						if (depth === path.length) {
							const valueStart = scanner.getTokenOffset();
							const valueEnd = skipValue();
							const commaAfter = currentToken === "Comma" ? scanner.getTokenOffset() : undefined;
							return {
								_tag: "Located",
								container: "object",
								keyStart,
								valueStart,
								valueEnd,
								commaBefore: lastComma,
								commaAfter,
							};
						}
						break; // descend into this value on the next segment
					}
					lastValueEnd = skipValue();
				} else {
					currentToken = scanner.scan();
					lastValueEnd = scanner.getTokenOffset();
				}
				isFirst = false;
			}

			if (!found && depth === path.length) {
				return { _tag: "Insert", container: "object", at: lastValueEnd, isFirst, depth };
			}
			// Intermediate miss: fall through to the next segment, where the
			// closing brace token will fail the OpenBrace/OpenBracket check.
		} else {
			if (currentToken !== "OpenBracket") {
				return { _tag: "Mismatch", depth, expected: "array" };
			}
			currentToken = scanner.scan();
			let idx = 0;
			let lastEnd = scanner.getTokenOffset();
			let lastComma: number | undefined;

			while (currentToken !== "CloseBracket" && currentToken !== "EOF") {
				if (idx > 0 && currentToken === "Comma") {
					lastComma = scanner.getTokenOffset();
					currentToken = scanner.scan();
				}
				if (idx === segment) {
					if (depth === path.length) {
						const valueStart = scanner.getTokenOffset();
						const valueEnd = skipValue();
						const commaAfter = currentToken === "Comma" ? scanner.getTokenOffset() : undefined;
						return {
							_tag: "Located",
							container: "array",
							keyStart: valueStart,
							valueStart,
							valueEnd,
							commaBefore: lastComma,
							commaAfter,
						};
					}
					break; // descend into this element on the next segment
				}
				lastEnd = skipValue();
				idx++;
			}

			if (idx <= segment && depth === path.length) {
				return { _tag: "Insert", container: "array", at: lastEnd, isFirst: idx === 0, depth };
			}
		}
	}

	return { _tag: "NoOp" };
}
