/**
 * Iterative bracket-balance skip shared by the parser, navigator and visitor.
 *
 * Counting `Open*`/`Close*` bracket depth over the flat token stream skips any
 * value — scalar or arbitrarily-nested collection — without recursing, so it
 * cannot overflow the stack on hostile deeply-nested input. Strings tokenize
 * whole, so braces inside them never affect the count. This is
 * security-relevant recursion hardening: keep the single copy here so a
 * boundary tweak or malformed-input guard lands everywhere at once.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { SyntaxKind } from "./scanner.ts";

/**
 * The token-cursor surface {@link skipBalancedValue} walks. Each call site
 * adapts its own advance discipline — the parser's error-collecting
 * `scanNext`, the visitor's raw non-emitting `scan`, the navigator's
 * trivia-ignoring closure — so the skip stays agnostic of how tokens are
 * produced or what bookkeeping advancing entails.
 *
 * @see {@link skipBalancedValue} for the iterative skip that consumes this cursor.
 * @internal
 * @category type-level
 * @since 0.0.0
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
 *
 * **Example** (Empty-range closer stays put)
 *
 * ```ts
 * import { createScanner } from "../../../jsonc/internal/scanner.ts";
 * import { skipBalancedValue } from "../../../jsonc/internal/skip.ts";
 *
 * const scanner = createScanner("}");
 * scanner.scan();
 * const start = scanner.getTokenOffset();
 * const end = skipBalancedValue({
 *   getToken: () => scanner.getToken(),
 *   advance: () => {
 *     scanner.scan();
 *   },
 *   tokenStart: () => scanner.getTokenOffset(),
 *   tokenEnd: () => scanner.getTokenOffset() + scanner.getTokenLength(),
 * });
 *
 * console.log(end === start); // true
 * console.log(scanner.getToken() === "CloseBrace"); // true
 * ```
 *
 * @see {@link SkipCursor} for the adapter each call site must provide.
 * @internal
 * @category utilities
 * @since 0.0.0
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
