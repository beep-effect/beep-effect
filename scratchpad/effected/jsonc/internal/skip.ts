// The single iterative bracket-balance skip, shared by the parser (tree/value
// depth caps), the modifier's structural navigation and the visitor's depth
// cap. Private implementation.
//
// Counting `Open*`/`Close*` bracket depth over the flat token stream skips any
// value — scalar or arbitrarily-nested collection — without recursing, so it
// cannot overflow the stack on hostile deeply-nested input. Strings tokenize
// whole, so braces inside them never affect the count. This is
// security-relevant recursion hardening: keep the single copy here so a
// boundary tweak or malformed-input guard lands everywhere at once.

import type { SyntaxKind } from "./scanner.ts";

/**
 * The token-cursor surface {@link skipBalancedValue} walks. Each call site
 * adapts its own advance discipline — the parser's error-collecting
 * `scanNext`, the visitor's raw non-emitting `scan`, the navigator's
 * trivia-ignoring closure — so the skip stays agnostic of how tokens are
 * produced or what bookkeeping advancing entails.
 */
export interface SkipCursor {
	/** Return the current token without advancing. */
	readonly getToken: () => SyntaxKind;
	/** Advance the cursor past the current token. */
	readonly advance: () => void;
	/** Start offset of the current token. */
	readonly tokenStart: () => number;
	/** Tight end offset of the current token (start + length, before trivia). */
	readonly tokenEnd: () => number;
}

/**
 * Iteratively consume the value beginning at the cursor's current token and
 * return its tight end offset (excludes trailing whitespace/comments).
 *
 * Malformed input can route a non-value token here — a value slot may actually
 * hold a container closer (e.g. `{"k":}`) or EOF. There is no value to skip:
 * the cursor is left untouched and the current start offset is returned, so an
 * edit synthesized from it spans an empty range and the caller's enclosing
 * loop still sees the closer, rather than the count decrementing past zero and
 * splicing the closer into the value range.
 *
 * Callers that skip a container at a depth cap pass the opener as the current
 * token and ignore the returned offset.
 */
export const skipBalancedValue = (cursor: SkipCursor): number => {
	const start = cursor.getToken();
	if (start === "CloseBrace" || start === "CloseBracket" || start === "EOF") {
		return cursor.tokenStart();
	}
	let level = 0;
	let end = cursor.tokenEnd();
	do {
		const t = cursor.getToken();
		if (t === "OpenBrace" || t === "OpenBracket") {
			level++;
		} else if (t === "CloseBrace" || t === "CloseBracket") {
			level--;
		}
		end = cursor.tokenEnd();
		cursor.advance();
	} while (level > 0 && cursor.getToken() !== "EOF");
	return end;
};
