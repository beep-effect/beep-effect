// Scanner-based path navigation for the modifier. Private implementation.
//
// Resolution is structural, through the scanner's tokens, rather than a
// string search that breaks on keys containing quote characters: the matching
// property's key offset is captured directly from the key token, never
// guessed from the source text. `navigate` returns a plain structural result;
// `JsoncModifier` synthesizes edits and constructs `JsoncModificationError`
// from it, so this module never imports the facade or the edit vocabulary.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { JsoncSegment } from "../JsoncNode.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";

const $I = $ScratchpadId.create("effected/jsonc/internal/navigate");

/**
 * The container kind a path segment addresses: a string key enters an object,
 * a number enters an array.
 *
 * **Example** (Guard a container kind)
 *
 * ```ts
 * import { NavigateContainer } from "@beep/scratchpad/effected/jsonc/internal/navigate"
 *
 * console.log(NavigateContainer.is.object("object")) // true
 * console.log(NavigateContainer.is.object("array")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NavigateContainer = LiteralKit(["object", "array"]).pipe(
  $I.annoteSchema("NavigateContainer", { description: "The JSONC container kind a path segment addresses." })
);

const Container = NavigateContainer;

/**
 * Structural outcomes of locating a path in the original JSONC text.
 *
 * **Details**
 *
 * - `Located`: the target exists. `keyStart` is the property key's offset (or
 *   the element's value offset in an array), `valueStart`/`valueEnd` bound the
 *   value tightly, and the comma offsets come from scanner tokens so commas
 *   inside comments are invisible.
 * - `Insert`: the target does not exist; `at` is the insertion offset,
 *   `isFirst` whether the container is empty, `depth` the path length for
 *   indentation.
 * - `Mismatch`: the value at `depth` is not the container kind the segment
 *   requires. An intermediate miss surfaces as a mismatch at the next segment.
 * - `NoOp`: the final array index can never address an element or the end of
 *   the array (a negative or fractional index the scan passed), so nothing is
 *   edited; this keeps upstream's no-edit answer for such indices.
 *
 * **Example** (Locate a property)
 *
 * ```ts
 * import { navigate, NavigateResult } from "@beep/scratchpad/effected/jsonc/internal/navigate"
 *
 * const result = navigate('{ "a": 1, "b": 2 }', ["b"])
 *
 * console.log(NavigateResult.guards.Located(result)) // true
 * console.log(NavigateResult.match(result, {
 *   Located: (r) => r.valueStart,
 *   Insert: (r) => r.at,
 *   Mismatch: (r) => r.depth,
 *   NoOp: () => -1,
 * })) // 15
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NavigateResult = S.TaggedUnion({
  Located: {
    container: Container,
    keyStart: S.Natural,
    valueStart: S.Natural,
    valueEnd: S.Natural,
    commaBefore: S.Option(S.Natural),
    commaAfter: S.Option(S.Natural),
  },
  Insert: { container: Container, at: S.Natural, isFirst: S.Boolean, depth: S.Natural },
  Mismatch: { depth: S.Natural, expected: Container },
  NoOp: {},
}).pipe(
  $I.annoteSchema("NavigateResult", {
    description:
      "Where a JSONC path resolves in the source text: a located value, an insertion point, a structural mismatch or no edit.",
  })
);

/**
 * The decoded shape of {@link NavigateResult}.
 *
 * @see {@link NavigateResult} for the runtime schema and its case helpers.
 * @category type-level
 * @since 0.0.0
 */
export type NavigateResult = typeof NavigateResult.Type;

/**
 * Resolve `path` against `text`, returning where the target is or where it
 * would be inserted.
 *
 * **Details**
 *
 * Dual: `navigate(text, path)` or `navigate(path)(text)`. The path is
 * non-empty by type; the whole-document case is handled by the caller.
 * Skipping is iterative, so hostile nesting cannot overflow the stack and no
 * depth cap is needed here.
 *
 * **Example** (Resolve an insertion point in an empty object)
 *
 * ```ts
 * import { navigate, NavigateResult } from "@beep/scratchpad/effected/jsonc/internal/navigate"
 *
 * const result = navigate("{}", ["port"])
 *
 * console.log(NavigateResult.guards.Insert(result) && result.isFirst) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const navigate: {
  (text: string, path: A.NonEmptyReadonlyArray<JsoncSegment>): NavigateResult;
  (path: A.NonEmptyReadonlyArray<JsoncSegment>): (text: string) => NavigateResult;
} = dual(2, (text: string, path: A.NonEmptyReadonlyArray<JsoncSegment>): NavigateResult => {
  const scanner = createScanner(text, true);
  let currentToken = scanner.scan();
  let depth = 0;

  // Malformed input can route a non-value token here (a value slot may hold a
  // closer, as in `{"k":}`); the skip helper leaves the cursor untouched then.
  const skipCursor: SkipCursor = {
    getToken: () => currentToken,
    advance: () => {
      currentToken = scanner.scan();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenLength: () => scanner.getTokenLength(),
  };

  const skipValue = (): number => skipBalancedValue(skipCursor);

  const located = (container: "object" | "array", keyStart: number, commaBefore: O.Option<number>): NavigateResult => {
    const valueStart = scanner.getTokenOffset();
    const valueEnd = skipValue();
    return NavigateResult.cases.Located.make({
      container,
      keyStart,
      valueStart,
      valueEnd,
      commaBefore,
      commaAfter: currentToken === "Comma" ? O.some(scanner.getTokenOffset()) : O.none(),
    });
  };

  // Walk an object's entries until `segment` is found; the cursor is left on
  // the matching value, or on the closer when the key is absent.
  const scanObject = (segment: string) => {
    currentToken = scanner.scan(); // skip {
    let lastValueEnd = scanner.getTokenOffset();
    let isFirst = true;
    let lastComma = O.none<number>();
    while (currentToken !== "CloseBrace" && currentToken !== "EOF") {
      if (!isFirst && currentToken === "Comma") {
        lastComma = O.some(scanner.getTokenOffset());
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
          return { found: O.some({ keyStart, commaBefore: lastComma }), lastValueEnd, isFirst };
        }
        lastValueEnd = skipValue();
      } else {
        currentToken = scanner.scan();
        lastValueEnd = scanner.getTokenOffset();
      }
      isFirst = false;
    }
    return { found: O.none<{ readonly keyStart: number; readonly commaBefore: O.Option<number> }>(), lastValueEnd, isFirst };
  };

  // Walk an array's elements until index `segment`; the cursor is left on the
  // matching value, or on the closer when the array is shorter.
  const scanArray = (segment: number) => {
    currentToken = scanner.scan(); // skip [
    let index = 0;
    let lastEnd = scanner.getTokenOffset();
    let lastComma = O.none<number>();
    while (currentToken !== "CloseBracket" && currentToken !== "EOF") {
      if (index > 0 && currentToken === "Comma") {
        lastComma = O.some(scanner.getTokenOffset());
        currentToken = scanner.scan();
      }
      if (index === segment) {
        return { found: true, lastEnd, index, lastComma };
      }
      lastEnd = skipValue();
      index++;
    }
    return { found: false, lastEnd, index, lastComma };
  };

  const mismatch = (segment: JsoncSegment): NavigateResult =>
    NavigateResult.cases.Mismatch.make({ depth, expected: P.isString(segment) ? "object" : "array" });

  const canEnter = (segment: JsoncSegment): boolean =>
    P.isString(segment) ? currentToken === "OpenBrace" : currentToken === "OpenBracket";

  // Intermediate segments only need to position the cursor on the next value.
  // A miss leaves the cursor on the closer, which the next segment reports.
  for (const segment of A.initNonEmpty(path)) {
    depth++;
    if (!canEnter(segment)) {
      return mismatch(segment);
    }
    if (P.isString(segment)) {
      scanObject(segment);
    } else {
      scanArray(segment);
    }
  }

  const last = A.lastNonEmpty(path);
  depth++;
  if (!canEnter(last)) {
    return mismatch(last);
  }
  if (P.isString(last)) {
    const { found, lastValueEnd, isFirst } = scanObject(last);
    return O.match(found, {
      onSome: ({ keyStart, commaBefore }) => located("object", keyStart, commaBefore),
      onNone: () => NavigateResult.cases.Insert.make({ container: "object", at: lastValueEnd, isFirst, depth }),
    });
  }
  const { found, lastEnd, index, lastComma } = scanArray(last);
  if (found) {
    return located("array", scanner.getTokenOffset(), lastComma);
  }
  // Upstream inserts only while the scanned length has not passed the index;
  // a negative or fractional index the scan passed resolves to no edit.
  return index <= last
    ? NavigateResult.cases.Insert.make({ container: "array", at: lastEnd, isFirst: index === 0, depth })
    : NavigateResult.cases.NoOp.make({});
});
