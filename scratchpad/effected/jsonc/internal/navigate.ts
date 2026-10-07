// Scanner-based path navigation for the modifier. Private implementation.
//
// Resolution is structural, through the scanner's tokens, rather than a
// string search that breaks on keys containing quote characters: the matching
// property's key offset is captured directly from the key token, never
// guessed from the source text. `navigate` returns a plain structural result;
// `JsoncModifier` synthesizes edits and constructs `JsoncModificationError`
// from it, so this module never imports the facade or the edit vocabulary.

import type { JsoncPath } from "../JsoncNode.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { dual } from "effect/Function";

/** Structural outcomes of locating a value in the original JSONC text. */
export const NavigateResult = S.TaggedUnion({
  Located: {
    container: S.Literals(["object", "array"]),
    keyStart: S.Int, valueStart: S.Int, valueEnd: S.Int,
    commaBefore: S.Option(S.Int), commaAfter: S.Option(S.Int),
  },
  Insert: { container: S.Literals(["object", "array"]), at: S.Int, isFirst: S.Boolean, depth: S.Int },
  Mismatch: { depth: S.Int, expected: S.Literals(["object", "array"]) },
  NoOp: {},
});
export type NavigateResult = typeof NavigateResult.Type;

/**
 * Resolve `path` against `text`, returning where the target is (or where it
 * would be inserted). `path` must be non-empty — the whole-document case is
 * handled by the caller.
 */
export const navigate: {
  (text: string, path: JsoncPath): NavigateResult;
  (path: JsoncPath): (text: string) => NavigateResult
} = dual(2, (text: string, path: JsoncPath): NavigateResult => {
  if (path.length === 0) {
    return NavigateResult.cases.NoOp.make({});
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
    if (P.isString(segment)) {
      if (currentToken !== "OpenBrace") {
        return NavigateResult.cases.Mismatch.make({ depth, expected: "object" });
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
              return NavigateResult.cases.Located.make({
                container: "object",
                keyStart,
                valueStart,
                valueEnd,
                commaBefore: O.fromUndefinedOr(lastComma),
                commaAfter: O.fromUndefinedOr(commaAfter),
              });
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
        return NavigateResult.cases.Insert.make({
          container: "object",
          at: lastValueEnd,
          isFirst,
          depth,
        });
      }
      // Intermediate miss: fall through to the next segment, where the
      // closing brace token will fail the OpenBrace/OpenBracket check.
    } else {
      if (currentToken !== "OpenBracket") {
        return NavigateResult.cases.Mismatch.make({ depth, expected: "array" });
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
            return NavigateResult.cases.Located.make({
              container: "array",
              keyStart: valueStart,
              valueStart,
              valueEnd,
              commaBefore: O.fromUndefinedOr(lastComma),
              commaAfter: O.fromUndefinedOr(commaAfter),
            });
          }
          break; // descend into this element on the next segment
        }
        lastEnd = skipValue();
        idx++;
      }

      if (idx <= segment && depth === path.length) {
        return NavigateResult.cases.Insert.make({
          container: "array",
          at: lastEnd,
          isFirst: idx === 0,
          depth,
        });
      }
    }
  }

  return NavigateResult.cases.NoOp.make({});
});
