// The single iterative bracket-balance skip, shared by the parser (depth caps),
// the modifier's structural navigation and the visitor's depth cap.
//
// Counting opener/closer depth over the flat token stream skips any value
// without recursing, so hostile nesting cannot overflow the stack. Strings
// tokenize whole, so brackets inside them never affect the count.

import * as S from "effect/Schema";
import { SyntaxKind } from "./scanner.ts";

/**
 * The token-cursor contract {@link skipBalancedValue} walks.
 *
 * **Details**
 *
 * Each call site adapts its own advance discipline: the parser's
 * error-collecting `scanNext`, the visitor's raw non-emitting `scan`, the
 * navigator's trivia-ignoring closure. The skip stays agnostic of how tokens
 * are produced or what bookkeeping advancing entails.
 *
 * @category services
 * @since 0.0.0
 */
export interface SkipCursor {
  /** Return the current token without advancing. */
  readonly getToken: () => SyntaxKind;
  /** Advance the cursor past the current token. */
  readonly advance: () => void;
  /** Start offset of the current token. */
  readonly tokenStart: () => number;
  /** Character length of the current token, before any trailing trivia. */
  readonly tokenLength: () => number;
}

const isOpener = S.is(SyntaxKind.pick(["OpenBrace", "OpenBracket"]));
const isCloser = S.is(SyntaxKind.pick(["CloseBrace", "CloseBracket"]));
const isNotAValue = S.is(SyntaxKind.pick(["CloseBrace", "CloseBracket", "EOF"]));

const tokenEnd = (cursor: SkipCursor): number => cursor.tokenStart() + cursor.tokenLength();

/**
 * Iteratively consume the value beginning at the cursor's current token and
 * return its tight end offset (excluding trailing whitespace and comments).
 *
 * **Details**
 *
 * Malformed input can route a non-value token here: a value slot may hold a
 * container closer (`{"k":}`) or EOF. There is no value to skip, so the cursor
 * is left untouched and the current start offset is returned. An edit
 * synthesized from it spans an empty range and the caller's enclosing loop
 * still sees the closer.
 *
 * **Gotchas**
 *
 * Callers that skip a container at a depth cap pass the opener as the current
 * token and ignore the returned offset.
 *
 * **Example** (Skip a nested value through a hand-built cursor)
 *
 * ```ts
 * import { createScanner } from "@beep/scratchpad/effected/jsonc/internal/scanner"
 * import { skipBalancedValue } from "@beep/scratchpad/effected/jsonc/internal/skip"
 *
 * const text = '[1, {"a": [2]}, 3]'
 * const scanner = createScanner(text, true)
 * scanner.scan() // [
 * scanner.scan() // 1
 * scanner.scan() // ,
 * scanner.scan() // { — the value to skip
 *
 * const end = skipBalancedValue({
 *   getToken: () => scanner.getToken(),
 *   advance: () => {
 *     scanner.scan()
 *   },
 *   tokenStart: () => scanner.getTokenOffset(),
 *   tokenLength: () => scanner.getTokenLength(),
 * })
 *
 * console.log(text.slice(4, end)) // '{"a": [2]}'
 * console.log(scanner.getToken()) // "Comma"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const skipBalancedValue = (cursor: SkipCursor): number => {
  if (isNotAValue(cursor.getToken())) {
    return cursor.tokenStart();
  }
  let level = 0;
  let end = tokenEnd(cursor);
  do {
    const t = cursor.getToken();
    if (isOpener(t)) {
      level++;
    } else if (isCloser(t)) {
      level--;
    }
    end = tokenEnd(cursor);
    cursor.advance();
  } while (level > 0 && cursor.getToken() !== "EOF");
  return end;
};
